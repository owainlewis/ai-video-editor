// Export a YouTube video without rendering every frame. Owain uploads a finished cut from Final
// Cut; only the parts with graphics change. So: render each graphic section on its own (titles over
// the picture with transparency, side and full-frame graphics complete), then lay them over his
// original file in one hardware-encoded pass. His picture and grade are untouched everywhere else,
// and a 27 minute video exports in minutes, not hours (2026-10-24).
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compositionFor } from "../effects/canvas.ts";
import { frameWindow, overlayEnable, type Preview, rangesInWindow, sectionFrames } from "../engine/parts.ts";
import { type Issue, lastKept } from "../engine/resolve.ts";
import type { Resolved } from "../engine/schema.ts";
import { prepareExport } from "./render.ts";
import { ffmpegProgress, hasHardwareH264, type Log, loudness, probeDuration, probeRate, probeSize, readJson, run, tempSibling, writeJson } from "./tools.ts";

export type Section = { start: number; end: number; alpha: boolean };

// The parts of the video a graphic touches. A visual and the keep shots after it are one section;
// sections that touch are merged so the picture never flickers between them. Overlays (titles over
// the picture) render with transparency; anything that reframes the picture renders complete.
export function sections(r: Resolved): Section[] {
  const out: Section[] = [];
  r.shots.forEach((s, i) => {
    if (s.keep || s.layout === "full") return;
    const last = lastKept(r.shots, i);
    const next = { start: s.start, end: r.shots[last].end, alpha: s.layout === "over" };
    const prev = out[out.length - 1];
    if (prev && next.start - prev.end < 0.05 && prev.alpha === next.alpha) prev.end = next.end;
    else out.push(next);
  });
  return out;
}

// The kept stretches of [0, total] after cutting out `remove` ranges.
export function keptRanges(remove: [number, number][], total: number): [number, number][] {
  const keep: [number, number][] = [];
  let at = 0;
  for (const [a, b] of [...remove].sort((x, y) => x[0] - y[0])) {
    if (a > at) keep.push([at, Math.min(a, total)]);
    at = Math.max(at, b);
    if (at >= total) break;
  }
  if (at < total) keep.push([at, total]);
  return keep;
}

// `preview`: one part only, to its own file. Every step is the final export's, limited to the part:
// the plan keeps the whole video's times, so graphics draw exactly the frames they will in the
// finished video, and only the overlay pass moves them to the part's own time.
export async function exportOverOriginal(projects: string, slug: string, onStage: (stage: string) => void, log?: Log, preview?: Preview): Promise<string> {
  const dir = join(projects, slug);
  const { flat, resolved: r } = await prepareExport(projects, slug, onStage, log, preview?.range);
  const meta = readJson<{ original: string }>(join(dir, "project.json"));
  const original = flat?.picture ?? meta.original;
  const [num, den] = probeRate(original);
  const fps = num / den;
  const [w] = probeSize(original);
  const comp = compositionFor(r.canvas);
  const scale = Math.max(1, Math.round(w / comp.width));
  // Where the part starts on the timeline, and how long it is. A flattened part's picture already
  // starts there; an uncut original, and the whole mix, are read from there.
  const win = preview ? frameWindow(preview.range, fps) : null;
  const base = win ? win.a / fps : 0;
  const length = win ? (win.b - win.a) / fps : probeDuration(original);
  const stretch = win ? ["-ss", base.toFixed(6), "-t", length.toFixed(6)] : [];

  const work = join(dir, "build/export");
  mkdirSync(work, { recursive: true });
  for (const f of readdirSync(work)) rmSync(join(work, f), { recursive: true });
  const parts = sections(r).flatMap((s) => {
    const f = sectionFrames(s, fps, win);
    return f ? [{ s, ...f }] : [];
  });
  const files: { file: string; s: Section }[] = [];
  for (const [k, { s, from, to }] of parts.entries()) {
    onStage(`Rendering graphics ${k + 1}/${parts.length}`);
    const props = join(work, `props-${k}.json`);
    writeJson(props, { ...r, fps, alpha: s.alpha, ...(win && flat ? { pictureFrom: win.a } : {}) });
    const file = join(work, `${String(k).padStart(2, "0")}.mov`);
    run("npx", ["remotion", "render", "effects/index.ts", comp.id, file, `--props=${props}`, `--frames=${from}-${to}`, `--scale=${scale}`, "--muted", "--codec=prores", "--log=error",
      // Seeking deep into a long 4K working copy can take longer than Remotion's 30 s default (2026-10-30).
      "--timeout=180000",
      ...(s.alpha ? ["--prores-profile=4444", "--pixel-format=yuva444p10le", "--image-format=png"] : ["--prores-profile=hq"])], { env: { REEL_PRORES: "1" }, log });
    files.push({ file, s: { ...s, start: from / fps - base, end: win ? (to + 1) / fps - base : s.end } });
  }

  // Each section is a timed input laid over the original from its first frame; outside its time it
  // passes the picture through untouched.
  const inputs = files.flatMap(({ file, s }) => ["-itsoffset", s.start.toFixed(6), "-i", file]);
  const chain = files.map(({ s }, k) => `[v${k}][${k + 1}:v]overlay=eof_action=pass:enable='${overlayEnable(s, fps)}'[v${k + 1}]`);
  const graph = files.length ? `[0:v]null[v0];${chain.join(";")}` : "[0:v]null[v0]";
  // Stretches cut out (a section said twice): the overlaid picture and the mix are cut at the same
  // points and joined, in the same pass.
  const remove = (win ? rangesInWindow(r.remove ?? [], base, length) : [...(r.remove ?? [])]).sort((x, y) => x[0] - y[0]);
  const total = length;
  const keep = keptRanges(remove, total);
  const A = files.length + 1;
  let vOut = `[v${files.length}]`, aOut = `${A}:a`, graphFull = graph;
  if (remove.length) {
    if (!keep.length) throw new Error("nothing left to render: remove covers the entire export");
    const k = keep.length;
    graphFull += `;${vOut}split=${k}${keep.map((_, i) => `[vs${i}]`).join("")};[${A}:a]asplit=${k}${keep.map((_, i) => `[as${i}]`).join("")}`;
    keep.forEach(([a, b], i) => {
      graphFull += `;[vs${i}]trim=start=${a.toFixed(4)}:end=${b.toFixed(4)},setpts=PTS-STARTPTS[vk${i}];[as${i}]atrim=start=${a.toFixed(4)}:end=${b.toFixed(4)},asetpts=PTS-STARTPTS[ak${i}]`;
    });
    graphFull += `;${keep.map((_, i) => `[vk${i}][ak${i}]`).join("")}concat=n=${k}:v=1:a=1[vcut][acut]`;
    vOut = "[vcut]";
    aOut = "[acut]";
  }
  const audio = join(dir, "build/mix.wav");
  const out = join(dir, "renders", preview?.file ?? "final.mp4");
  mkdirSync(join(dir, "renders"), { recursive: true });
  const hw = hasHardwareH264();
  let last = -1;
  const tmp = tempSibling(out);
  try {
    await ffmpegProgress([
      ...(flat ? [] : stretch), "-i", original, ...inputs, ...stretch, "-i", audio,
      "-filter_complex", graphFull, "-map", vOut, "-map", aOut,
      ...(hw ? ["-c:v", "h264_videotoolbox", "-b:v", w >= 3840 ? "45M" : "16M"] : ["-c:v", "libx264", "-crf", "17", "-preset", "fast"]),
      "-pix_fmt", "yuv420p", "-r", `${num}/${den}`, "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", "-shortest", tmp,
    ], total, (f) => {
      const pct = Math.floor(f * 100);
      if (pct !== last) onStage(`Finishing ${pct}%`), (last = pct);
    }, log);
    renameSync(tmp, out);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
  onStage("Checking the export");
  const check = verifyExport(original, out, files, remove, win ? { length, seek: flat ? 0 : base } : undefined);
  writeJson(join(dir, preview ? `checks/${preview.file.replace(/\.mp4$/, "")}-check.json` : "checks/export-check.json"), { at: new Date().toISOString(), ...check });
  for (const i of check.issues) log?.(`${i.level === "error" ? "ERROR" : "warn "}  ${i.message}`);
  return out;
}

// One frame as 64x36 grey pixels, for comparing pictures cheaply (null if ffmpeg failed).
const thumb = (file: string, t: number): Buffer | null => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-ss", t.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 });
  if (r.error || r.status !== 0 || !r.stdout?.length) return null;
  return r.stdout as Buffer;
};
const differ = (a: Buffer, b: Buffer) => (a.length && a.length === b.length ? a.reduce((sum, x, k) => sum + Math.abs(x - b[k]), 0) / a.length : 255);

// After an export: the same length as the original, every graphic where it should be, and the
// loudness, so a bad export is caught before Owain watches it (2026-10-25). `part`: the export is one
// part, `length` seconds, read from `seek` seconds into `original`.
export function verifyExport(original: string, out: string, files: { file: string; s: Section }[], remove: [number, number][] = [], part?: { length: number; seek: number }) {
  const issues: Issue[] = [];
  const cutOut = remove.reduce((sum, [x, y]) => sum + (y - x), 0);
  const [a, b] = [(part?.length ?? probeDuration(original)) - cutOut, probeDuration(out)];
  if (!Number.isFinite(a) || !Number.isFinite(b)) issues.push({ level: "error", message: `could not measure duration (expected ${a}s, got ${b}s)` });
  else if (Math.abs(a - b) > 0.15) issues.push({ level: "error", message: `the export is ${b.toFixed(2)}s; expected ${a.toFixed(2)}s (the original less ${cutOut.toFixed(2)}s removed)` });
  // A time in the original, as it falls in the export after removals (null if it was removed).
  const mapped = (t: number) => (remove.some(([x, y]) => t >= x && t < y) ? null : t - remove.filter(([, y]) => y <= t).reduce((sum, [x, y]) => sum + (y - x), 0));
  // Same size as the original: a 4K master exports 4K for YouTube (2026-10-25).
  const [ow, oh] = probeSize(original), [ew, eh] = probeSize(out);
  if (!Number.isFinite(ow) || !Number.isFinite(oh) || !Number.isFinite(ew) || !Number.isFinite(eh) || ow !== ew || oh !== eh)
    issues.push({ level: "error", message: `the export is ${ew}x${eh}; the original is ${ow}x${oh}` });
  for (const { file, s } of files) {
    const mid = (s.start + s.end) / 2;
    const there = mapped(mid);
    if (there === null) continue;
    const final = thumb(out, there);
    if (!final) {
      issues.push({ level: "error", message: `could not read frame at ${there.toFixed(2)}s from the export` });
      continue;
    }
    if (s.alpha) {
      // A title over the picture: the export must differ from the original there.
      const orig = thumb(original, mid + (part?.seek ?? 0));
      if (!orig) issues.push({ level: "error", message: `could not read frame at ${(mid + (part?.seek ?? 0)).toFixed(2)}s from the original` });
      else if (differ(final, orig) < 1) issues.push({ level: "error", message: `no graphic visible at ${mid.toFixed(2)}s, where a title should sit over the picture` });
    } else {
      const rendered = thumb(file, mid - s.start);
      if (!rendered) issues.push({ level: "error", message: `could not read frame at ${(mid - s.start).toFixed(2)}s from ${file}` });
      else if (differ(final, rendered) > 10)
        issues.push({ level: "error", message: `the graphic at ${s.start.toFixed(2)}s did not land where it was rendered (${mid.toFixed(2)}s looks different)` });
    }
  }
  const lufs = loudness(out);
  if (!Number.isFinite(lufs)) issues.push({ level: "error", message: "could not measure the export loudness" });
  else if (lufs > -10 || lufs < -18) issues.push({ level: "warn", message: `loudness is ${lufs} LUFS; YouTube plays around -14` });
  return { issues, lufs, sections: files.length, size: `${ew}x${eh}` };
}
