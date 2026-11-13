import { describe, expect, it } from "vitest";
import { Visual } from "../engine/schema.ts";
import { FLOW, flowBeats, flowIssues, flowTimes, layoutFlow, textWidth, type Box, type Flow, type FlowLayout } from "../engine/flow.ts";
import { CODE, codeBeats, codeIssues, codeLayout, codeTimes, langOf, tokenize, typeSecs, type Code } from "../engine/code.ts";
import { resolveShots, cleanSfx } from "../engine/resolve.ts";
import { Edit } from "../engine/schema.ts";
import { cards } from "../styles/blueprint/style.ts";
import { atMax } from "../styles/catalog.ts";

const flow = (shape: Flow["shape"], labels: string[], extra: Partial<Flow["nodes"][number]>[] = []) =>
  Visual.parse({ kind: "flow", shape, nodes: labels.map((label, i) => ({ label, ...extra[i] })) }) as Flow;

// The boxes the kit is drawn in: a split's panel, the panel under the hook, full frame, YouTube's side.
const BOXES: [string, number, number][] = [
  ["split", 960, 724],
  ["hooked", 960, 494],
  ["full", 960, 1180],
  ["side", 1350, 860],
];

const overlaps = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
// Distance from a point to a segment.
const dist = ([px, py]: number[], [ax, ay]: number[], [bx, by]: number[]) => {
  const [dx, dy] = [bx - ax, by - ay];
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
};
// The nearest any point of a box comes to a polyline.
const boxToPath = (b: Box, pts: [number, number][]) => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [a, c] = [pts[i - 1], pts[i]];
    for (let s = 0; s <= 40; s++) {
      const p = [a[0] + ((c[0] - a[0]) * s) / 40, a[1] + ((c[1] - a[1]) * s) / 40];
      const dx = Math.max(b.x - p[0], 0, p[0] - (b.x + b.w)), dy = Math.max(b.y - p[1], 0, p[1] - (b.y + b.h));
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
};

// What the layout engine promises, for any layout in any box.
const guarantees = (L: FlowLayout, w: number, h: number, label: string) => {
  expect(L.fits, `${label} fits`).toBe(true);
  const parts: Box[] = [...L.cards, ...L.items, ...L.arrows.flatMap((a) => (a.label ? [a.label] : []))];
  // Inside its box.
  for (const b of parts) {
    expect(b.x, `${label} left`).toBeGreaterThanOrEqual(-0.5);
    expect(b.y, `${label} top`).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.w, `${label} right`).toBeLessThanOrEqual(w + 0.5);
    expect(b.y + b.h, `${label} bottom`).toBeLessThanOrEqual(h + 0.5);
  }
  // Nothing overlaps anything else.
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) expect(overlaps(parts[i], parts[j]), `${label} parts ${i} and ${j} overlap`).toBe(false);
  // Every card is one size.
  for (const c of L.cards) expect([Math.round(c.w), Math.round(c.h)], label).toEqual([Math.round(L.cards[0].w), Math.round(L.cards[0].h)]);
  // Fills the box and sits in its middle.
  expect(L.bounds.h / h, `${label} fills its height`).toBeGreaterThanOrEqual(FLOW.fill - 0.25);
  expect(Math.abs(L.bounds.y + L.bounds.h / 2 - h / 2), `${label} centred down`).toBeLessThan(1);
  expect(Math.abs(L.bounds.x + L.bounds.w / 2 - w / 2), `${label} centred across`).toBeLessThan(1);
  // Arrows run straight or in right angles, end clear of the cards, and every label is clear of every line.
  for (const a of L.arrows) {
    for (let i = 1; i < a.points.length; i++) {
      const [p, q] = [a.points[i - 1], a.points[i]];
      expect(Math.abs(p[0] - q[0]) < 0.01 || Math.abs(p[1] - q[1]) < 0.01, `${label} arrow segment is axis-aligned`).toBe(true);
    }
    for (const c of L.cards) expect(boxToPath(c, a.points), `${label} arrow clear of a card`).toBeGreaterThanOrEqual(FLOW.inset - 0.5);
    for (const o of L.arrows) if (o.label) expect(boxToPath(o.label, a.points), `${label} "${o.label.text}" clear of an arrow`).toBeGreaterThanOrEqual(FLOW.clear - 0.5);
  }
  // Type stays readable.
  expect(L.size).toBeGreaterThanOrEqual(FLOW.min);
  expect(L.sub).toBeGreaterThanOrEqual(24);
};

describe("the flow layout engine", () => {
  it("sets a row's cards with equal gaps, one size, centred", () => {
    const L = layoutFlow(flow("row", ["Plan", "Build", "Review"]), 960, 724);
    const gaps = L.cards.slice(1).map((c, i) => c.x - (L.cards[i].x + L.cards[i].w));
    expect(gaps[0]).toBeCloseTo(gaps[1]);
    expect(L.cards.every((c) => c.y === L.cards[0].y)).toBe(true);
    expect(L.arrows).toHaveLength(2);
    // Each arrow is a straight line across the gap, `inset` from each card.
    L.arrows.forEach((a, i) => {
      expect(a.points).toHaveLength(2);
      expect(a.points[0][0] - (L.cards[i].x + L.cards[i].w)).toBeCloseTo(FLOW.inset);
      expect(L.cards[i + 1].x - a.points[1][0]).toBeCloseTo(FLOW.inset);
    });
    guarantees(L, 960, 724, "row");
  });

  it("stacks a column with equal gaps and wide cards", () => {
    const L = layoutFlow(flow("column", ["Issue", "Agent", "Review"]), 960, 724);
    expect(L.axis).toBe("y");
    expect(L.cards[0].mode).toBe("strip");
    const gaps = L.cards.slice(1).map((c, i) => c.y - (L.cards[i].y + L.cards[i].h));
    expect(gaps[0]).toBeCloseTo(gaps[1]);
    guarantees(L, 960, 724, "column");
  });

  it("branches a fan-out from the first node and a fan-in into the last, in right angles", () => {
    const out = layoutFlow(flow("fan-out", ["Lead", "Search", "Code", "Tests"]), 960, 724);
    expect(out.arrows.map((a) => [a.from, a.to])).toEqual([[0, 1], [0, 2], [0, 3]]);
    expect(out.arrows.some((a) => a.points.length === 4)).toBe(true);
    guarantees(out, 960, 724, "fan-out");
    const into = layoutFlow(flow("fan-in", ["Docs", "Code", "Tickets", "Context"]), 960, 724);
    expect(into.arrows.map((a) => [a.from, a.to])).toEqual([[0, 3], [1, 3], [2, 3]]);
    guarantees(into, 960, 724, "fan-in");
  });

  it("makes room for arrow labels, clear of every line", () => {
    const v = flow("row", ["You", "Agent", "Repo"], [{}, { arrow: { label: "task" } }, { arrow: { label: "pull request" } }]);
    const L = layoutFlow(v, 960, 724);
    const gap = L.cards[1].x - (L.cards[0].x + L.cards[0].w);
    expect(gap).toBeGreaterThanOrEqual(textWidth("pull request", L.arrows[1].label!.size, false) + 2 * FLOW.clear - 0.5);
    guarantees(L, 960, 724, "row with labels");
    const fan = layoutFlow(flow("fan-out", ["Lead", "A", "B", "C"], [{}, { arrow: { label: "plan.md" } }, { arrow: { label: "plan.md" } }, { arrow: { label: "plan.md" } }]), 960, 724);
    guarantees(fan, 960, 724, "fan with labels");
  });

  it("picks the larger type when a shape can lie either way", () => {
    const v = flow("before-after", ["Copy and paste", "One command"]);
    const L = layoutFlow(v, 960, 724);
    expect(L.size).toBeGreaterThanOrEqual(layoutFlow({ ...v, shape: "row" }, 960, 724).size);
    guarantees(L, 960, 724, "before-after");
  });

  it("lines up a versus's rows across its two columns", () => {
    const v = Visual.parse({ kind: "flow", shape: "versus", nodes: [{ label: "A", items: [{ text: "One" }, { text: "Two" }] }, { label: "B", items: [{ text: "Uno" }, { text: "Dos and a much longer point" }] }] }) as Flow;
    const L = layoutFlow(v, 960, 724);
    const row = (k: number) => L.items.filter((i) => i.item === k);
    for (const k of [0, 1]) expect(row(k)[0].y).toBeCloseTo(row(k)[1].y);
    expect(L.vs).toBeDefined();
    guarantees(L, 960, 724, "versus");
  });

  it("turns a column the other way when it cannot fit the short panel under the hook", () => {
    const L = layoutFlow(flow("column", ["Bug report", "Agent", "Review"], [{ sub: "a user finds it" }, { sub: "fixes it" }, { sub: "checks it" }]), 960, 494);
    expect(L.fits).toBe(true);
    guarantees(L, 960, 494, "column under the hook");
  });

  // Every flow card's sample and its longest text, in every box it is drawn in.
  for (const c of cards.filter((x) => x.kind === "flow"))
    for (const longest of [false, true])
      for (const [name, w, h] of BOXES)
        it(`${c.id} ${longest ? "at its limits" : "sample"} lays out in the ${name} box`, () => {
          const v = Visual.parse((longest ? atMax(c) : c.sample)!.visual) as Flow;
          const L = layoutFlow(v, w, h);
          guarantees(L, w, h, `${c.id} ${name}`);
          // The split panel is what QC judges: the graphic fills at least 45% of the 864 px panel.
          if (name === "split") expect(L.bounds.h, `${c.id} fills the split panel`).toBeGreaterThanOrEqual(0.45 * 864);
        });
});

describe("flow timing", () => {
  it("lands nodes on their times, arrows with the node they reach, and spaces arrows that would land together", () => {
    const v = flow("fan-in", ["A", "B", "C", "Hub"]);
    const b = flowBeats(v, 0, [1, 2, 3, 4]);
    expect(b.nodes).toEqual([1, 2, 3, 4]);
    // Every arrow into the hub draws as it lands, one after another.
    expect(b.arrows.map((a) => +a.t.toFixed(2))).toEqual([4, 4.12, 4.24]);
  });
  it("draws an arrow on its own word when it has one", () => {
    const v = flow("row", ["A", "B"], [{}, { arrow: { at: "passes" } }]);
    // Slots: node A, node B, B's arrow.
    expect(flowBeats(v, 0, [1, 2, 1.5]).arrows[0].t).toBe(1.5);
    expect(flowTimes(v, 0, [1, 2, 1.5])).toEqual([1, 2, 1.5]);
    // Without a word, the arrow's time becomes the node's, so checks and sounds see when it draws.
    const plain = flow("row", ["A", "B"], [{}, { arrow: { label: "x" } }]);
    expect(flowTimes(plain, 0, [1, 2, 0.2])).toEqual([1, 2, 2]);
  });
  it("strikes the old one in a before/after as the new one lands", () => {
    expect(flowBeats(flow("before-after", ["Old", "New"]), 0, [0.5, 2.5]).strike).toBe(2.5);
  });
  it("resolves every part of a flow on its spoken word, items searched per column", () => {
    const words = "Claude runs in your terminal while Codex runs in the cloud".split(" ").map((text, i) => ({ text, start: i, end: i + 0.8 }));
    const plan = Edit.parse({ title: "t", face: { x: 0.5, y: 0.2, h: 0.3 }, shots: [{ at: "Claude", layout: "split", visual: { kind: "flow", shape: "versus", nodes: [{ label: "Claude", at: "Claude", items: [{ text: "Terminal", at: "terminal" }] }, { label: "Codex", at: "Codex", items: [{ text: "Cloud", at: "cloud" }] }] } }] });
    const { shots, issues } = resolveShots(plan, words, 12);
    expect(issues).toEqual([]);
    expect(shots[0].visual?.times?.map((t) => Math.round(t))).toEqual([0, 6, 4, 10]);
    // A tick for each node and item.
    expect(cleanSfx(shots).filter((e) => e.kind === "pop")).toHaveLength(4);
  });
  it("flags shapes given the wrong nodes", () => {
    expect(flowIssues(flow("versus", ["A", "B", "C"]))[0]).toMatch(/two nodes/);
    expect(flowIssues(flow("row", ["A", "B"], [{ arrow: { label: "x" } }]))[0]).toMatch(/no arrow/);
    expect(flowIssues(flow("row", ["A", "B"], [{ icon: "spaceship" }]))[0]).toMatch(/icon/);
  });
});

const code = (lines: { text: string; diff?: "add" | "del"; at?: string }[], extra: Partial<Code> = {}) => Visual.parse({ kind: "code", file: "src/a.ts", lines, ...extra }) as Code;

describe("code timing", () => {
  it("types lines one after another, never before the line above has finished", () => {
    const v = code([{ text: "const a = 1;" }, { text: "const b = 2;" }, { text: "const c = a + b;", at: "add" }]);
    const b = codeBeats(v, 0, [0, 0.1, 0.2]);
    expect(b.lines[0].t0).toBeCloseTo(0.15);
    for (let i = 1; i < 3; i++) expect(b.lines[i].t0).toBeGreaterThanOrEqual(b.lines[i - 1].t1);
    expect(b.lines[0].t1 - b.lines[0].t0).toBeCloseTo(typeSecs(12));
    // A line on its word waits for its word.
    expect(codeBeats(v, 0, [0, 0.1, 3]).lines[2].t0).toBe(3);
  });
  it("shows a diff's file at once and lands each change on its word, spaced", () => {
    const v = code([{ text: "a();" }, { text: "b();", diff: "del" }, { text: "c();", diff: "add" }]);
    const b = codeBeats(v, 0, [0, 1, 1.1]);
    expect(b.lines[0].t0).toBe(0);
    expect(b.lines[1].t0).toBe(1);
    expect(b.lines[2].t0).toBeCloseTo(1.4);
    expect(codeTimes(v, 0, [0, 1, 1.1])).toEqual([0, 1, b.lines[2].t0]);
  });
  it("lands marks after the lines when they have no time, and on their words when they do", () => {
    const v = code([{ text: "a();" }], { marks: [{ from: 1, at: "this" }] } as Partial<Code>);
    const b = codeBeats(v, 0, []);
    expect(b.marks[0]).toBeGreaterThan(b.lines[0].t1);
    expect(codeBeats(v, 0, [0.15, 2]).marks[0]).toBe(2);
  });
  it("shows the file at once with typed off", () => {
    const v = code([{ text: "a();" }, { text: "b();", at: "now" }], { typed: false } as Partial<Code>);
    expect(codeBeats(v, 0, [0, 2]).lines.map((l) => l.t0)).toEqual([0, 2]);
  });
  it("keys under typing in a clean reel", () => {
    const words = "here is the code".split(" ").map((text, i) => ({ text, start: i, end: i + 0.8 }));
    const plan = Edit.parse({ title: "t", face: { x: 0.5, y: 0.2, h: 0.3 }, shots: [{ at: "here", layout: "split", visual: { kind: "code", file: "a.ts", lines: [{ text: "const a = 1;" }, { text: "export default a;", at: "code" }] } }] });
    const { shots, issues } = resolveShots(plan, words, 6);
    expect(issues).toEqual([]);
    const keys = cleanSfx(shots).filter((e) => e.kind === "key");
    expect(keys.length).toBeGreaterThan(4);
    expect(Math.min(...keys.map((k) => k.t))).toBeCloseTo(0.15);
  });
  it("flags marks outside the lines and lines too long to read", () => {
    expect(codeIssues(code([{ text: "a" }], { marks: [{ from: 2, at: "x" }] } as Partial<Code>))[0]).toMatch(/outside/);
    expect(codeIssues(code([{ text: "x".repeat(CODE.chars + 1) }]))[0]).toMatch(/characters/);
  });
});

describe("the code window", () => {
  it("fills its box, keeps type readable and fits the longest line", () => {
    for (const c of cards.filter((x) => x.kind === "code"))
      for (const longest of [false, true])
        for (const [name, w, h] of BOXES) {
          const v = Visual.parse((longest ? atMax(c) : c.sample)!.visual) as Code;
          const L = codeLayout(v, w, h);
          expect(L.fits, `${c.id} ${name}`).toBe(true);
          expect(L.font).toBeGreaterThanOrEqual(CODE.min);
          expect(L.height / h, `${c.id} ${name} fills`).toBeGreaterThanOrEqual(CODE.fill - 0.01);
          expect(L.y + L.height / 2).toBeCloseTo(h / 2);
        }
  });
});

describe("the tokenizer", () => {
  const kinds = (line: string, lang: Parameters<typeof tokenize>[1]) => tokenize(line, lang).filter((t) => t.text.trim()).map((t) => `${t.kind}:${t.text.trim()}`);
  it("colours TypeScript", () => {
    expect(kinds('const x = await load("a"); // why', "ts")).toEqual(["kw:const", "plain:x =", "kw:await", "fn:load", "plain:(", "str:\"a\"", "plain:);", "com:// why"]);
  });
  it("colours Python, JSON and bash", () => {
    expect(kinds("def run(n=3):", "py").slice(0, 2)).toEqual(["kw:def", "fn:run"]);
    expect(kinds('  "name": "studio",', "json")).toEqual(["prop:\"name\"", "plain::", "str:\"studio\"", "plain:,"]);
    expect(kinds("npm test --watch # fast", "bash")).toEqual(["fn:npm", "plain:test", "prop:--watch", "com:# fast"]);
  });
  it("keeps every character", () => {
    const line = "  if (a.b?.[0] !== `x${y}`) throw new Error('no');";
    expect(tokenize(line, "ts").map((t) => t.text).join("")).toBe(line);
  });
  it("finds the language from the file name", () => {
    expect(langOf({ file: "src/app.tsx" })).toBe("ts");
    expect(langOf({ file: "main.py" })).toBe("py");
    expect(langOf({ file: "terminal" })).toBe("bash");
    expect(langOf({ file: "notes.md" })).toBe("text");
  });
});
