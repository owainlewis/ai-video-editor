import { describe, expect, it } from "vitest";
import { type Box, closest, findPhrase, markRect, type Page, phraseFrame, placePhrases } from "../engine/page.ts";

// A page 1000 x 500 CSS px with two lines of words, laid out 100 px a word, 40 px a line.
const line = (words: string[], y: number, block: number, x0 = 0) => words.map((text, i) => ({ text, box: [(x0 + i * 100) / 1000, y / 500, 90 / 1000, 30 / 500] as Box, block }));
const page: Page = {
  url: "https://docs.example.com/email",
  title: "Email",
  dark: false,
  scale: 3,
  size: [1000, 500],
  runs: [...line(["You", "can", "open", "Connect", "apps,", "choose", "Email,"], 100, 0), ...line(["and", "choose", "Create", "address.", "→", "Connect", "apps"], 140, 0), ...line(["create", "Address"], 300, 1)],
  blocks: [
    { tag: "p", box: [0, 0.2, 0.7, 0.14] },
    { tag: "p", box: [0, 0.6, 0.2, 0.06] },
  ],
};

describe("findPhrase", () => {
  it("finds an exact phrase, punctuation at the ends of words ignored", () => {
    const { lines, block } = findPhrase(page, "Create address");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toBeCloseTo(0.2);
    expect(lines[0][1]).toBeCloseTo(0.28);
    expect(lines[0][2]).toBeCloseTo(0.19);
    expect(block).toBe(0);
  });

  it("prefers a match in the same case over one in another case", () => {
    // "Create address" (line 2) matches exactly; "create Address" (line 3) only ignoring case.
    expect(findPhrase(page, "Create address").lines[0][1]).toBeCloseTo(0.28);
    expect(findPhrase(page, "create Address").lines[0][1]).toBeCloseTo(0.6);
  });

  it("matches in any case when no match has the same case", () => {
    expect(findPhrase(page, "CONNECT APPS").lines[0][0]).toBeCloseTo(0.3);
  });

  it("picks a later match with nth, skipping a run with no letters", () => {
    expect(findPhrase(page, "Connect apps", 2).lines[0][0]).toBeCloseTo(0.5);
    expect(() => findPhrase(page, "Connect apps", 3)).toThrow(/2 times, not 3/);
  });

  it("splits a phrase that wraps into one box per line", () => {
    expect(findPhrase(page, "choose Email, and choose").lines).toHaveLength(2);
  });

  it("names the closest phrases when the page does not have it", () => {
    expect(() => findPhrase(page, "Create adress")).toThrow(/not on the page; closest: "Create address"/);
    expect(closest(page, "Conect aps")[0]).toBe("Connect apps");
  });
});

describe("markRect", () => {
  it("pads the words a few pixels, as a marker does", () => {
    const r = markRect(page, "Create address");
    expect(r[0]).toBeCloseTo(0.2 - 4 / 1000);
    expect(r[1]).toBeCloseTo(0.28 - 2 / 500);
  });

  it("refuses a phrase that wraps onto a second line", () => {
    expect(() => markRect(page, "choose Email, and choose")).toThrow(/runs over 2 lines/);
  });
});

describe("phraseFrame", () => {
  it("frames several phrases with a pad of the page's width", () => {
    const r = phraseFrame(page, { phrase: ["Connect apps", "Create address"], pad: 0.05 });
    expect(r[0]).toBeCloseTo(0.15);
    expect(r[1]).toBeCloseTo(0.2 - 0.1);
    expect(r[2]).toBeCloseTo(0.29 + 0.1);
  });

  it("frames the block a phrase sits in", () => {
    expect(phraseFrame(page, { phrase: "create Address", block: true, pad: 0 })).toEqual([0, 0.6, 0.2, 0.06]);
  });
});

describe("placePhrases", () => {
  const base = { kind: "image" as const, src: "assets/pages/email.png", frame: "browser" as const, highlight: [] };

  it("fills in rects and keeps rect marks as they are", () => {
    const { visual, errors } = placePhrases({ ...base, to: { phrase: "Create address" }, highlight: [{ phrase: "Connect apps", at: "Connect" }, { rect: [0, 0, 0.1, 0.1], at: "open" }] }, page);
    expect(errors).toEqual([]);
    expect(Array.isArray(visual.to)).toBe(true);
    expect(visual.highlight[0].rect).toHaveLength(4);
    expect(visual.highlight[1].rect).toEqual([0, 0, 0.1, 0.1]);
    expect(visual.url).toBe("https://docs.example.com/email");
  });

  it("reports an unknown phrase as an error", () => {
    const { errors } = placePhrases({ ...base, highlight: [{ phrase: "Delete address" }] }, page);
    expect(errors[0]).toMatch(/"Delete address" is not on the page/);
  });

  it("needs the page json to name words", () => {
    expect(placePhrases({ ...base, highlight: [{ phrase: "Connect apps" }] }, undefined).errors[0]).toMatch(/no page json/);
  });
});
