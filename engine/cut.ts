// The cut as a timeline: where each segment lands, what is said on the timeline, and the edits the
// editor makes (split, trim, ripple delete, move, insert). Pure, so it is easy to test. Times on the
// timeline are seconds of the finished video; `in` and `out` are seconds of a segment's own clip.
import type { Issue } from "./resolve.ts";
import { type CutPlan, type CutSegment, MAIN, type Word } from "./schema.ts";

export type Placed = CutSegment & { start: number; end: number };

// A project with no cut.json: its one clip, whole.
export const wholeCut = (duration: number): CutPlan => ({ segments: [{ id: "s1", src: MAIN, in: 0, out: duration }] });

export const placed = (cut: CutPlan): Placed[] => {
  let t = 0;
  return cut.segments.map((s) => {
    const start = t;
    t += s.out - s.in;
    return { ...s, start, end: t };
  });
};

export const cutLength = (cut: CutPlan) => cut.segments.reduce((sum, s) => sum + s.out - s.in, 0);

// What is said on the timeline: each segment's words, moved to where the segment plays. A word cut
// through by an edge stays if most of it plays, clamped to the edge (`clippedWords` warns about it).
export function cutWords(cut: CutPlan, words: Record<string, Word[]>): Word[] {
  return placed(cut).flatMap((s) =>
    (words[s.src] ?? [])
      .filter((w) => (w.start + w.end) / 2 >= s.in && (w.start + w.end) / 2 < s.out)
      .map((w) => ({ text: w.text, start: +(s.start + Math.max(w.start, s.in) - s.in).toFixed(3), end: +(s.start + Math.min(w.end, s.out) - s.in).toFixed(3) })),
  );
}

// The segment playing at timeline time `t` (the last one at the very end), and the clip time there.
export function atTime(cut: CutPlan, t: number): { seg: Placed; index: number; local: number } | null {
  const all = placed(cut);
  if (!all.length) return null;
  const index = Math.max(0, all.findIndex((s) => t < s.end));
  const k = t >= all[all.length - 1].end ? all.length - 1 : index;
  const seg = all[k];
  return { seg, index: k, local: seg.in + Math.min(seg.end, Math.max(seg.start, t)) - seg.start };
}

// Stretches of one clip's own time (on-camera ranges, cuts in the footage) as they fall on the timeline.
export function mapRanges(cut: CutPlan, src: string, ranges: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const s of placed(cut)) {
    if (s.src !== src) continue;
    for (const [a, b] of ranges) {
      const lo = Math.max(a, s.in), hi = Math.min(b, s.out);
      if (hi <= lo) continue;
      const range: [number, number] = [s.start + lo - s.in, s.start + hi - s.in];
      const last = out[out.length - 1];
      if (last && Math.abs(last[1] - range[0]) < 1e-6) last[1] = range[1];
      else out.push(range);
    }
  }
  return out.sort((x, y) => x[0] - y[0]);
}

export const mapTimes = (cut: CutPlan, src: string, times: number[]) =>
  placed(cut).flatMap((s) => (s.src === src ? times.filter((t) => t >= s.in && t < s.out).map((t) => s.start + t - s.in) : [])).sort((a, b) => a - b);

// Where segments join on the timeline.
export const joins = (cut: CutPlan) => placed(cut).slice(1).map((s) => s.start);

// A segment edge inside a word clips it: the viewer hears half a word.
export function clippedWords(cut: CutPlan, words: Record<string, Word[]>): Issue[] {
  return placed(cut).flatMap((s, i) =>
    (["in", "out"] as const).flatMap((edge) => {
      const t = s[edge];
      const w = (words[s.src] ?? []).find((x) => x.start < t - 0.02 && x.end > t + 0.02);
      return w ? [{ level: "warn" as const, message: `segment ${i + 1} ${edge === "in" ? "starts" : "ends"} inside the word "${w.text}" (${s.src} ${w.start.toFixed(2)}-${w.end.toFixed(2)}s); trim it to a word edge` }] : [];
    }),
  );
}

export const nextId = (cut: CutPlan) => `s${1 + Math.max(0, ...cut.segments.map((s) => parseInt(s.id.replace(/\D/g, ""), 10) || 0))}`;

// The shortest a segment may be: two frames.
const MIN = 2 / 30;

// Split the segment under timeline time `t` in two. Nothing changes on screen.
export function splitAt(cut: CutPlan, t: number): CutPlan {
  const hit = atTime(cut, t);
  if (!hit || hit.local - hit.seg.in < MIN || hit.seg.out - hit.local < MIN) return cut;
  const { start: _s, end: _e, ...seg } = hit.seg;
  const segments = [...cut.segments];
  segments.splice(hit.index, 1, { ...seg, out: hit.local }, { ...seg, id: nextId(cut), in: hit.local });
  return { segments };
}

// Remove a segment and close the gap.
export const rippleDelete = (cut: CutPlan, id: string): CutPlan => ({ segments: cut.segments.filter((s) => s.id !== id) });

// Move one edge of a segment to `t` in its clip, kept inside the clip (0 to `length`) and at least
// two frames long. Everything after it ripples.
export function trimEdge(cut: CutPlan, id: string, edge: "in" | "out", t: number, length = Infinity): CutPlan {
  return {
    segments: cut.segments.map((s) => {
      if (s.id !== id) return s;
      const v = edge === "in" ? Math.max(0, Math.min(t, s.out - MIN)) : Math.min(length, Math.max(t, s.in + MIN));
      return { ...s, [edge]: +v.toFixed(3) };
    }),
  };
}

// Move a segment so it plays at position `to` (0 is first).
export function moveSegment(cut: CutPlan, id: string, to: number): CutPlan {
  const from = cut.segments.findIndex((s) => s.id === id);
  if (from < 0) return cut;
  const segments = [...cut.segments];
  const [seg] = segments.splice(from, 1);
  segments.splice(Math.max(0, Math.min(segments.length, to)), 0, seg);
  return { segments };
}

// Put a stretch of a clip into the cut at position `at`.
export function insertSegment(cut: CutPlan, src: string, from: number, to: number, at = cut.segments.length): CutPlan {
  const segments = [...cut.segments];
  segments.splice(Math.max(0, Math.min(segments.length, at)), 0, { id: nextId(cut), src, in: from, out: to });
  return { segments };
}

// The position a segment dropped at timeline time `t` goes to: before the segment whose middle is
// after `t`.
export const slotAt = (cut: CutPlan, t: number) => {
  const k = placed(cut).findIndex((s) => t < (s.start + s.end) / 2);
  return k < 0 ? cut.segments.length : k;
};

// The word edge nearest clip time `t`, for trimming: an in point lands just before a word starts, an
// out point just after one ends, never more than halfway into the pause, so no word is clipped.
export function snapEdge(words: Word[], t: number, edge: "in" | "out"): number {
  if (!words.length) return t;
  const edges = words.map((w, i) => {
    if (edge === "in") {
      const gap = i ? w.start - words[i - 1].end : w.start;
      return Math.max(0, w.start - Math.min(0.06, gap / 2));
    }
    const gap = words[i + 1] ? words[i + 1].start - w.end : 0.12;
    return w.end + Math.min(0.06, gap / 2);
  });
  return edges.reduce((best, e) => (Math.abs(e - t) < Math.abs(best - t) ? e : best), edges[0]);
}
