// A video's parts (intro, part 1, part 2): named stretches of the timeline, each edited and tested on
// its own. A part starts on a spoken phrase, as a shot does, and runs to the start of the next, so
// parts cover the video with no gaps and follow their words through any re-cut. Also the frame
// arithmetic for rendering one stretch on its own. Pure, so it is easy to test.
import { CUT_LEAD, findPhrase, type Issue, snap } from "./resolve.ts";
import type { EditPlan, ResolvedPart, Word } from "./schema.ts";

export type Range = { start: number; end: number };
// Frames of the timeline, from `a` up to but not including `b`.
export type FrameWindow = { a: number; b: number };
// A render of one stretch: what to render and the file in renders/ it goes to.
export type Preview = { range: Range; file: string };

export const partSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// `cut`: the words are the cut's, so a part whose words were cut out is left out with a warning, the
// same way a shot is, and the first part that is left starts the video.
export function resolveParts(parts: EditPlan["parts"], words: Word[], duration: number, fps = 30, cut = false) {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const found: { name: string; i: number }[] = [];
  let cursor = 0;
  for (const p of parts) {
    const key = partSlug(p.name);
    if (!key) issues.push({ level: "error", message: `part "${p.name}" needs a name with letters or numbers` });
    else if (seen.has(key)) issues.push({ level: "error", message: `two parts are called "${p.name}"` });
    seen.add(key);
    let i = findPhrase(words, p.at, cursor);
    if (i < 0 && cut) {
      const used = new Set(found.map((f) => f.i));
      for (let from = 0; (i = findPhrase(words, p.at, from)) >= 0 && used.has(i); from = i + 1);
    }
    if (i < 0) {
      issues.push(cut ? { level: "warn", message: `"${p.at}" is no longer said in the cut, so part "${p.name}" is left out` } : { level: "error", message: `part "${p.name}": "${p.at}" is not said after the part before it` });
      continue;
    }
    cursor = i + 1;
    found.push({ name: p.name, i });
  }
  if (cut) found.sort((x, y) => x.i - y.i);
  // The same start as a shot on the same words, so a part and its chapter card land on one frame.
  const starts = found.map((f, k) => (k === 0 ? 0 : snap(Math.max(0, words[f.i].start - CUT_LEAD), fps)));
  const out: ResolvedPart[] = found.map((f, k) => ({ name: f.name, anchor: parts.find((p) => p.name === f.name)!.at, start: starts[k], end: starts[k + 1] ?? duration }));
  for (const p of out) if (p.end <= p.start) issues.push({ level: "error", message: `part "${p.name}" has no length; it starts where the next one does` });
  return { parts: out, issues };
}

const fileOf = (slug: string) => `${slug.startsWith("part-") ? slug : `part-${slug}`}.mp4`;
// The file a part renders to, in renders/.
export const partFile = (name: string) => fileOf(partSlug(name));

// What `render --part <name>` or `render --from <s> --to <s>` asks for, as a stretch of the timeline
// and a file for it. Undefined when it asks for the whole video.
export function pickPreview(parts: ResolvedPart[], duration: number, ask: { part?: string; from?: string; to?: string }): Preview | undefined {
  if (ask.part !== undefined) {
    if (ask.from !== undefined || ask.to !== undefined) throw new Error("use --part, or --from and --to, not both");
    const key = partSlug(ask.part);
    const p = parts.find((x) => partSlug(x.name) === key);
    if (!p) throw new Error(`no part called "${ask.part}"; this project has ${parts.length ? parts.map((x) => `"${x.name}"`).join(", ") : "none"}`);
    return { range: { start: p.start, end: p.end }, file: fileOf(key) };
  }
  if (ask.from === undefined && ask.to === undefined) return undefined;
  const start = ask.from === undefined ? 0 : Number(ask.from);
  const end = Math.min(duration, ask.to === undefined ? duration : Number(ask.to));
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end <= start) throw new Error(`--from and --to need seconds on the timeline, from before to, inside ${duration.toFixed(2)}s`);
  return { range: { start, end }, file: fileOf(`${start}-${end}`) };
}

export const frameWindow = (r: Range, fps: number): FrameWindow => ({ a: Math.round(r.start * fps), b: Math.round(r.end * fps) });

// The frames of one segment of the flattened cut (from `a`, `n` long) inside a window: how many to
// skip from its start and how many to keep. Null when none of it plays. Taken from the whole cut's
// frame edges, so a part has the same frames on the same frame numbers as the finished video.
export function segmentInWindow(f: { a: number; n: number }, w: FrameWindow): { skip: number; n: number } | null {
  const from = Math.max(f.a, w.a), to = Math.min(f.a + f.n, w.b);
  return to > from ? { skip: from - f.a, n: to - from } : null;
}

// The frames (first to last, inclusive) of a graphic section, cut to a window. A section that starts
// before the window picks up mid-graphic, as it stands at that frame in the finished video.
export function sectionFrames(s: Range, fps: number, w?: FrameWindow | null): { from: number; to: number } | null {
  const from = Math.round(s.start * fps), end = Math.round(s.end * fps);
  const whole = { from, to: Math.max(from, end - 1) };
  if (!w) return whole;
  if (from >= w.b || end <= w.a) return null;
  return { from: Math.max(from, w.a), to: Math.min(whole.to, w.b - 1) };
}

// When ffmpeg lays a graphic over the picture. The start is half a frame early: written to three
// decimals, a start exactly on a frame's time can round past it and lose the graphic's first frame.
export const overlayEnable = (s: Range, fps: number) => `between(t,${(s.start - 0.5 / fps).toFixed(3)},${(s.end + 1 / fps).toFixed(3)})`;

// Stretches of the timeline (the plan's `remove`) as they fall inside a window starting at `base` and
// `length` long, in the window's own time.
export const rangesInWindow = (ranges: [number, number][], base: number, length: number): [number, number][] =>
  ranges.map(([a, b]): [number, number] => [Math.max(0, a - base), Math.min(length, b - base)]).filter(([a, b]) => b > a);
