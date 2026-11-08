import { describe, expect, it } from "vitest";
import { cardPlan, effectList, settledTime, shotPlan } from "../effects/preview.ts";
import { cards, slotIssues } from "../styles/blueprint/style.ts";
import { libraryVariants } from "../media/qc.ts";

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

  it("leaves the YouTube-only lower third out of reels, and marks it off the look on YouTube", () => {
    expect(effectList("reel").some((e) => e.kind === "lower")).toBe(false);
    expect(effectList("youtube").find((e) => e.kind === "lower")?.off).toBeTruthy();
  });

  it("shows each project's look: house graphics first, clean cards only in clean reels", () => {
    const ivory = effectList("reel");
    expect(ivory.slice(0, 4).map((e) => e.kind)).toEqual(["words", "focus", "shift", "map"]);
    expect(ivory.some((e) => e.id === "blueprint.t1.beats" || e.off)).toBe(false);
    const clean = effectList("reel", "clean");
    const kit = clean.filter((e) => !e.off).map((e) => e.id);
    expect(kit.slice(0, 2)).toEqual(["blueprint.t1.beats", "blueprint.t1.list.bracket"]);
    expect(kit).toContain("blueprint.t1.words");
    expect(kit).not.toContain("blueprint.t2.kpi");
    expect(effectList("youtube").filter((e) => e.off).map((e) => e.kind)).toEqual(["lower"]);
  });

  it("draws a clean card as a clean reel does", () => {
    const beats = cardPlan("blueprint.t1.beats", "reel", undefined, false, "clean");
    expect([beats.style, beats.shots[0].layout, beats.shots[0].bg, beats.shots[0].header]).toEqual(["clean", "card", "ink", undefined]);
    const words = cardPlan("blueprint.t1.words", "reel", "light", false, "clean");
    expect([words.shots[0].layout, words.shots[0].tone, words.standIn]).toEqual(["split", "dark", true]);
    expect(cardPlan("blueprint.t1.words", "reel").style).toBeUndefined();
  });

  it("picks the bracketed list card only for a bracketed title", () => {
    expect(slotIssues({ kind: "list", title: "[A LONG BRACKET TITLE]", items: [{ text: "a" }, { text: "b" }], preview: false } as never)[0]).toMatch(/list.bracket title/);
    expect(slotIssues({ kind: "list", title: "Plain title", items: [{ text: "a" }, { text: "b" }], preview: false } as never)).toEqual([]);
  });

  it("checks the library in every theme and the clean style, at sample and longest text", () => {
    expect(libraryVariants()).toHaveLength(14);
    expect(libraryVariants("reel").every((v) => v.canvas === "reel")).toBe(true);
    expect(libraryVariants("youtube").some((v) => v.style === "clean")).toBe(false);
  });
});
