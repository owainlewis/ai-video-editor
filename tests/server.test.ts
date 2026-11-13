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
});

describe("a plan change that adds an error", () => {
  // The plan is spaced oddly on purpose: putting it back must restore these exact bytes.
  const setup = () => {
    const projects = mkdtempSync(join(tmpdir(), "studio-"));
    const dir = join(projects, "p");
    mkdirSync(dir);
    const text = "one two three four five six seven eight nine ten".split(" ").map((t, i) => ({ text: t, start: i * 0.4, end: i * 0.4 + 0.3 }));
    writeFileSync(join(dir, "project.json"), JSON.stringify({ slug: "p", size: [1080, 1920], duration: 4 }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify(text));
    const plan = JSON.stringify({ title: "t", face: { x: 0.5, y: 0.3, h: 0.2 }, music: false, shots: [{ at: "one two", layout: "full" }, { at: "five six", layout: "split", visual: { kind: "title", text: "Five" } }] }, null, 7);
    writeFileSync(join(dir, "edit.json"), plan);
    return { projects, file: join(dir, "edit.json"), plan };
  };
  it("puts an edited shot back, byte for byte, and says why", async () => {
    const { editShot } = await import("../server/insert.ts");
    const { projects, file, plan } = setup();
    expect(() => editShot(projects, "p", { start: 1.6 }, { shot: { at: "five six", layout: "cutaway" } })).toThrow(expect.objectContaining({ code: 409, message: expect.stringContaining("cutaway") }));
    expect(readFileSync(file, "utf8")).toBe(plan);
  });
  it("puts the plan back when an inserted shot adds an error", async () => {
    const { insertAt } = await import("../server/insert.ts");
    const { projects, file, plan } = setup();
    expect(() => insertAt(projects, "p", [{ start: 0.8, shot: { at: "", layout: "cutaway" } }])).toThrow(expect.objectContaining({ code: 409 }));
    expect(readFileSync(file, "utf8")).toBe(plan);
  });
  it("keeps a change that adds no error", async () => {
    const { editShot } = await import("../server/insert.ts");
    const { projects, file } = setup();
    editShot(projects, "p", { start: 1.6 }, { remove: true });
    const text = readFileSync(file, "utf8");
    expect(JSON.parse(text).shots[1]).toEqual({ at: "five six", layout: "full" });
    expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2) + "\n");
  });
  it("refuses to change a plan that already has errors", async () => {
    const { moveShotEnd } = await import("../server/insert.ts");
    const { projects, file } = setup();
    writeFileSync(file, "{}");
    expect(() => moveShotEnd(projects, "p", { start: 1.6 }, 2)).toThrow(expect.objectContaining({ code: 409 }));
    expect(readFileSync(file, "utf8")).toBe("{}");
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

describe("the inspector", () => {
  it("finds the plan's shot behind a resolved shot, counting repeated anchors in order", async () => {
    const { planIndex } = await import("../engine/insert.ts");
    const plan = [{ at: "so" }, { at: "and then" }, { at: "so" }];
    const resolved = [{ anchor: "" }, { anchor: "so" }, { anchor: "and then" }, { anchor: "so" }];
    expect([0, 1, 2, 3].map((k) => planIndex(plan, resolved, k))).toEqual([-1, 0, 1, 2]);
  });

  it("drops a library sample's own anchors, keeping everything else", async () => {
    const { stripAnchors } = await import("../engine/insert.ts");
    expect(stripAnchors({ kind: "list", items: [{ text: "a", at: "said" }], region: [1, 2], at: "x" })).toEqual({ kind: "list", items: [{ text: "a" }], region: [1, 2] });
  });

  it("previews an edit over the resolved timing, spacing a new card's parts", async () => {
    const { previewShot } = await import("../app/Inspector.tsx");
    const rs = { start: 2, end: 6, layout: "split" as const, anchor: "x", visual: { kind: "title", text: "Old", times: [2.4] } as never };
    expect(previewShot(rs, { at: "x", layout: "media", visual: { kind: "title", text: "New" } as never })).toMatchObject({ layout: "media", visual: { text: "New", times: [2.4] } });
    const swapped = previewShot(rs, { at: "x", layout: "split", visual: { kind: "list", items: [{ text: "a" }, { text: "b" }] } as never });
    expect((swapped.visual as { times: number[] }).times.map((t) => +t.toFixed(2))).toEqual([2.3, 2.7]);
  });
});

describe("takes on a graphic", () => {
  it("resolves each take against the real words and reports what it would break", async () => {
    const { resolveVariants, saveVariants } = await import("../server/variants.ts");
    const dir = mkdtempSync(join(tmpdir(), "takes-"));
    const said = "so here are the three things you need context jobs and skills thanks".split(" ");
    writeFileSync(join(dir, "transcript.json"), JSON.stringify(said.map((text, i) => ({ text, start: i * 0.5, end: i * 0.5 + 0.4 }))));
    writeFileSync(join(dir, "project.json"), JSON.stringify({ duration: 8 }));
    writeFileSync(join(dir, "edit.json"), JSON.stringify({ title: "t", canvas: "reel", face: { x: 0.5, y: 0.3, h: 0.2 }, shots: [{ at: "so here are", layout: "full" }, { at: "the three things", layout: "split", visual: { kind: "title", text: "Three things" } }, { at: "thanks", layout: "full" }] }));
    const start = 3 * 0.5 - 0.1;
    saveVariants(dir, { start, items: [
      { id: "v1", label: "Focus", shot: { at: "the three things", layout: "split", visual: { kind: "focus", items: [{ text: "Context", at: "context" }, { text: "Jobs", at: "jobs" }, { text: "Skills", at: "skills" }] } } },
      { id: "v2", label: "Broken", shot: { at: "the three things", layout: "split", visual: { kind: "words", lines: [{ text: "Nope", at: "never said" }] } } },
    ] });
    const v = resolveVariants(dir)!;
    expect(v.items[0].problems).toEqual([]);
    expect(v.items[0].resolved?.visual?.kind).toBe("focus");
    expect((v.items[0].resolved?.visual as { times: number[] }).times.map((t) => Math.round(t * 10) / 10)).toEqual([4, 4.5, 5.5]);
    expect(v.items[1].problems.join()).toMatch(/never said/);
  });
});
