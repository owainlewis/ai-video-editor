// A captured web page: `media/capture.ts` writes it beside the PNG (`assets/pages/<name>.json`) with
// every word's box, so a plan names the words to mark or frame and never types a rect by hand.
// Pure: no files, no browser.
import type { VisualSpec } from "./schema.ts";

// [x, y, width, height], each 0 to 1 of the captured image.
export type Box = [number, number, number, number];

export type Page = {
  url: string;
  title: string;
  // The favicon, saved beside the capture (a path inside the project), when the page has one.
  icon?: string;
  dark: boolean;
  // Device pixels per CSS pixel in the PNG.
  scale: number;
  // The capture's size in CSS pixels.
  size: [number, number];
  // Every word on the page inside the capture, in reading order: its letters (punctuation at either
  // end left out), its box, and the block (paragraph, list item, heading, cell) it sits in.
  runs: { text: string; box: Box; block: number }[];
  blocks: { tag: string; box: Box }[];
  // The form's fields, for an agent's `actions`: each one's label (its <label>, else its aria-label,
  // placeholder or name), its box, and how the page sets its text: `size` a fraction of the capture's
  // height, `pad` (left padding and border) of its width. A box keeps `checked`, itself ticked; a
  // field keeps `focused`, itself with focus.
  fields?: PageField[];
};

export type PageField = {
  label: string;
  kind: "text" | "check";
  box: Box;
  font?: { family?: string; size: number; weight?: number; color?: string; bg?: string; pad: number; secret?: boolean };
  checked?: string;
  // The field with focus, as the page draws it, and where that crop sits (a little outside `box`).
  focused?: { src: string; box: Box };
};

// A camera rect named by words on the page: the box around `phrase` (or around several phrases), or
// around the whole block it sits in, with `pad` (a fraction of the page's width) on every side.
export type PhraseFrame = { phrase: string | string[]; pad?: number; block?: boolean; nth?: number };

// A marker sits this far outside its words, in CSS pixels, as a highlighter pen does.
const MARK_PAD = { x: 4, y: 2 };
const DEFAULT_PAD = 0.04;

// Words compare without punctuation at either end, so "address." matches "address".
const core = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const tokens = (s: string) => s.split(/\s+/).map(core).filter(Boolean);

// Where `phrase` sits on the page: the indexes of its words, one list per match. Case counts when
// some match has the same case; otherwise any case matches.
function matches(page: Page, phrase: string): number[][] {
  const want = tokens(phrase);
  if (!want.length) return [];
  // Runs with no letters or digits (an arrow, a bullet) are skipped, as a reader skips them.
  const idx = page.runs.flatMap((r, i) => (core(r.text) ? [i] : []));
  const find = (eq: (a: string, b: string) => boolean) => {
    const out: number[][] = [];
    for (let s = 0; s + want.length <= idx.length; s++) {
      if (want.every((w, k) => eq(core(page.runs[idx[s + k]].text), w))) out.push(idx.slice(s, s + want.length));
    }
    return out;
  };
  const exact = find((a, b) => a === b);
  return exact.length ? exact : find((a, b) => a.toLowerCase() === b.toLowerCase());
}

const edits = (a: string, b: string) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};

// The page's phrases most like `phrase`, closest first: runs of the same number of words, give or take one.
export function closest(page: Page, phrase: string, n = 3): string[] {
  const want = tokens(phrase).join(" ").toLowerCase();
  const words = page.runs.map((r) => core(r.text)).filter(Boolean);
  const len = tokens(phrase).length;
  const seen = new Map<string, number>();
  for (const l of [len, len - 1, len + 1]) {
    if (l < 1) continue;
    for (let s = 0; s + l <= words.length; s++) {
      const cand = words.slice(s, s + l).join(" ");
      if (seen.has(cand)) continue;
      seen.set(cand, edits(cand.toLowerCase(), want));
    }
  }
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, n).map(([c]) => c);
}

const union = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map((b) => b[0])), y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2])), y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};

const round = (b: Box): Box => b.map((v) => Math.round(v * 10000) / 10000) as Box;

// Grow a box by (x, y) fractions of the image, kept inside the image.
const grow = (b: Box, x: number, y: number): Box => {
  const x0 = Math.max(0, b[0] - x), y0 = Math.max(0, b[1] - y);
  const x1 = Math.min(1, b[0] + b[2] + x), y1 = Math.min(1, b[1] + b[3] + y);
  return round([x0, y0, x1 - x0, y1 - y0]);
};

// A phrase on the page: its boxes, one per line it runs over, and the block it starts in. Throws when
// the page does not have it, naming the closest phrases it does have. `nth` picks a later match.
export function findPhrase(page: Page, phrase: string, nth = 1): { lines: Box[]; block: number } {
  const found = matches(page, phrase);
  if (!found.length) {
    const near = closest(page, phrase);
    throw new Error(`"${phrase}" is not on the page${near.length ? `; closest: ${near.map((c) => `"${c}"`).join(", ")}` : ""}`);
  }
  if (nth > found.length) throw new Error(`"${phrase}" is on the page ${found.length} time${found.length > 1 ? "s" : ""}, not ${nth}`);
  const runs = found[nth - 1].map((i) => page.runs[i]);
  // A new line starts where a word's middle sits below the line so far.
  const lines: Box[][] = [];
  for (const r of runs) {
    const line = lines.at(-1);
    const last = line?.at(-1);
    if (line && last && r.box[1] + r.box[3] / 2 < last[1] + last[3] && r.box[0] >= last[0]) line.push(r.box);
    else lines.push([r.box]);
  }
  return { lines: lines.map(union), block: runs[0].block };
}

// The marker's rect for a phrase, a few pixels outside its words. A phrase that wraps onto a second
// line cannot be one marker.
export function markRect(page: Page, phrase: string, nth = 1): Box {
  const { lines } = findPhrase(page, phrase, nth);
  if (lines.length > 1) throw new Error(`"${phrase}" runs over ${lines.length} lines on the page; mark a shorter phrase, or each line on its own`);
  return grow(lines[0], MARK_PAD.x / page.size[0], MARK_PAD.y / page.size[1]);
}

// A camera rect for words on the page.
export function phraseFrame(page: Page, f: PhraseFrame): Box {
  const phrases = Array.isArray(f.phrase) ? f.phrase : [f.phrase];
  const boxes = phrases.flatMap((p) => {
    const hit = findPhrase(page, p, f.nth ?? 1);
    return f.block && page.blocks[hit.block] ? [page.blocks[hit.block].box] : hit.lines;
  });
  const pad = f.pad ?? DEFAULT_PAD;
  return grow(union(boxes), pad, (pad * page.size[0]) / page.size[1]);
}

// The field labelled `name`: same words, any case, else the one whose label starts with them.
export function findField(page: Page, name: string, nth = 1): PageField {
  const want = tokens(name).join(" ").toLowerCase();
  const label = (f: PageField) => tokens(f.label).join(" ").toLowerCase();
  const fields = page.fields ?? [];
  const exact = fields.filter((f) => label(f) === want);
  const found = exact.length ? exact : fields.filter((f) => label(f).startsWith(want));
  if (!found.length) {
    const near = [...fields].sort((a, b) => edits(label(a), want) - edits(label(b), want)).slice(0, 3);
    throw new Error(`no field labelled "${name}" on the page${near.length ? `; its fields: ${near.map((f) => `"${f.label}"`).join(", ")}` : " (capture it again to find its fields)"}`);
  }
  if (nth > found.length) throw new Error(`"${name}" labels ${found.length} field${found.length > 1 ? "s" : ""}, not ${nth}`);
  return found[nth - 1];
}

export type ImageSpec = Extract<VisualSpec, { kind: "image" }>;

// An image visual with its named words turned into rects, and the page's own address on a browser
// window that does not give its own. Every phrase the page lacks is an error.
export function placePhrases(v: ImageSpec, page: Page | undefined): { visual: ImageSpec; errors: string[] } {
  const errors: string[] = [];
  const named = [v.from, v.to].some((r) => r && !Array.isArray(r)) || v.highlight.some((h) => h.phrase) || !!v.actions?.some((a) => a.field || a.phrase);
  if (!page) {
    if (named) errors.push(`${v.src} has no page json beside it, so it cannot name words; capture it with \`studio capture\`, or give rects`);
    return { visual: v, errors };
  }
  const attempt = <R>(f: () => R): R | undefined => {
    try {
      return f();
    } catch (e) {
      errors.push((e as Error).message);
      return undefined;
    }
  };
  const camera = (r: ImageSpec["from"]) => (r && !Array.isArray(r) ? attempt(() => phraseFrame(page, r)) : r);
  const visual: ImageSpec = {
    ...v,
    from: camera(v.from),
    to: camera(v.to),
    highlight: v.highlight.map((h) => (h.phrase ? { ...h, rect: attempt(() => markRect(page, h.phrase!, h.nth ?? 1)) } : h)),
    // A field brings its box, its text style and its ticked look; a phrase to click, its first line.
    actions: v.actions?.map((a) => {
      if (a.field) {
        const f = attempt(() => findField(page, a.field!, a.nth ?? 1));
        if (f && a.act === "type" && f.kind !== "text") errors.push(`"${a.field}" is a box to check, not a field to type into`);
        if (f && a.act === "check" && f.kind !== "check") errors.push(`"${a.field}" is a field to type into, not a box to check`);
        return f ? { ...a, rect: f.box, ...(f.font && { font: f.font }), ...(f.checked && { checked: f.checked }), ...(f.focused && { focused: f.focused }) } : a;
      }
      if (a.phrase) {
        const hit = attempt(() => findPhrase(page, a.phrase!, a.nth ?? 1));
        return hit ? { ...a, rect: hit.lines[0] } : a;
      }
      return a;
    }),
    // The tab's title and favicon stay the plan's choice: the page json has them to copy in.
    ...(v.frame === "browser" && { url: v.url ?? page.url }),
  };
  return { visual, errors };
}
