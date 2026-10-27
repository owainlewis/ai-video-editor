import { describe, expect, it } from "vitest";
import { atTime, clippedWords, cutLength, cutWords, insertSegment, joins, mapRanges, moveSegment, placed, rippleDelete, slotAt, snapEdge, splitAt, trimEdge, wholeCut } from "../engine/cut.ts";
import { Cut } from "../engine/schema.ts";

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
