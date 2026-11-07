import { describe, expect, it } from "vitest";
import { tighten, wordsRange } from "../engine/tighten.ts";

const say = (text: string, gaps: Record<number, number> = {}) => {
  let t = 0;
  return text.split(" ").map((w, i) => {
    t += gaps[i] ?? 0.05;
    const word = { text: w, start: t, end: t + 0.25 };
    t += 0.25;
    return word;
  });
};

describe("cutting by the words", () => {
  it("takes the words and the pause after them, with a short lead into the next word", () => {
    const w = say("one two three four", { 2: 0.5 });
    const [a, b] = wordsRange(w, 1, 1);
    expect(a).toBeCloseTo(w[1].start - 0.025);
    expect(b).toBeCloseTo(w[2].start - 0.06);
  });

  it("finds a sentence started again, and keeps the second attempt", () => {
    const w = say("nobody can see what they're doing. Nobody can see what it's running");
    const t = tighten(w);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ kind: "retake", words: [0, 5] });
  });

  it("finds a line said twice word for word", () => {
    expect(tighten(say("so the first thing so the first thing you need is taste"))[0]).toMatchObject({ kind: "retake", words: [0, 3] });
  });

  it("leaves a phrase said again on purpose", () => {
    expect(tighten(say("you need to learn three things. The first thing you need to learn is design"))).toEqual([]);
    expect(tighten(say("you give it a model, which declares which LLM it uses, and you give it a workspace"))).toEqual([]);
  });

  it("cuts fillers and shortens long pauses to a quarter second", () => {
    const w = say("so um this works", { 3: 1.4 });
    const t = tighten(w);
    expect(t.map((x) => x.kind)).toEqual(["filler", "pause"]);
    expect(w[3].start - w[2].end - (t[1].to - t[1].from)).toBeCloseTo(0.25);
  });
});
