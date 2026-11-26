// The skeleton doc (`doc`): its rows, the grey bars standing in for its words, and when each part
// lands. Pure, so the renderer (effects/clean/doc.tsx), the sound and the tests agree.
import type { VisualSpec } from "./schema.ts";

type Doc = Extract<VisualSpec, { kind: "doc" }>;

// The card's measures, in the 960 px design space the view scales to its box.
export const DOC = { width: 960, pad: 52, head: 204, row: 64, tableRow: 74, cols: 58, bar: 16, scan: 1.4, draw: 0.035 };

// A bar's width as a share of its room, the same on every render: a paragraph's lines run long and
// its last line short, so the grey reads as text rather than a pattern.
const SHAPE = [0.96, 0.9, 0.98, 0.58, 0.93, 0.86, 0.97, 0.44];
const CELL = [0.72, 0.5, 0.86, 0.62, 0.4, 0.78, 0.56, 0.68, 0.46, 0.82];
export const barShare = (row: number, col = -1) => (col < 0 ? SHAPE[row % SHAPE.length] : CELL[(row * 3 + col * 7) % CELL.length]);

// The header: the icon and tag on a row of their own, the title under them, then a hairline.
export const docHead = (v: Pick<Doc, "icon" | "tag">) => (v.icon || v.tag ? DOC.head : DOC.head - 56);
export const docHeight = (v: Doc) => docHead(v) + (v.cols ? DOC.cols + v.rows * DOC.tableRow : v.rows * DOC.row) + DOC.pad;

// The scan comes first: it is said as the agent starts reading, before the line it finds.
export const docAnchors = (v: Doc) => [...(v.scan ? [v.scan] : []), ...v.marks.map((m) => m.at)];

// The frame is there on the cut; the rows draw in a quick cascade; each mark lands on its word; the
// scan sweeps the rows from its word.
export const docBeats = (v: Doc, start: number, times: number[] = []) => ({
  rows: Array.from({ length: v.rows }, (_, i) => start + 0.1 + i * DOC.draw),
  marks: v.marks.map((_, j) => times[j + (v.scan ? 1 : 0)] ?? start),
  scan: v.scan ? (times[0] ?? start) : undefined,
});

export const docIssues = (v: Doc): string[] => {
  const out: string[] = [];
  for (const m of v.marks) if (m.row > v.rows) out.push(`mark on row ${m.row}, but the doc has ${v.rows} rows`);
  if (v.tag && v.tag.length > 16) out.push(`tag "${v.tag}" is long; a tag is a word or two (16 letters at most)`);
  return out;
};
