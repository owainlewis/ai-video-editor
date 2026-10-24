// Export a YouTube video without rendering every frame. Owain uploads a finished cut from Final
// Cut; only the parts with graphics change. So: render each graphic section on its own (titles over
// the picture with transparency, side and full-frame graphics complete), then lay them over his
// original file in one hardware-encoded pass. His picture and grade are untouched everywhere else,
// and a 27 minute video exports in minutes, not hours (2026-10-24).
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compositionFor } from "../effects/canvas.ts";
import type { Resolved } from "../engine/schema.ts";
import { mixAudio } from "./render.ts";
import { makeMatte, mattePaths, matteKey } from "./matte.ts";
import { missingMattes, resolveProject } from "./project.ts";
import { ffmpegProgress, hasHardwareH264, type Log, probeDuration, probeRate, probeSize, readJson, run, writeJson } from "./tools.ts";

export type Section = { start: number; end: number; alpha: boolean; behind?: boolean };

// The parts of the video a graphic touches. A visual and the keep shots after it are one section;
// sections that touch are merged so the picture never flickers between them. Overlays (titles over
// the picture) render with transparency; anything that reframes the picture renders complete.
export function sections(r: Resolved): Section[] {
  const out: Section[] = [];
  r.shots.forEach((s, i) => {
    if (s.keep || s.layout === "full") return;
    let last = i;
    while (r.shots[last + 1]?.keep) last++;
    const behind = s.layout === "behind";
    const next: Section = { start: s.start, end: r.shots[last].end, alpha: s.layout === "over" || behind, ...(behind ? { behind: true } : {}) };
    const prev = out[out.length - 1];
    if (prev && !behind && !prev.behind && next.start - prev.end < 0.05 && prev.alpha === next.alpha) prev.end = next.end;
    else out.push(next);
  });
  return out;
}

export async function exportOverOriginal(projects: string, slug: string, onStage: (stage: string) => void, log?: Log): Promise<string> {
  const dir = join(projects, slug);
  const first = resolveProject(projects, slug);
  if (!first.resolved || first.issues.some((i) => i.level === "error")) throw new Error(first.issues.filter((i) => i.level === "error").map((i) => i.message).join("\n"));
  // Behind sections need the speaker's cut-out; make any that are missing first.
  for (const m of missingMattes(projects, slug)) onStage("Cutting you out"), makeMatte(dir, m.start, m.end, log);
  onStage("Mixing audio");
  mixAudio(projects, slug, log);
  const { resolved } = resolveProject(projects, slug);
  const r = resolved!;
  const meta = readJson<{ original: string }>(join(dir, "project.json"));
  const original = meta.original;
  const [num, den] = probeRate(original);
  const fps = num / den;
  const [w] = probeSize(original);
  const comp = compositionFor(r.canvas);
  const scale = Math.max(1, Math.round(w / comp.width));

  const work = join(dir, "build/export");
  mkdirSync(work, { recursive: true });
  for (const f of readdirSync(work)) rmSync(join(work, f), { recursive: true });
  const parts = sections(r);
  const files: { file: string; s: Section }[] = [];
  for (const [k, s] of parts.entries()) {
    onStage(`Rendering graphics ${k + 1}/${parts.length}`);
    const props = join(work, `props-${k}.json`);
    writeJson(props, { ...r, fps, alpha: s.alpha });
    const file = join(work, `${String(k).padStart(2, "0")}.mov`);
    const from = Math.round(s.start * fps), to = Math.max(from, Math.round(s.end * fps) - 1);
    run("npx", ["remotion", "render", "effects/index.ts", comp.id, file, `--props=${props}`, `--frames=${from}-${to}`, `--scale=${scale}`, "--muted", "--codec=prores", "--log=error",
      ...(s.alpha ? ["--prores-profile=4444", "--pixel-format=yuva444p10le", "--image-format=png"] : ["--prores-profile=hq"])], { env: { REEL_PRORES: "1" }, log });
    files.push({ file, s: { ...s, start: from / fps } });
  }

  // Each section is a timed input laid over the original from its first frame; outside its time it
  // passes the picture through untouched. A behind section then lays Owain back on top: the original
  // frames for that stretch, cut out with the matte (scaled to the original's size), so his pixels
  // stay full resolution.
  const inputs: string[] = [];
  const chain: string[] = [];
  let n = 1, v = 0;
  const window = (s: Section) => `enable='between(t,${s.start.toFixed(3)},${(s.end + 1 / fps).toFixed(3)})'`;
  for (const { file, s } of files) {
    inputs.push("-itsoffset", s.start.toFixed(6), "-i", file);
    chain.push(`[v${v}][${n++}:v]overlay=eof_action=pass:${window(s)}[v${v + 1}]`);
    v++;
    if (s.behind) {
      const key = matteKey(s.start, s.end);
      const length = (s.end - s.start).toFixed(4);
      inputs.push("-ss", s.start.toFixed(6), "-t", length, "-itsoffset", s.start.toFixed(6), "-i", original);
      inputs.push("-itsoffset", s.start.toFixed(6), "-i", mattePaths(dir, key).mask);
      const [o, m] = [n++, n++];
      // Pull the matte in a few pixels and soften it, so no undimmed wall shows as a halo round his head.
      chain.push(`[${m}:v]scale=${w}:-2,format=gray,erosion,erosion,erosion,gblur=sigma=2[m${o}]`, `[${o}:v]format=rgba[o${o}]`, `[o${o}][m${o}]alphamerge[f${o}]`);
      chain.push(`[v${v}][f${o}]overlay=eof_action=pass:${window(s)}[v${v + 1}]`);
      v++;
    }
  }
  const graph = `[0:v]null[v0]${chain.length ? ";" + chain.join(";") : ""}`;
  const audio = join(dir, "build/mix.wav");
  const out = join(dir, "renders/final.mp4");
  mkdirSync(join(dir, "renders"), { recursive: true });
  const hw = hasHardwareH264();
  let last = -1;
  await ffmpegProgress([
    "-i", original, ...inputs, "-i", audio,
    "-filter_complex", graph, "-map", `[v${v}]`, "-map", `${n}:a`,
    ...(hw ? ["-c:v", "h264_videotoolbox", "-b:v", w >= 3840 ? "45M" : "16M"] : ["-c:v", "libx264", "-crf", "17", "-preset", "fast"]),
    "-pix_fmt", "yuv420p", "-r", `${num}/${den}`, "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", "-shortest", out,
  ], probeDuration(original), (f) => {
    const pct = Math.floor(f * 100);
    if (pct !== last) onStage(`Finishing ${pct}%`), (last = pct);
  }, log);
  return out;
}
