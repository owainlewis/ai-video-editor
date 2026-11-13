import { describe, expect, it } from "vitest";
import { appBeats, appEnd, appRows, typeTime } from "../engine/apps.ts";
import { cleanSfx, resolveShots, visualAnchors } from "../engine/resolve.ts";
import { Edit, Visual } from "../engine/schema.ts";

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
});
