import { describe, expect, it } from "vitest";
import { appBeats, appEnd, appRows, typeTime } from "../engine/apps.ts";
import { cleanSfx, resolveShots, visualAnchors } from "../engine/resolve.ts";
import { Edit, Visual } from "../engine/schema.ts";
import { bodyRange, clip, fit, inView, pan, snap, tail, textWidth, windowSize } from "../effects/apps/kit.tsx";

const said = (text: string, gap = 1) => text.split(" ").map((t, i) => ({ text: t, start: i * gap + 0.5, end: i * gap + 1 }));

describe("app mock-ups", () => {
  const cli = Visual.parse({
    kind: "cli",
    steps: [
      { type: "prompt", text: "Run the tests" },
      { type: "tool", name: "Bash", text: "npm test", out: ["Tests passed"] },
      { type: "text", text: "All green.", at: "green" },
    ],
  });

  it("fill in the app's defaults", () => {
    expect(cli.kind === "cli" && [cli.app, cli.cwd, cli.welcome]).toEqual(["claude-code", "~/project", true]);
    const gb = Visual.parse({ kind: "grokbot" });
    expect(gb.kind === "grokbot" && [gb.view, gb.bot.name, gb.bot.color]).toEqual(["chat", "Gradient Bot", "white"]);
  });

  it("play their steps one after another, each anchored step on its words", () => {
    const b = appBeats(cli as never, 10, [0, 0, 20]);
    expect(b[0].t0).toBeCloseTo(10.4);
    expect(b[0].t1).toBeCloseTo(10.4 + typeTime("Run the tests".length) + 0.35);
    // The tool starts when the prompt is sent; the reply waits for "green".
    expect(b[1].t0).toBeCloseTo(b[0].t1);
    expect(b[2].t0).toBe(20);
    expect(appEnd(cli as never, 10, [0, 0, 20])).toBeCloseTo(20.5);
  });

  it("time a bot list's rows on their words, and the rest from the start", () => {
    const v = Visual.parse({ kind: "grokbot", view: "bots", bots: [{ name: "A", color: "green" }, { name: "B", color: "red", at: "bee" }] });
    expect(visualAnchors(v)).toEqual([undefined, "bee"]);
    expect(appRows(v as never, 5, [5, 9]).bots).toEqual([4, 9]);
  });

  it("resolve in a plan, with keys under every prompt they type", () => {
    const plan = Edit.parse({ title: "t", shots: [{ at: "one", layout: "split", visual: { kind: "cli", steps: [{ type: "prompt", text: "hello there" }, { type: "text", text: "Hi.", at: "four" }] } }] });
    const { shots, issues } = resolveShots(plan, said("one two three four five"), 6);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    const v = shots[0].visual!;
    expect(v.times?.[1]).toBeGreaterThan(3);
    const keys = cleanSfx(shots).filter((e) => e.kind === "key");
    expect(keys.length).toBeGreaterThan(2);
    expect(keys[0].t).toBeCloseTo(shots[0].start + 0.4);
  });

  it("stream a chat reply whole within 0.75 s, so the settled frame shows all of it", () => {
    const v = Visual.parse({ kind: "claudeapp", steps: [{ type: "text", text: "word ".repeat(60).trim() }] });
    const [b] = appBeats(v as never, 0);
    expect(b.t1 - b.t0).toBeLessThanOrEqual(0.75);
  });
});

describe("the app window's camera", () => {
  const split = { width: 960, height: 724, panel: true };
  const hooked = { width: 960, height: 494, panel: true };
  const youtube = { width: 1920, height: 1080, panel: false };

  it("fills a split's panel edge to edge, and keeps a paper margin on the dots", () => {
    expect(windowSize(split)).toEqual({ winW: 960, winH: 724 });
    const dots = windowSize(split, "dots");
    expect(dots.winW).toBeGreaterThan(880);
    expect(dots.winH).toBeGreaterThan(650);
  });

  it("never sets body text under 30 px, and keeps a terminal close on a tall panel", () => {
    for (const box of [split, hooked, youtube]) for (const k of ["terminal", "chat", "page"] as const) expect(bodyRange(box, windowSize(box), k)[0]).toBeGreaterThanOrEqual(30);
    expect(bodyRange(split, windowSize(split), "terminal")[0]).toBe(36);
    expect(bodyRange(hooked, windowSize(hooked), "terminal")[0]).toBe(30);
    expect(bodyRange(split, windowSize(split), "page")[0]).toBe(30);
    // A YouTube frame keeps the app nearer its own size.
    expect(bodyRange(youtube, windowSize(youtube))[1]).toBeLessThanOrEqual(38);
  });

  it("fits the largest size that holds the content", () => {
    expect(fit(30, 46, (u) => u * 10 <= 400)).toBeCloseTo(40, 1);
    expect(fit(30, 46, () => true)).toBe(46);
    expect(fit(30, 46, () => false)).toBe(30);
  });

  it("pans in eased moves and lands on a row's top", () => {
    const events = [{ t: 1, y: 100 }, { t: 3, y: 250 }];
    expect(pan(0.5, events)).toBe(0);
    expect(pan(2, events)).toBeCloseTo(100);
    expect(pan(3.2, events)).toBeGreaterThan(100);
    expect(pan(3.2, events)).toBeLessThan(250);
    expect(snap(130, [0, 90, 180, 270])).toBe(180);
    expect(snap(-5, [0, 90])).toBe(0);
  });

  it("fades a row the window's edges would cut, and shows a whole one in full", () => {
    expect(inView(100, 40, 0, 500, 30)).toBe(1);
    expect(inView(100, 40, 120, 500, 30)).toBeLessThan(0.3);
    expect(inView(480, 40, 0, 500, 30)).toBeLessThan(0.3);
  });

  it("shows the end of a long typed prompt and cuts a long label with an ellipsis, each on one line", () => {
    const long = "Set up the video tools for this project and make the first render in the renders folder";
    const end = tail(long, 400, 30);
    expect(long.endsWith(end)).toBe(true);
    expect(textWidth(end, 30)).toBeLessThanOrEqual(400);
    const cut = clip(long, 400, 30);
    expect(cut.endsWith("…")).toBe(true);
    expect(textWidth(cut, 30)).toBeLessThanOrEqual(400);
  });
});
