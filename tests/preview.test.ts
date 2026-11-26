import { describe, expect, it } from "vitest";
import { cardPlan, effectList, settledTime, shotPlan } from "../effects/preview.ts";
import { cards, slotIssues } from "../styles/blueprint/style.ts";
import { libraryVariants } from "../media/qc.ts";
import { readCardLibrary } from "../media/cardlibrary.ts";

// Every catalog card, to test the catalog itself apart from what the library holds today.
const EVERY = { cards: cards.map((c) => c.id), removed: [] };

describe("the gallery's plans", () => {
  it("plays every card in a layout the card allows, at sample and longest text", () => {
    for (const canvas of ["youtube", "reel"] as const)
      for (const e of effectList(canvas, EVERY))
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
    const r = { ...cardPlan(effectList("youtube", EVERY)[0].id, "youtube"), video: "p/source/video.mp4", audio: "p/build/mix.wav", sfx: [{ kind: "whoosh" as const, t: 1 }] };
    r.shots = [{ ...r.shots[0], end: 2 }, { ...r.shots[0], start: 2, end: 4 }];
    const bare = shotPlan(r, 1, false);
    expect(bare.shots).toEqual([r.shots[1]]);
    expect([bare.audio, bare.video, bare.sfx.length]).toEqual([null, "", 0]);
    expect(shotPlan(r, 1, true).video).toBe("p/source/video.mp4");
  });

  it("leaves the YouTube-only lower third out of reels, and marks it off the look on YouTube", () => {
    expect(effectList("reel", EVERY).some((e) => e.kind === "lower")).toBe(false);
    expect(effectList("youtube", EVERY).find((e) => e.kind === "lower")?.off).toBeTruthy();
  });

  it("shows each canvas's look: house graphics first on YouTube, the clean kit on reels", () => {
    const wide = effectList("youtube", EVERY);
    expect(wide.slice(0, 4).map((e) => e.kind)).toEqual(["words", "focus", "shift", "map"]);
    expect(wide.some((e) => e.id === "blueprint.t1.beats")).toBe(false);
    const kit = effectList("reel", EVERY).filter((e) => !e.off).map((e) => e.id);
    expect(kit.slice(0, 2)).toEqual(["blueprint.t1.beats", "blueprint.t1.list.bracket"]);
    expect(kit).toContain("blueprint.t1.words");
    expect(kit).not.toContain("blueprint.t2.kpi");
  });

  it("shows only the library's cards, and the removed ones apart, to add back", () => {
    const lib = { cards: ["blueprint.t1.beats", "blueprint.t1.cli"], removed: ["blueprint.t2.code"] };
    const list = effectList("reel", lib);
    expect(list.map((e) => [e.id, e.approved, e.removed])).toEqual([
      ["blueprint.t1.beats", true, false],
      ["blueprint.t1.cli", true, false],
      ["blueprint.t2.code", false, true],
    ]);
    // Today's library on reels is the clean kit, nothing retired.
    const now = effectList("reel", readCardLibrary()).filter((e) => e.approved);
    expect(now.length).toBeGreaterThanOrEqual(15);
    expect(now.some((e) => ["words", "kpi", "custom"].includes(e.kind))).toBe(false);
    // The parts from the Jeff Su study (2026-11-26) joined the kit: a chart, a prompt bar, a doc.
    for (const kind of ["chart", "prompt", "doc"]) expect(now.some((e) => e.kind === kind && !e.off)).toBe(true);
    expect(effectList("youtube", EVERY).filter((e) => e.off).map((e) => e.kind)).toEqual(["lower"]);
  });

  it("draws a clean card as a clean reel does", () => {
    const beats = cardPlan("blueprint.t1.beats", "reel", undefined, false);
    expect([beats.style, beats.shots[0].layout, beats.shots[0].bg, beats.shots[0].header]).toEqual(["clean", "card", "ink", undefined]);
    const words = cardPlan("blueprint.t1.words", "reel", "light", false);
    expect([words.shots[0].layout, words.shots[0].tone, words.standIn]).toEqual(["split", "dark", true]);
    expect(cardPlan("blueprint.t1.words", "youtube").style).toBeUndefined();
  });

  it("picks the bracketed list card only for a bracketed title", () => {
    expect(slotIssues({ kind: "list", title: "[A LONG BRACKET TITLE]", items: [{ text: "a" }, { text: "b" }], preview: false } as never)[0]).toMatch(/list.bracket title/);
    expect(slotIssues({ kind: "list", title: "Plain title", items: [{ text: "a" }, { text: "b" }], preview: false } as never)).toEqual([]);
  });

  it("checks YouTube in every theme and reels once in the clean style, at sample and longest text", () => {
    expect(libraryVariants()).toHaveLength(8);
    expect(libraryVariants("reel")).toEqual([{ canvas: "reel", theme: "dark", longest: false }, { canvas: "reel", theme: "dark", longest: true }]);
    expect(libraryVariants("youtube")).toHaveLength(6);
  });
});
