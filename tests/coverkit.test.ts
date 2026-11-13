import { describe, expect, it } from "vitest";
import { coverPrompt } from "../media/coverkit.ts";

describe("the Higgsfield cover prompt", () => {
  it("carries the title as written and names only the reel's own logos", () => {
    const p = coverPrompt("Give Your AI Agents Their Own Email", ["Grok", "Grok Bot"]);
    expect(p).toContain("> Give Your AI Agents Their Own Email");
    expect(p).toContain("copied exactly from the attached logo images: Grok and Grok Bot");
    expect(p).toContain("Do not add any other logo");
  });
});
