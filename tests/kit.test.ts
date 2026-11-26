// The kit parts from the Jeff Su and listicle studies (2026-11-26): the prompt bar, the skeleton doc, and the chart
// in the clean kit. Their layout and timing (engine/prompt.ts, engine/doc.ts) and how a plan resolves.
import { describe, expect, it } from "vitest";
import { Edit, Visual, type VisualSpec } from "../engine/schema.ts";
import { PROMPT, promptBeats, promptIssues, promptLayout, promptLines, promptText, typedCount } from "../engine/prompt.ts";
import { DOC, docBeats, docHead, docHeight, docIssues } from "../engine/doc.ts";
import { textWidth } from "../engine/flow.ts";
import { floatPlaces, galleryBeats, galleryGrid, galleryIssues, galleryTiles } from "../engine/gallery.ts";
import { cleanSfx, resolveShots } from "../engine/resolve.ts";
import { cards } from "../styles/blueprint/style.ts";
import { atMax, cardFor } from "../styles/catalog.ts";

type Prompt = Extract<VisualSpec, { kind: "prompt" }>;
type Doc = Extract<VisualSpec, { kind: "doc" }>;
const prompt = (x: Partial<Prompt>) => Visual.parse({ kind: "prompt", text: "Summarise this", ...x }) as Prompt;
const doc = (x: Partial<Doc>) => Visual.parse({ kind: "doc", title: "Plan.md", ...x }) as Doc;
const say = (s: string) => s.split(" ").map((text, i) => ({ text, start: i, end: i + 0.8 }));
const plan = (at: string, visual: unknown) => Edit.parse({ title: "t", face: { x: 0.5, y: 0.2, h: 0.3 }, shots: [{ at, layout: "split", visual }] });

describe("the prompt bar", () => {
  it("types the text without its asterisks and knows where the mark sits", () => {
    const { plain, mark } = promptText("Fix the *failing test* now");
    expect(plain).toBe("Fix the failing test now");
    expect(plain.slice(mark!.from, mark!.to)).toBe("failing test");
  });
  it("wraps on spaces, every line inside the box, the lines joining back to the text", () => {
    const text = "Read every issue in this repo and write a short plan for the three that matter most";
    const L = promptLayout(prompt({ text }));
    expect(L.lines.join("")).toBe(text);
    for (const l of L.lines) expect(textWidth(l.trimEnd(), PROMPT.size, false)).toBeLessThanOrEqual(L.inner);
    expect(L.lines.length).toBeGreaterThan(1);
    expect(promptLines("one", 44, 10)).toEqual(["one"]);
  });
  it("keeps a search on one line, shrinking the type, and says when it cannot fit", () => {
    const short = promptLayout(prompt({ search: true, text: "claude code hooks" }));
    expect(short.lines).toHaveLength(1);
    expect(short.size).toBe(PROMPT.size);
    expect(promptIssues(prompt({ search: true, text: "a search far too long to ever fit on one line of the bar at all" }))[0]).toMatch(/too long/);
  });
  it("types from its word, marks once the phrase is typed, sends only when told", () => {
    const v = prompt({ text: "Fix the *failing test*", at: "fix", mark: "failing" });
    const b = promptBeats(v, 0, [1, 1.2, 9]);
    expect(b.t0).toBe(1);
    expect(b.markAt).toBeGreaterThan(b.t1 - 0.01);
    expect(b.sendAt).toBeUndefined();
    expect(typedCount(v, 0.5, b)).toBe(0);
    expect(typedCount(v, 99, b)).toBe(promptText(v.text).plain.length);
    // Unanchored, it types just after the cut.
    expect(promptBeats(prompt({}), 2).t0).toBeCloseTo(2.3);
    // A send said before the typing ends waits for it.
    const s = promptBeats(prompt({ text: "Ship it", at: "ship", send: "go" }), 0, [0, 0, 0.1]);
    expect(s.sendAt).toBeGreaterThan(s.t1);
  });
  it("flags a mark with nothing marked", () => {
    expect(promptIssues(prompt({ mark: "this" }))[0]).toMatch(/marked/);
  });
  it("resolves on its words, with keys under the typing and a click on send", () => {
    const words = say("now I ask it to fix the failing test and send");
    const { shots, issues } = resolveShots(plan("now", { kind: "prompt", text: "Fix the *failing test*", at: "fix", mark: "failing", send: "send" }), words, 12);
    expect(issues).toEqual([]);
    const sfx = cleanSfx(shots);
    expect(sfx.filter((e) => e.kind === "key").length).toBeGreaterThan(3);
    expect(sfx.filter((e) => e.kind === "blip")).toHaveLength(1);
    expect(sfx.filter((e) => e.kind === "pop")).toHaveLength(1);
  });
});

describe("the skeleton doc", () => {
  it("is taller for a table and for more rows, and keeps a header only when it has a tag or icon", () => {
    expect(docHeight(doc({ cols: ["A", "B"] }))).toBeGreaterThan(docHeight(doc({})));
    expect(docHeight(doc({ rows: 8 }))).toBeGreaterThan(docHeight(doc({ rows: 3 })));
    expect(docHead({ tag: "Doc" })).toBe(DOC.head);
    expect(docHead({})).toBeLessThan(DOC.head);
  });
  it("draws its rows in a cascade, lights marks and scans on their words", () => {
    const v = doc({ rows: 4, marks: [{ row: 2, at: "this" }], scan: "reads" });
    const b = docBeats(v, 1, [2, 3]);
    expect(b.rows).toHaveLength(4);
    expect(b.rows[3]).toBeGreaterThan(b.rows[0]);
    expect(b.marks).toEqual([3]);
    expect(b.scan).toBe(2);
    expect(docBeats(doc({}), 0).scan).toBeUndefined();
  });
  it("flags a mark past its last row", () => {
    expect(docIssues(doc({ rows: 3, marks: [{ row: 5, at: "x" }] }))[0]).toMatch(/row 5/);
  });
  it("resolves its marks and scan on their words, a blip for each mark", () => {
    const words = say("the agent reads the plan and finds this line");
    const { shots, issues } = resolveShots(plan("the", { kind: "doc", title: "Plan.md", marks: [{ row: 3, at: "this" }], scan: "reads" }), words, 10);
    expect(issues).toEqual([]);
    expect(shots[0].visual?.times?.map((t) => Math.round(t))).toEqual([2, 7]);
    expect(cleanSfx(shots).filter((e) => e.kind === "blip")).toHaveLength(1);
  });
});

describe("the library cards", () => {
  const ids = ["blueprint.t2.prompt", "blueprint.t2.prompt.search", "blueprint.t2.doc", "blueprint.t2.doc.table"];
  it("pick their card by treatment", () => {
    for (const id of ids) {
      const c = cards.find((x) => x.id === id)!;
      expect(cardFor(cards, c.sample!.visual).id).toBe(id);
    }
  });
  it("hold their longest text", () => {
    for (const id of ids) {
      const v = atMax(cards.find((x) => x.id === id)!)!.visual;
      // Filled to the limit the text loses its asterisks, so only the fit is checked.
      if (v.kind === "prompt") expect(promptLayout(v).fits).toBe(true);
      if (v.kind === "doc") expect(docIssues(v)).toEqual([]);
    }
  });
});

describe("the gallery wall and floating pages", () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ src: `assets/pages/p${i}.png` }));
  it("lays tiles edge to edge in two or three columns, a short last row centred", () => {
    expect(galleryGrid(4)).toEqual({ cols: 2, rows: 2 });
    expect(galleryGrid(6)).toEqual({ cols: 3, rows: 2 });
    expect(galleryGrid(9)).toEqual({ cols: 3, rows: 3 });
    const t = galleryTiles(9, 1080, 700);
    expect(t[0].x).toBe(0);
    expect(t[8].x + t[8].w).toBeCloseTo(1080);
    expect(t[8].y + t[8].h).toBeCloseTo(700);
    const seven = galleryTiles(7, 1080, 700);
    expect(seven[6].x + seven[6].w / 2).toBeCloseTo(540);
  });
  it("grows its focus only once every tile has landed", () => {
    const v = Visual.parse({ kind: "gallery", items: items(4), focus: { item: 2, at: "this" } }) as Extract<VisualSpec, { kind: "gallery" }>;
    const b = galleryBeats(v, 0, [0, 0.1, 3, 3.1, 1]);
    expect(b.focus).toBeGreaterThan(3.1);
    expect(galleryIssues({ ...v, focus: { item: 7, at: "x" } })[0]).toMatch(/item 7/);
  });
  it("places floating pages back to front, the front one last", () => {
    for (const n of [3, 4, 5, 6]) {
      const p = floatPlaces(n);
      expect(p).toHaveLength(n);
      expect(p[n - 1].z).toBe(0);
    }
  });
  it("resolves on the names, ticks on each, and needs its captures", () => {
    const words = say("you can run Codex Claude Code and OpenCode through one place");
    const { shots, issues } = resolveShots(plan("you", { kind: "gallery", items: [{ src: "a.png", at: "Codex" }, { src: "b.png", at: "Claude" }, { src: "c.png", at: "OpenCode" }, { src: "d.png" }], focus: { item: 4, at: "one place" } }), words, 12);
    expect(issues).toEqual([]);
    const sfx = cleanSfx(shots);
    expect(sfx.filter((e) => e.kind === "pop")).toHaveLength(3);
    expect(sfx.some((e) => e.kind === "whoosh" && e.t > 8)).toBe(true);
  });
});
