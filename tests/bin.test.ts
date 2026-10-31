import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clips, loadCut, timeline } from "../media/bin.ts";
import { resolveProject } from "../media/project.ts";

const said = (text: string) => text.split(" ").map((t, i) => ({ text: t, start: +(i * 0.4).toFixed(3), end: +(i * 0.4 + 0.3).toFixed(3) }));
const write = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data));

// A project made from one clip, with a second clip in its bin.
const project = () => {
  const projects = mkdtempSync(join(tmpdir(), "studio-bin-"));
  const dir = join(projects, "p");
  mkdirSync(join(dir, "clips/b"), { recursive: true });
  write(join(dir, "project.json"), { slug: "p", original: "/footage/a.mov", size: [1080, 1920], duration: 4 });
  write(join(dir, "transcript.json"), said("one two three four five six seven eight nine ten"));
  write(join(dir, "clips/b/clip.json"), { name: "b.mov", original: "/footage/b.mov", duration: 2 });
  write(join(dir, "clips/b/transcript.json"), said("alpha beta gamma delta"));
  write(join(dir, "edit.json"), {
    title: "t",
    face: { x: 0.5, y: 0.3, h: 0.2 },
    music: false,
    shots: [{ at: "one two", layout: "full" }, { at: "five six", layout: "split", visual: { kind: "title", text: "Five" } }, { at: "beta gamma", layout: "full" }],
  });
  return { projects, dir };
};

describe("a project's bin and cut", () => {
  it("lists the main clip and added clips", () => {
    const { projects, dir } = project();
    expect(clips(dir).map((c) => [c.id, c.name, c.ready])).toEqual([["main", "a.mov", true], ["b", "b.mov", true]]);
    rmSync(projects, { recursive: true });
  });

  it("with no cut.json, plays the main clip whole, exactly as before", () => {
    const { projects, dir } = project();
    expect(loadCut(dir).explicit).toBe(false);
    const { resolved, issues } = resolveProject(projects, "p");
    expect(resolved!.duration).toBe(4);
    expect(resolved!.cut).toBeUndefined();
    expect(resolved!.video).toBe("p/source/talking.mp4");
    // "beta gamma" is in clip b, which is not in the cut.
    expect(issues.some((i) => i.level === "error" && i.message.includes("beta gamma"))).toBe(true);
    rmSync(projects, { recursive: true });
  });

  it("with a cut, resolves the plan on the cut's timeline", () => {
    const { projects, dir } = project();
    // "five" to "ten" of main (1.55 to 4), then all of b.
    write(join(dir, "cut.json"), { segments: [{ id: "s1", src: "main", in: 1.55, out: 4 }, { id: "s2", src: "b", in: 0, out: 2 }] });
    const line = timeline(dir);
    expect(line.duration).toBeCloseTo(4.45);
    expect(line.words[0]).toEqual({ text: "five", start: 0.05, end: 0.35 });
    const { resolved, issues } = resolveProject(projects, "p");
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    // "one two" was cut out, so its shot is left out; the rest follow their words.
    expect(resolved!.shots.map((s) => [s.anchor, +s.start.toFixed(2)])).toEqual([["five six", 0], ["beta gamma", 2.8]]);
    expect(resolved!.cut!.map((c) => [c.video, c.start, c.in])).toEqual([["p/build/preview.mp4", 0, 1.55], ["p/clips/b/build/preview.mp4", 2.45, 0]]);
    rmSync(projects, { recursive: true });
  });

  it("reports a cut.json that does not parse", () => {
    const { projects, dir } = project();
    write(join(dir, "cut.json"), { segments: [{ id: "s1", src: "main", in: 2, out: 1 }] });
    expect(resolveProject(projects, "p").issues[0].message).toMatch(/cut.json/);
    rmSync(projects, { recursive: true });
  });
});
