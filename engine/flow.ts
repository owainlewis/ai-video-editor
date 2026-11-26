// The `flow` diagram's layout engine (2026-11-13). Hand-placed coordinates made amateur diagrams:
// labels jammed against shapes, arrows at odd angles, empty boxes, everything huddled at the top of
// the panel. Here every position comes from the shape, the content and a few spacing tokens, so the
// result is the same every time:
//   - nodes are cards of one size, with equal gaps between them, centred in the box;
//   - the label size is the largest at which every card's words fit (two lines at most);
//   - the graphic spans at least FLOW.fill of its box's height and width;
//   - every label sits at least FLOW.clear from any line, and every arrow runs straight or in right
//     angles, ending FLOW.inset short of the card it reaches.
// Pure functions: the renderer (effects/clean/flow.tsx) draws what this returns, and the tests check it.
import type { VisualSpec } from "./schema.ts";

export type Flow = Extract<VisualSpec, { kind: "flow" }>;
export type FlowShape = Flow["shape"];

export const FLOW = {
  clear: 24, // any text to any line or card edge
  inset: 16, // an arrow's ends to the cards it joins
  arrow: 64, // the shortest arrow, head included
  head: 15, // the arrowhead's length (its half-width is 0.6 of it)
  stroke: 3,
  pad: 0.7, // padding round a card's content, in label sizes (24 at least)
  cross: 0.6, // the gap between cards side by side in one rank, in label sizes (32 at least)
  radius: 0.42, // card corners, in label sizes
  fill: 0.62, // the share of its box the graphic spans, at least, across and down
  max: 64, // label sizes, largest and smallest
  min: 28,
  sub: 0.6, // a sub-label's size, of the label's (26 at least: QC calls under 24 small)
  icon: 1.6, // an icon's size, of the label's
  tall: 2.1, // a card is never taller than this many times its width
};

// The line icons a node can carry (drawn in effects/clean/flow.tsx), besides a real logo.
export const FLOW_ICONS = ["file", "folder", "terminal", "browser", "database", "server", "cloud", "user", "agent", "chat", "mail", "code", "branch", "lock", "check", "gear"] as const;
export const isImageIcon = (s?: string) => !!s && (s.startsWith("logo:") || s.startsWith("data:") || /\.(png|jpe?g|svg|webp)$/i.test(s));

// ---------- text widths (Helvetica's advance widths, in thousandths of an em) ----------

const table = (rows: string[]) => Object.fromEntries(rows.flatMap((row) => { const n = Number(row.slice(0, row.indexOf(" "))); return [...row.slice(row.indexOf(" ") + 1)].map((c) => [c, n]); }));
const BOLD: Record<string, number> = table(["238 '", "278  ,./\\iIjl", "280 |", "333 !()-:;[]`ft", "389 *r{}", "474 \"", "500 z", "556 #$0123456789Jacesvkxy_", "584 +<=>^~", "611 ?FLTZbdghnopqu", "667 ESPVXY", "722 &ABCDHKNRU", "778 GOQw", "833 M", "889 %m", "944 W", "975 @"]);
const REGULAR: Record<string, number> = table(["191 '", "222 ijl", "278  !,./:;I[\\]ft", "333 ()-`r", "355 \"", "389 *", "469 ^", "500 Jckvxyzs", "556 #$0123456789?_abdeghnopquL", "584 +<=>~", "611 FTZ", "667 &ABEKPSVXY", "722 CDHNRUw", "778 GOQ", "833 Mm", "889 %", "944 W", "1015 @"]);
// The type's tracking, in ems, as the renderer sets it.
export const TRACK = { label: -0.02, text: -0.01 };
// Helvetica Neue sets a little wider than the Helvetica tables; the margin keeps an estimate on the safe side.
const SAFETY = 1.06;
export const textWidth = (s: string, size: number, bold = true) => {
  const t = bold ? BOLD : REGULAR;
  const track = bold ? TRACK.label : TRACK.text;
  return [...s].reduce((w, c) => w + ((t[c] ?? 600) / 1000 + track) * size, 0) * SAFETY;
};

// `text` in one line, or two balanced lines, no wider than `width`; undefined when it cannot fit.
export const wrap = (text: string, size: number, bold: boolean, width: number): string[] | undefined => {
  if (textWidth(text, size, bold) <= width) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  let best: string[] | undefined;
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const w = Math.max(...lines.map((l) => textWidth(l, size, bold)));
    if (w < bestW) (bestW = w), (best = lines);
  }
  return best && bestW <= width ? best : undefined;
};

// ---------- the parts and their times ----------

// What lands, in the order of the visual's anchors (and its `times`): every node, then every arrow
// that has an `arrow` entry, then every item of every node.
export type FlowSlot = { part: "node"; node: number } | { part: "arrow"; node: number } | { part: "item"; node: number; item: number };
export const flowSlots = (v: Flow): FlowSlot[] => [
  ...v.nodes.map((_, i): FlowSlot => ({ part: "node", node: i })),
  ...v.nodes.flatMap((n, i): FlowSlot[] => (n.arrow ? [{ part: "arrow", node: i }] : [])),
  ...v.nodes.flatMap((n, i) => n.items.map((_, j): FlowSlot => ({ part: "item", node: i, item: j }))),
];
// A travelling camera's `wide` word comes last, after every part.
export const flowAnchors = (v: Flow) => [
  ...flowSlots(v).map((s) => (s.part === "node" ? v.nodes[s.node].at : s.part === "arrow" ? v.nodes[s.node].arrow?.at : v.nodes[s.node].items[s.item].at)),
  ...(v.camera === "travel" && v.wide ? [v.wide] : []),
];
// Where the search for a part's word starts again from the shot's start: arrows and each node's items
// are said in their own order, interleaved with the nodes.
export const flowResets = (v: Flow) => {
  const slots = flowSlots(v);
  return slots.flatMap((s, k) => (k > 0 && (s.part !== slots[k - 1].part || (s.part === "item" && s.node !== slots[k - 1].node)) ? [k] : []));
};

// The arrows a shape draws. `owner`: the node whose `arrow` entry labels and times it (the node it
// reaches, or on a fan-in the node it leaves). Fan-out's hub is the first node; fan-in's is the last.
export type FlowEdge = { from: number; to: number; owner: number };
export const flowEdges = (v: Pick<Flow, "shape" | "nodes">): FlowEdge[] => {
  const n = v.nodes.length;
  const idx = [...Array(n).keys()];
  switch (v.shape) {
    case "versus": return [];
    case "fan-out": return idx.slice(1).map((i) => ({ from: 0, to: i, owner: i }));
    case "fan-in": return idx.slice(0, -1).map((i) => ({ from: i, to: n - 1, owner: i }));
    case "before-after": return n >= 2 ? [{ from: 0, to: 1, owner: 1 }] : [];
    default: return idx.slice(1).map((i) => ({ from: i - 1, to: i, owner: i }));
  }
};

// When each part lands. A node lands on its time; an arrow on its own word, else as the later of its
// two ends lands (a fan-in's arrows run into the hub one after another as it lands); an item on its
// time, never before its column's header. Before/after strikes the old one as the new one lands.
export const ARROW_DRAW = 0.4;
export const flowBeats = (v: Flow, start: number, times: number[] = []) => {
  const slots = flowSlots(v);
  const timeOf = (pred: (s: FlowSlot) => boolean, fallback: number) => {
    const k = slots.findIndex(pred);
    return k >= 0 && times[k] !== undefined ? times[k] : fallback;
  };
  const nodes = v.nodes.map((_, i) => Math.max(start, timeOf((s) => s.part === "node" && s.node === i, start + 0.3 + i * 0.5)));
  const used = new Map<number, number>();
  const arrows = flowEdges(v).map((e) => {
    const own = v.nodes[e.owner].arrow?.at ? timeOf((s) => s.part === "arrow" && s.node === e.owner, NaN) : NaN;
    let t = Number.isFinite(own) ? own : Math.max(nodes[e.from], nodes[e.to]);
    // Arrows that would draw at the same moment follow each other.
    const key = Math.round(t * 100);
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    t += n * 0.12;
    return { ...e, t };
  });
  const items = v.nodes.map((nd, i) => nd.items.map((_, j) => Math.max(nodes[i], timeOf((s) => s.part === "item" && s.node === i && s.item === j, nodes[i] + 0.4 + j * 0.4))));
  const strike = v.shape === "before-after" && v.nodes.length >= 2 ? nodes[1] : undefined;
  return { nodes, arrows, items, strike };
};
// Every moment something lands, in order: for sounds and the "something changes every 2 s" check.
export const flowMoments = (v: Flow, start: number, times: number[] = []) => {
  const b = flowBeats(v, start, times);
  return [...b.nodes, ...b.arrows.map((a) => a.t), ...b.items.flat()].sort((a, c) => a - c);
};
// The plan's times with every unanchored arrow at the time it really draws, so checks and sounds see
// what the viewer sees.
export const flowTimes = (v: Flow, start: number, times: number[]) => {
  const b = flowBeats(v, start, times);
  const slots = flowSlots(v);
  return [
    ...slots.map((s, k) => {
      if (s.part !== "arrow" || v.nodes[s.node].arrow?.at) return times[k] ?? start;
      return b.arrows.find((a) => a.owner === s.node)?.t ?? times[k] ?? start;
    }),
    ...times.slice(slots.length),
  ];
};

// Plan problems a schema cannot see.
export const flowIssues = (v: Flow): string[] => {
  const out: string[] = [];
  const n = v.nodes.length;
  if ((v.shape === "before-after" || v.shape === "versus") && n !== 2) out.push(`a ${v.shape} flow takes two nodes, not ${n}`);
  if ((v.shape === "fan-out" || v.shape === "fan-in") && n < 3) out.push(`a ${v.shape} takes a hub and two or more others`);
  if (v.shape !== "versus" && v.nodes.some((nd) => nd.items.length)) out.push(`items are drawn only in a versus flow`);
  const edges = flowEdges(v);
  v.nodes.forEach((nd, i) => {
    if (nd.arrow && !edges.some((e) => e.owner === i)) out.push(`node ${i + 1} ("${nd.label}") has an arrow entry, but no arrow in a ${v.shape} is ${v.shape === "fan-in" ? "drawn from" : "drawn into"} it`);
    if (nd.icon && !isImageIcon(nd.icon) && !(FLOW_ICONS as readonly string[]).includes(nd.icon)) out.push(`node ${i + 1} icon "${nd.icon}" is neither a logo ("logo:<name>") nor one of ${FLOW_ICONS.join(", ")}`);
  });
  if (v.camera === "travel" && v.shape === "versus") out.push(`a versus compares two columns side by side; the camera cannot travel it`);
  if (v.wide && v.camera !== "travel") out.push(`"wide" is the word a travelling camera pulls back on; add "camera": "travel" or drop it`);
  if (v.nodes.filter((nd) => nd.accent).length > 1) out.push(`the accent goes on the one node that matters; ${v.nodes.filter((nd) => nd.accent).length} have it`);
  return out;
};

// The node that takes the accent: the one marked, else the new one in a before/after.
export const accentOf = (v: Pick<Flow, "shape" | "nodes">) => {
  const marked = v.nodes.findIndex((n) => n.accent);
  return marked >= 0 ? marked : v.shape === "before-after" ? 1 : -1;
};

// ---------- the layout ----------

export type Box = { x: number; y: number; w: number; h: number };
export type FlowCard = Box & { mode: "tile" | "strip"; label: string[]; sub: string[]; icon: boolean };
export type FlowArrow = FlowEdge & { points: [number, number][]; label?: Box & { text: string; size: number } };
export type FlowItem = Box & { lines: string[]; node: number; item: number };
export type FlowLayout = {
  axis: "x" | "y";
  size: number; // the label size
  sub: number; // the sub-label size
  icon: number; // the icon's size
  pad: number;
  radius: number;
  cards: FlowCard[];
  arrows: FlowArrow[];
  items: FlowItem[];
  itemSize: number;
  vs?: Box & { size: number };
  bounds: Box;
  fits: boolean;
};

// The node shape a layout needs: its words and whether it has an icon.
type NodeContent = { label: string; sub?: string; icon?: string; arrow?: { label?: string }; items: { text: string }[] };

const sizes = (s: number) => ({
  pad: Math.max(24, Math.round(s * FLOW.pad)),
  sub: Math.max(26, Math.round(s * FLOW.sub)),
  icon: Math.round(s * FLOW.icon),
  gapIcon: Math.round(s * 0.42),
  gapSub: Math.round(s * 0.22),
  cross: Math.max(32, Math.round(s * FLOW.cross)),
  arrowLabel: Math.max(26, Math.round(s * 0.5)),
  radius: Math.round(s * FLOW.radius),
});
const LEAD = { label: 1.12, sub: 1.25 };

// A card's content at width `w`: its lines and the height it needs, or undefined when the words do not fit.
const content = (nd: NodeContent, s: number, mode: "tile" | "strip", w: number, iconRoom: boolean) => {
  const z = sizes(s);
  const iconW = iconRoom ? z.icon + z.gapIcon : 0;
  const inner = w - 2 * z.pad - (mode === "strip" ? iconW : 0);
  if (inner <= 0 || (mode === "tile" && iconRoom && z.icon > inner)) return undefined;
  const label = wrap(nd.label, s, true, inner);
  const sub = nd.sub ? wrap(nd.sub, z.sub, false, inner) : [];
  if (!label || !sub) return undefined;
  const text = label.length * s * LEAD.label + (sub.length ? z.gapSub + sub.length * z.sub * LEAD.sub : 0);
  const h = mode === "tile" ? 2 * z.pad + (iconRoom ? z.icon + z.gapIcon : 0) + text : 2 * z.pad + Math.max(iconRoom ? z.icon : 0, text);
  return { label, sub, h };
};
// The width a card needs to set every word on one line.
const natural = (nd: NodeContent, s: number, mode: "tile" | "strip", iconRoom: boolean) => {
  const z = sizes(s);
  const text = Math.max(textWidth(nd.label, s, true), nd.sub ? textWidth(nd.sub, z.sub, false) : 0);
  return mode === "tile" ? 2 * z.pad + Math.max(text, iconRoom ? z.icon : 0) : 2 * z.pad + (iconRoom ? z.icon + z.gapIcon : 0) + text;
};

// The nodes in ranks, along the flow: one per rank in a row or column, the hub and the rest in a fan.
const ranks = (shape: FlowShape, n: number): number[][] => {
  const idx = [...Array(n).keys()];
  if (shape === "fan-out") return [[0], idx.slice(1)];
  if (shape === "fan-in") return [idx.slice(0, -1), [n - 1]];
  if (shape === "before-after") return [[0], [1]].filter(([i]) => i < n);
  return idx.map((i) => [i]);
};

// A path from a to b, straight or in right angles through the middle of the gap (`mid`, along the axis).
const route = (axis: "x" | "y", a: [number, number], b: [number, number], mid: number): [number, number][] => {
  const [au, av] = axis === "x" ? a : [a[1], a[0]];
  const [bu, bv] = axis === "x" ? b : [b[1], b[0]];
  const pts: [number, number][] = Math.abs(av - bv) < 0.5 ? [[au, av], [bu, bv]] : [[au, av], [mid, av], [mid, bv], [bu, bv]];
  return axis === "x" ? pts : pts.map(([u, v]) => [v, u]);
};

const flowAt = (shape: FlowShape, nodes: NodeContent[], W: number, H: number, axis: "x" | "y", s: number): FlowLayout | undefined => {
  const z = sizes(s);
  const rk = ranks(shape, nodes.length);
  const n = rk.length, m = Math.max(...rk.map((r) => r.length));
  const iconRoom = nodes.some((nd) => !!nd.icon);
  // Tiles (icon over the words) where cards stand side by side; strips (icon beside them) where they stack.
  const mode: "tile" | "strip" = (axis === "y") === (m === 1) ? "strip" : "tile";
  const edges = flowEdges({ shape, nodes: nodes as Flow["nodes"] });
  const elbow = rk.some((r, k) => k > 0 && r.length !== rk[k - 1].length);
  // The gap along the flow holds the arrow and its label, each at least `clear` from every line.
  const labels = edges.map((e) => nodes[e.owner].arrow?.label).filter((x): x is string => !!x);
  const lw = Math.max(0, ...labels.map((l) => textWidth(l, z.arrowLabel, false)));
  const lh = labels.length ? z.arrowLabel * 1.2 : 0;
  const along = axis === "x" ? lw : lh; // the label's extent along the arrow
  // In a fan the label sits on the stretch between the card and the bus, clear of both.
  const room = labels.length ? along + 2 * FLOW.clear : 0;
  const G = elbow ? Math.max(2 * (FLOW.inset + FLOW.arrow * 0.6), labels.length ? 2 * (room + FLOW.inset) : 0) : Math.max(2 * FLOW.inset + FLOW.arrow, room);
  const U = axis === "x" ? W : H, V = axis === "x" ? H : W;
  const cu = (U - (n - 1) * G) / n, cv = (V - (m - 1) * z.cross) / m;
  if (cu <= 0 || cv <= 0) return undefined;
  const [wMax, hMax] = axis === "x" ? [cu, cv] : [cv, cu];
  // As wide as the words want, and wide enough for the whole to fill its box.
  const across = axis === "x" ? n : m, acrossGap = axis === "x" ? G : z.cross;
  const fillW = (FLOW.fill * W - (across - 1) * acrossGap) / across;
  const cw = Math.min(wMax, Math.max(...nodes.map((nd) => natural(nd, s, mode, iconRoom)), fillW));
  const fitted = nodes.map((nd) => content(nd, s, mode, cw, iconRoom));
  if (fitted.some((f) => !f)) return undefined;
  const down = axis === "y" ? n : m, downGap = axis === "y" ? G : z.cross;
  const fillH = (FLOW.fill * H - (down - 1) * downGap) / down;
  const need = Math.max(...fitted.map((f) => f!.h));
  if (need > hMax + 0.5) return undefined;
  const ch = Math.min(hMax, Math.max(need, Math.min(fillH, cw * FLOW.tall)));
  // A label beside a drop must not reach the next drop over, nor the box's edge.
  if (labels.length && elbow) {
    const space = (axis === "x" ? ch : cw) + z.cross;
    const side = axis === "x" ? lh : lw;
    if (m > 1 && side + 2 * FLOW.clear + FLOW.head > space) return undefined;
  }
  const [cardU, cardV] = axis === "x" ? [cw, ch] : [ch, cw];
  const total = n * cardU + (n - 1) * G;
  const u0 = (U - total) / 2;
  const cards: FlowCard[] = [];
  rk.forEach((r, k) => {
    const tv = r.length * cardV + (r.length - 1) * z.cross;
    r.forEach((i, j) => {
      const u = u0 + k * (cardU + G), v = (V - tv) / 2 + j * (cardV + z.cross);
      const f = fitted[i]!;
      cards[i] = { ...(axis === "x" ? { x: u, y: v } : { x: v, y: u }), w: cw, h: ch, mode, label: f.label, sub: f.sub, icon: !!nodes[i].icon };
    });
  });
  const rankOf = (i: number) => rk.findIndex((r) => r.includes(i));
  const arrows: FlowArrow[] = edges.map((e) => {
    const [a, b] = [cards[e.from], cards[e.to]];
    const ka = rankOf(e.from);
    const gapStart = u0 + (ka + 1) * cardU + ka * G;
    const mid = gapStart + G / 2;
    const p0: [number, number] = axis === "x" ? [a.x + a.w + FLOW.inset, a.y + a.h / 2] : [a.x + a.w / 2, a.y + a.h + FLOW.inset];
    const p1: [number, number] = axis === "x" ? [b.x - FLOW.inset, b.y + b.h / 2] : [b.x + b.w / 2, b.y - FLOW.inset];
    const points = route(axis, p0, p1, mid);
    const text = nodes[e.owner].arrow?.label;
    if (!text) return { ...e, points };
    // The label rides on the owner's own stretch: in a fan, between its card and the bus (the bus runs
    // across the middle of the gap, so a label centred on a straight run would sit on it).
    const bus = (p: [number, number]): [number, number] => (axis === "x" ? [mid, p[1]] : [p[0], mid]);
    const seg = !elbow ? [p0, p1] : shape === "fan-in" ? [p0, bus(p0)] : [bus(p1), p1];
    const w = textWidth(text, z.arrowLabel, false), h = z.arrowLabel * 1.2;
    const off = FLOW.clear + FLOW.head * 0.6;
    const label = axis === "x"
      ? { x: (seg[0][0] + seg[1][0]) / 2 - w / 2, y: seg[0][1] - off - h, w, h, text, size: z.arrowLabel }
      : { x: seg[0][0] + off, y: (seg[0][1] + seg[1][1]) / 2 - h / 2, w, h, text, size: z.arrowLabel };
    return { ...e, points, label };
  });
  const parts = [...cards, ...arrows.flatMap((a) => (a.label ? [a.label] : []))];
  if (parts.some((b) => b.x < -0.5 || b.y < -0.5 || b.x + b.w > W + 0.5 || b.y + b.h > H + 0.5)) return undefined;
  return { axis, size: s, sub: z.sub, icon: z.icon, pad: z.pad, radius: z.radius, cards, arrows, items: [], itemSize: 0, bounds: boundsOf(parts), fits: true };
};

// Two columns compared: each node's card on top, its items in rows under it, aligned across, "vs"
// between the two cards.
const versusAt = (nodes: NodeContent[], W: number, H: number, s: number): FlowLayout | undefined => {
  const z = sizes(s);
  const it = Math.max(26, Math.round(s * 0.62));
  const vs = Math.max(28, Math.round(s * 0.62));
  const G = Math.max(textWidth("vs", vs, true) + 2 * FLOW.clear, 2 * FLOW.clear + 24);
  const cw = (W - G) / 2;
  const iconRoom = nodes.some((nd) => !!nd.icon);
  const heads = nodes.slice(0, 2).map((nd) => content(nd, s, "tile", cw, iconRoom));
  if (heads.some((h) => !h)) return undefined;
  const rows = Math.max(...nodes.slice(0, 2).map((nd) => nd.items.length));
  const ipad = Math.max(20, Math.round(it * 0.6));
  const rowLines = [...Array(rows).keys()].map((r) => nodes.slice(0, 2).map((nd) => (nd.items[r] ? wrap(nd.items[r].text, it, false, cw - 2 * ipad) : [])));
  if (rowLines.some((r) => r.some((l) => !l))) return undefined;
  const gi = Math.max(16, Math.round(s * 0.3));
  const gh = Math.max(FLOW.clear, Math.round(s * 0.5));
  let headH = Math.max(...heads.map((h) => h!.h));
  const rowNeed = rowLines.map((r) => 2 * ipad + Math.max(1, ...r.map((l) => l!.length)) * it * LEAD.sub);
  let rowH = rowNeed.slice();
  const total = () => headH + (rows ? gh + rowH.reduce((a, b) => a + b, 0) + (rows - 1) * gi : 0);
  if (total() > H + 0.5) return undefined;
  // Fill the box: the rows grow first, the cards after, each to a point.
  const want = FLOW.fill * H;
  if (total() < want && rows) {
    const grow = Math.min((want - total()) / rows, Math.min(...rowNeed) * 0.8);
    rowH = rowH.map((h) => h + grow);
  }
  if (total() < want) headH = Math.min(headH + (want - total()), headH * 1.6, cw * FLOW.tall);
  const y0 = (H - total()) / 2;
  const x0 = (W - (2 * cw + G)) / 2;
  const cards: FlowCard[] = nodes.slice(0, 2).map((nd, i) => ({ x: x0 + i * (cw + G), y: y0, w: cw, h: headH, mode: "tile", label: heads[i]!.label, sub: heads[i]!.sub, icon: !!nd.icon }));
  const items: FlowItem[] = [];
  let y = y0 + headH + gh;
  rowLines.forEach((r, k) => {
    r.forEach((lines, i) => { if (nodes[i].items[k]) items.push({ x: x0 + i * (cw + G), y, w: cw, h: rowH[k], lines: lines!, node: i, item: k }); });
    y += rowH[k] + gi;
  });
  const vw = textWidth("vs", vs, true);
  const vsBox = { x: W / 2 - vw / 2, y: y0 + headH / 2 - vs * 0.6, w: vw, h: vs * 1.2, size: vs };
  return { axis: "x", size: s, sub: z.sub, icon: z.icon, pad: z.pad, radius: z.radius, cards, arrows: [], items, itemSize: it, vs: vsBox, bounds: boundsOf([...cards, ...items]), fits: true };
};

const boundsOf = (bs: Box[]): Box => {
  const l = Math.min(...bs.map((b) => b.x)), t = Math.min(...bs.map((b) => b.y));
  return { x: l, y: t, w: Math.max(...bs.map((b) => b.x + b.w)) - l, h: Math.max(...bs.map((b) => b.y + b.h)) - t };
};

// The layout of a flow in a w x h box: the largest label size that fits, in the better direction
// where the shape leaves it open (fans and before/after), else the smallest size, marked as not fitting.
export const layoutFlow = (v: Pick<Flow, "shape" | "nodes">, w: number, h: number): FlowLayout => {
  const nodes = v.nodes as NodeContent[];
  const at = (s: number, axis: "x" | "y") => (v.shape === "versus" ? versusAt(nodes, w, h, s) : flowAt(v.shape, nodes, w, h, axis, s));
  const axes: ("x" | "y")[] = v.shape === "row" || v.shape === "versus" ? ["x"] : v.shape === "column" ? ["y"] : ["x", "y"];
  let best: FlowLayout | undefined;
  for (const axis of axes)
    for (let s = FLOW.max; s >= FLOW.min; s -= 2) {
      const l = at(s, axis);
      if (!l) continue;
      // Larger type wins; at the same size, the layout whose cards are bigger.
      const area = (x: FlowLayout) => x.cards.reduce((a, c) => a + c.w * c.h, 0);
      if (!best || l.size > best.size || (l.size === best.size && area(l) > area(best))) best = l;
      break;
    }
  // A row or column turns the other way when it cannot fit its box at any size (a column in the short
  // panel under the hook), or would leave most of the box empty (a row of thin cards full frame).
  const sparse = (l: FlowLayout) => l.bounds.h < 0.45 * h || l.bounds.w < 0.45 * w;
  if ((v.shape === "row" || v.shape === "column") && (!best || sparse(best)))
    for (let s = FLOW.max; s >= FLOW.min; s -= 2) {
      const l = flowAt(v.shape, nodes, w, h, v.shape === "row" ? "y" : "x", s);
      if (!l) continue;
      if (!best || (!sparse(l) && l.size >= best.size * 0.85)) best = l;
      break;
    }
  if (best) return best;
  // Nothing fits: the smallest size, cards as they come, so QC shows what overflows.
  const z = sizes(FLOW.min);
  const n = nodes.length;
  const cw = (w - (n - 1) * (2 * FLOW.inset + FLOW.arrow)) / n;
  const cards: FlowCard[] = nodes.map((nd, i) => ({ x: i * (cw + 2 * FLOW.inset + FLOW.arrow), y: h / 2 - h * 0.3, w: cw, h: h * 0.6, mode: "tile", label: [nd.label], sub: nd.sub ? [nd.sub] : [], icon: !!nd.icon }));
  return { axis: "x", size: FLOW.min, sub: z.sub, icon: z.icon, pad: z.pad, radius: z.radius, cards, arrows: [], items: [], itemSize: 26, bounds: boundsOf(cards), fits: false };
};

// ---------- the travelling camera ----------

// `camera: "travel"` (2026-11-26, from Jeff Su's plugin video): the diagram is laid out to fit the
// frame as always, and the camera moves over it. It starts close on the first node, travels to each
// node as it lands, framed with the nodes it joins that are already there, and pulls back to the
// whole diagram on `wide`, or near the end of the shot. Between moves the frame holds still.
export const CAMERA = {
  zoom: 1.6, // the closest the camera goes
  frame: 0.84, // the share of the frame a framed group fills, at most, across and down
  travel: 0.8, // one move, in seconds
  lead: 0.25, // a move starts this long before its node lands, so the node lands as the camera arrives
  hold: 1.6, // the whole diagram holds at least this long before the shot ends
  rest: 0.9, // and pulls back no sooner than this after the last part lands
};
export type Camera = { z: number; x: number; y: number }; // zoom, and the canvas point at the frame's centre
export type CameraKey = Camera & { t: number };

const union = (bs: Box[]): Box => boundsOf(bs);
// The stage around the box, out to the frame's edge, on each side (none when the box is a panel).
// Parts draw into it; past it they are cut (effects/clean/flow.tsx).
export type Room = { l: number; t: number; r: number; b: number };
// The camera that frames `b` in a w x h frame, centred on it. Past the diagram is plain stage, so
// the camera may look there: a first card at the edge still lands in the middle of the frame.
export const frameBox = (b: Box, w: number, h: number): Camera => ({
  z: Math.max(1, Math.min(CAMERA.zoom, (w * CAMERA.frame) / b.w, (h * CAMERA.frame) / b.h)),
  x: b.x + b.w / 2,
  y: b.y + b.h / 2,
});

// Where the camera goes and when: one key per node as it lands, then the wide. `wide` is the time
// of the `wide` word, if any; `end` the shot's end.
export const cameraKeys = (v: Flow, L: FlowLayout, w: number, h: number, start: number, end?: number, times: number[] = []): CameraKey[] => {
  if (v.camera !== "travel" || v.shape === "versus" || !L.cards.length) return [];
  const b = flowBeats(v, start, times);
  const edges = flowEdges(v);
  const order = v.nodes.map((_, i) => i).sort((a, c) => b.nodes[a] - b.nodes[c] || a - c);
  const keys: CameraKey[] = order.map((i, n) => {
    const joined = edges.flatMap((e) => (e.from === i ? [e.to] : e.to === i ? [e.from] : [])).filter((j) => order.indexOf(j) < n);
    const cam = frameBox(union([L.cards[i], ...joined.map((j) => L.cards[j])]), w, h);
    return { ...cam, t: n === 0 ? start : Math.max(start, b.nodes[i] - CAMERA.lead) };
  });
  const last = Math.max(...flowMoments(v, start, times));
  const said = v.wide ? times[flowSlots(v).length] : undefined;
  const latest = end !== undefined ? end - CAMERA.hold : Infinity;
  const tw = Math.max(start, said ?? Math.min(latest, Math.max(last + CAMERA.rest, Math.min(latest, last + 2 * CAMERA.rest))));
  // The whole is always seen: in a short shot the camera pulls back as the last nodes land instead
  // of travelling to them first, since a move it cannot finish before the wide is wasted.
  while (keys.length > 1 && keys[keys.length - 1].t + CAMERA.travel > tw) keys.pop();
  keys.push({ z: 1, x: w / 2, y: h / 2, t: tw });
  return keys;
};

const io = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
// The camera at time `t`: each move eases from wherever the camera is to its key, so moves that
// overlap blend rather than jump. Zoom moves in log space, so a pull back feels even.
export const cameraAt = (keys: CameraKey[], t: number): Camera | undefined => {
  if (!keys.length) return undefined;
  let c: Camera = { z: keys[0].z, x: keys[0].x, y: keys[0].y };
  for (const k of keys.slice(1)) {
    const p = io(Math.min(1, Math.max(0, (t - k.t) / CAMERA.travel)));
    if (p <= 0) break;
    c = { z: Math.exp(Math.log(c.z) + (Math.log(k.z) - Math.log(c.z)) * p), x: c.x + (k.x - c.x) * p, y: c.y + (k.y - c.y) * p };
  }
  return c;
};
