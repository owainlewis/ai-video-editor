import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { brollFolder, clipsFolder, indexLibrary, loadLibrary, useClip } from "../media/broll.ts";
import { ROOT } from "../media/tools.ts";

// The b-roll library's folder is a setting: STUDIO_BROLL in the environment or .env.
const savedBroll = process.env.STUDIO_BROLL;
const savedPath = process.env.PATH;
const tempDirs: string[] = [];

const makeTempDir = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  tempDirs.push(dir);
  return dir;
};

// Fake ffprobe/ffmpeg binaries so indexLibrary tests run deterministically without system ffmpeg.
function installFakeMediaBins(opts: { durations: Record<string, number>; includeFfmpeg?: boolean; ffmpegFail?: string; logFile?: string }) {
  const binDir = makeTempDir("studio-bin-");
  const ffprobePath = join(binDir, "ffprobe");
  writeFileSync(
    ffprobePath,
    `#!${process.execPath}
const path = require("node:path");
const durations = ${JSON.stringify(opts.durations)};
const file = process.argv[process.argv.length - 1];
const duration = durations[path.basename(file)] ?? 3;
console.log(JSON.stringify({ streams: [{ width: 1920, height: 1080, r_frame_rate: "30/1" }], format: { duration: String(duration) } }));
`,
  );
  chmodSync(ffprobePath, 0o755);

  if (opts.includeFfmpeg !== false) {
    const ffmpegPath = join(binDir, "ffmpeg");
    writeFileSync(
      ffmpegPath,
      `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const logFile = ${JSON.stringify(opts.logFile ?? null)};
if (logFile) fs.appendFileSync(logFile, JSON.stringify(args) + "\\n");
const fail = ${JSON.stringify(opts.ffmpegFail ?? null)};
if (fail) {
  process.stderr.write(fail + "\\n");
  process.exit(1);
}
const ssIdx = args.indexOf("-ss");
const toIdx = args.indexOf("-to");
if (toIdx !== -1) {
  const ss = ssIdx !== -1 ? Number(args[ssIdx + 1]) : 0;
  const to = Number(args[toIdx + 1]);
  if (!Number.isFinite(to) || to <= 0 || to <= ss) {
    process.stderr.write("Invalid duration: -ss " + ss + " -to " + to + "\\n");
    process.exit(1);
  }
}
const vfIdx = args.indexOf("-vf");
const vf = vfIdx !== -1 ? args[vfIdx + 1] : "";
if (vf.includes("cropdetect")) process.stderr.write("crop=1920:1080:0:0\\n");
if (vf.includes("signalstats")) process.stderr.write("lavfi.signalstats.YAVG=128\\n");
const out = args[args.length - 1];
if (out && out !== "-") fs.writeFileSync(out, "fake-media");
`,
    );
    chmodSync(ffmpegPath, 0o755);
  }
  return binDir;
}

afterEach(() => {
  if (savedBroll === undefined) delete process.env.STUDIO_BROLL;
  else process.env.STUDIO_BROLL = savedBroll;
  if (savedPath === undefined) delete process.env.PATH;
  else process.env.PATH = savedPath;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("b-roll library folder", () => {
  it("follows STUDIO_BROLL, with ~ as the home folder", () => {
    process.env.STUDIO_BROLL = "~/Clips/b-roll";
    expect(brollFolder()).toBe(join(homedir(), "Clips/b-roll"));
    expect(clipsFolder()).toBe(join(homedir(), "Clips/b-roll/.clips"));
    process.env.STUDIO_BROLL = "elsewhere/broll";
    expect(brollFolder()).toBe(join(ROOT, "elsewhere/broll"));
  });

  it("is library/broll when nothing sets it", () => {
    // A copy of the two modules in a folder with no .env, so its ROOT has no setting.
    const root = makeTempDir("studio-broll-");
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
    mkdirSync(join(root, "media"));
    for (const f of ["tools.ts", "broll.ts"]) copyFileSync(join(ROOT, "media", f), join(root, "media", f));
    const env = { ...process.env };
    delete env.STUDIO_BROLL;
    const out = execFileSync(join(ROOT, "node_modules/.bin/tsx"), ["-e", 'import("./media/broll.ts").then((m) => console.log(m.brollFolder()))'], { cwd: root, env, encoding: "utf8" });
    expect(out.trim()).toBe(join(root, "library", "broll"));
  });

  it("reads the index and copies shots from that folder", () => {
    const lib = makeTempDir("studio-lib-");
    mkdirSync(join(lib, ".clips"));
    writeFileSync(join(lib, "index.json"), JSON.stringify([{ id: "desk-1", description: "a desk" }]));
    writeFileSync(join(lib, ".clips", "desk-1.mp4"), "video");
    process.env.STUDIO_BROLL = lib;
    expect(loadLibrary().map((c) => c.id)).toEqual(["desk-1"]);
    const project = makeTempDir("studio-proj-");
    expect(useClip(project, "desk-1")).toBe("assets/broll/desk-1.mp4");
    expect(useClip(project, "gone-1")).toBeNull();
    // A shot the library no longer holds keeps playing from the project's own copy.
    process.env.STUDIO_BROLL = makeTempDir("studio-empty-");
    expect(useClip(project, "desk-1")).toBe("assets/broll/desk-1.mp4");
  });

  it("rejects path traversal and invalid clip IDs in useClip", () => {
    const lib = makeTempDir("studio-lib-");
    mkdirSync(join(lib, ".clips"));
    // File outside .clips that a traversal ID like "../secret" would otherwise reach.
    writeFileSync(join(lib, "secret.mp4"), "secret");
    writeFileSync(join(lib, ".clips", "valid_clip-1.mp4"), "video");
    process.env.STUDIO_BROLL = lib;

    const project = makeTempDir("studio-proj-");
    writeFileSync(join(project, "escape.mp4"), "existing");

    for (const badId of ["../secret", "..", ".", "../../escape", "nested/clip", "nested\\clip", "", "clip.1", "clip 1"]) {
      expect(useClip(project, badId), badId).toBeNull();
    }
    expect(existsSync(join(project, "assets", "secret.mp4"))).toBe(false);
    expect(existsSync(join(project, "assets"))).toBe(false);
    expect(useClip(project, "valid_clip-1")).toBe("assets/broll/valid_clip-1.mp4");
  });
});

describe("b-roll indexing edge cases", () => {
  it("preserves non-negative 64-bit mtimeMs in source stamps", () => {
    const lib = makeTempDir("studio-lib-");
    const clip = join(lib, "desk.mp4");
    writeFileSync(clip, "video");
    // Timestamp whose signed 32-bit bitwise truncation (| 0) overflows negative.
    const ms = Date.parse("2026-11-01T00:00:00.000Z");
    expect(ms | 0).toBeLessThan(0);
    utimesSync(clip, ms / 1000, ms / 1000);
    const expectedMtime = Math.trunc(statSync(clip).mtimeMs);
    expect(expectedMtime).toBeGreaterThan(2 ** 31);

    const logFile = join(makeTempDir("studio-log-"), "ffmpeg.log");
    process.env.STUDIO_BROLL = lib;
    process.env.PATH = installFakeMediaBins({ durations: { "desk.mp4": 3 }, logFile });

    const first = indexLibrary();
    expect(first).toHaveLength(1);
    expect(first[0].source).toBe(`desk.mp4@${expectedMtime}`);
    const stampMs = Number(first[0].source.split("@")[1]);
    expect(stampMs).toBeGreaterThanOrEqual(0);
    expect(stampMs).toBe(expectedMtime);

    // Re-indexing without file changes should recognize the stamp and skip ffmpeg.
    const callsAfterFirst = statSync(logFile).size;
    const second = indexLibrary();
    expect(second).toHaveLength(1);
    expect(statSync(logFile).size).toBe(callsAfterFirst);
  });

  it("guards short clips at or below 0.12s without computing non-positive end times", () => {
    const lib = makeTempDir("studio-lib-");
    writeFileSync(join(lib, "tiny.mp4"), "video");
    writeFileSync(join(lib, "boundary.mp4"), "video");
    writeFileSync(join(lib, "zero.mp4"), "video");

    process.env.STUDIO_BROLL = lib;
    process.env.PATH = installFakeMediaBins({ durations: { "tiny.mp4": 0.1, "boundary.mp4": 0.12, "zero.mp4": 0 } });

    const clips = indexLibrary();
    expect(clips.map((c) => [c.id, c.start, c.end, c.duration])).toEqual([
      ["boundary-1", 0, 0.12, 0.12],
      ["tiny-1", 0, 0.1, 0.1],
    ]);
  });

  it("reports a clear error instead of TypeError when ffmpeg is missing or fails", () => {
    const lib = makeTempDir("studio-lib-");
    writeFileSync(join(lib, "desk.mp4"), "video");
    process.env.STUDIO_BROLL = lib;

    // Missing ffmpeg binary (spawnSync returns r.error and r.stderr === null).
    process.env.PATH = installFakeMediaBins({ durations: { "desk.mp4": 3 }, includeFfmpeg: false });
    let missingErr: unknown;
    try {
      indexLibrary();
    } catch (e) {
      missingErr = e;
    }
    expect(missingErr).toBeInstanceOf(Error);
    expect(missingErr).not.toBeInstanceOf(TypeError);
    expect((missingErr as Error).message).toMatch(/ffmpeg/i);

    // Failing ffmpeg binary (non-zero exit status).
    process.env.PATH = installFakeMediaBins({ durations: { "desk.mp4": 3 }, ffmpegFail: "Invalid data found" });
    let failErr: unknown;
    try {
      indexLibrary();
    } catch (e) {
      failErr = e;
    }
    expect(failErr).toBeInstanceOf(Error);
    expect(failErr).not.toBeInstanceOf(TypeError);
    expect((failErr as Error).message).toMatch(/ffmpeg/i);
    expect((failErr as Error).message).toMatch(/Invalid data found/);
  });
});
