// The desktop app's Studio server: one `cli.ts serve` run from the repo on the system's Node, the
// same process the CLI and the tests use. It is restarted when its own code changes, but never while
// Claude is working on a note (a note runs inside the server; imports and renders are detached and
// survive). If a Studio server is already answering on the port, the app uses that one instead of
// starting a second, which would save every plan change twice.
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { type FSWatcher, watch } from "node:fs";
import { createLineReader, fetchProjects, needsRestart, serverUrl } from "./logic.ts";

export type State = "starting" | "ready" | "restarting" | "failed" | "stopped";

export type StudioServerOptions = {
  port?: number;
  spawn?: typeof spawn;
  watch?: typeof watch;
  fetch?: typeof fetch;
  crashBackoffMs?: number;
  idlePollMs?: number;
  killGraceMs?: number;
  watchDebounceMs?: number;
};

const PORT = 4747;
const LOG_LINES = 200;

export class StudioServer extends EventEmitter {
  readonly repo: string;
  state: State = "stopped";
  url: string | null = null;
  // "own": started here, restarted on code changes. "attached": started elsewhere, used as it is.
  mode: "own" | "attached" | null = null;
  log: string[] = [];
  private child: ChildProcess | null = null;
  private killing: ChildProcess | null = null;
  private env: NodeJS.ProcessEnv = process.env;
  private watcher: FSWatcher | null = null;
  private pending: NodeJS.Timeout | null = null;
  private crashTimer: NodeJS.Timeout | null = null;
  private idleAbort: AbortController | null = null;
  private crashes: number[] = [];
  private stopping = false;
  private activeTransition: Promise<void> | null = null;
  private restartPhase: "idle" | "waiting" | "spawning" = "idle";
  private pendingRestartReason: string | null = null;
  private checking: Promise<boolean> | null = null;
  private readonly port: number;
  private readonly spawnImpl: typeof spawn;
  private readonly watchImpl: typeof watch;
  private readonly fetchImpl: typeof fetch;
  private readonly crashBackoffMs: number;
  private readonly idlePollMs: number;
  private readonly killGraceMs: number;
  private readonly watchDebounceMs: number;

  constructor(repo: string, opts: StudioServerOptions = {}) {
    super();
    this.repo = repo;
    this.port = opts.port ?? PORT;
    this.spawnImpl = opts.spawn ?? spawn;
    this.watchImpl = opts.watch ?? watch;
    this.fetchImpl = opts.fetch ?? fetch;
    this.crashBackoffMs = opts.crashBackoffMs ?? 1000;
    this.idlePollMs = opts.idlePollMs ?? 2000;
    this.killGraceMs = opts.killGraceMs ?? 5000;
    this.watchDebounceMs = opts.watchDebounceMs ?? 600;
  }

  async start(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
    this.stopping = false;
    this.clearCrashTimer();
    const running = `http://localhost:${this.port}`;
    if (await answers(running, this.fetchImpl)) {
      if (this.stopping) return;
      this.mode = "attached";
      this.note(`Using the Studio server already running at ${running}.`);
      return this.set("ready", running);
    }
    if (this.stopping) return;
    this.mode = "own";
    this.watchCode();
    await this.runTransition(() => this.spawn());
  }

  // Verify the server actually responds with valid Studio JSON on /api/projects.
  // If dead (whether managed or previously attached), transition out of "ready",
  // take ownership if needed, and restart cleanly.
  async ensureAlive(): Promise<boolean> {
    if (this.checking) return this.checking;
    const run = async (): Promise<boolean> => {
      if (this.stopping || this.state !== "ready" || !this.url) return false;
      const ok = await answers(this.url, this.fetchImpl);
      if (ok) return true;
      if (this.stopping || this.state !== "ready") return false;
      const wasAttached = this.mode === "attached";
      await this.runTransition(async () => {
        if (this.isStopped() || this.state !== "ready") return;
        this.clearCrashTimer();
        this.note(wasAttached ? "The external Studio server stopped answering; starting Studio's server." : "The Studio server stopped answering; restarting.");
        this.mode = "own";
        this.watchCode();
        this.set("starting", null);
        await this.kill();
        if (this.isStopped()) return;
        await this.spawn();
      });
      return false;
    };
    this.checking = run().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  // Restart now (from the menu), or after a code change once nothing would be cut off.
  // Concurrent calls are serialized/coalesced so two servers are never spawned at once.
  async restart(reason = "Restarting") {
    if (this.isStopped() || this.mode !== "own") return;
    if (this.activeTransition) {
      if (this.restartPhase !== "waiting") this.pendingRestartReason = reason;
      return this.activeTransition;
    }
    return this.runTransition(async () => {
      let nextReason: string | null = reason;
      while (nextReason !== null) {
        const currentReason = nextReason;
        nextReason = null;
        this.pendingRestartReason = null;
        if (this.isStopped() || this.mode !== "own") break;
        this.clearCrashTimer();
        this.restartPhase = "waiting";
        await this.idle();
        if (this.isStopped()) break;
        this.note(`${currentReason}.`);
        this.set("restarting", this.url);
        await this.kill();
        if (this.isStopped()) break;
        this.restartPhase = "spawning";
        await this.spawn();
        if (this.isStopped()) break;
        nextReason = this.pendingRestartReason;
      }
    });
  }

  async stop() {
    this.stopping = true;
    this.pendingRestartReason = null;
    this.watcher?.close();
    this.watcher = null;
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    this.clearCrashTimer();
    this.idleAbort?.abort();
    // Stopped first, so the server's exit is not taken for a crash and started again.
    this.set("stopped", null);
    if (this.child) await this.kill();
  }

  // Start (or start again) after a failure.
  async retry() {
    if (this.activeTransition) await this.activeTransition;
    this.stopping = false;
    this.crashes = [];
    this.clearCrashTimer();
    if (this.mode === "attached" || this.mode === null) return this.start(this.env);
    this.watchCode();
    await this.runTransition(async () => {
      await this.kill();
      if (this.isStopped()) return;
      await this.spawn();
    });
  }

  private isStopped(): boolean {
    return this.stopping || this.state === "stopped";
  }

  private runTransition(fn: () => Promise<void>): Promise<void> {
    let p: Promise<void> | null = null;
    p = (async () => {
      try {
        await fn();
      } finally {
        this.restartPhase = "idle";
        if (this.activeTransition === p) this.activeTransition = null;
      }
      const queued = this.pendingRestartReason;
      if (queued !== null && !this.isStopped() && this.mode === "own") {
        this.pendingRestartReason = null;
        await this.restart(queued);
      }
    })();
    this.activeTransition = p;
    return p;
  }

  private clearCrashTimer() {
    if (this.crashTimer) {
      clearTimeout(this.crashTimer);
      this.crashTimer = null;
    }
  }

  private spawn(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.state !== "starting" || this.url !== null) this.set("starting", this.url);
    return new Promise((done) => {
      const child = this.spawnImpl("node", ["--import", "tsx", "cli.ts", "serve", "--port", String(this.port)], {
        cwd: this.repo,
        env: { ...this.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      let ready = false;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        done();
      };
      const onLine = (line: string) => {
        this.note(line);
        const url = serverUrl(line);
        if (url && !ready && !this.stopping && this.state !== "stopped" && this.child === child) {
          ready = true;
          this.set("ready", url);
          finish();
        }
      };
      const stdoutReader = createLineReader(onLine);
      const stderrReader = createLineReader(onLine);
      child.stdout?.on("data", (chunk: Buffer) => stdoutReader.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderrReader.push(chunk));
      // Node not found, or not runnable: no exit follows, so fail here.
      child.on("error", (e) => {
        if (this.child !== child) return;
        this.child = null;
        const missing = (e as NodeJS.ErrnoException).code === "ENOENT";
        this.note(missing ? "Node was not found on the PATH your terminal uses. Install Node, or check your shell profile sets PATH." : `Could not start the server: ${e.message}`);
        if (!this.stopping && this.state !== "stopped") this.set("failed", null);
        finish();
      });
      child.on("exit", (code, signal) => {
        stdoutReader.flush();
        stderrReader.flush();
        if (this.child !== child) return finish();
        this.child = null;
        this.note(`The server stopped (${signal ?? `exit ${code}`}).`);
        if (this.stopping || this.state === "stopped" || this.state === "restarting" || this.killing === child) return finish();
        // It died on its own: start it again with backoff, unless it keeps dying.
        const now = Date.now();
        this.crashes = [...this.crashes.filter((t) => now - t < 60_000), now];
        if (ready && this.crashes.length < 3) {
          const delay = this.crashBackoffMs * 2 ** (this.crashes.length - 1);
          this.set("starting", null);
          this.clearCrashTimer();
          this.crashTimer = setTimeout(() => {
            this.crashTimer = null;
            if (this.stopping || this.state === "stopped") return;
            void this.runTransition(() => this.spawn());
          }, delay);
        } else {
          this.set("failed", null);
        }
        finish();
      });
    });
  }

  private kill(): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      if (this.child === child) this.child = null;
      return Promise.resolve();
    }
    this.killing = child;
    return new Promise((done) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(force);
        if (this.killing === child) this.killing = null;
        if (this.child === child) this.child = null;
        done();
      };
      const force = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        if (child.exitCode !== null || child.signalCode !== null) finish();
      }, this.killGraceMs);
      child.once("exit", finish);
      try {
        child.kill("SIGTERM");
      } catch {
        finish();
      }
    });
  }

  // Watch the server's code, and restart a moment after the last change.
  private watchCode() {
    if (this.watcher) return;
    try {
      this.watcher = this.watchImpl(this.repo, { recursive: true }, (_e, file) => {
        if (!file || !needsRestart(String(file))) return;
        if (this.pending) clearTimeout(this.pending);
        this.pending = setTimeout(() => {
          this.pending = null;
          void this.restart(`${file} changed; restarting`);
        }, this.watchDebounceMs);
      });
      this.watcher.on("error", (err) => {
        this.note(`File watcher error: ${err.message}`);
      });
    } catch (err) {
      this.note(`Could not watch repository: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Wait until no Claude note is running, saying once what it waits for.
  private async idle() {
    let said = false;
    for (;;) {
      if (this.stopping || !this.url || this.state !== "ready") return;
      const notes = await busy(this.url, this.fetchImpl);
      if (this.stopping || this.state !== "ready") return;
      if (!notes.length) return;
      if (!said) this.note(`Waiting for Claude to finish (${notes.join(", ")}) before restarting.`);
      said = true;
      await this.sleep(this.idlePollMs);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const ctrl = new AbortController();
      this.idleAbort = ctrl;
      const done = () => {
        if (this.idleAbort === ctrl) this.idleAbort = null;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, ms);
      ctrl.signal.addEventListener("abort", done, { once: true });
    });
  }

  private set(state: State, url: string | null) {
    this.state = state;
    this.url = url;
    this.emit("state", state, url);
  }

  private note(line: string) {
    this.log = [...this.log, line].slice(-LOG_LINES);
    this.emit("log", line);
  }
}

// Whether a Studio server answers at `url` with valid /api/projects JSON.
export async function answers(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  return (await fetchProjects(url, fetchImpl, 1500)) !== null;
}

// The projects Claude is working on now. An older server without /api/busy counts as idle.
export async function busy(url: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  try {
    const r = await fetchImpl(`${url}/api/busy`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? (((await r.json()) as { notes?: string[] }).notes ?? []) : [];
  } catch {
    return [];
  }
}

// The PATH a terminal gets. An app opened from the Finder or at login gets only the system's,
// without Homebrew, nvm or ~/.local/bin, so `node`, `claude`, `ffmpeg` and `python3` would not be
// found. Asked once from the login shell; the app's own PATH is kept if that fails.
export function shellEnv(): Promise<NodeJS.ProcessEnv> {
  const shell = process.env.SHELL || "/bin/zsh";
  const mark = "__STUDIO_PATH__";
  return new Promise((done) => {
    execFile(shell, ["-ilc", `printf '${mark}%s${mark}' "$PATH"`], { timeout: 8000 }, (err, out) => {
      const path = String(out ?? "").split(mark)[1];
      done(err || !path ? process.env : { ...process.env, PATH: path });
    });
  });
}
