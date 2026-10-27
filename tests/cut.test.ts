import { describe, expect, it } from "vitest";
import { atTime, clippedWords, deleteRange, cutLength, cutWords, insertSegment, joins, mapRanges, moveSegment, placed, rippleDelete, slotAt, snapEdge, splitAt, trimEdge, wholeCut } from "../engine/cut.ts";
import { Cut, Edit } from "../engine/schema.ts";
import { resolveShots } from "../engine/resolve.ts";

const said = (text: string, gap = 0.3) => text.split(" ").map((t, i) => ({ text: t, start: +(i * gap).toFixed(3), end: +(i * gap + 0.25).toFixed(3) }));
// "one" 0-0.25, "two" 0.3-0.55, ... "six" 1.5-1.75
const main = said("one two three four five six");
const b = said("alpha beta gamma");

describe("the cut schema", () => {
  it("parses segments and refuses one that ends before it starts", () => {
    expect(Cut.safeParse({ segments: [{ id: "s1", src: "main", in: 0, out: 2 }] }).success).toBe(true);
    expect(Cut.safeParse({ segments: [{ id: "s1", src: "main", in: 2, out: 1 }] }).success).toBe(false);
  });
  it("a project with no cut plays its one clip whole", () => {
    const cut = wholeCut(1.8);
    expect(cutLength(cut)).toBe(1.8);
    expect(cutWords(cut, { main })).toEqual(main);
  });
});

describe("placing segments on the timeline", () => {
  const cut = { segments: [{ id: "a", src: "main", in: 0.9, out: 1.8 }, { id: "b", src: "b", in: 0, out: 0.6 }] };
  it("lays segments end to end", () => {
    expect(placed(cut).map((s) => [s.start, +s.end.toFixed(3)])).toEqual([[0, 0.9], [0.9, 1.5]]);
    expect(joins(cut)).toEqual([0.9]);
  });
  it("moves each clip's words to where they play", () => {
    expect(cutWords(cut, { main, b }).map((w) => [w.text, w.start])).toEqual([["four", 0], ["five", 0.3], ["six", 0.6], ["alpha", 0.9], ["beta", 1.2]]);
  });
  it("finds the clip time under the playhead", () => {
    const hit = atTime(cut, 1.0)!;
    expect(hit.seg.id).toBe("b");
    expect(hit.local).toBeCloseTo(0.1);
  });
  it("maps a clip's own ranges onto the timeline", () => {
    expect(mapRanges(cut, "main", [[0, 1.2]]).map((r) => r.map((x) => +x.toFixed(2)))).toEqual([[0, 0.3]]);
  });
});

describe("editing the cut", () => {
  it("split leaves the timeline the same", () => {
    const cut = splitAt(wholeCut(1.8), 0.58);
    expect(cut.segments.map((s) => [s.in, s.out])).toEqual([[0, 0.58], [0.58, 1.8]]);
    expect(new Set(cut.segments.map((s) => s.id)).size).toBe(2);
    expect(cutWords(cut, { main })).toEqual(main);
  });
  it("ripple delete closes the gap", () => {
    const cut = splitAt(splitAt(wholeCut(1.8), 0.6), 1.2);
    const out = rippleDelete(cut, cut.segments[1].id);
    expect(cutLength(out)).toBeCloseTo(1.2);
    expect(cutWords(out, { main }).map((w) => w.text)).toEqual(["one", "two", "five", "six"]);
  });
  it("deletes an I to O range across segments", () => {
    const cut = { segments: [{ id: "a", src: "main", in: 0, out: 1.8 }, { id: "b", src: "b", in: 0, out: 0.9 }] };
    const out = deleteRange(cut, 1.18, 2.38);
    expect(cutLength(out)).toBeCloseTo(1.5);
    expect(cutWords(out, { main, b }).map((w) => w.text)).toEqual(["one", "two", "three", "four", "gamma"]);
  });
  it("trim keeps a segment inside its clip and at least two frames long", () => {
    const cut = wholeCut(1.8);
    expect(trimEdge(cut, "s1", "in", -1).segments[0].in).toBe(0);
    expect(trimEdge(cut, "s1", "out", 9, 1.8).segments[0].out).toBe(1.8);
    expect(trimEdge(cut, "s1", "in", 1.8).segments[0].in).toBeCloseTo(1.8 - 2 / 30);
  });
  it("moves and inserts segments", () => {
    const cut = splitAt(wholeCut(1.8), 0.9);
    const [x, y] = cut.segments;
    expect(moveSegment(cut, y.id, 0).segments.map((s) => s.id)).toEqual([y.id, x.id]);
    const added = insertSegment(cut, "b", 0, 0.6, 1);
    expect(added.segments.map((s) => s.src)).toEqual(["main", "b", "main"]);
    expect(slotAt(cut, 0.2)).toBe(0);
    expect(slotAt(cut, 1.7)).toBe(2);
  });
  it("snaps trims to word edges, never into a word", () => {
    expect(snapEdge(main, 0.62, "in")).toBeCloseTo(0.6 - 0.025);
    expect(snapEdge(main, 0.5, "out")).toBeCloseTo(0.55 + 0.025);
  });
  it("warns about an edge inside a word", () => {
    expect(clippedWords({ segments: [{ id: "a", src: "main", in: 0.4, out: 1.8 }] }, { main })[0].message).toMatch(/inside the word "two"/);
    expect(clippedWords(wholeCut(1.8), { main })).toEqual([]);
  });
});

describe("graphics follow the words through a re-cut", () => {
  // Two sentences: a title lands on "five", a list reveal on "six".
  const plan = Edit.parse({
    title: "t",
    face: { x: 0.5, y: 0.3, h: 0.2 },
    shots: [
      { at: "one two", layout: "full" },
      { at: "five", layout: "split", visual: { kind: "list", items: [{ text: "a" }, { text: "b", at: "six" }] } },
      { at: "alpha", layout: "full" },
    ],
  });
  const words = { main, b };
  const resolve = (cut: ReturnType<typeof wholeCut>) => resolveShots(plan, cutWords(cut, words), cutLength(cut), 30, true);
  const both = { segments: [{ id: "s1", src: "main", in: 0, out: 1.8 }, { id: "s2", src: "b", in: 0, out: 0.9 }] };
  const at = (r: ReturnType<typeof resolve>, anchor: string) => r.shots.find((s) => s.anchor === anchor);

  it("a split changes nothing", () => {
    const before = resolve(both);
    const after = resolve(splitAt(both, 0.58));
    expect(after.shots).toEqual(before.shots);
    expect(after.issues).toEqual([]);
  });

  it("a ripple delete before an anchor pulls it and its reveals earlier", () => {
    const before = resolve(both);
    // Cut "three four" (0.58 to 1.18 in main).
    const cut = splitAt(splitAt(both, 0.58), 1.18);
    const after = resolve(rippleDelete(cut, cut.segments[1].id));
    expect(at(after, "five")!.start).toBeCloseTo(at(before, "five")!.start - 0.6, 1);
    expect(at(after, "five")!.visual!.times![1]).toBeCloseTo(before.shots[1].visual!.times![1] - 0.6, 5);
    expect(at(after, "alpha")!.start).toBeCloseTo(at(before, "alpha")!.start - 0.6, 1);
    expect(after.issues).toEqual([]);
  });

  it("a reorder moves the shot with its words", () => {
    // Clip b now plays first: "alpha" opens the video, "one two" follows it.
    const after = resolve(moveSegment(both, "s2", 0));
    expect(after.shots.map((s) => s.anchor)).toEqual(["alpha", "one two", "five"]);
    expect(at(after, "alpha")!.start).toBe(0);
    expect(at(after, "one two")!.start).toBeCloseTo(Math.round((0.9 - 0.05) * 30) / 30);
    expect(at(after, "five")!.visual!.times![1]).toBeCloseTo(0.9 + 1.5 - 0.05);
    expect(after.issues).toEqual([]);
  });

  it("a shot whose words were cut is left out with a warning, not an error", () => {
    const cut = splitAt(splitAt(both, 1.18), 1.48);
    const after = resolve(rippleDelete(cut, cut.segments[1].id));
    expect(after.shots.map((s) => s.anchor)).toEqual(["one two", "alpha"]);
    expect(after.issues.map((i) => i.level)).toEqual(["warn"]);
  });

  it("when the opening shot's words are cut, the next shot keeps its own start", () => {
    // Cut "one two three": the plan's first shot is gone, "four" opens and "five" plays 0.32s in.
    const after = resolve({ segments: [{ id: "s1", src: "main", in: 0.88, out: 1.8 }, { id: "s2", src: "b", in: 0, out: 0.9 }] });
    expect(after.shots.map((s) => [s.anchor, s.layout, s.start])).toEqual([["", "full", 0], ["five", "split", Math.round((0.32 - 0.05) * 30) / 30], ["alpha", "full", Math.round((0.92 - 0.05) * 30) / 30]]);
  });

  it("a cut with none of the plan's words left plays the picture plain", () => {
    const after = resolve({ segments: [{ id: "s1", src: "main", in: 0.9, out: 1.2 }] });
    expect(after.shots.map((s) => [s.layout, s.start, s.end])).toEqual([["full", 0, 0.3]]);
  });

  it("without a cut, anchors out of order are still an error", () => {
    const { issues } = resolveShots(plan, cutWords(moveSegment(both, "s2", 0), words), 2.7, 30, false);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});
