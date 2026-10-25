// Quality checks before anything is rendered (Owain, 2026-10-25: "it's expensive to fix afterwards").
// Two kinds. Plan checks read the resolved plan and the transcript: pacing, reading time, cuts in the
// footage, numbers that were never said. Layout checks read measurements of real frames, taken in a
// headless browser by `studio qc` (media/qc.ts): safe area, collisions, orphans, type size, contrast,
// balance. Errors stop an export; warnings are reported.
import type { Issue } from "./resolve.ts";
import type { Resolved, ResolvedShot, Word } from "./schema.ts";

// ---------- plan checks ----------

const SKIP = new Set(["kind", "at", "src", "settle", "times", "words", "type", "highlight", "from", "to", "rate", "start", "loop", "hit", "sync", "even", "preview", "bottleneck", "active", "of"]);

// Every piece of text a visual puts on screen.
export const visualText = (v: unknown): string[] => {
  if (typeof v === "string") return [v.replace(/\*/g, "").replace(/\/\//g, "")];
  if (Array.isArray(v)) return v.flatMap(visualText);
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => (SKIP.has(k) ? [] : visualText(x)));
  return [];
};

const label = (s: ResolvedShot, i: number) => `shot ${i + 1} (${s.start.toFixed(2)}s "${s.anchor}")`;
const digits = (t: string) => (t.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]/g, "")).filter((n) => n.length);

export const qcPlan = (r: Resolved, words: Word[], notes: (string | undefined)[], cuts: number[] = []): Issue[] => {
  const issues: Issue[] = [];
  const graphic = (s: ResolvedShot) => !!s.visual && !s.keep && s.layout !== "full";
  r.shots.forEach((s, i) => {
    if (!graphic(s)) return;
    const v = s.visual!;
    const text = visualText(v).join(" ");
    const len = s.end - s.start;
    // Reading time: about a second to take in a card, plus a quarter of a second a word.
    const n = text.split(/\s+/).filter(Boolean).length;
    const need = 1 + 0.22 * n;
    if (s.layout !== "side" && len < need && v.kind !== "chapter" && v.kind !== "stat")
      issues.push({ level: "warn", message: `${label(s, i)}: ${n} words on screen for ${len.toFixed(1)}s; about ${need.toFixed(1)}s to read` });
    // Lingering: once the last part has landed, a graphic has made its point. Hold about two seconds,
    // then cut back (Owain, 2026-10-25: "sometimes the graphics linger a bit too long").
    const last = Math.max(s.start, ...(v.times ?? []).filter((t) => t < s.end), ...((v as { words?: number[] }).words ?? []));
    const linger = s.end - last;
    const settle = v.kind === "constraint" ? 5 : 3;
    if (s.layout !== "over" && v.kind !== "chapter" && linger > settle)
      issues.push({ level: "warn", message: `${label(s, i)}: lingers ${linger.toFixed(1)}s after its last part lands; end it about 2s after` });
    // Two full-frame cards back to back: cut to Owain between them.
    const next = r.shots[i + 1];
    if (s.layout === "media" && next && next.layout === "media" && !next.keep)
      issues.push({ level: "warn", message: `${label(s, i)}: followed straight by another full-frame card; cut back to the picture between them` });
    // An overlay that runs over a cut in the footage sits on two different pictures.
    if (s.layout === "over" || s.layout === "side") {
      const cut = cuts.find((c) => c > s.start + 0.2 && c < s.end - 0.2);
      if (cut !== undefined) issues.push({ level: "error", message: `${label(s, i)}: runs over a cut in the footage at ${cut.toFixed(2)}s; end it before the cut` });
    }
    // Numbers on screen must be said nearby, or come from the plan's note or the visual's source.
    if (v.kind !== "chapter" && v.kind !== "journey") {
      const said = new Set(words.filter((w) => w.start > s.start - 20 && w.start < s.end + 20).flatMap((w) => digits(w.text)));
      const noted = new Set([...digits(notes[i] ?? ""), ...digits("source" in v ? String((v as { source?: string }).source ?? "") : "")]);
      const owed = digits(text).filter((d) => !said.has(d) && !noted.has(d) && !(v.kind === "waffle" && d === String((v as { value: number }).value) && said.has(d)));
      for (const d of new Set(owed)) issues.push({ level: "warn", message: `${label(s, i)}: shows ${d}, which is not said nearby or given in the note or source` });
    }
    // Count-ups flash numbers that were never said; Owain accepts them, but say so.
    if ((v.kind === "stat" && !v.hit) || v.kind === "waffle" || v.kind === "ring" || v.kind === "meter")
      issues.push({ level: "warn", message: `${label(s, i)}: counts up from zero, so it briefly shows numbers that were never said` });
    // A comparison strikes through its left side: only right when the left is a myth.
    if (v.kind === "compare" && !v.even)
      issues.push({ level: "warn", message: `${label(s, i)}: strikes through "${v.left.text}"; set "even": true if both sides are right` });
  });
  return issues;
};

// Said twice: a stretch that shares many short runs of words with one a few minutes before it,
// usually a section recorded twice and both takes left in (Owain, 2026-10-25: "In the final output I
// repeat the same section twice"). Retakes are paraphrased, so it counts 4-word runs in 30 s windows;
// on the Code Review video the real repeat shared 17 and nothing else more than 9. A repeat with one
// copy in a removed stretch is already handled.
export const saidTwice = (words: Word[], remove: [number, number][] = []): Issue[] => {
  const N = 4, WINDOW = 30, ENOUGH = 10;
  const gone = (t: number) => remove.some(([a, b]) => t >= a && t < b);
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9']/g, "");
  const runs = new Map<string, number[]>();
  for (let i = 0; i + N <= words.length; i++) {
    if (gone(words[i].start)) continue;
    const key = words.slice(i, i + N).map((w) => norm(w.text)).join(" ");
    runs.set(key, [...(runs.get(key) ?? []), i]);
  }
  const shared = new Map<string, number>();
  for (const at of runs.values())
    for (const a of at)
      for (const b of at) {
        const dt = words[b].start - words[a].start;
        if (dt > 20 && dt < 300) {
          const key = `${Math.floor(words[b].start / WINDOW) * WINDOW} ${Math.floor(words[a].start / WINDOW) * WINDOW}`;
          shared.set(key, (shared.get(key) ?? 0) + 1);
        }
      }
  return [...shared.entries()]
    .filter(([, n]) => n >= ENOUGH)
    .map(([key, n]) => {
      const [later, earlier] = key.split(" ").map(Number);
      return { level: "warn" as const, message: `${later}-${later + WINDOW}s repeats ${earlier}-${earlier + WINDOW}s (${n} shared phrases): a section said twice? Remove one take (plan "remove")` };
    });
};

// ---------- layout checks ----------

export type Box = [number, number, number, number]; // left, top, width, height
export type Measure = {
  texts: { text: string; box: Box; size: number; opacity: number; color: string; block: number; under?: string; clipped?: boolean }[];
  marks: { box: Box; opacity: number }[];
  words: { block: number; top: number; h: number }[];
  paint?: Box[];
};

// The frame's safe area: clear of the edges, and higher clearance at the bottom, where YouTube's
// player controls and Instagram's caption sit.
export const SAFE = { x: 0.05, top: 0.05, bottom: 0.085 };
const MIN_GAP = 6;
const visible = (o: number) => o >= 0.3;

const gap = (a: Box, b: Box) => {
  const dx = Math.max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]), 0);
  const dy = Math.max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]), 0);
  return Math.max(dx, dy);
};
const overlap = (a: Box, b: Box) => Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) > 2 && Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) > 2;
const short = (t: string) => (t.length > 28 ? `${t.slice(0, 26)}...` : t);

const rgb = (c: string) => (c.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const contrast = (fg: number[], bg: number[], alpha = 1) => {
  const mix = fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
  const [a, b] = [lum(mix), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

// `bg` is the card's background (hex) for designed frames; on footage contrast is not checked.
export const qcLayout = (m: Measure, size: [number, number], where: string, bg?: string, full = false): Issue[] => {
  const [W, H] = size;
  const issues: Issue[] = [];
  const texts = m.texts.filter((t) => visible(t.opacity));
  const err = (message: string) => issues.push({ level: "error", message: `${where}: ${message}` });
  const warn = (message: string) => issues.push({ level: "warn", message: `${where}: ${message}` });
  for (const t of texts) {
    const [x, y, w, h] = t.box;
    if (x < W * SAFE.x || x + w > W * (1 - SAFE.x) || y < H * SAFE.top || y + h > H * (1 - SAFE.bottom))
      err(`"${short(t.text)}" is outside the safe area (${Math.round(x)},${Math.round(y)} ${Math.round(w)}x${Math.round(h)})`);
    if (t.clipped) err(`"${short(t.text)}" is cut off by its container`);
    if (t.opacity >= 0.6 && t.size < 20) err(`"${short(t.text)}" is ${t.size.toFixed(0)}px, too small to read at 1080p`);
    else if (t.opacity >= 0.6 && t.size < 24) warn(`"${short(t.text)}" is ${t.size.toFixed(0)}px, small at 1080p`);
    // Faded items (a list's earlier rows, a preview) are faint on purpose; check what is meant to be read.
    if (bg && t.opacity >= 0.9) {
      const ratio = contrast(rgb(t.color), t.under ? rgb(t.under) : hex(bg), Math.min(1, t.opacity));
      if (ratio < 3) warn(`"${short(t.text)}" has low contrast (${ratio.toFixed(1)}:1)`);
    }
    for (const k of m.marks.filter((q) => visible(q.opacity)))
      if (gap(t.box, k.box) < MIN_GAP) err(`"${short(t.text)}" touches a line or dot (${gap(t.box, k.box).toFixed(0)}px)`);
  }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const [a, b] = [texts[i], texts[j]];
      // Runs of text in one block (inline `code` inside a sentence) are laid out by the browser and
      // cannot collide; a multi-line sentence's box simply contains them.
      if (a.block !== b.block && overlap(a.box, b.box)) err(`"${short(a.text)}" overlaps "${short(b.text)}"`);
      // Side by side on one line: they need a little air (the "x" jammed into the "12").
      const sameLine = Math.min(a.box[1] + a.box[3], b.box[1] + b.box[3]) - Math.max(a.box[1], b.box[1]) > 0.5 * Math.min(a.box[3], b.box[3]);
      if (sameLine && !overlap(a.box, b.box) && gap(a.box, b.box) < Math.max(4, 0.03 * Math.min(a.size, b.size))) {
        // Touching: separate pieces of text whose letters run into each other (the odometer's zeros).
        if (gap(a.box, b.box) < 1 && Math.min(a.size, b.size) >= 40) err(`"${short(a.text)}" and "${short(b.text)}" touch`);
        else if (a.block !== b.block) warn(`"${short(a.text)}" and "${short(b.text)}" sit very tight (${gap(a.box, b.box).toFixed(0)}px)`);
      }
    }
  // A last line with a single word on it ("review" alone under a title).
  const blocks = new Map<number, number[]>();
  for (const w of m.words) blocks.set(w.block, [...(blocks.get(w.block) ?? []), w.top]);
  for (const [block, tops] of blocks) {
    const lines: number[] = [];
    // A new line starts well below the last (a raised "%" is not a new line).
    const h = Math.max(...m.words.filter((w) => w.block === block).map((w) => w.h));
    for (const t of [...tops].sort((a, b) => a - b)) if (!lines.length || t - lines[lines.length - 1] > h * 0.6) lines.push(t);
    // Short labels (under four words) may wrap however they like.
    if (lines.length < 2 || tops.length < 4) continue;
    const last = tops.filter((t) => Math.abs(t - lines[lines.length - 1]) <= h * 0.6).length;
    const owner = m.texts.find((t) => t.block === block);
    if (last === 1 && owner && visible(owner.opacity)) warn(`a line ends with one word on its own ("${short(owner.text)}...")`);
  }
  // A full-frame card should sit near the middle of the frame.
  if (full && texts.length) {
    const all = [...texts.map((t) => t.box), ...m.marks.filter((q) => visible(q.opacity)).map((q) => q.box), ...(m.paint ?? [])];
    const l = Math.min(...all.map((b) => b[0])), r = Math.max(...all.map((b) => b[0] + b[2]));
    const t = Math.min(...all.map((b) => b[1])), b = Math.max(...all.map((b) => b[1] + b[3]));
    const dx = (l + r) / 2 - W / 2, dy = (t + b) / 2 - H / 2;
    if (Math.abs(dx) > W * 0.08) warn(`the card sits ${Math.round(Math.abs(dx))}px ${dx > 0 ? "right" : "left"} of centre`);
    if (Math.abs(dy) > H * 0.1) warn(`the card sits ${Math.round(Math.abs(dy))}px ${dy > 0 ? "below" : "above"} centre`);
  }
  return issues;
};
