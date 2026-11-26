import { chmodSync, closeSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ffmpegProgress, imageSize, loudness, run, speechEnd, writeJson } from "../media/tools.ts";

const savedPath = process.env.PATH;
const tempDirs: string[] = [];
const makeTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  if (savedPath === undefined) delete process.env.PATH;
  else process.env.PATH = savedPath;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("writeJson", () => {
  it("writes valid JSON atomically without leaving sibling temp files behind", () => {
    const dir = makeTempDir("studio-writejson-");
    const file = join(dir, "nested", "edit.json");
    writeJson(file, { title: "v1", shots: [1, 2, 3] });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ title: "v1", shots: [1, 2, 3] });
    expect(readdirSync(join(dir, "nested"))).toEqual(["edit.json"]);

    // Overwriting an existing file replaces it cleanly and never leaves .tmp siblings.
    writeJson(file, { title: "v2", shots: [] });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ title: "v2", shots: [] });
    expect(readdirSync(join(dir, "nested"))).toEqual(["edit.json"]);

    // A serialization error does not corrupt the previous valid file.
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writeJson(file, circular)).toThrow();
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ title: "v2", shots: [] });
    expect(readdirSync(join(dir, "nested"))).toEqual(["edit.json"]);
  });

  it("writes via a sibling temp file and atomic rename (not directly truncating the target)", () => {
    const dir = makeTempDir("studio-writejson-atomic-");
    const file = join(dir, "state.json");
    writeJson(file, { version: 1, payload: "original" });
    const oldIno = statSync(file).ino;
    // Hold an open descriptor to the original file, simulating a concurrent reader.
    const fd = openSync(file, "r");
    try {
      writeJson(file, { version: 2, payload: "replaced" });
      // Rename swapped the directory entry to a brand-new inode; the open reader still sees complete v1 JSON.
      expect(statSync(file).ino).not.toBe(oldIno);
      expect(JSON.parse(readFileSync(fd, "utf8"))).toEqual({ version: 1, payload: "original" });
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ version: 2, payload: "replaced" });
    } finally {
      closeSync(fd);
    }

    // If rename fails (target is a directory), the sibling .tmp file is cleaned up.
    const targetDir = join(dir, "as-dir");
    writeJson(join(targetDir, "inside.json"), { ok: true });
    expect(() => writeJson(targetDir, { a: 2 })).toThrow();
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});

describe("subprocess hardening in media/tools.ts", () => {
  it("includes error message and signal in run() when stderr is empty", () => {
    expect(() => run("definitely-missing-studio-binary-xyz", [])).toThrow(/ENOENT/);
    // A child killed by a signal with empty stderr reports the signal.
    expect(() => run(process.execPath, ["-e", "process.kill(process.pid, 'SIGKILL')"])).toThrow(/SIGKILL/);
  });

  it("rejects ffmpegProgress instead of emitting an unhandled error when ffmpeg is missing", async () => {
    process.env.PATH = makeTempDir("studio-empty-bin-");
    await expect(ffmpegProgress(["-version"], 1, () => {})).rejects.toThrow(/ENOENT/);
  });

  it("handles null stderr in loudness() and speechEnd() without throwing TypeError", () => {
    const binDir = makeTempDir("studio-ffprobe-only-");
    const ffprobe = join(binDir, "ffprobe");
    writeFileSync(ffprobe, `#!${process.execPath}\nconsole.log("12.5");\n`);
    chmodSync(ffprobe, 0o755);
    // No ffmpeg in PATH -> spawnSync returns stderr: null.
    process.env.PATH = binDir;
    expect(loudness("fake.mp4")).toBeNaN();
    expect(speechEnd("fake.wav")).toBe(12.5);
  });

  it("handles >1 MiB silencedetect output in speechEnd() without exceeding maxBuffer", () => {
    const binDir = makeTempDir("studio-long-speech-");
    const ffprobe = join(binDir, "ffprobe");
    writeFileSync(ffprobe, `#!${process.execPath}\nconsole.log("3600.0");\n`);
    chmodSync(ffprobe, 0o755);
    const ffmpeg = join(binDir, "ffmpeg");
    writeFileSync(
      ffmpeg,
      `#!${process.execPath}
process.stderr.write("x".repeat(1200 * 1024) + "\\n");
process.stderr.write("[silencedetect] silence_start: 3598.25\\n");
`,
    );
    chmodSync(ffmpeg, 0o755);
    process.env.PATH = binDir;
    expect(speechEnd("long.wav")).toBe(3598.25);
  });
});

describe("imageSize", () => {
  it("reads valid PNG and JPEG dimensions and returns undefined on short or truncated files", () => {
    const dir = makeTempDir("studio-img-");

    // Empty and short files (< 24 bytes) must not throw RangeError.
    for (const [name, buf] of [
      ["empty.png", Buffer.alloc(0)],
      ["tiny.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])],
      ["short-png.png", Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)])],
      ["short-jpg.jpg", Buffer.from([0xff, 0xd8])],
      ["trunc-marker.jpg", Buffer.from([0xff, 0xd8, 0xff])],
      ["trunc-len.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])],
      ["trunc-seg.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x01, 0x02])],
      ["trunc-sof.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x06, 0x08, 0x01, 0x02])],
      ["zero-len.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00])],
    ] as const) {
      const f = join(dir, name);
      writeFileSync(f, buf);
      expect(imageSize(f), name).toBeUndefined();
    }

    // Valid PNG header (24 bytes): 1080 x 1920.
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(1080, 16);
    png.writeUInt32BE(1920, 20);
    const pngFile = join(dir, "valid.png");
    writeFileSync(pngFile, png);
    expect(imageSize(pngFile)).toEqual([1080, 1920]);

    // Valid JPEG: SOI + APP0 (length 4) + SOF0 (height 640, width 480).
    const jpg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x02, 0x80, 0x01, 0xe0, 0x01, 0x01, 0x11, 0x00,
    ]);
    const jpgFile = join(dir, "valid.jpg");
    writeFileSync(jpgFile, jpg);
    expect(imageSize(jpgFile)).toEqual([480, 640]);
  });
});
