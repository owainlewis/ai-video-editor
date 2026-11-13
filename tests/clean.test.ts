// The clean reel style (style "clean", 2026-11-06): its plan fields resolve to times, and its checks
// hold the house rules Owain chose.
import { describe, expect, it } from "vitest";
import { Edit } from "../engine/schema.ts";
import { cleanSfx, hookLines, lintClean, lintCover, lintHook, resolveHook, resolveShots } from "../engine/resolve.ts";

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

  it("warns when a reel ends full frame on the face", () => {
    const ends = (last: unknown) => {
      const { shots } = resolveShots(plan([{ at: "If", layout: "split", visual: { kind: "custom", name: "x" } }, last]), words, 5);
      return lintClean(shots, 5, false).some((i) => /ends on/.test(i.message));
    };
    expect(ends({ at: "having", layout: "full" })).toBe(true);
    expect(ends({ at: "having", layout: "card", bg: "paper", visual: { kind: "beats", items: [{ text: "CODE", at: "code" }] } })).toBe(false);
  });

  it("warns when a reel opens full frame on the face", () => {
    const opens = (first: unknown) => {
      const { shots } = resolveShots(plan([first, { at: "having", layout: "split", visual: { kind: "custom", name: "x" } }]), words, 5);
      return lintClean(shots, 5, false).some((i) => /opens on/.test(i.message));
    };
    expect(opens({ at: "If", layout: "full" })).toBe(true);
    expect(opens({ at: "If", layout: "split", visual: { kind: "custom", name: "y" } })).toBe(false);
  });

  it("rejects a hit word too wide for the frame", () => {
    const { shots } = resolveShots(plan([{ at: "If", layout: "full", hit: { text: "PROFESSIONAL", at: "AI" } }]), words, 5);
    expect(lintClean(shots, 5, false).some((i) => i.level === "error" && /too wide/.test(i.message))).toBe(true);
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
        { at: "tool is", layout: "split", visual: { kind: "cli", steps: [{ type: "prompt", text: "/egm-review a.md" }] } },
      ]),
      words,
      5,
    );
    const ev = cleanSfx(shots);
    expect(ev.filter((e) => e.kind === "chime")).toHaveLength(1);
    expect(ev.filter((e) => e.kind === "impact")).toHaveLength(1);
    expect(ev.filter((e) => e.kind === "key").length).toBeGreaterThan(3);
  });

  it("whooshes a new graphic into the split, hits a huge beat, and stays quiet back on the face", () => {
    const { shots } = resolveShots(
      plan([
        { at: "If", layout: "split", visual: { kind: "custom", name: "x" } },
        { at: "having", layout: "split", visual: { kind: "custom", name: "y" } },
        { at: "good", layout: "card", visual: { kind: "beats", items: [{ text: "CODE", size: "huge", at: "code" }, { text: "review", size: "small", at: "review" }] } },
        { at: "tool is", layout: "full" },
      ]),
      words,
      5,
    );
    const ev = cleanSfx(shots);
    // Not on the first shot (the hook is there), and its peak lands on the cut.
    expect(ev.filter((e) => e.kind === "whoosh").map((e) => e.t)).toEqual([shots[1].start - 0.18]);
    expect(ev.filter((e) => e.kind === "impact").map((e) => e.t)).toEqual([shots[2].visual!.times![0]]);
    expect(ev.filter((e) => e.t >= shots[3].start)).toEqual([]);
  });

  it("warns when a full-screen card holds over 4 s", () => {
    const card = { at: "If", layout: "card", visual: { kind: "beats", items: [{ text: "A", at: "If" }] } };
    const long = (rest: unknown[]) => {
      const { shots } = resolveShots(plan([card, ...rest]), words, 5);
      return lintClean(shots, 5, false).some((i) => /full-screen card holds/.test(i.message));
    };
    expect(long([])).toBe(true); // the card runs the whole 5 s
    expect(long([{ at: "having", layout: "split", visual: { kind: "custom", name: "x" } }])).toBe(false);
  });

  it("holds the hook to the first cut after 3 s, or its own words, and never past 5 s", () => {
    const at = (cuts: string[], hook: { text: string; until?: string }) => {
      const { shots } = resolveShots(plan(cuts.map((c) => ({ at: c, layout: "full" }))), words, 5);
      return resolveHook(hook, words, shots, 5);
    };
    // Shots at 0, 2.35 ("good", word 8) and 3.55 ("is", word 12): the first cut at or after 3 s.
    expect(at(["If", "good", "is"], { text: "x" }).hook!.until).toBeCloseTo(12 * 0.3 - 0.05, 1);
    // No cut between 3 and 5 s: 3 s.
    expect(at(["If", "good"], { text: "x" }).hook!.until).toBe(3);
    // A first shot longer than 5 s ends the hook at 5 s.
    expect(at(["If"], { text: "x" }).hook!.until).toBe(5);
    // Its own words.
    expect(at(["If"], { text: "x", until: "having" }).hook!.until).toBeCloseTo(6 * 0.3 - 0.05, 1);
    expect(at(["If"], { text: "x", until: "nowhere" }).issues[0].level).toBe("error");
  });

  it("warns when a clean reel has no hook, or a hook that is long or wraps past two lines", () => {
    const { shots } = resolveShots(plan([{ at: "If", layout: "split", visual: { kind: "custom", name: "y" } }]), words, 5);
    expect(lintClean(shots, 5, false).map((i) => i.message).join()).toMatch(/no text hook/);
    expect(lintClean(shots, 5, false, { text: "Google EGM: *better code* with AI." }).map((i) => i.message).join()).not.toMatch(/hook/);
    // Owain, 2026-11-11: "We should keep the text hook short": six words at most.
    expect(lintHook({ text: "Google EGM helps you write *better code*." }).map((i) => i.message).join()).toMatch(/7 words/);
    expect(lintHook({ text: "Professional engineers *review everything* before shipping software." }).map((i) => i.message).join()).toMatch(/about 3 lines/);
    expect(lintHook({ text: "two *marks* and *more*" }).map((i) => i.message).join()).toMatch(/marks 2 phrases/);
    expect(hookLines("Google EGM helps you write better code with AI.")).toBe(2);
  });

  it("warns when a clean reel has no cover, or a cover title that runs past two lines", () => {
    const { shots } = resolveShots(plan([{ at: "If", layout: "split", visual: { kind: "custom", name: "y" } }]), words, 5);
    expect(lintClean(shots, 5, false).map((i) => i.message).join()).toMatch(/no cover/);
    expect(lintCover({ title: "Google's New Tool Improves Your AI Code" })).toEqual([]);
    expect(lintCover({ title: "Google's Brand New Free Tool Massively Improves Your AI Code" }).map((i) => i.message).join()).toMatch(/10 words.*\n?|lines/);
  });
});
