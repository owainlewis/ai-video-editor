import { describe, expect, it } from "vitest";
import { CTA_TAIL, noCtaLength, resolveCta } from "../engine/cta.ts";
import type { Word } from "../engine/schema.ts";

const said = (text: string) => text.split(" ").map((t, i): Word => ({ text: t, start: i * 0.5, end: i * 0.5 + 0.4 }));
const words = said("If you want this comment below. Now your bot answers. If you want a guide comment Agent below");

describe("resolveCta", () => {
  it("ends in the pause before the last time the call to action is said", () => {
    const { cta, issues } = resolveCta("If you want a guide", words, 30);
    expect(issues).toEqual([]);
    // "If" (the second time) is word 10, at 5.0 s; "answers." ends at 4.9 s.
    expect(cta).toEqual({ at: "If you want a guide", end: Math.round(4.95 * 30) / 30 });
    expect(resolveCta("If you want", words, 30).cta!.end).toBeCloseTo(4.9667, 3);
    expect(noCtaLength(cta!)).toBeCloseTo(cta!.end + CTA_TAIL);
  });

  it("warns when a reel names no call to action, and refuses words not said or said first", () => {
    expect(resolveCta(undefined, words, 30).issues[0]).toMatchObject({ level: "warn", message: expect.stringMatching(/TikTok/) });
    expect(resolveCta("comment Bot below", words, 30).issues[0]).toMatchObject({ level: "error" });
    expect(resolveCta("If you want this", words, 30).issues[0].message).toMatch(/starts the reel/);
  });

  it("does not push the no-CTA end past the CTA start when Whisper word timestamps overlap", () => {
    const overlapping: Word[] = [
      { text: "done", start: 4.4, end: 5.2 },
      { text: "comment", start: 5.0, end: 5.4 },
      { text: "now", start: 5.4, end: 5.7 },
    ];
    const { cta, issues } = resolveCta("comment now", overlapping, 30);
    expect(issues).toEqual([]);
    expect(cta!.end).toBeLessThanOrEqual(5.0);
    expect(cta!.end).toBeCloseTo(5.0, 4);
  });
});
