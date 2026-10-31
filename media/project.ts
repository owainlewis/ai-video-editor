// Turn a project's plan (edit.json) into what the compositions render (build/edit.resolved.json),
// with every check the house rules need. The editor runs this on every change to the plan, so
// the player always shows the plan as it is, and problems show next to it.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Edit, type Resolved, type Word } from "../engine/schema.ts";
import { chunkWords, lintLeave, lintOnCamera, lintShots, resolveShots, sfxEvents } from "../engine/resolve.ts";
import { qcPlan, saidTwice } from "../engine/qc.ts";
import { frameRect } from "../effects/camera.ts";
import { HEADER, MEDIA, splitGeom } from "../effects/theme.ts";
import { slotIssues } from "../styles/blueprint/style.ts";
import { useClip } from "./broll.ts";
import { clipLevels, clipPath, clips, timeline } from "./bin.ts";
import { clippedWords, joins, loudJoins, mapRanges, mapTimes, placed } from "../engine/cut.ts";
import { MAIN } from "../engine/schema.ts";
import { FPS, imageSize, probeDuration, probeSize, readJson, ROOT, speechEnd, writeJson } from "./tools.ts";

export type Issue = { level: "error" | "warn"; message: string };

// Where the placeholder speaker's face sits in its 1080x1920 frame (see effects/Speaker.tsx).
const PLACEHOLDER_FACE = { x: 0.5, y: 0.3, h: 0.17 };

export const LIBRARY = join(ROOT, "library");

// `exportCut`: the cut flattened to one file by media/cutrender.ts, which an export draws the picture
// from instead of playing segments.
export function resolveProject(projects: string, slug: string, exportCut?: { video: string; voice: string }): { resolved?: Resolved; issues: Issue[] } {
  const dir = join(projects, slug);
  const meta0 = readJson<{ duration: number; size?: [number, number]; script?: boolean }>(join(dir, "project.json"));
  // Everything below works on the timeline: with a cut, its words and length; with none, the clip as it is.
  const line = timeline(dir);
  const { cut, explicit } = line;
  const words: Word[] = line.words;
  const meta = { ...meta0, duration: line.duration };
  if (line.error) return { issues: [{ level: "error", message: line.error }] };
  const parsed = Edit.safeParse(readJson(join(dir, "edit.json")));
  if (!parsed.success) return { issues: parsed.error.issues.map((i) => ({ level: "error", message: `edit.json ${i.path.join(".")}: ${i.message}` })) };
  const plan = parsed.data;
  const youtube = plan.canvas === "youtube";
  const face = meta.script ? PLACEHOLDER_FACE : (plan.face ?? (youtube ? { x: 0.5, y: 0.38, h: 0.3 } : undefined));
  if (!face) return { issues: [{ level: "error", message: 'edit.json needs "face": measure it on checks/frame.jpg' }] };

  const { shots, issues } = resolveShots(plan, words, meta.duration, FPS, explicit);
  if (explicit) {
    // The words can be a tenth of a second off; the sound says whether a join cuts into speech.
    const ids = [...new Set(cut.segments.map((x) => x.src))];
    const levels = Object.fromEntries(ids.flatMap((id) => { const l = clipLevels(dir, id); return l ? [[id, l]] : []; }));
    const lengths = Object.fromEntries(clips(dir).map((c) => [c.id, c.duration]));
    issues.push(...clippedWords(cut, line.byClip, levels), ...loudJoins(cut, levels, lengths));
    if (!cut.segments.length) issues.push({ level: "error", message: "the cut is empty; drag a clip onto the A-roll track" });
    // Stretches in seconds belong to a project without a cut; a cut removes by ripple delete instead.
    if (plan.remove.length) issues.push({ level: "error", message: 'this project has a cut, so "remove" no longer applies; delete the stretch from the cut instead' });
  }
  // The video's theme is every graphic's tone unless a shot sets its own.
  if (plan.theme === "dark") for (const s of shots) s.tone ??= "dark";
  issues.push(...lintShots(shots, meta.duration, plan.format, plan.canvas));
  const scanned = join(dir, "build/camera.json");
  // The scan is in the main clip's own time; added clips have none, so they count as off camera.
  if (youtube && existsSync(scanned)) issues.push(...lintOnCamera(shots, explicit ? mapRanges(cut, MAIN, readJson<{ ranges: [number, number][] }>(scanned).ranges) : readJson<{ ranges: [number, number][] }>(scanned).ranges));
  else if (youtube && !meta.script && shots.some((s) => s.visual)) issues.push({ level: "warn", message: "no camera scan, so graphics cannot be checked against where you are on camera; run frames, then scan" });
  if (youtube) issues.push(...lintLeave(shots, plan.leave));
  // A removed stretch must start and end between words, and must not cut through a graphic.
  for (const [a, b] of plan.remove) {
    const cut = words.find((w) => (w.start < a && w.end > a + 0.02) || (w.start < b - 0.02 && w.end > b));
    if (cut) issues.push({ level: "error", message: `removing ${a}-${b}s cuts through the word "${cut.text}" (${cut.start.toFixed(2)}-${cut.end.toFixed(2)}s)` });
    shots.forEach((s, i) => {
      if (s.layout !== "full" && s.start < b && s.end > a) issues.push({ level: "error", message: `removing ${a}-${b}s cuts through shot ${i + 1} (${s.start.toFixed(2)}s "${s.anchor}")` });
    });
  }
  if (youtube && meta.size && meta.size[0] < meta.size[1]) issues.push({ level: "error", message: "youtube canvas needs landscape footage" });

  // Library shots ("broll:<id>") are copied into the project so the renderer can serve them.
  for (const s of shots) {
    const v = s.visual;
    if (v?.kind === "video" && v.src.startsWith("broll:")) {
      const rel = useClip(dir, v.src.slice(6));
      if (!rel) issues.push({ level: "error", message: `no b-roll ${v.src} in the library` });
      else s.visual = { ...v, src: rel };
    }
  }
  const seen = new Set<string>();
  for (const s of shots) {
    const v = s.visual;
    if (s.layout === "cutaway" && v?.kind !== "video") issues.push({ level: "error", message: `cutaway at "${s.anchor}" needs a video visual` });
    const srcs = !v ? [] : v.kind === "image" || v.kind === "video" ? [v.src] : v.kind === "logos" || v.kind === "logowall" || v.kind === "windows" ? v.items.map((i) => i.src) : v.kind === "cta" && v.src ? [v.src] : [];
    // The style's cards are sized for their slots' max lengths.
    if (v && !s.keep) for (const m of slotIssues(v)) issues.push({ level: "warn", message: `"${s.anchor}": ${m}` });
    for (const src of srcs) if (!existsSync(join(dir, src))) issues.push({ level: "error", message: `missing asset ${src}` });
    if (v?.kind === "windows") s.visual = { ...v, items: v.items.map((it) => ({ ...it, ...(existsSync(join(dir, it.src)) ? { size: imageSize(join(dir, it.src)) } : {}) })) };
    if (v?.kind === "image" && existsSync(join(dir, v.src))) {
      const size = imageSize(join(dir, v.src));
      s.visual = { ...v, size };
      // Captures are taken at 2x, so page text of 16 CSS px is 32 image px; under ~30 px on the
      // 1080 frame it is unreadable on a phone.
      if (size && v.to && !youtube) {
        const top = s.header ? HEADER.top + 120 + 30 : 150;
        const bottom = (s.layout === "split" ? splitGeom(plan.split).panelBottom : MEDIA.panelBottom) - 20;
        const { k } = frameRect(v.to, size[0], size[1], 900, bottom - top - (v.frame === "browser" ? 64 : 0));
        if (k * 32 < 30) issues.push({ level: "warn", message: `"${s.anchor}": ${v.src} ends too wide; 16px page text shows at ${Math.round(k * 32)}px. Tighten "to".` });
      }
    }
    if (v?.kind === "video" && existsSync(join(dir, v.src))) {
      s.visual = { ...v, size: probeSize(join(dir, v.src)) };
      // A slowed clip lasts longer on screen.
      const left = (probeDuration(join(dir, v.src)) - v.start) / (v.rate ?? 1);
      if (!v.loop && s.end - s.start > left + 0.04) issues.push({ level: "error", message: `"${s.anchor}": shot is ${(s.end - s.start).toFixed(2)}s but ${v.src} has ${left.toFixed(2)}s from start ${v.start}` });
    }
    // A kept shot carries on the same clip; that is one use, not two.
    if (v?.kind === "video" && !s.keep) {
      if (seen.has(v.src)) issues.push({ level: "error", message: `b-roll ${v.src} is used twice` });
      seen.add(v.src);
    }
  }
  if (plan.music) {
    const track = plan.music.track ? join(LIBRARY, "music", plan.music.track) : "";
    const any = existsSync(join(LIBRARY, "music")) && readdirSync(join(LIBRARY, "music"), { recursive: true }).some((f) => /\.(mp3|wav|m4a|flac|aiff?)$/i.test(String(f)));
    if (track ? !existsSync(track) : !any) issues.push({ level: "warn", message: `no music found${track ? ` at library/music/${plan.music.track}` : " in library/music"}; the video will have no bed` });
  }
  if (!explicit && existsSync(join(dir, "source/voice.wav"))) {
    const tail = meta.duration - speechEnd(join(dir, "source/voice.wav"));
    if (tail < 0.5) issues.push({ level: "warn", message: `speech ends ${tail.toFixed(2)}s before the end; it will feel cut off` });
  }
  const spoken = words.map((w) => w.text.toLowerCase()).join(" ");
  for (const a of plan.accents) if (!spoken.includes(a.toLowerCase())) issues.push({ level: "warn", message: `accent word not spoken: "${a}"` });

  const resolved: Resolved = {
    slug,
    title: plan.title,
    duration: meta.duration,
    fps: FPS,
    video: meta.script ? "" : exportCut?.video ?? `${slug}/source/talking.mp4`,
    videoSize: meta.size ?? [1080, 1920],
    audio: existsSync(join(dir, "build/mix.wav")) && (!explicit || exportCut) ? `${slug}/build/mix.wav` : null,
    face,
    remove: plan.remove,
    grade: plan.grade,
    split: plan.split,
    canvas: plan.canvas,
    style: plan.style,
    captions: plan.captions ?? !youtube,
    preview: explicit
      ? {}
      : {
          ...(existsSync(join(dir, "build/preview.mp4")) ? { video: `${slug}/build/preview.mp4` } : {}),
          ...(existsSync(join(dir, "build/preview.m4a")) ? { audio: `${slug}/build/preview.m4a` } : {}),
        },
    // The editor plays a cut segment by segment from each clip's preview copy.
    ...(explicit && !exportCut
      ? { cut: placed(cut).map((s) => ({ video: `${clipPath(slug, s.src)}/build/preview.mp4`, audio: `${clipPath(slug, s.src)}/build/preview.m4a`, start: s.start, end: s.end, in: s.in })) }
      : {}),
    shots,
    chunks: chunkWords(words, plan.accents, [...shots.map((s) => s.start).slice(1), ...(explicit ? joins(cut) : [])].sort((a, b) => a - b), FPS),
    sfx: sfxEvents(shots),
  };
  // Plan checks from QC (engine/qc.ts): pacing, reading time, cuts in the footage, numbers on screen.
  const cutsFile = join(dir, "build/cuts.json");
  const found = existsSync(cutsFile) ? readJson<{ cuts: number[] }>(cutsFile).cuts : [];
  // Cuts found in the main clip, moved through the cut, plus every join in the cut itself.
  const cuts = explicit ? [...mapTimes(cut, MAIN, found), ...joins(cut)].sort((a, b) => a - b) : found;
  issues.push(...qcPlan(resolved, words, plan.shots.map((s) => s.note), cuts));
  if (youtube) issues.push(...saidTwice(words, plan.remove));
  // An export of a cut writes its own files: the editor re-resolves the plan whenever it reloads,
  // and must not swap the flattened cut out from under a running export.
  const name = exportCut ? "export" : "resolved";
  writeJson(join(dir, `build/edit.${name}.json`), resolved);
  writeJson(join(dir, exportCut ? "build/audio.export.json" : "build/audio.json"), { duration: meta.duration, canvas: plan.canvas, music: plan.music, voiceGain: plan.voiceGain, sfx: resolved.sfx, ...(exportCut ? { voice: exportCut.voice } : {}) });
  return { resolved, issues };
}
