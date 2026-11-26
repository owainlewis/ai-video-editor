import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportOverOriginal, keptRanges, verifyExport } from "../media/export.ts";
import { holdEnd, NO_CTA, renderNoCta } from "../media/nocta.ts";
import { previewMix } from "../media/previewmix.ts";
import { coverStill, renderFinal, verifyReel } from "../media/render.ts";

const savedPath = process.env.PATH;
const tempDirs: string[] = [];
const makeTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

function installFakeBins(opts: {
  duration?: string;
  videoDuration?: string;
  audioDuration?: string;
  size?: string;
  loudness?: string;
  thumbFail?: boolean;
  ffmpegFail?: boolean;
  ffmpegWrite?: string;
  uvOk?: boolean;
}) {
  const binDir = makeTempDir("studio-exp-bin-");

  const ffprobe = join(binDir, "ffprobe");
  writeFileSync(
    ffprobe,
    `#!${process.execPath}
const args = process.argv.slice(2);
const entries = args[args.indexOf("-show_entries") + 1] ?? "";
const select = args.includes("-select_streams") ? args[args.indexOf("-select_streams") + 1] : "";
if (entries.includes("width,height")) {
  console.log(${JSON.stringify(opts.size ?? "1080,1920")});
} else if (select === "v:0" && entries.includes("duration")) {
  console.log(${JSON.stringify(opts.videoDuration ?? opts.duration ?? "10.0")});
} else if (select === "a:0" && entries.includes("duration")) {
  console.log(${JSON.stringify(opts.audioDuration ?? opts.duration ?? "10.0")});
} else if (entries.includes("duration")) {
  console.log(${JSON.stringify(opts.duration ?? "10.0")});
} else {
  console.log("30/1");
}
`,
  );
  chmodSync(ffprobe, 0o755);

  const ffmpeg = join(binDir, "ffmpeg");
  writeFileSync(
    ffmpeg,
    `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args.includes("ebur128")) {
  const lufs = ${JSON.stringify(opts.loudness ?? "-14.0")};
  if (lufs) process.stderr.write("Summary:\\n  I:         " + lufs + " LUFS\\n");
  process.exit(0);
}
if (args.includes("rawvideo")) {
  if (${JSON.stringify(!!opts.thumbFail)}) {
    process.stderr.write("cannot decode frame\\n");
    process.exit(1);
  }
  process.stdout.write(Buffer.alloc(64 * 36, 42));
  process.exit(0);
}
const out = args[args.length - 1];
if (${JSON.stringify(!!opts.ffmpegFail)}) {
  if (out && out !== "-") fs.writeFileSync(out, "corrupt-partial");
  process.stderr.write("encode failed\\n");
  process.exit(1);
}
if (out && out !== "-") fs.writeFileSync(out, ${JSON.stringify(opts.ffmpegWrite ?? "new-good-output")});
`,
  );
  chmodSync(ffmpeg, 0o755);

  if (opts.uvOk) {
    const uv = join(binDir, "uv");
    writeFileSync(
      uv,
      `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const mixIdx = args.indexOf("audio.mix");
const dir = args[mixIdx + 1];
const outRel = args[mixIdx + 3] ?? "build/mix.wav";
const out = path.join(dir, outRel);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, "fake-wav");
`,
    );
    chmodSync(uv, 0o755);
  }

  return binDir;
}

afterEach(() => {
  if (savedPath === undefined) delete process.env.PATH;
  else process.env.PATH = savedPath;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("strict verification rejects NaN measurements", () => {
  it("verifyReel errors when probeDuration, probeVideoDuration, or loudness returns NaN", () => {
    process.env.PATH = installFakeBins({ duration: "N/A", videoDuration: "10.0", audioDuration: "10.0", loudness: "-14.0" });
    expect(verifyReel("out.mp4", 10, [1080, 1920]).issues.some((i) => i.level === "error")).toBe(true);

    process.env.PATH = installFakeBins({ duration: "10.0", videoDuration: "N/A", audioDuration: "10.0", loudness: "-14.0" });
    expect(verifyReel("out.mp4", 10, [1080, 1920]).issues.some((i) => i.level === "error")).toBe(true);

    process.env.PATH = installFakeBins({ duration: "10.0", videoDuration: "10.0", audioDuration: "10.0", loudness: "" });
    expect(verifyReel("out.mp4", 10, [1080, 1920]).issues.some((i) => i.level === "error")).toBe(true);

    // Valid values produce no errors.
    process.env.PATH = installFakeBins({ duration: "10.0", videoDuration: "10.0", audioDuration: "10.0", loudness: "-14.0" });
    expect(verifyReel("out.mp4", 10, [1080, 1920]).issues).toEqual([]);
  });

  it("verifyExport errors when probeDuration, loudness, or thumb() fails", () => {
    process.env.PATH = installFakeBins({ duration: "N/A", size: "1920,1080", loudness: "-14.0" });
    expect(verifyExport("orig.mp4", "out.mp4", []).issues.some((i) => i.level === "error")).toBe(true);

    process.env.PATH = installFakeBins({ duration: "10.0", size: "1920,1080", loudness: "" });
    expect(verifyExport("orig.mp4", "out.mp4", []).issues.some((i) => i.level === "error")).toBe(true);

    // A failed thumb() on an alpha overlay section must error rather than silently pass.
    process.env.PATH = installFakeBins({ duration: "10.0", size: "1920,1080", loudness: "-14.0", thumbFail: true });
    const res = verifyExport("orig.mp4", "out.mp4", [{ file: "00.mov", s: { start: 1, end: 3, alpha: true } }]);
    expect(res.issues.some((i) => i.level === "error")).toBe(true);
  });
});

describe("atomic exports preserve last good output on failure", () => {
  it("holdEnd keeps the existing final.mp4 intact when ffmpeg fails", () => {
    const dir = makeTempDir("studio-holdend-");
    const src = join(dir, "render.mp4");
    const out = join(dir, "renders", "final.mp4");
    mkdirSync(join(dir, "renders"), { recursive: true });
    writeFileSync(src, "raw-render");
    writeFileSync(out, "previous-good-final");

    process.env.PATH = installFakeBins({ ffmpegFail: true });
    expect(() => holdEnd(src, out, 10, 0.6)).toThrow(/ffmpeg failed/);
    expect(readFileSync(out, "utf8")).toBe("previous-good-final");
    expect(readdirSync(join(dir, "renders"))).toEqual(["final.mp4"]);

    process.env.PATH = installFakeBins({ ffmpegWrite: "new-final" });
    holdEnd(src, out, 10, 0.6);
    expect(readFileSync(out, "utf8")).toBe("new-final");
    expect(readdirSync(join(dir, "renders"))).toEqual(["final.mp4"]);
  });

  it("renderNoCta keeps the existing final-no-cta.mp4 intact when encode fails", () => {
    const dir = makeTempDir("studio-nocta-");
    mkdirSync(join(dir, "renders"), { recursive: true });
    mkdirSync(join(dir, "build"), { recursive: true });
    const existing = join(dir, NO_CTA);
    writeFileSync(existing, "previous-good-nocta");
    writeFileSync(join(dir, "renders/final.mp4"), "final");
    writeFileSync(join(dir, "build/audio.json"), JSON.stringify({ duration: 10, sfx: [] }));

    process.env.PATH = installFakeBins({ ffmpegFail: true, uvOk: true });
    expect(() =>
      renderNoCta(dir, { cta: { at: "comment", end: 8 } } as never, join(dir, "renders/final.mp4"), "build/audio.json", [1080, 1920]),
    ).toThrow(/ffmpeg failed/);
    expect(readFileSync(existing, "utf8")).toBe("previous-good-nocta");
    expect(readdirSync(join(dir, "renders")).sort()).toEqual(["final-no-cta.mp4", "final.mp4"]);
  });

  it("previewMix keeps old preview-mix-*.m4a when ffmpeg fails and removes old ones after success", () => {
    const projects = makeTempDir("studio-prevmix-");
    const slug = "demo";
    const dir = join(projects, slug);
    mkdirSync(join(dir, "source"), { recursive: true });
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(join(dir, "project.json"), JSON.stringify({ original: join(dir, "source/video.mp4"), duration: 5 }));
    writeFileSync(join(dir, "edit.json"), JSON.stringify({ title: "Demo", canvas: "youtube", shots: [{ at: "hello", layout: "full" }] }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify([{ text: "hello", start: 0.5, end: 1.0 }]));
    writeFileSync(join(dir, "source/video.mp4"), "vid");
    writeFileSync(join(dir, "source/voice.wav"), "wav");
    const oldMix = join(dir, "build/preview-mix-old0000000.m4a");
    writeFileSync(oldMix, "old-good-mix");

    // On encode failure, the old mix file must still exist.
    process.env.PATH = installFakeBins({ duration: "5.0", size: "1920,1080", ffmpegFail: true, uvOk: true });
    expect(() => previewMix(projects, slug)).toThrow(/ffmpeg failed/);
    expect(existsSync(oldMix)).toBe(true);
    expect(readFileSync(oldMix, "utf8")).toBe("old-good-mix");

    // On encode success, the new mix is written and the old mix is removed.
    process.env.PATH = installFakeBins({ duration: "5.0", size: "1920,1080", ffmpegWrite: "new-mix", uvOk: true });
    const created = previewMix(projects, slug);
    expect(existsSync(created)).toBe(true);
    expect(readFileSync(created, "utf8")).toBe("new-mix");
    expect(existsSync(oldMix)).toBe(false);
  });

  it("exportOverOriginal guards empty keep and keeps existing final.mp4 intact when ffmpeg fails", async () => {
    const projects = makeTempDir("studio-yt-exp-");
    const slug = "yt";
    const dir = join(projects, slug);
    mkdirSync(join(dir, "source"), { recursive: true });
    mkdirSync(join(dir, "renders"), { recursive: true });
    writeFileSync(join(dir, "project.json"), JSON.stringify({ original: join(dir, "source/video.mp4"), duration: 5 }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify([{ text: "hello", start: 0.5, end: 1.0 }]));
    writeFileSync(join(dir, "source/video.mp4"), "vid");
    writeFileSync(join(dir, "source/voice.wav"), "wav");

    // keptRanges returns empty when remove covers [0, total].
    expect(keptRanges([[0, 5]], 5)).toEqual([]);
    expect(keptRanges([[1, 2], [3, 4]], 5)).toEqual([[0, 1], [2, 3], [4, 5]]);
    expect(keptRanges([[6, 8]], 5)).toEqual([[0, 5]]);

    // When remove covers the whole video, exportOverOriginal throws instead of building invalid concat=n=0.
    writeFileSync(join(dir, "edit.json"), JSON.stringify({ title: "YT", canvas: "youtube", remove: [[0, 5]], shots: [{ at: "hello", layout: "full" }] }));
    process.env.PATH = installFakeBins({ duration: "5.0", size: "1920,1080", uvOk: true });
    await expect(exportOverOriginal(projects, slug, () => {})).rejects.toThrow(/nothing left to render/i);

    // When ffmpeg fails, an existing renders/final.mp4 is untouched and no temp file remains.
    writeFileSync(join(dir, "edit.json"), JSON.stringify({ title: "YT", canvas: "youtube", shots: [{ at: "hello", layout: "full" }] }));
    const existing = join(dir, "renders/final.mp4");
    writeFileSync(existing, "previous-good-youtube");
    process.env.PATH = installFakeBins({ duration: "5.0", size: "1920,1080", ffmpegFail: true, uvOk: true });
    await expect(exportOverOriginal(projects, slug, () => {})).rejects.toThrow(/ffmpeg failed/);
    expect(readFileSync(existing, "utf8")).toBe("previous-good-youtube");
    expect(readdirSync(join(dir, "renders"))).toEqual(["final.mp4"]);
  });

  it("coverStill and renderFinal reject on missing npx and preserve existing part-*.mp4 on failure", async () => {
    const projects = makeTempDir("studio-render-err-");
    const slug = "reel1";
    const dir = join(projects, slug);
    mkdirSync(join(dir, "source"), { recursive: true });
    mkdirSync(join(dir, "renders"), { recursive: true });
    writeFileSync(join(dir, "project.json"), JSON.stringify({ original: join(dir, "source/video.mp4"), duration: 5 }));
    writeFileSync(join(dir, "edit.json"), JSON.stringify({ title: "Reel", canvas: "youtube", shots: [{ at: "hello", layout: "full" }] }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify([{ text: "hello", start: 0.5, end: 1.0 }]));
    writeFileSync(join(dir, "source/video.mp4"), "vid");
    writeFileSync(join(dir, "source/voice.wav"), "wav");

    // Missing npx in PATH -> coverStill and renderFinal reject with ENOENT instead of crashing with unhandled error.
    const binDir = installFakeBins({ duration: "5.0", size: "1920,1080", uvOk: true });
    process.env.PATH = binDir;
    await expect(coverStill(projects, slug, join(dir, "renders/cover.jpg"))).rejects.toThrow(/ENOENT/);

    const partFile = join(dir, "renders/part-intro.mp4");
    writeFileSync(partFile, "previous-good-part");
    await expect(renderFinal(projects, slug, () => {}, undefined, () => {}, { range: { start: 0, end: 2 }, file: "part-intro.mp4" })).rejects.toThrow(/ENOENT/);
    expect(readFileSync(partFile, "utf8")).toBe("previous-good-part");
    expect(readdirSync(join(dir, "renders"))).toEqual(["part-intro.mp4"]);
  });
});
