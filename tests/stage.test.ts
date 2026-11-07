import { describe, expect, it } from "vitest";
import { CUSTOM, STILL } from "../effects/custom/index.ts";
import { cards } from "../styles/blueprint/style.ts";

describe("the stage moves", () => {
  const samples = cards.filter((c) => c.kind === "custom" && c.sample);
  it("draws every library card that names a custom graphic", () => {
    expect(samples.length).toBeGreaterThanOrEqual(8);
    for (const c of samples) expect(CUSTOM[(c.sample!.visual as { name: string }).name], c.id).toBeDefined();
  });
  it("holds the frame still on every stage move: the study measured no camera at all", () => {
    for (const name of STILL) expect(CUSTOM[name], name).toBeDefined();
    for (const c of samples) expect(STILL.has((c.sample!.visual as { name: string }).name), c.id).toBe(true);
  });
});
