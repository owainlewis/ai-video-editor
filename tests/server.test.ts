import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanWords, liveStatus, starterPlan } from "../media/ingest.ts";
import { Edit } from "../engine/schema.ts";
import { promptFor } from "../server/agent.ts";
import { snapshot, undo, versions } from "../server/history.ts";
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
