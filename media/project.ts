// Turn a project's plan (edit.json) into what the compositions render (build/edit.resolved.json),
// with every check the house rules need. The editor runs this on every change to the plan, so
// the player always shows the plan as it is, and problems show next to it.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Edit, type Resolved, type Word } from "../engine/schema.ts";
import { type Issue, type ScreenZoom, zoomClashes, chunkWords, cleanSfx, lintClean, lintLeave, lintOnCamera, lintWide, resolveHook, resolveShots, sfxEvents, shotLabel } from "../engine/resolve.ts";
import { qcPlan, saidTwice } from "../engine/qc.ts";
import { frameRect, rectOf } from "../effects/camera.ts";
import { type Page, placePhrases } from "../engine/page.ts";
import { BAND } from "../effects/theme.ts";
import { cards, slotIssues } from "../styles/blueprint/style.ts";
import { stripAnchors } from "../engine/insert.ts";
import { BROLL, useClip } from "./broll.ts";
import { cameraOnTimeline, clipLevels, clipPath, clips, timeline } from "./bin.ts";
import { clippedWords, joins, loudJoins, mapTimes, placed } from "../engine/cut.ts";
import { resolveParts } from "../engine/parts.ts";
import { MAIN } from "../engine/schema.ts";
import { ffmpeg, FPS, imageSize, mediaProbe, readJson, ROOT, writeJson } from "./tools.ts";

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

  const probe = mediaProbe(dir);
  const { shots, issues } = resolveShots(plan, words, meta.duration, FPS, explicit);
  const { parts, issues: partIssues } = resolveParts(plan.parts, words, meta.duration, FPS, explicit);
  issues.push(...partIssues);
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
  if (plan.theme === "dark" || plan.theme === "black") for (const s of shots) s.tone ??= "dark";
  // Every reel is a clean reel; YouTube has its own checks.
  const clean = !youtube;
  const { hook, issues: hookIssues } = clean ? resolveHook(plan.hook, words, shots, meta.duration, FPS, explicit) : { hook: undefined, issues: [] };
  issues.push(...hookIssues);
  issues.push(...(clean ? lintClean(shots, meta.duration, !!meta.script, hook, plan.cover) : lintWide(shots, meta.duration)));
  // The cover's card comes in from the library at the 3:4 band's size (1080 x 1440), so the renderer can
  // serve it and it loads at once; a full-size photo is several megabytes.
  let cover: Resolved["cover"];
  if (clean && plan.cover) {
    const from = ["png", "jpg"].map((x) => join(LIBRARY, "covers", `${plan.cover!.image}.${x}`)).find((f) => existsSync(f));
    if (!from) issues.push({ level: "error", message: `no cover card library/covers/${plan.cover.image}.png; drop Owain's blank card there` });
    else {
      const rel = `assets/cover-${plan.cover.image}.jpg`;
      if (!existsSync(join(dir, rel)) || statSync(join(dir, rel)).mtimeMs < statSync(from).mtimeMs)
        mkdirSync(join(dir, "assets"), { recursive: true }), ffmpeg(["-i", from, "-vf", "scale=1080:1440:force_original_aspect_ratio=increase,crop=1080:1440:(iw-1080)/2:0", "-q:v", "2", join(dir, rel)]);
      cover = { title: plan.cover.title, image: `${slug}/${rel}` };
    }
  }
  const onCamera = youtube ? cameraOnTimeline(dir, cut) : undefined;
  if (onCamera) issues.push(...lintOnCamera(shots, onCamera));
  else if (youtube && !meta.script && shots.some((s) => s.visual)) issues.push({ level: "warn", message: "no camera scan, so graphics cannot be checked against where you are on camera; run frames, then scan" });
  if (youtube) issues.push(...lintLeave(shots, plan.leave));
  // A removed stretch must start and end between words, and must not cut through a graphic.
  for (const [a, b] of plan.remove) {
    const cut = words.find((w) => (w.start < a && w.end > a + 0.02) || (w.start < b - 0.02 && w.end > b));
    if (cut) issues.push({ level: "error", message: `removing ${a}-${b}s cuts through the word "${cut.text}" (${cut.start.toFixed(2)}-${cut.end.toFixed(2)}s)` });
    shots.forEach((s, i) => {
      if (s.layout !== "full" && s.start < b && s.end > a) issues.push({ level: "error", message: `removing ${a}-${b}s cuts through ${shotLabel(s, i)}` });
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
  // The clean style's pictures: library shots are copied in like b-roll visuals. A split's bottom
  // panel may show a shot again (the library is small), but it is better not to.
  const pictures = new Map<string, number>();
  for (const s of shots) {
    if (!s.picture) continue;
    if (s.picture.src.startsWith("broll:")) {
      const rel = useClip(dir, s.picture.src.slice(6));
      if (!rel) issues.push({ level: "error", message: `no b-roll ${s.picture.src} in the library` });
      else s.picture = { ...s.picture, src: rel };
    } else if (!existsSync(join(dir, s.picture.src))) issues.push({ level: "error", message: `missing picture ${s.picture.src}` });
    pictures.set(s.picture.src, (pictures.get(s.picture.src) ?? 0) + 1);
    // A picture shorter than its shot loops back to its first frame, which reads as a glitch (Owain,
    // 2026-11-08: "some of it was 1s loops").
    const file = join(dir, s.picture.src);
    if (existsSync(file)) {
      const plays = (probe.duration(file) - s.picture.start) / s.picture.rate;
      if (s.end - s.start > plays + 0.05) issues.push({ level: "error", message: `picture ${s.picture.src} at "${s.anchor}" plays ${plays.toFixed(1)}s but the shot holds ${(s.end - s.start).toFixed(1)}s, so it loops; use a longer shot or cut the shot sooner` });
    }
  }
  for (const [src, n] of pictures) if (n > 1) issues.push({ level: "warn", message: `picture ${src} is used ${n} times; fresh b-roll reads better` });
  // Library logos ("logo:<name>", library/logos/<name>.svg or .png) become data URLs wherever they appear in a
  // visual (custom props included).
  const logos = (x: unknown): unknown =>
    typeof x === "string" && x.startsWith("logo:") ? useLogo(x.slice(5)) ?? (issues.push({ level: "error", message: `no logo ${x} in library/logos` }), x)
    : Array.isArray(x) ? x.map(logos)
    : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, logos(v)]))
    : x;
  for (const s of shots) if (s.visual) s.visual = logos(s.visual) as typeof s.visual;
  const seen = new Set<string>();
  for (const s of shots) {
    const v = s.visual;
    if (s.layout === "cutaway" && v?.kind !== "video") issues.push({ level: "error", message: `cutaway at "${s.anchor}" needs a video visual` });
    const srcs = !v ? [] : v.kind === "image" || v.kind === "video" ? [v.src] : v.kind === "logos" || v.kind === "logowall" || v.kind === "windows" ? v.items.map((i) => i.src) : v.kind === "cta" && v.src ? [v.src] : [];
    // The style's cards are sized for their slots' max lengths.
    if (v && !s.keep) for (const m of slotIssues(v)) issues.push({ level: "warn", message: `"${s.anchor}": ${m}` });
    for (const src of srcs) if (!src.startsWith("data:") && !existsSync(join(dir, src))) issues.push({ level: "error", message: `missing asset ${src}` });
    if (v?.kind === "windows") s.visual = { ...v, items: v.items.map((it) => ({ ...it, ...(existsSync(join(dir, it.src)) ? { size: imageSize(join(dir, it.src)) } : {}) })) };
    if (v?.kind === "image" && existsSync(join(dir, v.src))) {
      const size = imageSize(join(dir, v.src));
      // A page from `capture` has its words beside it, so the plan names words, not rects.
      const pageFile = join(dir, v.src.replace(/\.\w+$/, ".json"));
      const read = existsSync(pageFile) ? readJson<Page>(pageFile) : undefined;
      const page = Array.isArray(read?.runs) ? read : undefined;
      const { visual, errors } = placePhrases(v, page);
      for (const message of errors) issues.push({ level: "error", message: `"${s.anchor}": ${message}` });
      s.visual = { ...visual, size };
      // Page text of 16 CSS px is 16 x scale image px (captures are 3x, older ones 2x); under ~26 px
      // on the 1080 frame it is hard to read on a phone. Measured in the clean split's panel, where a
      // capture sits 48 px in from each side, from y 100 to 40 px above the caption band.
      const to = rectOf(visual.to);
      if (size && to && !youtube && s.layout === "split") {
        const { k } = frameRect(to, size[0], size[1], 1080 - 96, BAND.top - 40 - 100 - (v.frame === "browser" ? 64 : 0));
        const px = k * 16 * (page?.scale ?? 2);
        if (px < 26) issues.push({ level: "warn", message: `"${s.anchor}": ${v.src} ends too wide; 16px page text shows at ${Math.round(px)}px. Tighten "to".` });
      }
    }
    if (v?.kind === "video" && existsSync(join(dir, v.src))) {
      const moves = join(dir, v.src.replace(/\.\w+$/, ".json"));
      const screen = v.sync && existsSync(moves) ? readJson<{ zooms: ScreenZoom[]; ticks: number[]; warnings?: string[] }>(moves) : undefined;
      s.visual = { ...v, size: probe.size(join(dir, v.src)), ...(screen && { zooms: screen.zooms, ticks: screen.ticks }) };
      const clashes = zoomClashes(screen?.zooms ?? []).map((z) => `the zoom at ${z.t.toFixed(2)}s has not settled when the next one starts; hold it longer, or make the next a hard cut`);
      for (const message of [...(screen?.warnings ?? []), ...clashes]) if (!issues.some((i) => i.message === message)) issues.push({ level: "warn", message });
      // A recording is timed to the cut it was made for; it does not follow a re-cut as the anchors do.
      const cutFile = join(dir, "cut.json");
      if (v.sync && !s.keep && existsSync(cutFile) && statSync(cutFile).mtimeMs > statSync(join(dir, v.src)).mtimeMs) issues.push({ level: "warn", message: `"${s.anchor}": cut.json changed after ${v.src} was made, so the screen may be out of step with the words` });
      // A slowed clip lasts longer on screen.
      const left = (probe.duration(join(dir, v.src)) - (v.sync ? s.start : v.start)) / (v.rate ?? 1);
      if (!v.loop && s.end - s.start > left + 0.04) issues.push({ level: "error", message: `"${s.anchor}": shot is ${(s.end - s.start).toFixed(2)}s but ${v.src} has ${left.toFixed(2)}s from start ${v.start}` });
    }
    // A kept shot carries on the same clip; that is one use, not two.
    if (v?.kind === "video" && !s.keep && !v.sync) {
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
    const tail = meta.duration - probe.speechEnd(join(dir, "source/voice.wav"));
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
    style: youtube ? "ivory" : "clean",
    captions: plan.captions ?? !youtube,
    theme: plan.theme,
    palette: plan.palette,
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
    ...(hook ? { hook } : {}),
    ...(cover ? { cover } : {}),
    parts,
    chunks: chunkWords(words, plan.accents, [...shots.map((s) => s.start).slice(1), ...joins(cut)].sort((a, b) => a - b), FPS),
    sfx: clean ? cleanSfx(shots) : sfxEvents(shots),
  };
  // Plan checks from QC (engine/qc.ts): pacing, reading time, cuts in the footage, numbers on screen.
  const cutsFile = join(dir, "build/cuts.json");
  const found = existsSync(cutsFile) ? readJson<{ cuts: number[] }>(cutsFile).cuts : [];
  // Cuts found in the main clip, moved through the cut, plus every join in the cut itself.
  const cuts = [...mapTimes(cut, MAIN, found), ...joins(cut)].sort((a, b) => a - b);
  issues.push(...qcPlan(resolved, words, plan.shots.map((s) => s.note), cuts));
  if (youtube) issues.push(...saidTwice(words, plan.remove));
  // A card put in from the library starts with its sample words, which this video never says.
  plan.shots.forEach((s) => {
    const sample = s.visual && cards.find((c) => c.kind === s.visual!.kind)?.sample?.visual;
    if (sample && JSON.stringify(stripAnchors(s.visual)) === JSON.stringify(stripAnchors(sample)))
      issues.push({ level: "warn", message: `"${s.at}": the ${s.visual!.kind} still shows the library's sample words; put in what is said here` });
  });
  probe.save();
  // An export of a cut writes its own files: the editor re-resolves the plan whenever it reloads,
  // and must not swap the flattened cut out from under a running export.
  const name = exportCut ? "export" : "resolved";
  writeJson(join(dir, `build/edit.${name}.json`), resolved);
  writeJson(join(dir, exportCut ? "build/audio.export.json" : "build/audio.json"), { duration: meta.duration, canvas: plan.canvas, music: plan.music, voiceGain: plan.voiceGain, sfx: resolved.sfx, ...(exportCut ? { voice: exportCut.voice } : {}) });
  return { resolved, issues };
}

const LIBRARY_LOGOS = join(BROLL, "..", "logos");
// A library logo as a data URL, so any visual can draw it without knowing the project's folder.
// The official SVG when there is one (crisp at any size), else the PNG.
export function useLogo(name: string): string | undefined {
  for (const [ext, type] of [["svg", "image/svg+xml"], ["png", "image/png"]]) {
    const from = join(LIBRARY_LOGOS, `${name}.${ext}`);
    if (existsSync(from)) return `data:${type};base64,${readFileSync(from).toString("base64")}`;
  }
  return undefined;
}
