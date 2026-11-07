// The clean reel style (style "clean", 2026-11-06): its plan fields resolve to times, and its checks
// hold the house rules Owain chose.
import { describe, expect, it } from "vitest";
import { Edit } from "../engine/schema.ts";
import { cleanSfx, lintClean, resolveShots } from "../engine/resolve.ts";

const words = "If you're building software with AI, having a good code review tool is essential."
  .split(" ")
  .map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25 }));
const plan = (shots: unknown[]) => Edit.parse({ title: "t", style: "clean", shots });

describe("clean plans", () => {
  it("resolves a hit, a title and a chip to their words", () => {
    const { shots, issues } = resolveShots(
      plan([
        { at: "If you're", layout: "full", picture: "broll:1-5", hit: { text: "AI", tag: "for code", at: "AI", until: "having" } },
        { at: "having a good", layout: "diagram", visual: { kind: "custom", name: "x" }, title: { lines: ["code", "review"], at: "code review" } },
        { at: "tool is", layout: "split", picture: { src: "broll:1-1", rate: 1 }, chip: { name: "egm-review", at: "essential" }, visual: { kind: "custom", name: "y" } },
      ]),
      words,
      5,
    );
    expect(issues).toEqual([]);
    expect(shots[0].picture).toEqual({ src: "broll:1-5", start: 0, rate: 1 });
    expect(shots[0].hit).toMatchObject({ text: "AI", tag: "for code" });
    expect(shots[0].hit!.at).toBeCloseTo(5 * 0.3 - 0.05);
    expect(shots[0].hit!.until).toBe(shots[0].end);
    expect(shots[1].title!.at).toBeCloseTo(9 * 0.3 - 0.05);
    expect(shots[2].chip!.at).toBeCloseTo(13 * 0.3 - 0.05);
  });

  it("reports a hit whose words are said in a later shot", () => {
    const { issues } = resolveShots(plan([{ at: "If", layout: "full", hit: { text: "TOOL", at: "tool" } }, { at: "having", layout: "full" }]), words, 5);
    expect(issues.map((i) => i.message).join()).toMatch(/hit "tool"/);
  });

  it("resolves card beats on their words", () => {
    const { shots } = resolveShots(plan([{ at: "If", layout: "card", bg: "paper", visual: { kind: "beats", items: [{ text: "CODE", at: "code" }, { text: "review", size: "small", at: "review" }] } }]), words, 5);
    expect(shots[0].visual!.times).toHaveLength(2);
  });

  it("keeps split as the main view and diagrams occasional", () => {
    const { shots } = resolveShots(
      plan([
        { at: "If", layout: "card" },
        { at: "having", layout: "diagram", visual: { kind: "custom", name: "x" } },
        { at: "essential", layout: "split", visual: { kind: "custom", name: "y" } },
      ]),
      words,
      5,
    );
    const messages = lintClean(shots, 5, false).map((i) => i.message).join("\n");
    expect(messages).toMatch(/split is \d+% of the reel/);
    expect(messages).toMatch(/diagrams fill/);
  });

  it("needs b-roll on every picture shot of a faceless reel", () => {
    const { shots } = resolveShots(plan([{ at: "If", layout: "split", visual: { kind: "custom", name: "y" } }]), words, 5);
    expect(lintClean(shots, 5, true).filter((i) => i.level === "error").map((i) => i.message).join()).toMatch(/needs a picture/);
    expect(lintClean(shots, 5, false).filter((i) => i.level === "error")).toEqual([]);
  });

  it("rejects the old style's layouts", () => {
    const { shots } = resolveShots(plan([{ at: "If", layout: "scene", visual: { kind: "title", text: "Hi" } }]), words, 5);
    expect(lintClean(shots, 5, false).some((i) => i.level === "error" && /not a clean layout/.test(i.message))).toBe(true);
  });

  it("types keys under a chip and ticks list items, and nothing on plain cuts", () => {
    const { shots } = resolveShots(
      plan([
        { at: "If", layout: "split", chip: { name: "egm" }, visual: { kind: "custom", name: "y" } },
        { at: "having", layout: "card", visual: { kind: "list", title: "[X]", items: [{ text: "a", at: "code" }, { text: "b", at: "tool" }] } },
        { at: "essential", layout: "full" },
      ]),
      words,
      5,
    );
    const ev = cleanSfx(shots);
    expect(ev.filter((e) => e.kind === "key").length).toBeGreaterThan(0);
    expect(ev.filter((e) => e.kind === "pop")).toHaveLength(2);
    expect(ev.some((e) => e.kind === "whoosh")).toBe(false);
  });

  it("sounds only what lands: a low whoosh as a graphic takes over, one tick per diagram, a click per marker", () => {
    const { shots } = resolveShots(
      plan([
        { at: "If", layout: "full" },
        { at: "having", layout: "diagram", visual: { kind: "custom", name: "x", at: ["good", "review"] } },
        { at: "tool is", layout: "split", visual: { kind: "image", src: "a.png", highlight: [{ rect: [0, 0, 1, 0.1], at: "essential" }] } },
      ]),
      words,
      5,
    );
    const ev = cleanSfx(shots);
    expect(ev.filter((e) => e.kind === "thud").map((e) => e.t)).toEqual([shots[1].start]);
    expect(ev.filter((e) => e.kind === "blip")).toHaveLength(1);
    expect(ev.filter((e) => e.kind === "pop")).toHaveLength(0); // the diagram's first beat sits on the whoosh
  });

  it("rings a logo, hits a hit word and types a Claude Code prompt", () => {
    const { shots } = resolveShots(
      plan([
        { at: "If", layout: "split", visual: { kind: "logos", items: [{ src: "a.png", at: "AI" }] } },
        { at: "having", layout: "full", hit: { text: "CODE", at: "code" } },
        { at: "tool is", layout: "split", visual: { kind: "claudecode", lines: [{ text: "/egm-review a.md", style: "prompt" }] } },
      ]),
      words,
      5,
    );
    const ev = cleanSfx(shots);
    expect(ev.filter((e) => e.kind === "chime")).toHaveLength(1);
    expect(ev.filter((e) => e.kind === "impact")).toHaveLength(1);
    expect(ev.filter((e) => e.kind === "key").length).toBeGreaterThan(3);
  });
});
