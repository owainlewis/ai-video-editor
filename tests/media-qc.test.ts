import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const openBrowserMock = vi.fn();
const viteCloseMock = vi.fn(async () => {});
const createViteMock = vi.fn(async (..._args: unknown[]) => ({
  middlewares: (_req: unknown, res: { end: () => void }) => res.end(),
  close: viteCloseMock,
}));

vi.mock("@remotion/renderer", () => ({
  openBrowser: (...args: unknown[]) => openBrowserMock(...args),
}));

vi.mock("vite", () => ({
  createServer: (...args: unknown[]) => createViteMock(...args),
}));

import { checkHook, escapeFilterValue, qcPage, runQc } from "../media/qc.ts";
import type { Resolved } from "../engine/schema.ts";

const tempDirs: string[] = [];
const makeTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  openBrowserMock.mockReset();
  viteCloseMock.mockClear();
  createViteMock.mockClear();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("qc ffmpeg filtergraph escaping", () => {
  it("escapes special characters in stats file paths for ffmpeg two-level parsing", () => {
    const raw = "/Users/owain's/proj:1/[a,b];c\\d/motion-1.txt";
    const escaped = escapeFilterValue(raw);
    expect(escaped).toBe("/Users/owain\\\\\\'s/proj\\\\:1/\\[a\\,b\\]\\;c\\\\\\\\d/motion-1.txt");
    expect(escaped).not.toMatch(/(?<!\\)[:,;[\]']/);
  });
});

describe("qc cleanup and recovery on failure", () => {
  function makeMinimalProject(projectsDir: string, slug: string) {
    const dir = join(projectsDir, slug);
    mkdirSync(join(dir, "source"), { recursive: true });
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(
      join(dir, "project.json"),
      JSON.stringify({ slug, title: "Test", canvas: "youtube", fps: 30, duration: 10, width: 1920, height: 1080 }),
    );
    writeFileSync(
      join(dir, "transcript.json"),
      JSON.stringify([{ text: "hello", start: 0, end: 1 }, { text: "world", start: 1, end: 2 }]),
    );
    writeFileSync(
      join(dir, "edit.json"),
      JSON.stringify({
        title: "Test",
        canvas: "youtube",
        shots: [
          { at: "hello", layout: "media", visual: { kind: "title", text: "Hello" } },
          { at: "world", layout: "full" },
        ],
      }),
    );
    return dir;
  }

  it("closes browser and awaits vite.close() and restores checks/qc.prev when qcPage fails", async () => {
    const projects = makeTempDir("studio-qc-");
    const dir = makeMinimalProject(projects, "demo");
    const qcDir = join(dir, "checks/qc");
    mkdirSync(qcDir, { recursive: true });
    writeFileSync(join(qcDir, "report.json"), JSON.stringify({ sentinel: "previous-good-report" }));

    const browserClose = vi.fn(async () => {});
    openBrowserMock.mockResolvedValue({
      newPage: async () => ({
        setViewport: async () => {},
        goto: async () => {
          throw new Error("navigation boom");
        },
        evaluate: async () => false,
      }),
      close: browserClose,
    });

    await expect(runQc(projects, "demo")).rejects.toThrow(/navigation boom/);

    // Browser was closed inside qcPage even though goto failed.
    expect(browserClose).toHaveBeenCalledTimes(1);
    // Vite server was closed even though qcPage failed.
    expect(viteCloseMock).toHaveBeenCalledTimes(1);
    // checks/qc was restored from checks/qc.prev and checks/qc.prev is gone.
    expect(existsSync(join(dir, "checks/qc.prev"))).toBe(false);
    expect(JSON.parse(readFileSync(join(qcDir, "report.json"), "utf8"))).toEqual({ sentinel: "previous-good-report" });
  });

  it("removes partial checks/qc when failing with no previous cache", async () => {
    const projects = makeTempDir("studio-qc-noprev-");
    const dir = makeMinimalProject(projects, "demo");

    openBrowserMock.mockRejectedValue(new Error("chrome failed to launch"));

    await expect(runQc(projects, "demo")).rejects.toThrow(/chrome failed to launch/);
    expect(viteCloseMock).toHaveBeenCalledTimes(1);
    expect(existsSync(join(dir, "checks/qc"))).toBe(false);
    expect(existsSync(join(dir, "checks/qc.prev"))).toBe(false);
  });

  it("throws when qcReady times out and closes the browser", async () => {
    const browserClose = vi.fn(async () => {});
    openBrowserMock.mockResolvedValue({
      newPage: async () => ({
        setViewport: async () => {},
        goto: async () => {},
        evaluate: async () => false,
      }),
      close: browserClose,
    });

    await expect(qcPage({ url: "http://127.0.0.1:9999" }, { width: 1080, height: 1920 }, "slug=x", undefined, 50)).rejects.toThrow(/ready|timed out/i);
    expect(browserClose).toHaveBeenCalledTimes(1);
  });

  it("restores [data-qc=hook] visibility in finally and guards zero-sized hook boxes and empty shots", async () => {
    const framesDir = makeTempDir("studio-hook-");
    let hiddenCalls = 0;
    let restoredCalls = 0;
    let shotCount = 0;
    const fakePage = {
      evaluate: async (fn: (...a: unknown[]) => unknown) => {
        const src = String(fn);
        if (src.includes("qcSeek")) return;
        if (src.includes("qcMeasure")) {
          return {
            texts: [{ text: "Hook", box: [100, 100, 200, 50], size: 60, opacity: 1, color: "rgb(255,255,255)", block: 1, hook: true }],
            marks: [],
            words: [],
          };
        }
        if (src.includes('visibility = "hidden"')) hiddenCalls++;
        if (src.includes('visibility = ""')) restoredCalls++;
      },
      _client: () => ({
        send: async () => {
          shotCount++;
          if (shotCount === 2) throw new Error("bare shot failed");
          return { data: Buffer.from("jpg").toString("base64") };
        },
      }),
    };

    const resolved = {
      canvas: "reel",
      style: "clean",
      fps: 30,
      duration: 5,
      hook: { text: "Hook", until: 3 },
      shots: [{ start: 0, end: 5, layout: "full", anchor: "a" }],
    } as unknown as Resolved;

    await expect(checkHook(fakePage as never, resolved, framesDir, "000-hook", [])).rejects.toThrow(/bare shot failed/);
    expect(hiddenCalls).toBe(1);
    expect(restoredCalls).toBe(1);

    // Zero-width hook box (box outside canvas) should NOT invoke ffmpeg crop and should still return the file.
    const zeroBoxPage = {
      evaluate: async (fn: (...a: unknown[]) => unknown) => {
        const src = String(fn);
        if (src.includes("qcMeasure")) {
          return {
            texts: [{ text: "Hook", box: [2000, 100, 200, 50], size: 60, opacity: 1, color: "rgb(255,255,255)", block: 1, hook: true }],
            marks: [],
            words: [],
          };
        }
      },
      _client: () => ({
        send: async () => ({ data: Buffer.from("jpg").toString("base64") }),
      }),
    };
    const files = await checkHook(zeroBoxPage as never, resolved, framesDir, "000-hook-zero", []);
    expect(files).toHaveLength(1);

    // When no shot starts before hook.until, checkHook returns [] cleanly.
    const emptyResolved = { ...resolved, shots: [{ start: 4, end: 5, layout: "full", anchor: "a" }] } as unknown as Resolved;
    const emptyFiles = await checkHook(zeroBoxPage as never, emptyResolved, framesDir, "000-hook-empty", []);
    expect(emptyFiles).toEqual([]);
  });
});
