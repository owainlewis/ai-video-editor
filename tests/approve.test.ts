import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approvalState, fileTitle, thisWeek, weekStart } from "../engine/approve.ts";
import { approval, approve, approvedFolder, listApproved, loadRecord, unapprove, weekCount } from "../media/approve.ts";

// Every test approves into a temporary folder through STUDIO_APPROVED, and trashes into another.
let root: string, projects: string, folder: string, trash: string;
const saved = { approved: process.env.STUDIO_APPROVED, trash: process.env.STUDIO_TRASH };
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "studio-approve-"));
  projects = join(root, "projects");
  folder = join(root, "Reels", "Approved");
  trash = join(root, "Trash");
  process.env.STUDIO_APPROVED = folder;
  process.env.STUDIO_TRASH = trash;
});
afterEach(() => {
  for (const [k, v] of [["STUDIO_APPROVED", saved.approved], ["STUDIO_TRASH", saved.trash]] as const)
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
});

const T = Date.parse("2026-11-13T10:00:00");
const at = (file: string, ms: number) => utimesSync(file, ms / 1000, ms / 1000);
const cover = async (_p: string, slug: string, file: string) => writeFileSync(file, `cover of ${slug}`);
const day = (iso: string) => new Date(iso);

// A reel with its plan at T, and (unless told otherwise) an export a minute later with a clean check.
function reel(slug: string, o: { title?: string; canvas?: string; video?: number | null; check?: number | null; errors?: number; cut?: number } = {}) {
  const dir = join(projects, slug);
  mkdirSync(join(dir, "renders"), { recursive: true });
  mkdirSync(join(dir, "checks"), { recursive: true });
  writeFileSync(join(dir, "project.json"), "{}");
  writeFileSync(join(dir, "edit.json"), JSON.stringify({ title: o.title ?? "Two types of agent", canvas: o.canvas ?? "reel", shots: [] }));
  at(join(dir, "edit.json"), T);
  if (o.cut !== undefined) {
    writeFileSync(join(dir, "cut.json"), '{"segments":[]}');
    at(join(dir, "cut.json"), o.cut);
  }
  const video = o.video === undefined ? T + 60_000 : o.video;
  if (video !== null) {
    writeFileSync(join(dir, "renders/final.mp4"), `video of ${slug}`);
    at(join(dir, "renders/final.mp4"), video);
  }
  const check = o.check === undefined ? (video ?? T) + 5_000 : o.check;
  if (check !== null) {
    const issues = Array.from({ length: o.errors ?? 0 }, () => ({ level: "error", message: "the export is 3.00s; the plan is 30.00s" }));
    writeFileSync(join(dir, "checks/export-check.json"), JSON.stringify({ issues: [...issues, { level: "warn", message: "loudness is -19 LUFS" }] }));
    at(join(dir, "checks/export-check.json"), check);
  }
  return dir;
}
const files = () => (existsSync(folder) ? readdirSync(folder).sort() : []);

describe("approving a reel", () => {
  it("refuses with no export", async () => {
    reel("a", { video: null, check: null });
    await expect(approve(projects, "a", { cover })).rejects.toThrow(/no export yet/);
    expect(files()).toEqual([]);
  });

  it("refuses an export older than the plan or the cut", async () => {
    reel("a", { video: T - 1000 });
    await expect(approve(projects, "a", { cover })).rejects.toThrow(/plan changed after the last export/);
    reel("b", { cut: T + 120_000 });
    await expect(approve(projects, "b", { cover })).rejects.toThrow(/plan changed after the last export/);
    expect(files()).toEqual([]);
  });

  it("refuses a failed export check, a missing one, or one from an older export", async () => {
    reel("a", { errors: 2 });
    await expect(approve(projects, "a", { cover })).rejects.toThrow(/found 2 errors/);
    reel("b", { check: null });
    await expect(approve(projects, "b", { cover })).rejects.toThrow(/no export check/);
    reel("c", { check: T + 30_000 });
    await expect(approve(projects, "c", { cover })).rejects.toThrow(/no export check/);
    expect(files()).toEqual([]);
  });

  it("refuses a YouTube video", async () => {
    reel("a", { canvas: "youtube" });
    await expect(approve(projects, "a", { cover })).rejects.toThrow(/only reels/);
  });

  it("copies the export and its cover into STUDIO_APPROVED, made if missing, and records it", async () => {
    const dir = reel("a", { title: "Google EGM: better code / with AI?" });
    expect(approvedFolder()).toBe(folder);
    expect(approval(dir).state).toBe("exported");
    const r = await approve(projects, "a", { cover, now: day("2026-11-13T12:00:00") });
    expect(files()).toEqual(["2026-11-13 Google EGM better code with AI cover.jpg", "2026-11-13 Google EGM better code with AI.mp4"]);
    expect(readFileSync(r.video, "utf8")).toBe("video of a");
    expect(readFileSync(r.cover, "utf8")).toBe("cover of a");
    expect(loadRecord(dir)).toEqual({ at: day("2026-11-13T12:00:00").toISOString(), video: r.video, cover: r.cover, title: "Google EGM: better code / with AI?" });
    expect(approval(dir).state).toBe("approved");
  });

  it("is out of date once the plan changes after approving", async () => {
    const dir = reel("a");
    await approve(projects, "a", { cover, now: new Date(T + 120_000) });
    expect(approval(dir).state).toBe("approved");
    at(join(dir, "edit.json"), T + 180_000);
    expect(approval(dir)).toMatchObject({ state: "stale", ready: false });
  });

  it("replaces only its own earlier files when approved again", async () => {
    const dir = reel("a");
    await approve(projects, "a", { cover, now: day("2026-11-13T12:00:00") });
    // Approved again the same day: the same names, replaced in place.
    await approve(projects, "a", { cover, now: day("2026-11-13T13:00:00") });
    expect(files()).toEqual(["2026-11-13 Two types of agent cover.jpg", "2026-11-13 Two types of agent.mp4"]);
    // A new export, approved the next day: the new files in, the old ones to the Trash.
    writeFileSync(join(dir, "renders/final.mp4"), "video of a, take 2");
    at(join(dir, "renders/final.mp4"), Date.parse("2026-11-14T09:00:00"));
    at(join(dir, "checks/export-check.json"), Date.parse("2026-11-14T09:00:05"));
    expect(approval(dir).state).toBe("stale");
    expect(approval(dir).ready).toBe(true);
    const r = await approve(projects, "a", { cover, now: day("2026-11-14T10:00:00") });
    expect(files()).toEqual(["2026-11-14 Two types of agent cover.jpg", "2026-11-14 Two types of agent.mp4"]);
    expect(readFileSync(r.video, "utf8")).toBe("video of a, take 2");
    expect(readdirSync(trash).sort()).toEqual(["2026-11-13 Two types of agent cover.jpg", "2026-11-13 Two types of agent.mp4"]);
  });

  it("never overwrites another reel's approved files", async () => {
    reel("a");
    reel("b");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "2026-11-13 Two types of agent.mp4"), "Owain's own file");
    const now = day("2026-11-13T12:00:00");
    const a = await approve(projects, "a", { cover, now });
    const b = await approve(projects, "b", { cover, now });
    expect(a.video).toBe(join(folder, "2026-11-13 Two types of agent (2).mp4"));
    expect(b.video).toBe(join(folder, "2026-11-13 Two types of agent (3).mp4"));
    expect(readFileSync(join(folder, "2026-11-13 Two types of agent.mp4"), "utf8")).toBe("Owain's own file");
    expect(readFileSync(b.cover, "utf8")).toBe("cover of b");
  });

  it("unapproves to the Trash and drops the record", async () => {
    const dir = reel("a");
    const r = await approve(projects, "a", { cover, now: day("2026-11-13T12:00:00") });
    unapprove(projects, "a");
    expect(files()).toEqual([]);
    expect(readdirSync(trash).sort()).toEqual([r.cover, r.video].map((f) => f.split("/").pop()).sort());
    expect(loadRecord(dir)).toBeNull();
    expect(approval(dir).state).toBe("exported");
    expect(() => unapprove(projects, "a")).toThrow(/not approved/);
  });

  it("lists approved reels newest first and counts this week's", async () => {
    reel("a");
    reel("b");
    reel("c");
    await approve(projects, "a", { cover, now: day("2026-11-09T08:00:00") }); // Monday
    await approve(projects, "b", { cover, now: day("2026-11-12T08:00:00") });
    await approve(projects, "c", { cover, now: day("2026-11-08T22:00:00") }); // the Sunday before
    expect(listApproved(projects).map((x) => x.slug)).toEqual(["b", "a", "c"]);
    expect(weekCount(projects, day("2026-11-15T23:59:00"))).toEqual({ count: 2, target: 7 });
    expect(weekCount(projects, day("2026-11-16T00:00:00")).count).toBe(0);
  });
});

describe("approval rules", () => {
  it("names files safely", () => {
    expect(fileTitle("EGM, two types of agent")).toBe("EGM, two types of agent");
    expect(fileTitle('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
    expect(fileTitle("  ..Hidden.  \n\t title...  ")).toBe("Hidden. title");
    expect(fileTitle("///", "my-slug")).toBe("my-slug");
    expect(fileTitle("", "")).toBe("Reel");
    const long = fileTitle("Claude Code can now run agents in parallel across every repository you own and it is fast");
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith(" ")).toBe(false);
    expect("Claude Code can now run agents in parallel across every repository you own and it is fast".startsWith(long)).toBe(true);
  });

  it("runs weeks from Monday to Sunday", () => {
    expect(weekStart(day("2026-11-13T15:00:00"))).toEqual(day("2026-11-09T00:00:00"));
    expect(weekStart(day("2026-11-15T23:00:00"))).toEqual(day("2026-11-09T00:00:00"));
    expect(weekStart(day("2026-11-16T00:00:00"))).toEqual(day("2026-11-16T00:00:00"));
    const times = ["2026-11-08T23:59:59", "2026-11-09T00:00:00", "2026-11-15T23:59:59", "2026-11-16T00:00:00"].map((t) => day(t).toISOString());
    expect(thisWeek([...times, null, undefined], day("2026-11-13T12:00:00"))).toBe(2);
  });

  it("reads the state from the file times", () => {
    const plan = 1000;
    expect(approvalState({ plan }).state).toBe("draft");
    expect(approvalState({ plan, video: 2000, check: { at: 2001, errors: 0 } }).state).toBe("exported");
    expect(approvalState({ plan, video: 2000, check: { at: 2001, errors: 0 }, exporting: true }).state).toBe("draft");
    const record = { at: new Date(3000).toISOString(), video: "v", cover: "c", title: "t" };
    expect(approvalState({ plan, video: 2000, check: { at: 2001, errors: 0 }, record }).state).toBe("approved");
    expect(approvalState({ plan: 4000, video: 2000, check: { at: 2001, errors: 0 }, record }).state).toBe("stale");
    expect(approvalState({ plan, video: 5000, check: { at: 5001, errors: 0 }, record })).toMatchObject({ state: "stale", ready: true });
  });
});
