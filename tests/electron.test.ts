import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import type { FSWatcher } from "node:fs";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createLineReader,
  fetchProjects,
  isExternalUrl,
  isOwnUrl,
  type Listed,
  needsRestart,
  notices,
  readyLoadTarget,
  refreshState,
  RetryScheduler,
  routeFor,
  serverUrl,
  shouldClearFailed,
  summary,
} from "../electron/logic.ts";
import { trayBitmap } from "../electron/icon.ts";
import { answers, type State, StudioServer } from "../electron/server.ts";

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  kills: Array<NodeJS.Signals | number | undefined> = [];
  autoExitOnKill = true;
  killDelayMs = 0;

  kill(signal?: NodeJS.Signals | number) {
    this.kills.push(signal);
    if (this.autoExitOnKill && this.exitCode === null && this.signalCode === null) {
      const sig = typeof signal === "string" ? signal : "SIGTERM";
      if (this.killDelayMs > 0) {
        setTimeout(() => this.die(null, sig), this.killDelayMs);
      } else {
        queueMicrotask(() => this.die(null, sig));
      }
    }
    return true;
  }

  die(code: number | null, signal: NodeJS.Signals | null = null) {
    if (this.exitCode !== null || this.signalCode !== null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.stdout.end();
    this.stderr.end();
    this.emit("exit", code, signal);
  }
}

class FakeWatcher extends EventEmitter {
  closed = false;
  close() {
    this.closed = true;
  }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const reel = (slug: string, status: Listed["status"], approvedAt: string | null = null): Listed => ({
  slug,
  title: slug.toUpperCase(),
  status,
  approval: { state: approvedAt ? "approved" : "draft", at: approvedAt },
});

describe("the desktop app", () => {
  it("restarts the server for its own code, not for the editor or the data", () => {
    for (const f of ["engine/resolve.ts", "media/approve.ts", "server/index.ts", "styles/cards.ts", "effects/clean/Clean.tsx", "cli.ts", "package.json"]) expect(needsRestart(f), f).toBe(true);
    for (const f of ["app/Editor.tsx", "projects/a1-reel-1/edit.json", "library/broll/index.json", "tests/clean.test.ts", "docs/RULES.md", "engine/README.md", "electron/main.ts", "styles/library.json"])
      expect(needsRestart(f), f).toBe(false);
  });

  it("reads the server's address from its first line", () => {
    expect(serverUrl("Studio is running at http://localhost:4748")).toBe("http://localhost:4748");
    expect(serverUrl("vite ready")).toBeNull();
  });

  it("opens studio:// links on the editor's pages", () => {
    expect(routeFor("studio://p/a1-reel-1")).toBe("#/p/a1-reel-1");
    expect(routeFor("studio://p/a1-reel-1/review")).toBe("#/p/a1-reel-1/review");
    expect(routeFor("studio:///p/a1-reel-1/")).toBe("#/p/a1-reel-1");
    expect(routeFor("studio://gallery")).toBe("#/gallery");
    expect(routeFor("studio://")).toBe("#/");
    expect(routeFor("studio://p/../etc")).toBeNull();
    expect(routeFor("https://example.com")).toBeNull();
  });

  it("tells Owain when an import or export finishes, or anything fails, and nothing else", () => {
    const running = (stage: string) => ({ stage, done: false, at: "t1" });
    const before = [reel("a", running("Transcribing")), reel("b", running("Rendering 40%")), reel("c", running("Mixing")), reel("d", running("QC"))];
    const after = [
      reel("a", { stage: "Ready", done: true, at: "t2" }),
      reel("b", { stage: "Render failed", done: true, error: "\nQC found 2 errors: shot 3 runs off the frame\nmore", at: "t2" }),
      reel("c", { stage: "Mixed", done: true, at: "t2" }),
      reel("d", { stage: "Checked", done: true, at: "t2" }),
    ];
    expect(notices(before, after)).toEqual([
      { title: "Import ready", body: "A", route: "#/p/a" },
      { title: "B: Render failed", body: "QC found 2 errors: shot 3 runs off the frame", route: "#/p/b" },
    ]);
  });

  it("stays quiet about what had already finished, and about projects it had not seen", () => {
    const done = { stage: "Rendered", done: true, at: "t1" };
    expect(notices([reel("a", done)], [reel("a", done)])).toEqual([]);
    expect(notices([], [reel("a", done)])).toEqual([]);
    // The same stage again, later: a second export.
    expect(notices([reel("a", done)], [reel("a", { ...done, at: "t2" })])).toEqual([{ title: "Export finished", body: "A", route: "#/p/a" }]);
  });

  it("lists what is running and the week's approvals in the menu bar", () => {
    const now = Date.parse("2026-11-13T12:00:00");
    const s = summary(
      [reel("a", { stage: "Rendering 40%", done: false }), reel("b", null, "2026-11-12T10:00:00.000Z"), reel("c", null, "2026-11-01T10:00:00.000Z")],
      ["b"],
      now,
    );
    expect(s.working).toEqual([
      { slug: "a", label: "A: Rendering 40%" },
      { slug: "b", label: "B: Claude is working" },
    ]);
    expect(s.week).toBe("This week: 1 of 7 approved");
  });

  it("draws the menu bar icon as a template image with soft edges", () => {
    const { buffer, width, height } = trayBitmap();
    expect([width, height]).toEqual([36, 36]);
    const alpha = [...Array(width * height).keys()].map((i) => buffer[i * 4 + 3]);
    expect(alpha.some((a) => a === 255)).toBe(true);
    expect(alpha.some((a) => a > 0 && a < 255)).toBe(true);
    expect(alpha[0]).toBe(0);
    for (let i = 0; i < width * height; i++) expect(buffer[i * 4] + buffer[i * 4 + 1] + buffer[i * 4 + 2]).toBe(0);
  });

  it("checks own URLs by origin, not string prefix, and restricts external URLs to http/https", () => {
    expect(isOwnUrl("http://localhost:4747/", "http://localhost:4747")).toBe(true);
    expect(isOwnUrl("http://localhost:4747/#/p/reel-1", "http://localhost:4747")).toBe(true);
    expect(isOwnUrl("http://localhost:47470/", "http://localhost:4747")).toBe(false);
    expect(isOwnUrl("http://localhost:4747.evil.com/", "http://localhost:4747")).toBe(false);
    expect(isOwnUrl("https://localhost:4747/", "http://localhost:4747")).toBe(false);
    expect(isOwnUrl("chrome-error://chromewebdata/", "http://localhost:4747")).toBe(false);
    expect(isOwnUrl("data:text/html,<h1>Hi</h1>", "http://localhost:4747")).toBe(false);
    expect(isOwnUrl("not a url", "http://localhost:4747")).toBe(false);
    expect(isOwnUrl("http://localhost:4747/", null)).toBe(false);

    expect(isExternalUrl("https://example.com/docs")).toBe(true);
    expect(isExternalUrl("http://example.com")).toBe(true);
    expect(isExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isExternalUrl("data:text/html,hi")).toBe(false);
    expect(isExternalUrl("studio://p/a")).toBe(false);
    expect(isExternalUrl("smb://server/share")).toBe(false);
    expect(isExternalUrl("not-a-url")).toBe(false);
  });

  it("only clears failed state on a healthy load from the server origin", () => {
    expect(shouldClearFailed("chrome-error://chromewebdata/", "http://localhost:4747", -1)).toBe(false);
    expect(shouldClearFailed("data:text/html;charset=utf-8,Starting", "http://localhost:4747", -1)).toBe(false);
    expect(shouldClearFailed("about:blank", "http://localhost:4747", null)).toBe(false);
    expect(shouldClearFailed("http://localhost:4747/", "http://localhost:4747", 500)).toBe(false);
    expect(shouldClearFailed("http://localhost:4747/", "http://localhost:4747", 502)).toBe(false);
    expect(shouldClearFailed("http://localhost:4747/", "http://localhost:4747", 200)).toBe(true);
    expect(shouldClearFailed("http://localhost:4747/#/p/a", "http://localhost:4747", null)).toBe(true);
  });

  it("backs off, deduplicates, caps, and cleans up load retries", async () => {
    vi.useFakeTimers();
    try {
      const retries: Array<{ url: string; attempt: number }> = [];
      const exhausted: string[] = [];
      const r = new RetryScheduler({
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 300,
        onRetry: (url, attempt) => retries.push({ url, attempt }),
        onExhausted: (url) => exhausted.push(url),
      });

      // Deduplication: second schedule while pending is ignored.
      expect(r.schedule("http://localhost:4747/")).toBe(true);
      expect(r.schedule("http://localhost:4747/")).toBe(false);
      await vi.advanceTimersByTimeAsync(99);
      expect(retries).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(retries).toEqual([{ url: "http://localhost:4747/", attempt: 1 }]);

      // Attempt 2: 200ms backoff.
      expect(r.schedule("http://localhost:4747/")).toBe(true);
      await vi.advanceTimersByTimeAsync(199);
      expect(retries).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(retries).toHaveLength(2);

      // Attempt 3: capped at 300ms (not 400ms).
      expect(r.schedule("http://localhost:4747/")).toBe(true);
      await vi.advanceTimersByTimeAsync(300);
      expect(retries).toHaveLength(3);

      // Attempt 4 exceeds maxRetries -> exhausted instead of infinite loop.
      expect(r.schedule("http://localhost:4747/")).toBe(false);
      expect(exhausted).toEqual(["http://localhost:4747/"]);

      // Clear resets attempts; dispose cancels pending timer on window close.
      r.clear();
      expect(r.schedule("http://localhost:4747/#/p/a")).toBe(true);
      r.dispose();
      await vi.advanceTimersByTimeAsync(1000);
      expect(retries).toHaveLength(3);
      expect(r.failedUrl).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores HTTP 500 and non-array /api/projects responses during refresh without corrupting projects", async () => {
    const existing = [reel("a", null)];

    const r500 = await refreshState("http://localhost:4747", existing, true, {
      fetch: async () => jsonResponse({ error: "boom" }, 500),
      busy: async () => [],
    });
    expect(r500.ok).toBe(false);
    expect(r500.projects).toBe(existing);
    expect(() => summary(r500.projects, [])).not.toThrow();

    const rObj = await refreshState("http://localhost:4747", existing, true, {
      fetch: async () => jsonResponse({ projects: [] }, 200),
      busy: async () => [],
    });
    expect(rObj.ok).toBe(false);
    expect(rObj.projects).toBe(existing);

    const rHtml = await refreshState("http://localhost:4747", existing, true, {
      fetch: async () => new Response("<html>not studio</html>", { status: 200 }),
      busy: async () => [],
    });
    expect(rHtml.ok).toBe(false);
    expect(rHtml.projects).toBe(existing);

    const updated = [reel("a", { stage: "Rendered", done: true, at: "t2" })];
    const rOk = await refreshState("http://localhost:4747", existing, true, {
      fetch: async () => jsonResponse(updated, 200),
      busy: async () => ["a"],
    });
    expect(rOk.ok).toBe(true);
    expect(rOk.projects).toEqual(updated);
    expect(rOk.notes).toEqual(["a"]);
    expect(rOk.alerts).toEqual([{ title: "Export finished", body: "A", route: "#/p/a" }]);
  });

  it("verifies Studio JSON array shape in answers() and fetchProjects()", async () => {
    expect(await answers("http://localhost:4747", async () => jsonResponse([]))).toBe(true);
    expect(await answers("http://localhost:4747", async () => jsonResponse([reel("a", null)]))).toBe(true);
    expect(await answers("http://localhost:4747", async () => jsonResponse({ error: "fail" }, 500))).toBe(false);
    expect(await answers("http://localhost:4747", async () => jsonResponse({ ok: true }, 200))).toBe(false);
    expect(await answers("http://localhost:4747", async () => jsonResponse([{ id: 1 }], 200))).toBe(false);
    expect(await answers("http://localhost:4747", async () => new Response("<html>other app</html>", { status: 200 }))).toBe(false);
    expect(await fetchProjects("http://localhost:4747", async () => jsonResponse({ error: "500" }, 500))).toBeNull();
  });

  it("buffers split stdout chunks across newline boundaries before matching the server URL", async () => {
    const lines: string[] = [];
    const reader = createLineReader((l) => lines.push(l));
    reader.push("Studio is running ");
    reader.push("at http://localhost:");
    reader.push("4747\nnext");
    expect(lines).toEqual(["Studio is running at http://localhost:4747"]);
    reader.flush();
    expect(lines).toEqual(["Studio is running at http://localhost:4747", "next"]);

    const children: FakeChild[] = [];
    const srv = new StudioServer("/tmp/repo", {
      fetch: async () => new Response("nope", { status: 503 }),
      watch: () => new FakeWatcher() as unknown as FSWatcher,
      spawn: (() => {
        const c = new FakeChild();
        children.push(c);
        queueMicrotask(() => {
          c.stdout.write("Studio is running ");
          c.stderr.write("some warning\n");
          c.stdout.write("at http://localhost:4747\n");
        });
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });

    await srv.start();
    expect(srv.state).toBe("ready");
    expect(srv.url).toBe("http://localhost:4747");
    await srv.stop();
  });

  it("detects a dead attached or managed server and automatically restarts it", async () => {
    let externalAlive = true;
    const spawned: FakeChild[] = [];
    const states: Array<[State, string | null]> = [];
    const watchers: FakeWatcher[] = [];

    const srv = new StudioServer("/tmp/repo", {
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/api/projects")) {
          if (externalAlive) return jsonResponse([]);
          throw new Error("ECONNREFUSED");
        }
        return jsonResponse({ notes: [] });
      },
      watch: () => {
        const w = new FakeWatcher();
        watchers.push(w);
        return w as unknown as FSWatcher;
      },
      spawn: (() => {
        const c = new FakeChild();
        spawned.push(c);
        queueMicrotask(() => {
          externalAlive = true;
          c.stdout.write("Studio is running at http://localhost:4747\n");
        });
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });
    srv.on("state", (s: State, u: string | null) => states.push([s, u]));

    // Starts attached to existing external server.
    await srv.start();
    expect(srv.mode).toBe("attached");
    expect(srv.state).toBe("ready");
    expect(spawned).toHaveLength(0);

    // Healthy check keeps it attached and spawns nothing.
    expect(await srv.ensureAlive()).toBe(true);
    expect(spawned).toHaveLength(0);

    // External server dies -> transitions out of ready, switches to own, spawns & recovers.
    externalAlive = false;
    const [a, b] = await Promise.all([srv.ensureAlive(), srv.ensureAlive()]);
    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(srv.mode).toBe("own");
    expect(srv.state).toBe("ready");
    expect(spawned).toHaveLength(1);
    expect(watchers).toHaveLength(1);
    expect(states).toContainEqual(["starting", null]);

    // Managed server stops answering silently -> kills old child and spawns a fresh one.
    externalAlive = false;
    expect(await srv.ensureAlive()).toBe(false);
    expect(spawned).toHaveLength(2);
    expect(spawned[0].kills.length).toBeGreaterThan(0);
    expect(srv.state).toBe("ready");
    await srv.stop();
  });

  it("restarts an unexpectedly killed managed child with backoff and stops after repeated crashes", async () => {
    const spawned: FakeChild[] = [];
    const states: Array<[State, string | null]> = [];

    const srv = new StudioServer("/tmp/repo", {
      crashBackoffMs: 25,
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
      watch: () => new FakeWatcher() as unknown as FSWatcher,
      spawn: (() => {
        const c = new FakeChild();
        spawned.push(c);
        queueMicrotask(() => c.stdout.write("Studio is running at http://localhost:4747\n"));
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });
    srv.on("state", (s: State, u: string | null) => states.push([s, u]));

    await srv.start();
    expect(srv.state).toBe("ready");
    expect(spawned).toHaveLength(1);

    // Crash 1 (by signal): transitions out of ready to starting(null), then restarts after backoff.
    spawned[0].die(null, "SIGKILL");
    expect(srv.state).toBe("starting");
    expect(srv.url).toBeNull();
    expect(spawned).toHaveLength(1); // hasn't spawned immediately without backoff

    await new Promise<void>((ok) => srv.once("state", (s: State) => s === "ready" && ok()));
    expect(spawned).toHaveLength(2);

    // Crash 2: restarts after 2x backoff.
    spawned[1].die(1, null);
    expect(srv.state).toBe("starting");
    await new Promise<void>((ok) => srv.once("state", (s: State) => s === "ready" && ok()));
    expect(spawned).toHaveLength(3);

    // Crash 3 within 60s -> transitions to failed.
    spawned[2].die(1, null);
    expect(srv.state).toBe("failed");
    await srv.stop();

    // Calling stop() during crash backoff must cancel the pending restart and spawn nothing.
    const spawned2: FakeChild[] = [];
    const srv2 = new StudioServer("/tmp/repo", {
      crashBackoffMs: 40,
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
      watch: () => new FakeWatcher() as unknown as FSWatcher,
      spawn: (() => {
        const c = new FakeChild();
        spawned2.push(c);
        queueMicrotask(() => c.stdout.write("Studio is running at http://localhost:4747\n"));
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });
    await srv2.start();
    spawned2[0].die(1, null);
    expect(srv2.state).toBe("starting");
    await srv2.stop();
    await new Promise((r) => setTimeout(r, 70));
    expect(srv2.state).toBe("stopped");
    expect(spawned2).toHaveLength(1);
  });

  it("serializes concurrent restart() calls and prevents stop() from resurrecting an orphaned server", async () => {
    let busyNotes = ["reel-1"];
    const spawned: FakeChild[] = [];
    let activeChildren = 0;
    let maxConcurrentChildren = 0;

    const srv = new StudioServer("/tmp/repo", {
      idlePollMs: 15,
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/api/busy")) return jsonResponse({ notes: busyNotes });
        throw new Error("ECONNREFUSED");
      },
      watch: () => new FakeWatcher() as unknown as FSWatcher,
      spawn: (() => {
        const c = new FakeChild();
        spawned.push(c);
        activeChildren++;
        maxConcurrentChildren = Math.max(maxConcurrentChildren, activeChildren);
        c.once("exit", () => activeChildren--);
        setTimeout(() => {
          if (c.exitCode === null && c.signalCode === null) {
            c.stdout.write("Studio is running at http://localhost:4747\n");
          }
        }, 15);
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });

    await srv.start();
    expect(spawned).toHaveLength(1);

    // Two overlapping restarts while idle() is waiting -> coalesce into ONE spawn.
    const r1 = srv.restart("file A changed");
    const r2 = srv.restart("file B changed");
    await new Promise((r) => setTimeout(r, 25));
    busyNotes = [];
    await Promise.all([r1, r2]);
    expect(spawned).toHaveLength(2);
    expect(maxConcurrentChildren).toBe(1);

    // Overlapping restarts while spawn() is already in progress run sequentially, never concurrently.
    const rMid1 = srv.restart("file C changed");
    await new Promise((r) => setTimeout(r, 5));
    const rMid2 = srv.restart("file D changed");
    await Promise.all([rMid1, rMid2]);
    expect(maxConcurrentChildren).toBe(1);
    expect(srv.state).toBe("ready");
    const countBeforeStop = spawned.length;

    // Calling stop() while restart() is blocked in idle() must NOT spawn an orphaned server.
    busyNotes = ["reel-2"];
    const r3 = srv.restart("file E changed");
    await new Promise((r) => setTimeout(r, 25));
    await srv.stop();
    await r3;
    expect(srv.state).toBe("stopped");
    expect(spawned).toHaveLength(countBeforeStop);
  });

  it("does not hang in stop()/kill() when the child already died by signal, and handles watcher errors", async () => {
    const watcher = new FakeWatcher();
    const spawned: FakeChild[] = [];
    const srv = new StudioServer("/tmp/repo", {
      killGraceMs: 5000,
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
      watch: () => watcher as unknown as FSWatcher,
      spawn: (() => {
        const c = new FakeChild();
        spawned.push(c);
        queueMicrotask(() => c.stdout.write("Studio is running at http://localhost:4747\n"));
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });

    await srv.start();
    // Watcher error must not throw uncaught exception.
    expect(() => watcher.emit("error", new Error("EMFILE"))).not.toThrow();

    // Simulate child killed externally by signal without firing exit handler yet (signalCode set, exitCode null).
    const child = spawned[0];
    child.signalCode = "SIGKILL";
    child.autoExitOnKill = false;

    const start = Date.now();
    await srv.stop();
    expect(Date.now() - start).toBeLessThan(500);
    expect(watcher.closed).toBe(true);
  });

  it("serializes ensureAlive() with restart() waiting in idle() without spawning duplicate servers or hanging", async () => {
    let projectsAlive = false;
    const spawned: FakeChild[] = [];
    let activeChildren = 0;
    let maxConcurrentChildren = 0;

    const srv = new StudioServer("/tmp/repo", {
      idlePollMs: 5000,
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/api/busy")) return jsonResponse({ notes: ["reel-1"] });
        if (url.endsWith("/api/projects")) {
          if (projectsAlive) return jsonResponse([]);
          throw new Error("ECONNREFUSED");
        }
        throw new Error("unexpected");
      },
      watch: () => new FakeWatcher() as unknown as FSWatcher,
      spawn: (() => {
        const c = new FakeChild();
        c.killDelayMs = 20;
        spawned.push(c);
        activeChildren++;
        maxConcurrentChildren = Math.max(maxConcurrentChildren, activeChildren);
        c.once("exit", () => activeChildren--);
        setTimeout(() => {
          if (c.exitCode === null && c.signalCode === null) {
            projectsAlive = true;
            c.stdout.write("Studio is running at http://localhost:4747\n");
          }
        }, 15);
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });

    await srv.start();
    expect(srv.state).toBe("ready");
    expect(spawned).toHaveLength(1);

    // Start a restart that blocks in idle() waiting for Claude notes.
    const restarting = srv.restart("server/index.ts changed");
    await new Promise((r) => setTimeout(r, 15));
    expect(srv.state).toBe("ready");

    // Server stops answering /api/projects while restart() is in idle().
    projectsAlive = false;
    const alive = await srv.ensureAlive();
    await restarting;

    expect(alive).toBe(false);
    expect(srv.state).toBe("ready");
    expect(spawned).toHaveLength(2);
    expect(maxConcurrentChildren).toBe(1);
    expect(activeChildren).toBe(1);
    // Ensure this.checking was released and subsequent health checks succeed.
    expect(await srv.ensureAlive()).toBe(true);

    await srv.stop();
    expect(activeChildren).toBe(0);
  });

  it("does not spawn an orphaned server when the child crashes while restart() is waiting in idle()", async () => {
    const spawned: FakeChild[] = [];
    let activeChildren = 0;
    let maxConcurrentChildren = 0;

    const srv = new StudioServer("/tmp/repo", {
      crashBackoffMs: 25,
      idlePollMs: 5000,
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/api/busy")) return jsonResponse({ notes: ["reel-1"] });
        throw new Error("ECONNREFUSED");
      },
      watch: () => new FakeWatcher() as unknown as FSWatcher,
      spawn: (() => {
        const c = new FakeChild();
        spawned.push(c);
        activeChildren++;
        maxConcurrentChildren = Math.max(maxConcurrentChildren, activeChildren);
        c.once("exit", () => activeChildren--);
        setTimeout(() => {
          if (c.exitCode === null && c.signalCode === null) {
            c.stdout.write("Studio is running at http://localhost:4747\n");
          }
        }, 10);
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });

    await srv.start();
    expect(spawned).toHaveLength(1);

    // Begin restart that blocks in idle().
    const restarting = srv.restart("server/index.ts changed");
    await new Promise((r) => setTimeout(r, 15));

    // Managed child crashes unexpectedly during idle().
    spawned[0].die(1, null);
    await restarting;

    // Wait well past crashBackoffMs to prove no crashTimer fires and leaks a second server.
    await new Promise((r) => setTimeout(r, 80));
    expect(srv.state).toBe("ready");
    expect(spawned).toHaveLength(2);
    expect(maxConcurrentChildren).toBe(1);
    expect(activeChildren).toBe(1);

    await srv.stop();
    expect(activeChildren).toBe(0);
  });

  it("restarts a stopped managed server on retry() and still aborts if stop() interrupts kill()", async () => {
    const spawned: FakeChild[] = [];
    const watchers: FakeWatcher[] = [];
    const srv = new StudioServer("/tmp/repo", {
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
      watch: () => {
        const w = new FakeWatcher();
        watchers.push(w);
        return w as unknown as FSWatcher;
      },
      spawn: (() => {
        const c = new FakeChild();
        spawned.push(c);
        queueMicrotask(() => c.stdout.write("Studio is running at http://localhost:4747\n"));
        return c as unknown as ChildProcess;
      }) as typeof import("node:child_process").spawn,
    });

    await srv.start();
    expect(srv.mode).toBe("own");
    expect(srv.state).toBe("ready");
    expect(spawned).toHaveLength(1);

    await srv.stop();
    expect(srv.state).toBe("stopped");
    expect(srv.mode).toBe("own");
    expect(watchers[0].closed).toBe(true);

    // retry() from state === "stopped" && mode === "own" must spawn and recover.
    await srv.retry();
    expect(srv.state).toBe("ready");
    expect(srv.url).toBe("http://localhost:4747");
    expect(spawned).toHaveLength(2);
    expect(watchers).toHaveLength(2);

    // Calling stop() while retry() is awaiting an async kill() must not spawn a new server.
    spawned[1].killDelayMs = 25;
    const retrying = srv.retry();
    await new Promise((r) => setTimeout(r, 5));
    await srv.stop();
    await retrying;
    expect(srv.state).toBe("stopped");
    expect(spawned).toHaveLength(2);
  });

  it("preserves failedUrl across an exhausted-retry restart so readyLoadTarget reloads the editor", async () => {
    vi.useFakeTimers();
    try {
      const r = new RetryScheduler({
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 500,
        onRetry: () => {},
        onExhausted: (url) => {
          r.resetForRestart(url);
        },
      });

      const badUrl = "http://localhost:4747/#/p/reel-1";
      expect(r.schedule(badUrl)).toBe(true);
      await vi.advanceTimersByTimeAsync(100);
      expect(r.schedule(badUrl)).toBe(true);
      await vi.advanceTimersByTimeAsync(200);
      // 3rd failure exhausts retries and triggers resetForRestart(url).
      expect(r.schedule(badUrl)).toBe(false);
      expect(r.attempts).toBe(0);
      expect(r.failedUrl).toBe(badUrl);

      // Even if the window is still on server.url's origin (e.g. HTTP 500 or unmounted #root),
      // render() reloads the editor once the server returns to "ready".
      expect(
        readyLoadTarget({
          serverUrl: "http://localhost:4747",
          currentUrl: badUrl,
          wanted: null,
          failedUrl: r.retryNow(),
        }),
      ).toEqual({ target: badUrl, clearWanted: true });

      // If the restarted server came up on a different port, keep the hash route.
      expect(
        readyLoadTarget({
          serverUrl: "http://localhost:4748",
          currentUrl: badUrl,
          wanted: null,
          failedUrl: r.retryNow(),
        }),
      ).toEqual({ target: "http://localhost:4748/#/p/reel-1", clearWanted: true });

      // Normal code-change restart with no load failure leaves the live editor alone.
      expect(
        readyLoadTarget({
          serverUrl: "http://localhost:4747",
          currentUrl: badUrl,
          wanted: null,
          failedUrl: null,
        }),
      ).toEqual({ target: null, clearWanted: false });
    } finally {
      vi.useRealTimers();
    }
  });
});
