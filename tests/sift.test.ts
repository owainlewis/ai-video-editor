import { describe, expect, it } from "vitest";
import { keeps, pauses, retakes, sift, type Word } from "../pipeline/sift.ts";
import { assign, perSecond } from "../pipeline/angles.ts";

// Words from a sentence, one every 0.3 s, starting at `at`.
const say = (text: string, at: number): Word[] =>
  text.split(" ").map((t, i) => ({ text: t, start: at + i * 0.3, end: at + i * 0.3 + 0.25 }));

describe("sift", () => {
  it("cuts a long silence but keeps padding either side", () => {
    const db = [...Array(100).fill(-20), ...Array(100).fill(-80), ...Array(100).fill(-20)];
    const [cut] = pauses({ step: 0.01, db }, 3);
    expect(cut.start).toBeCloseTo(1.12);
    expect(cut.end).toBeCloseTo(1.88);
  });

  it("keeps the last take of a repeated sentence", () => {
    const words = [...say("In this video I show you", 0), ...say("In this video I will show you", 3)];
    const [cut] = retakes(words);
    expect(cut.start).toBe(0);
    expect(cut.end).toBeLessThan(3);
    expect(cut.words).toBe("In this video I show you");
  });

  it("finds a retake said straight after the first attempt, with no pause", () => {
    const words = say("My name is Owain. My name is Owain and I build agents.", 0);
    const [cut] = retakes(words);
    expect(cut.words).toBe("My name is Owain.");
  });

  it("does not cut the start of the take that replaced an earlier one", () => {
    // Take 1: intro + line. Take 2: the same. The line's match must not swallow take 2's intro.
    const words = [...say("Hi I am Owain.", 0), ...say("I build agents every day.", 2), ...say("Hi I am Owain.", 6), ...say("I build agents every day.", 8)];
    const result = sift(words, { step: 0.01, db: Array(1000).fill(-20) }, 10);
    const kept = result.keeps.flatMap((k) => words.filter((w) => w.start >= k.start && w.end <= k.end)).map((w) => w.text);
    expect(kept.join(" ")).toBe("Hi I am Owain. I build agents every day.");
  });

  it("drops slivers between cuts", () => {
    expect(keeps([{ start: 0, end: 1, reason: "pause" }, { start: 1.1, end: 2, reason: "pause" }], 3)).toEqual([{ start: 2, end: 3 }]);
  });
});

describe("angles", () => {
  it("switches to the screen and splits a kept range there", () => {
    const angles = perSecond([0.9, 0.9, 0.2, 0.9, 0.3, 0.3, 0.3]);
    expect(angles).toEqual(["camera", "camera", "camera", "screen", "screen", "screen", "screen"]);
    expect(assign([{ start: 1.5, end: 5 }], angles)).toEqual([
      { start: 1.5, end: 3, angle: "camera" },
      { start: 3, end: 5, angle: "screen" },
    ]);
  });
});
