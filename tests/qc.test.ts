import { describe, expect, it } from "vitest";
import { contrast, longestStill, type Measure, qcLayout, qcPlan, saidTwice, visualText } from "../engine/qc.ts";
import { zoomAt } from "../engine/resolve.ts";
import type { Resolved, ResolvedShot } from "../engine/schema.ts";

const size: [number, number] = [1920, 1080];
const text = (t: string, box: [number, number, number, number], extra: Partial<Measure["texts"][0]> = {}) => ({ text: t, box, size: 40, opacity: 1, color: "rgb(247, 243, 236)", block: Math.random(), ...extra });
const m = (texts: Measure["texts"], extra: Partial<Measure> = {}): Measure => ({ texts, marks: [], words: [], ...extra });
const msgs = (issues: { message: string }[]) => issues.map((i) => i.message).join("\n");

describe("qcLayout", () => {
  it("passes a centred, clear card", () => {
    expect(qcLayout(m([text("Title", [860, 500, 200, 48])]), size, "s", "#1B1B1A", true)).toEqual([]);
  });
  it("errors on text outside the safe area, low at the bottom included", () => {
    expect(msgs(qcLayout(m([text("Missed in review", [28, 599, 506, 48])]), size, "s"))).toMatch(/outside the safe area/);
    expect(msgs(qcLayout(m([text("source", [900, 1000, 120, 30])]), size, "s"))).toMatch(/outside the safe area/);
  });
  it("errors when text touches a line or dot, or another text", () => {
    expect(msgs(qcLayout(m([text("2,500", [200, 400, 80, 30])], { marks: [{ box: [200, 432, 600, 2], opacity: 1 }] }), size, "s"))).toMatch(/touches a line/);
    expect(msgs(qcLayout(m([text("a", [500, 500, 100, 40]), text("b", [550, 510, 100, 40])]), size, "s"))).toMatch(/overlaps/);
  });
  it("errors when a label sits on a diagram's line, not when it sits clear or inside a ring", () => {
    const line = { points: [[100, 100], [200, 200], [300, 300]], opacity: 1 };
    const ring = { points: [[400, 400], [600, 400], [600, 600], [400, 600]], opacity: 1 };
    const label = text("Plan", [180, 180, 60, 30], { label: true });
    expect(msgs(qcLayout(m([label], { edges: [line] }), size, "s"))).toMatch(/sits on a line or shape/);
    expect(msgs(qcLayout(m([text("Plan", [700, 180, 60, 30], { label: true })], { edges: [line] }), size, "s"))).not.toMatch(/sits on/);
    expect(msgs(qcLayout(m([text("You", [480, 490, 40, 30], { label: true })], { edges: [ring] }), size, "s"))).not.toMatch(/sits on/);
  });
  it("warns on a crowded diagram and on long labels", () => {
    const six = Array.from({ length: 6 }, (_, i) => text(`L${i}`, [200 + i * 200, 300, 60, 30], { label: true }));
    expect(msgs(qcLayout(m(six), size, "s"))).toMatch(/6 labels at once/);
    expect(msgs(qcLayout(m(six.slice(0, 5)), size, "s"))).not.toMatch(/labels at once/);
    expect(msgs(qcLayout(m([text("the plan is written here", [400, 300, 300, 30], { label: true })]), size, "s"))).toMatch(/over three words/);
  });
  it("lets inline runs in one block sit inside their sentence (a `code` pill)", () => {
    expect(msgs(qcLayout(m([text("Generated files under and any file", [400, 500, 800, 80], { block: 1 }), text("src/gen/", [700, 505, 110, 30], { block: 1 })]), size, "s"))).not.toMatch(/overlaps/);
  });
  it("warns when two pieces of text sit jammed together on a line", () => {
    expect(msgs(qcLayout(m([text("12", [600, 300, 400, 300], { size: 500 }), text("x", [1002, 300, 200, 300], { size: 500 })]), size, "s"))).toMatch(/very tight/);
  });
  it("warns on a one-word last line in a longer title, not on a two-word label", () => {
    const words = (block: number, tops: number[]) => tops.map((top) => ({ block, top, h: 50 }));
    expect(msgs(qcLayout(m([text("Six levels of AI code review", [700, 300, 500, 120], { block: 1 })], { words: words(1, [300, 300, 300, 300, 300, 370]) }), size, "s"))).toMatch(/one word on its own/);
    expect(qcLayout(m([text("Documentation change", [700, 300, 300, 120], { block: 2 })], { words: words(2, [300, 370]) }), size, "s")).toEqual([]);
  });
  it("warns when a full-frame card sits off centre, counting everything drawn", () => {
    expect(msgs(qcLayout(m([text("Mistakes become evals", [538, 148, 844, 35])], { paint: [[208, 395, 152, 152]] }), size, "s", undefined, true))).toMatch(/above centre/);
  });
  it("errors on nearly invisible text, warns on low contrast, leaves faded items alone", () => {
    const on = (color: string, opacity = 1) => qcLayout(m([text("01", [860, 500, 60, 40], { color, opacity })]), size, "s", "#0B0B0B");
    expect(on("rgb(46, 46, 44)").map((i) => i.level)).toEqual(["error"]);
    expect(msgs(on("rgb(46, 46, 44)"))).toMatch(/nearly invisible \(1\.\d:1\)/);
    expect(on("rgb(80, 80, 78)").map((i) => i.level)).toEqual(["warn"]);
    expect(on("rgb(156, 156, 152)")).toEqual([]);
    // A list's earlier rows fade on purpose; only what is meant to be read is judged.
    expect(on("rgb(46, 46, 44)", 0.5)).toEqual([]);
  });
  it("measures contrast", () => {
    expect(contrast([247, 243, 236], [27, 27, 26])).toBeGreaterThan(10);
    expect(contrast([40, 40, 40], [27, 27, 26])).toBeLessThan(1.5);
  });
});

describe("qcPlan", () => {
  const shot = (o: Partial<ResolvedShot>): ResolvedShot => ({ start: 0, end: 1, layout: "full", anchor: "a", ...o }) as ResolvedShot;
  const plan = (shots: ResolvedShot[]) => ({ shots } as unknown as Resolved);
  const words = [{ text: "about", start: 9, end: 9.3 }, { text: "90", start: 10, end: 10.3 }];
  it("warns when a graphic lingers after its last part lands", () => {
    const r = plan([shot({ start: 10, end: 20, layout: "media", visual: { kind: "list", items: [{ text: "One" }, { text: "Two" }], preview: false, times: [10.2, 11] } as never }), shot({ start: 20, end: 30 })]);
    expect(msgs(qcPlan(r, words, []))).toMatch(/lingers 9.0s/);
  });
  it("warns on a number nobody said, but not on one that was", () => {
    const said = plan([shot({ start: 10, end: 13, layout: "media", visual: { kind: "title", text: "90 percent" } as never }), shot({ start: 13, end: 20 })]);
    expect(msgs(qcPlan(said, words, []))).not.toMatch(/not said/);
    const unsaid = plan([shot({ start: 10, end: 13, layout: "media", visual: { kind: "title", text: "75 percent" } as never }), shot({ start: 13, end: 20 })]);
    expect(msgs(qcPlan(unsaid, words, []))).toMatch(/shows 75/);
  });
  it("warns on two full-frame cards back to back, and errors on an overlay across a cut", () => {
    const r = plan([shot({ start: 0, end: 3, layout: "media", visual: { kind: "title", text: "One" } as never }), shot({ start: 3, end: 6, layout: "media", visual: { kind: "title", text: "Two" } as never }), shot({ start: 6, end: 9, layout: "over", visual: { kind: "title", text: "Three" } as never })]);
    const out = msgs(qcPlan(r, words, [], [7.5]));
    expect(out).toMatch(/another full-frame card/);
    expect(out).toMatch(/cut in the footage at 7.50s/);
  });
  it("reads every piece of text a visual shows", () => {
    expect(visualText({ kind: "compare", left: { label: "A", text: "B" }, right: { label: "C", text: "*D*", at: "x" } })).toEqual(["A", "B", "C", "D"]);
  });
});

describe("qcLayout: clipped and touching letters", () => {
  it("errors on text cut off by its container", () => {
    expect(msgs(qcLayout(m([text("0", [600, 300, 140, 200], { clipped: true })]), size, "s"))).toMatch(/cut off/);
  });
  it("errors when big letters from separate pieces of text touch", () => {
    expect(msgs(qcLayout(m([text("5", [600, 300, 140, 200], { size: 260 }), text("0", [740, 300, 140, 200], { size: 260 })]), size, "s"))).toMatch(/touch/);
  });
});

describe("saidTwice", () => {
  const take = "so before they open a pull request they run a local review then a second agent reviews the code with fresh context".split(" ");
  const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`);
  const at = (texts: string[], start: number) => texts.map((text, i) => ({ text, start: start + i * 0.4, end: start + i * 0.4 + 0.3 }));
  const words = [...at(take, 10), ...at(filler(150), 20), ...at(take, 100)];
  it("flags a section said twice", () => {
    expect(saidTwice(words)).toHaveLength(1);
  });
  it("is quiet when one take is removed", () => {
    expect(saidTwice(words, [[9, 19]])).toEqual([]);
  });
});

describe("parts that are never seen", () => {
  it("errors when a part lands as its graphic ends", async () => {
    const { qcPlan } = await import("../engine/qc.ts");
    const shot = (start: number, end: number, times: number[]) => ({ start, end, layout: "media" as const, anchor: "x", visual: { kind: "focus", items: [{ text: "A" }, { text: "B" }], times } as never });
    const r = { shots: [shot(0, 4, [0.5, 3.9])] } as never;
    expect(qcPlan(r, [], []).some((i) => /never seen/.test(i.message))).toBe(true);
    const ok = { shots: [shot(0, 4, [0.5, 2])] } as never;
    expect(qcPlan(ok, [], []).some((i) => /never seen/.test(i.message))).toBe(false);
  });
  it("allows a list that carries on: a part said in a later graphic lands there", async () => {
    const { qcPlan } = await import("../engine/qc.ts");
    const shot = (start: number, end: number, times: number[], kind = "checklist") => ({ start, end, layout: "media" as const, anchor: "x", visual: { kind, items: [{ text: "A" }, { text: "B" }], times } as never });
    const seen = (shots: unknown[]) => qcPlan({ shots } as never, [], []).some((i) => /never seen/.test(i.message));
    expect(seen([shot(0, 4, [1, 11]), shot(10, 14, [10, 11])])).toBe(false);
    // Still an error when nothing later lands it: no such part, or the later graphic has gone by then.
    expect(seen([shot(0, 4, [1, 11]), shot(10, 14, [10, 12])])).toBe(true);
    expect(seen([shot(0, 4, [1, 11]), shot(9, 10, [9, 11])])).toBe(true);
    expect(seen([shot(0, 4, [1, 11]), shot(10, 14, [10, 11], "list")])).toBe(true);
  });
});

describe("recorded screens", () => {
  it("finds the longest still stretch", () => {
    expect(longestStill([1, 0, 0, 0, 1, 0, 1], 10)).toEqual({ secs: 0.3, at: 0.1 });
  });
  it("counts a zoom as movement", () => {
    expect(longestStill([0, 0, 0, 0], 10, (t) => t >= 0.2).secs).toBeCloseTo(0.2);
  });
  it("eases a zoom in and holds it", () => {
    const zooms = [{ t: 1, x: 0.2, y: 0.4, s: 1.5, ms: 400 }];
    expect(zoomAt(zooms, 0.5).s).toBe(1);
    expect(zoomAt(zooms, 0.5).y).toBe(0);
    expect(zoomAt(zooms, 1.2).s).toBeCloseTo(1.25);
    expect(zoomAt(zooms, 3)).toEqual({ x: 0.2, y: 0.4, s: 1.5 });
  });
});
