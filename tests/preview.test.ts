import { describe, expect, it } from "vitest";
import { cardPlan, effectList, settledTime, shotPlan } from "../effects/preview.ts";
import { cards } from "../styles/blueprint/style.ts";

describe("the gallery's plans", () => {
  it("plays every card in a layout the card allows, at sample and longest text", () => {
    for (const canvas of ["youtube", "reel"] as const)
      for (const e of effectList(canvas))
        for (const longest of [false, true]) {
          const card = cards.find((c) => c.id === e.id)!;
          const plan = cardPlan(e.id, canvas, "dark", longest);
          const shot = plan.shots[0];
          expect(plan.shots).toHaveLength(1);
          expect(card.tier === "overlay" || canvas === "reel" || (card.layouts as string[]).includes(shot.layout)).toBe(true);
          expect(shot.tone).toBe("dark");
          expect(settledTime(shot)).toBeGreaterThan(shot.start);
          expect(settledTime(shot)).toBeLessThan(shot.end);
        }
  });

  it("plays one project shot alone and silent, with footage only when asked", () => {
    const r = { ...cardPlan(effectList("youtube")[0].id, "youtube"), video: "p/source/video.mp4", audio: "p/build/mix.wav", sfx: [{ kind: "whoosh" as const, t: 1 }] };
    r.shots = [{ ...r.shots[0], end: 2 }, { ...r.shots[0], start: 2, end: 4 }];
    const bare = shotPlan(r, 1, false);
    expect(bare.shots).toEqual([r.shots[1]]);
    expect([bare.audio, bare.video, bare.sfx.length]).toEqual([null, "", 0]);
    expect(shotPlan(r, 1, true).video).toBe("p/source/video.mp4");
  });
});
