import { describe, expect, it } from "vitest";
import { placed } from "../engine/cut.ts";
import { frameWindow, overlayEnable, partSlug, pickPreview, rangesInWindow, resolveParts, sectionFrames, segmentInWindow } from "../engine/parts.ts";
import { Edit } from "../engine/schema.ts";
import { segmentFrames } from "../media/cutrender.ts";
import { sections } from "../media/export.ts";

const said = (text: string, gap = 1) => text.split(" ").map((t, i) => ({ text: t, start: i * gap + 0.5, end: i * gap + 1 }));
// "one" 0.5-1, "two" 1.5-2, ... "six" 5.5-6
const words = said("one two three four five six");

describe("parts in the plan", () => {
  it("are optional, so a plan with none still parses", () => {
    expect(Edit.parse({ title: "t", shots: [{ at: "x", layout: "full" }] }).parts).toEqual([]);
  });
  it("cover the video: the first starts it, each runs to the next, the last ends it", () => {
    const { parts, issues } = resolveParts([{ name: "intro", at: "two" }, { name: "part 1", at: "four five" }], words, 8);
    expect(issues).toEqual([]);
    const edge = Math.round(3.45 * 30) / 30;
    expect(parts.map((p) => [p.name, p.start, p.end])).toEqual([["intro", 0, edge], ["part 1", edge, 8]]);
  });
  it("start on the same frame as a shot on the same words", () => {
    const { parts } = resolveParts([{ name: "a", at: "one" }, { name: "b", at: "three" }], words, 8);
    expect(parts[1].start * 30).toBeCloseTo(Math.round((2.5 - 0.05) * 30));
  });
  it("refuse a phrase that is not said, and two parts with one name", () => {
    expect(resolveParts([{ name: "a", at: "seven" }], words, 8).issues[0].level).toBe("error");
    expect(resolveParts([{ name: "Part 1", at: "one" }, { name: "part-1", at: "two" }], words, 8).issues.map((i) => i.message)).toEqual(['two parts are called "part-1"']);
  });
  it("over a cut, leave out a part whose words were cut, and the next one starts the video", () => {
    const { parts, issues } = resolveParts([{ name: "a", at: "seven" }, { name: "b", at: "two" }, { name: "c", at: "five" }], words, 8, 30, true);
    expect(issues[0]).toMatchObject({ level: "warn" });
    expect(parts.map((p) => p.name)).toEqual(["b", "c"]);
    expect(parts[0].start).toBe(0);
  });
  it("over a cut, follow words that now play earlier", () => {
    const { parts } = resolveParts([{ name: "a", at: "five" }, { name: "b", at: "two" }], words, 8, 30, true);
    expect(parts.map((p) => p.name)).toEqual(["b", "a"]);
  });
  it("over a cut, never assigns two parts to the same word index after fallback rewinds cursor", () => {
    const repeated = said("intro focus mid focus end");
    const { parts, issues } = resolveParts(
      [{ name: "first", at: "focus" }, { name: "intro", at: "intro" }, { name: "second", at: "focus" }],
      repeated,
      6,
      30,
      true,
    );
    expect(issues).toEqual([]);
    expect(parts.map((p) => p.name)).toEqual(["intro", "first", "second"]);
    expect(parts[1].start).toBeLessThan(parts[2].start);

    const single = said("intro focus end");
    const dup = resolveParts(
      [{ name: "first", at: "focus" }, { name: "intro", at: "intro" }, { name: "second", at: "focus" }],
      single,
      4,
      30,
      true,
    );
    expect(dup.parts.map((p) => p.name)).toEqual(["intro", "first"]);
    expect(dup.issues.some((i) => i.level === "warn" && /second/.test(i.message))).toBe(true);
  });
});

describe("what a render asks for", () => {
  const parts = [{ name: "intro", anchor: "x", start: 0, end: 12 }, { name: "Part 1", anchor: "y", start: 12, end: 30 }];
  it("a part by name, whatever its case", () => {
    expect(pickPreview(parts, 30, { part: "intro" })).toEqual({ range: { start: 0, end: 12 }, file: "part-intro.mp4" });
    expect(pickPreview(parts, 30, { part: "part 1" })).toEqual({ range: { start: 12, end: 30 }, file: "part-1.mp4" });
  });
  it("never the final file, however a part is named", () => {
    expect(pickPreview([{ name: "final", anchor: "x", start: 0, end: 12 }], 30, { part: "final" })!.file).not.toBe("final.mp4");
  });
  it("a stretch in seconds, either end optional", () => {
    expect(pickPreview(parts, 30, { from: "5", to: "9.5" })).toEqual({ range: { start: 5, end: 9.5 }, file: "part-5-9.5.mp4" });
    expect(pickPreview(parts, 30, { from: "5" })!.range).toEqual({ start: 5, end: 30 });
    expect(pickPreview(parts, 30, { to: "5" })!.range).toEqual({ start: 0, end: 5 });
  });
  it("the whole video when no flag is given", () => {
    expect(pickPreview(parts, 30, {})).toBeUndefined();
  });
  it("refuses an unknown part, a backwards stretch and mixed flags", () => {
    expect(() => pickPreview(parts, 30, { part: "outro" })).toThrow(/no part called "outro"/);
    expect(() => pickPreview(parts, 30, { from: "9", to: "5" })).toThrow();
    expect(() => pickPreview(parts, 30, { part: "intro", from: "5" })).toThrow();
    expect(() => pickPreview(parts, 30, { from: "" })).toThrow();
    expect(() => pickPreview(parts, 30, { from: "   ", to: "5" })).toThrow();
    expect(() => pickPreview(parts, 30, { to: "" })).toThrow();
    expect(() => pickPreview(parts, 30, { to: "Infinity" })).toThrow();
    expect(() => pickPreview(parts, 30, { from: "-Infinity", to: "5" })).toThrow();
  });
  it("slugs names for files", () => expect(partSlug(" The  Demo! ")).toBe("the-demo"));
});

describe("a part across joins in the cut", () => {
  const cut = { segments: [{ id: "a", src: "main", in: 10, out: 13 }, { id: "b", src: "main", in: 40, out: 42.5 }, { id: "c", src: "b", in: 0, out: 4 }] };
  const fps = 30;
  const frames = segmentFrames(placed(cut), fps);
  it("keeps frames from every segment it touches, and only those", () => {
    // Timeline 2.0s to 6.0s: the last second of a, all of b, the first half second of c.
    const w = frameWindow({ start: 2, end: 6 }, fps);
    expect(frames.map((f) => segmentInWindow(f, w))).toEqual([{ skip: 60, n: 30 }, { skip: 0, n: 75 }, { skip: 0, n: 15 }]);
  });
  it("adds up to the part's length in frames, with no frame twice or missing", () => {
    for (const range of [{ start: 0, end: 9.5 }, { start: 0.5, end: 3 }, { start: 2.9, end: 5.6 }, { start: 3.3, end: 8.1 }]) {
      const w = frameWindow(range, fps);
      const kept = frames.map((f) => segmentInWindow(f, w)).filter((x) => x);
      expect(kept.reduce((t, x) => t + x!.n, 0)).toBe(w.b - w.a);
    }
  });
  it("leaves out a segment that does not play in the part", () => {
    expect(segmentInWindow(frames[0], frameWindow({ start: 3, end: 5.5 }, fps))).toBeNull();
    expect(segmentInWindow(frames[2], frameWindow({ start: 3, end: 5.5 }, fps))).toBeNull();
  });
  it("works at a broadcast frame rate, whose frames do not land on whole seconds", () => {
    const ntsc = 30000 / 1001;
    const edges = segmentFrames(placed(cut), ntsc);
    const w = frameWindow({ start: 2.4, end: 7.7 }, ntsc);
    expect(edges.map((f) => segmentInWindow(f, w)).filter((x) => x).reduce((t, x) => t + x!.n, 0)).toBe(w.b - w.a);
  });
});

describe("a part that starts or ends inside a graphic", () => {
  const fps = 30;
  const graphic = { start: 10, end: 20 };
  const w = (start: number, end: number) => frameWindow({ start, end }, fps);
  it("with no window, the whole graphic as an export has always rendered it", () => {
    expect(sectionFrames(graphic, fps)).toEqual({ from: 300, to: 599 });
  });
  it("starting inside a graphic picks it up at that frame", () => {
    expect(sectionFrames(graphic, fps, w(15, 30))).toEqual({ from: 450, to: 599 });
  });
  it("ending inside a graphic stops on the part's last frame", () => {
    expect(sectionFrames(graphic, fps, w(0, 15))).toEqual({ from: 300, to: 449 });
  });
  it("wholly inside a part is unchanged", () => {
    expect(sectionFrames(graphic, fps, w(5, 25))).toEqual({ from: 300, to: 599 });
  });
  it("a graphic beside the part is left out, including one that starts on its last edge", () => {
    expect(sectionFrames(graphic, fps, w(0, 10))).toBeNull();
    expect(sectionFrames(graphic, fps, w(20, 30))).toBeNull();
  });
  it("a part inside one graphic renders only the part", () => {
    expect(sectionFrames(graphic, fps, w(12, 14))).toEqual({ from: 360, to: 419 });
  });
  it("sections come from the same plan a final export reads", () => {
    const shot = (start: number, end: number, layout: string) => ({ start, end, layout, anchor: "" });
    const r = { shots: [shot(0, 10, "full"), shot(10, 20, "side"), shot(20, 30, "full")] } as never;
    expect(sections(r).map((s) => sectionFrames(s, fps, w(15, 40)))).toEqual([{ from: 450, to: 599 }]);
  });
});

describe("when a graphic is laid over the picture", () => {
  it.each([24000 / 1001, 30000 / 1001, 24, 25, 30, 60])("takes in its first frame and not the one before at %f fps", (fps) => {
    const wrong = Array.from({ length: 40000 }, (_, f) => f).filter((f) => {
      const on = Number(overlayEnable({ start: f / fps, end: f / fps + 2 }, fps).match(/between\(t,(-?[\d.]+),/)![1]);
      return on > f / fps || on <= (f - 1) / fps;
    });
    expect(wrong).toEqual([]);
  });
});

describe("stretches removed from a part", () => {
  it("are moved into the part's own time and cut to it", () => {
    expect(rangesInWindow([[2, 4], [9, 12], [20, 25]], 10, 8)).toEqual([[0, 2]]);
    expect(rangesInWindow([[12, 13]], 10, 8)).toEqual([[2, 3]]);
  });
});
