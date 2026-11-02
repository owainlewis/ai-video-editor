import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanWords, liveStatus, starterPlan } from "../media/ingest.ts";
import { Edit } from "../engine/schema.ts";
import { promptFor } from "../server/agent.ts";
import { redo, redoable, snapshot, undo, versions } from "../server/history.ts";
import { trashProject } from "../server/trash.ts";

const words = [
  { text: "Anthropic", start: 0, end: 0.9 },
  { text: "just", start: 0.92, end: 1.2 },
  { text: "released", start: 1.2, end: 1.5 },
  { text: "an", start: 1.52, end: 1.8 },
  { text: "article.", start: 1.82, end: 2.1 },
];

describe("version history", () => {
  const project = () => {
    const dir = mkdtempSync(join(tmpdir(), "studio-"));
    writeFileSync(join(dir, "edit.json"), '{"v":1}');
    return dir;
  };
  it("saves a version only when the plan changed", () => {
    const dir = project();
    expect(snapshot(dir, "edit")).toBe(true);
    expect(snapshot(dir, "edit")).toBe(false);
    writeFileSync(join(dir, "edit.json"), '{"v":2}');
    expect(snapshot(dir, "claude")).toBe(true);
    expect(versions(dir).map((v) => [v.n, v.by])).toEqual([[1, "edit"], [2, "claude"]]);
  });
  it("undo restores the previous plan and is not saved again as a change", () => {
    const dir = project();
    snapshot(dir, "edit");
    writeFileSync(join(dir, "edit.json"), '{"v":2}');
    snapshot(dir, "claude");
    expect(undo(dir)).toBe(true);
    expect(readFileSync(join(dir, "edit.json"), "utf8")).toBe('{"v":1}');
    expect(snapshot(dir, "edit")).toBe(false);
    expect(versions(dir)).toHaveLength(1);
    expect(undo(dir)).toBe(false);
  });
  it("redo brings back what undo took away, until a new change", () => {
    const dir = project();
    snapshot(dir, "edit");
    writeFileSync(join(dir, "edit.json"), '{"v":2}');
    snapshot(dir, "edit");
    expect(redo(dir)).toBe(false);
    undo(dir);
    expect(redoable(dir)).toBe(1);
    expect(redo(dir)).toBe(true);
    expect(readFileSync(join(dir, "edit.json"), "utf8")).toBe('{"v":2}');
    expect(snapshot(dir, "edit")).toBe(false);
    undo(dir);
    writeFileSync(join(dir, "edit.json"), '{"v":3}');
    snapshot(dir, "edit");
    expect(redoable(dir)).toBe(0);
    expect(versions(dir)).toHaveLength(2);
  });
  it("versions the cut with the plan", () => {
    const dir = project();
    snapshot(dir, "edit");
    writeFileSync(join(dir, "cut.json"), '{"segments":[1]}');
    expect(snapshot(dir, "cut")).toBe(true);
    writeFileSync(join(dir, "cut.json"), '{"segments":[2]}');
    expect(snapshot(dir, "cut")).toBe(true);
    undo(dir);
    expect(readFileSync(join(dir, "cut.json"), "utf8")).toBe('{"segments":[1]}');
    // Back before there was a cut: the project plays its clip whole again.
    undo(dir);
    expect(existsSync(join(dir, "cut.json"))).toBe(false);
    expect(snapshot(dir, "edit")).toBe(false);
    redo(dir);
    redo(dir);
    expect(readFileSync(join(dir, "cut.json"), "utf8")).toBe('{"segments":[2]}');
    expect(snapshot(dir, "edit")).toBe(false);
  });
});

describe("a note's context", () => {
  it("gives Claude the selected section and the words said in it", () => {
    const p = promptFor("demo", "add a title here", { start: 0.9, end: 1.5 }, 0, words);
    expect(p).toContain("projects/demo/edit.json");
    expect(p).toContain("0.90s to 1.50s");
    expect(p).toContain('Said there: "just released"');
    expect(p).toContain("Note: add a title here");
  });
  it("falls back to the words around the playhead", () => {
    expect(promptFor("demo", "x", undefined, 1, words)).toContain('Said around it: "Anthropic just released an article."');
  });
});

describe("import", () => {
  it("drops words invented after speech ends and joins split numbers", () => {
    const raw = [{ text: "from", start: 0, end: 0.3 }, { text: "2", start: 0.3, end: 0.5 }, { text: ",500", start: 0.5, end: 0.8 }, { text: "ship.", start: 0.9, end: 1.2 }, { text: "Ship.", start: 1.4, end: 1.41 }];
    expect(cleanWords(raw, 1.3).map((w) => w.text)).toEqual(["from", "2,500", "ship."]);
  });
  it("starts landscape footage as a YouTube video and portrait as a reel", () => {
    expect(Edit.parse(starterPlan("demo", words, [3840, 2160]))).toMatchObject({ canvas: "youtube" });
    expect(Edit.parse(starterPlan("demo", words, [1080, 1920]))).toMatchObject({ canvas: "reel" });
  });
  it("starts a valid plan anchored on the opening words", () => {
    const plan = Edit.parse(starterPlan("demo", words, [1080, 1920]));
    expect(plan.shots[0]).toMatchObject({ at: "Anthropic just released", layout: "full" });
  });
});

describe("plan checks", () => {
  it("warns when a pipeline shows stages that are never named", async () => {
    const { lintShots } = await import("../engine/resolve.ts");
    const shot = (stages: { label?: string }[]) => ({ start: 0, end: 2, layout: "split" as const, anchor: "a", visual: { kind: "pipeline", stages } as never });
    expect(lintShots([shot([{ label: "A" }, {}])], 2, "mixed").map((i) => i.message).join()).toMatch(/unnamed stages/);
    expect(lintShots([shot([{ label: "A" }, { label: "B" }])], 2, "mixed").map((i) => i.message).join()).not.toMatch(/unnamed stages/);
  });
});

describe("deleting a project", () => {
  const setup = (status?: object) => {
    const projects = mkdtempSync(join(tmpdir(), "studio-"));
    mkdirSync(join(projects, "demo"));
    writeFileSync(join(projects, "demo", "edit.json"), "{}");
    if (status) writeFileSync(join(projects, "demo", "status.json"), JSON.stringify(status));
    mkdirSync(join(projects, ".uploads"));
    writeFileSync(join(projects, ".uploads", "demo.mp4"), "x");
    return projects;
  };
  it("moves the project and its upload into .trash, erasing nothing", () => {
    const projects = setup({ stage: "Ready", done: true });
    const dest = trashProject(projects, "demo", false);
    expect(existsSync(join(projects, "demo"))).toBe(false);
    expect(readFileSync(join(dest, "edit.json"), "utf8")).toBe("{}");
    expect(existsSync(join(dest, "upload-demo.mp4"))).toBe(true);
  });
  it("treats a job whose process is gone as interrupted, so it can be deleted", () => {
    const projects = setup({ stage: "Transcribing", done: false, pid: 999999 });
    expect(liveStatus(join(projects, "demo"))).toMatchObject({ stage: "Interrupted", done: true });
    expect(() => trashProject(projects, "demo", false)).not.toThrow();
  });
  it("keeps a live job running", () => {
    expect(liveStatus(join(setup({ stage: "Transcribing", done: false, pid: process.pid }), "demo"))).toMatchObject({ stage: "Transcribing", done: false });
  });
  it("refuses while an import, export or note is running, and rejects bad names", () => {
    expect(() => trashProject(setup({ stage: "Transcribing", done: false }), "demo", false)).toThrow(/still running/);
    expect(() => trashProject(setup(), "demo", true)).toThrow(/still working/);
    expect(() => trashProject(setup(), "../demo", false)).toThrow(/no project/);
    expect(() => trashProject(setup(), ".trash", false)).toThrow(/no project/);
  });
});

describe("YouTube export", () => {
  it("renders only the graphic sections, merging a visual with its keep shots", async () => {
    const { sections } = await import("../media/export.ts");
    const shot = (start: number, end: number, layout: string, extra: object = {}) => ({ start, end, layout, anchor: "a", ...extra });
    const r = { shots: [shot(0, 5, "full"), shot(5, 9, "side", { visual: { kind: "list" } }), shot(9, 12, "side", { keep: true }), shot(12, 20, "full"), shot(20, 24, "over", { visual: { kind: "title" } })] } as never;
    expect(sections(r)).toEqual([{ start: 5, end: 12, alpha: false }, { start: 20, end: 24, alpha: true }]);
  });
  it("pads a whip's sections so the frames either side of the cut render", async () => {
    const { sections } = await import("../media/export.ts");
    const r = { transition: "whip", shots: [{ start: 0, end: 5, layout: "full", anchor: "a" }, { start: 5, end: 9, layout: "side", anchor: "b", visual: { kind: "title" } }, { start: 9, end: 20, layout: "full", anchor: "c" }] } as never;
    expect(sections(r)).toEqual([{ start: 4.8, end: 9.2, alpha: false }]);
  });
  it("renders kinetic captions over the plain picture as overlays", async () => {
    const { sections } = await import("../media/export.ts");
    const r = { shots: [{ start: 0, end: 30, layout: "full", anchor: "a" }], kinetic: [{ start: 3, end: 6, lines: [] }, { start: 10, end: 12, lines: [] }] } as never;
    expect(sections(r)).toEqual([{ start: 2.9, end: 6, alpha: true }, { start: 9.9, end: 12, alpha: true }]);
  });
});

describe("inserting shots at a time", () => {
  const w = (texts: string[]) => texts.map((text, i) => ({ text, start: i, end: i + 0.9 }));
  it("finds a phrase that the in-order search lands on, growing it past repeats", async () => {
    const { phraseAt } = await import("../engine/insert.ts");
    const words = w(["so", "we", "ship", "it", "so", "we", "ship", "faster"]);
    expect(phraseAt(words, 4, -1)).toBe("so we ship faster");
    expect(phraseAt(words, 4, 3)).toBe("so we ship");
  });
  it("merges new shots into time order and replaces a shot on the same word", async () => {
    const { mergeShots } = await import("../engine/insert.ts");
    const words = w(["one", "two", "three", "four", "five", "six", "seven", "eight"]);
    const existing = [{ index: 0, shot: { at: "one two", layout: "full" } }, { index: 5, shot: { at: "six seven", layout: "full" } }];
    const out = mergeShots(words, existing, [{ index: 2, shot: { at: "", layout: "cutaway" } }, { index: 5, shot: { at: "", layout: "punch" } }]);
    expect(out.map((s) => [s.at, s.layout])).toEqual([["one two", "full"], ["three four five", "cutaway"], ["six seven eight", "punch"]]);
  });
});

describe("loudness limits", () => {
  it("passes -14 LUFS at -1 dBTP with a small range, and fails each limit", async () => {
    const { loudnessIssues } = await import("../media/tools.ts");
    const target = { lufs: -14, tp: -1 };
    expect(loudnessIssues({ lufs: -14.2, tp: -1.1, lra: 2.1 }, target)).toEqual([]);
    expect(loudnessIssues({ lufs: -14.7, tp: -1.1, lra: 2 }, target)[0].message).toMatch(/loudness/);
    expect(loudnessIssues({ lufs: -14, tp: -0.3, lra: 2 }, target)[0].message).toMatch(/true peak/);
    expect(loudnessIssues({ lufs: -14, tp: -1.2, lra: 7 }, target)[0].message).toMatch(/range/);
  });
});
