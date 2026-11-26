import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Actions } from "../engine/api.ts";
import { safeAuphonicFilename } from "../media/auphonic.ts";
import { cleanWords, liveStatus, starterPlan } from "../media/ingest.ts";
import { resolveProject, useLogo } from "../media/project.ts";
import { Edit } from "../engine/schema.ts";
import { ask, promptFor } from "../server/agent.ts";
import { listAssets } from "../server/assets.ts";
import { redo, redoable, snapshot, undo, versions } from "../server/history.ts";
import { dropBroll } from "../server/insert.ts";
import { finishSend, loadReview, saveNote, startSend } from "../server/review.ts";
import { serveFile, startServer } from "../server/index.ts";
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
    // A new reel gets the B2B bed; YouTube comes without music.
    expect(Edit.parse(starterPlan("demo", words, [1080, 1920])).music).toMatchObject({ track: "reels/ES_B2B - Rocket Jr.mp3", start: 60, under: 11 });
    expect(Edit.parse(starterPlan("demo", words, [3840, 2160])).music).toBe(false);
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

// Helper for raw HTTP requests where we control Host, Origin, Sec-Fetch-Site, Range, and raw URLs.
function rawReq(
  port: number,
  path: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: opts.method ?? "GET",
        headers: opts.headers,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
      },
    );
    req.on("error", reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

describe("hardening: history, assets, review, agent, and path validation", () => {
  const savedPath = process.env.PATH;
  const tempDirs: string[] = [];
  const mktemp = (prefix: string) => {
    const d = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(d);
    return d;
  };

  afterEach(() => {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
    for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("snapshot refuses to save corrupt edit.json or cut.json into history", () => {
    const dir = mktemp("studio-hist-");
    writeFileSync(join(dir, "edit.json"), '{"v":1}');
    expect(snapshot(dir, "edit")).toBe(true);
    writeFileSync(join(dir, "edit.json"), "{broken json");
    expect(snapshot(dir, "edit")).toBe(false);
    expect(versions(dir)).toHaveLength(1);

    writeFileSync(join(dir, "edit.json"), '{"v":1}');
    writeFileSync(join(dir, "cut.json"), "{bad cut");
    expect(snapshot(dir, "cut")).toBe(false);
    expect(versions(dir)).toHaveLength(1);
  });

  it("listAssets survives corrupt clips, corrupt meta.json, and clamps seek for < 0.5s clips", () => {
    const binDir = mktemp("studio-bin-");
    const ffmpegLog = join(binDir, "ffmpeg.log");
    const ffprobePath = join(binDir, "ffprobe");
    writeFileSync(
      ffprobePath,
      `#!${process.execPath}
const path = require("node:path");
const base = path.basename(process.argv[process.argv.length - 1]);
if (base === "corrupt.mp4") process.exit(1);
if (base === "short.mp4") console.log("0.2");
else console.log("3.0");
`,
    );
    chmodSync(ffprobePath, 0o755);
    const ffmpegPath = join(binDir, "ffmpeg");
    writeFileSync(
      ffmpegPath,
      `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(ffmpegLog)}, JSON.stringify(args) + "\\n");
const ss = Number(args[args.indexOf("-ss") + 1]);
if (args.some((a) => a.includes("short.mp4")) && ss >= 0.2) {
  process.stderr.write("seek past EOF\\n");
  process.exit(1);
}
fs.writeFileSync(args[args.length - 1], "jpg");
`,
    );
    chmodSync(ffmpegPath, 0o755);
    process.env.PATH = `${binDir}:${savedPath ?? ""}`;

    const dir = mktemp("studio-assets-");
    mkdirSync(join(dir, "assets/broll"), { recursive: true });
    mkdirSync(join(dir, "assets/.thumbs"), { recursive: true });
    writeFileSync(join(dir, "assets/.thumbs/meta.json"), "{broken");
    writeFileSync(join(dir, "assets/broll/corrupt.mp4"), "not-video");
    writeFileSync(join(dir, "assets/broll/short.mp4"), "short-video");
    writeFileSync(join(dir, "assets/broll/good.mp4"), "good-video");

    const assets = listAssets(dir, "demo");
    expect(assets.map((a) => a.name)).toEqual(["good.mp4", "short.mp4"]);
    expect(assets.find((a) => a.name === "short.mp4")?.duration).toBeCloseTo(0.2);
    const calls = readFileSync(ffmpegLog, "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    const shortCall = calls.find((a) => a.some((x) => x.includes("short.mp4")))!;
    expect(Number(shortCall[shortCall.indexOf("-ss") + 1])).toBeCloseTo(0.1);
  });

  it("finishSend reopens sent notes when Claude fails before writing review-replies.json", () => {
    const projects = mktemp("studio-rev-");
    const dir = join(projects, "p");
    mkdirSync(dir);
    const w = "one two three four five six".split(" ").map((text, i) => ({ text, start: i * 0.5, end: i * 0.5 + 0.4 }));
    writeFileSync(join(dir, "project.json"), JSON.stringify({ slug: "p", size: [1080, 1920], duration: 3 }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify(w));
    writeFileSync(
      join(dir, "edit.json"),
      JSON.stringify({ title: "t", face: { x: 0.5, y: 0.3, h: 0.2 }, music: false, shots: [{ at: "one two", layout: "full" }] }),
    );
    const r = resolveProject(projects, "p").resolved!;
    saveNote(dir, w, { t: 0.5, text: "fix timing" });
    expect(startSend(dir, "p", r, w)?.count).toBe(1);
    expect(loadReview(dir, r, w).review.notes[0].status).toBe("sent");

    // Claude exits without writing review-replies.json.
    finishSend(dir);
    const after = loadReview(dir, r, w);
    expect(after.review.notes[0].status).toBe("open");
    expect(after.open).toBe(1);
  });

  it("ask handles missing claude binary without crashing and still emits idle when onDone throws", async () => {
    const projects = mktemp("studio-agent-");
    const dir = join(projects, "p");
    mkdirSync(dir);
    writeFileSync(join(dir, "project.json"), JSON.stringify({ slug: "p", size: [1080, 1920], duration: 2 }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify(words));
    process.env.PATH = mktemp("studio-empty-bin-");

    const events: { role: string; text: string }[] = [];
    await new Promise<void>((resolve) => {
      ask(
        projects,
        "p",
        "hello",
        undefined,
        0,
        (m) => {
          events.push({ role: m.role, text: m.text });
          if (m.role === "status" && m.text === "idle") resolve();
        },
        () => {
          throw new Error("boom in onDone");
        },
      );
    });
    expect(events.some((e) => e.role === "status" && e.text === "working")).toBe(true);
    expect(events.some((e) => e.role === "status" && e.text === "idle")).toBe(true);
    expect(events.some((e) => e.role === "claude" && /failed/i.test(e.text))).toBe(true);
  });

  it("rejects path traversal in useLogo, resolveProject, and dropBroll", () => {
    expect(useLogo("../package")).toBeUndefined();
    expect(useLogo("../../etc/passwd")).toBeUndefined();
    expect(useLogo("a/b")).toBeUndefined();
    expect(useLogo(".hidden")).toBeUndefined();

    const projects = mktemp("studio-trav-");
    const dir = join(projects, "p");
    mkdirSync(dir);
    writeFileSync(join(projects, "outside.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 10]));
    writeFileSync(join(projects, "outside.mp4"), "fake");
    writeFileSync(join(dir, "project.json"), JSON.stringify({ slug: "p", size: [1080, 1920], duration: 3 }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify(words));
    writeFileSync(
      join(dir, "edit.json"),
      JSON.stringify({
        title: "t",
        face: { x: 0.5, y: 0.3, h: 0.2 },
        music: false,
        cover: { title: "Cover", image: "../../outside" },
        shots: [
          { at: "Anthropic just", layout: "split", visual: { kind: "image", src: "../outside.png" } },
          { at: "released an", layout: "full", picture: "../outside.mp4" },
        ],
      }),
    );

    const { issues } = resolveProject(projects, "p");
    const errors = issues.filter((i) => i.level === "error").map((i) => i.message);
    expect(errors.some((m) => /cover/i.test(m))).toBe(true);
    expect(errors.some((m) => /outside\.png/.test(m))).toBe(true);
    expect(errors.some((m) => /outside\.mp4/.test(m))).toBe(true);

    // dropBroll rejects traversal in ref.
    expect(() => dropBroll(projects, "p", "assets/../../outside.mp4", 0.5, 2)).toThrow(expect.objectContaining({ code: 400 }));
    expect(() => dropBroll(projects, "p", "../../../outside.mp4", 0.5, 2)).toThrow(expect.objectContaining({ code: 400 }));
    expect(() => dropBroll(projects, "p", "broll:../outside", 0.5, 2)).toThrow(expect.objectContaining({ code: 400 }));
  });

  it("resolveProject returns issues instead of throwing on corrupt JSON files", () => {
    const projects = mktemp("studio-corrupt-");
    const dir = join(projects, "p");
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(join(dir, "project.json"), JSON.stringify({ slug: "p", size: [1080, 1920], duration: 3 }));
    writeFileSync(join(dir, "transcript.json"), JSON.stringify(words));
    writeFileSync(join(dir, "edit.json"), "{corrupt edit");
    const r1 = resolveProject(projects, "p");
    expect(r1.resolved).toBeUndefined();
    expect(r1.issues.some((i) => i.level === "error" && /edit\.json/i.test(i.message))).toBe(true);

    // Valid edit.json with corrupt build/cuts.json still resolves without crashing.
    writeFileSync(
      join(dir, "edit.json"),
      JSON.stringify({ title: "t", face: { x: 0.5, y: 0.3, h: 0.2 }, music: false, shots: [{ at: "Anthropic just", layout: "full" }] }),
    );
    writeFileSync(join(dir, "build/cuts.json"), "{corrupt cuts");
    const r2 = resolveProject(projects, "p");
    expect(r2.resolved).toBeDefined();

    // Corrupt status.json in liveStatus does not throw.
    writeFileSync(join(dir, "status.json"), "{corrupt status");
    expect(liveStatus(dir)?.error).toBeTruthy();
  });

  it("render action schema rejects CLI flag injection and invalid from/to ranges", () => {
    expect(Actions.render.safeParse({ part: "--force" }).success).toBe(false);
    expect(Actions.render.safeParse({ part: "-x" }).success).toBe(false);
    expect(Actions.render.safeParse({ from: 5 }).success).toBe(false);
    expect(Actions.render.safeParse({ to: 5 }).success).toBe(false);
    expect(Actions.render.safeParse({ from: 5, to: 2 }).success).toBe(false);
    expect(Actions.render.safeParse({ part: "intro", from: 0, to: 5 }).success).toBe(false);
    expect(Actions.render.safeParse({ part: "intro" }).success).toBe(true);
    expect(Actions.render.safeParse({ from: 1, to: 4 }).success).toBe(true);
  });
});

describe("serveFile malformed URLs and Range validation", () => {
  it("returns 400 on malformed percent-encoding and 416 on invalid or out-of-range Range headers", async () => {
    const root = mkdtempSync(join(tmpdir(), "studio-serve-"));
    writeFileSync(join(root, "hello.txt"), "0123456789");
    writeFileSync(join(root, "empty.txt"), "");
    const { createServer } = await import("node:http");
    const srv = createServer((req, res) => {
      if (!serveFile(root, req, res)) {
        res.writeHead(404);
        res.end("not found");
      }
    });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const port = (srv.address() as { port: number }).port;
    try {
      const badUrl = await rawReq(port, "/%E0%A4%A");
      expect(badUrl.status).toBe(400);

      const okRange = await rawReq(port, "/hello.txt", { headers: { range: "bytes=2-5" } });
      expect(okRange.status).toBe(206);
      expect(okRange.body).toBe("2345");
      expect(okRange.headers["content-range"]).toBe("bytes 2-5/10");

      const suffixRange = await rawReq(port, "/hello.txt", { headers: { range: "bytes=-3" } });
      expect(suffixRange.status).toBe(206);
      expect(suffixRange.body).toBe("789");

      for (const bad of ["bytes=10-", "bytes=99-100", "bytes=5-2", "bytes=-", "bytes=-0", "bytes=abc-def"]) {
        const r = await rawReq(port, "/hello.txt", { headers: { range: bad } });
        expect(r.status, bad).toBe(416);
        expect(r.headers["content-range"], bad).toBe("bytes */10");
      }

      const emptyRange = await rawReq(port, "/empty.txt", { headers: { range: "bytes=0-0" } });
      expect(emptyRange.status).toBe(416);
      expect(emptyRange.headers["content-range"]).toBe("bytes */0");
    } finally {
      await new Promise<void>((ok) => srv.close(() => ok()));
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("auphonic filename sanitization", () => {
  it("strips directory components from remote filenames and rejects dot segments", () => {
    expect(safeAuphonicFilename("../../evil.wav")).toBe("evil.wav");
    expect(safeAuphonicFilename("..\\..\\evil.wav")).toBe("evil.wav");
    expect(safeAuphonicFilename("nested/dir/voice.wav")).toBe("voice.wav");
    expect(() => safeAuphonicFilename("..")).toThrow();
    expect(() => safeAuphonicFilename(".")).toThrow();
    expect(() => safeAuphonicFilename("")).toThrow();
  });
});

function readFirstSseEvent(port: number, hostHeader: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path: "/api/events", headers: { host: hostHeader } }, (res) => {
      let buf = "";
      res.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        for (const frame of buf.split("\n\n")) {
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (dataLine) {
            req.destroy();
            resolve(JSON.parse(dataLine.slice(6)));
            return;
          }
        }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

describe("local HTTP server security, resilience, and SSE boot ID", () => {
  let projectsDir: string;
  let srv: Awaited<ReturnType<typeof startServer>>;
  let port: number;
  const savedBroll = process.env.STUDIO_BROLL;
  let brollDir: string;

  beforeAll(async () => {
    projectsDir = mkdtempSync(join(tmpdir(), "studio-http-projects-"));
    brollDir = mkdtempSync(join(tmpdir(), "studio-http-broll-"));
    process.env.STUDIO_BROLL = brollDir;

    // Healthy project "good".
    const good = join(projectsDir, "good");
    mkdirSync(join(good, "build"), { recursive: true });
    writeFileSync(join(good, "project.json"), JSON.stringify({ slug: "good", size: [1080, 1920], duration: 3 }));
    writeFileSync(join(good, "transcript.json"), JSON.stringify(words));
    writeFileSync(
      join(good, "edit.json"),
      JSON.stringify({ title: "Good Project", face: { x: 0.5, y: 0.3, h: 0.2 }, music: false, shots: [{ at: "Anthropic just", layout: "split", visual: { kind: "title", text: "Hi" } }] }),
    );
    writeFileSync(join(good, "sample.txt"), "abcdefghij");
    writeFileSync(join(good, "build/edit.resolved.json"), JSON.stringify({ slug: "good", shots: [{ start: 0, end: 3, layout: "split", anchor: "a", visual: { kind: "title", text: "Hi" } }] }));

    // Dot-prefixed folder that must never be exposed by dirOf().
    mkdirSync(join(projectsDir, ".uploads"), { recursive: true });
    writeFileSync(join(projectsDir, ".uploads/project.json"), JSON.stringify({ slug: ".uploads", size: [1080, 1920], duration: 1 }));

    // Corrupt projects: one with broken edit.json, one with broken status.json, one with broken gallery JSON.
    const badEdit = join(projectsDir, "corrupt-edit");
    mkdirSync(join(badEdit, "build"), { recursive: true });
    writeFileSync(join(badEdit, "project.json"), JSON.stringify({ slug: "corrupt-edit", size: [1080, 1920], duration: 2 }));
    writeFileSync(join(badEdit, "transcript.json"), JSON.stringify(words));
    writeFileSync(join(badEdit, "edit.json"), "{corrupt edit json");
    writeFileSync(join(badEdit, "build/edit.resolved.json"), "{corrupt resolved json");

    const badStatus = join(projectsDir, "corrupt-status");
    mkdirSync(badStatus, { recursive: true });
    writeFileSync(join(badStatus, "project.json"), JSON.stringify({ slug: "corrupt-status", size: [1080, 1920], duration: 2 }));
    writeFileSync(join(badStatus, "status.json"), "{corrupt status json");

    srv = await startServer(0, { projects: projectsDir });
    port = Number(new URL(srv.url).port);
  }, 15000);

  afterAll(async () => {
    await srv?.close();
    if (savedBroll === undefined) delete process.env.STUDIO_BROLL;
    else process.env.STUDIO_BROLL = savedBroll;
    rmSync(projectsDir, { recursive: true, force: true });
    rmSync(brollDir, { recursive: true, force: true });
  });

  it("validates Host header on /api/* requests", async () => {
    expect((await rawReq(port, "/api/projects", { headers: { host: "evil.com:4747" } })).status).toBe(403);
    expect((await rawReq(port, "/api/projects", { headers: { host: "localhost:9999" } })).status).toBe(403);
    expect((await rawReq(port, "/api/projects", { headers: { host: `localhost:${port}` } })).status).toBe(200);
    expect((await rawReq(port, "/api/projects", { headers: { host: `127.0.0.1:${port}` } })).status).toBe(200);
  });

  it("rejects cross-site Origin / Sec-Fetch-Site and requires JSON Content-Type on body() endpoints", async () => {
    const host = `localhost:${port}`;
    // Cross-site Origin rejected on chat and delete.
    expect(
      (await rawReq(port, "/api/projects/good/chat", { method: "POST", headers: { host, origin: "https://evil.com", "content-type": "application/json" }, body: '{"note":"hi"}' })).status,
    ).toBe(403);
    expect(
      (await rawReq(port, "/api/projects/good/delete", { method: "POST", headers: { host, origin: "https://evil.com" } })).status,
    ).toBe(403);
    expect(
      (await rawReq(port, "/api/projects/good/delete", { method: "POST", headers: { host, origin: "null" } })).status,
    ).toBe(403);
    expect(
      (await rawReq(port, "/api/projects/good/delete", { method: "POST", headers: { host, origin: "http://localhost:3000" } })).status,
    ).toBe(403);

    // Cross-site / same-site Sec-Fetch-Site rejected even without Origin.
    expect(
      (await rawReq(port, "/api/projects/good/delete", { method: "POST", headers: { host, "sec-fetch-site": "cross-site" } })).status,
    ).toBe(403);
    expect(
      (await rawReq(port, "/api/projects/good/delete", { method: "POST", headers: { host, "sec-fetch-site": "same-site" } })).status,
    ).toBe(403);

    // Missing or non-JSON Content-Type rejected on JSON body() endpoints with 415.
    expect(
      (await rawReq(port, "/api/projects/good/stop", { method: "POST", headers: { host, "content-type": "text/plain" }, body: "{}" })).status,
    ).toBe(415);
    expect(
      (await rawReq(port, "/api/projects/good/stop", { method: "POST", headers: { host } })).status,
    ).toBe(415);

    // Malformed JSON returns 400 (not 500).
    expect(
      (await rawReq(port, "/api/projects/good/stop", { method: "POST", headers: { host, "content-type": "application/json" }, body: "{bad" })).status,
    ).toBe(400);

    // Same-origin browser request and no-Origin CLI/curl request both succeed.
    expect(
      (await rawReq(port, "/api/projects/good/stop", {
        method: "POST",
        headers: { host, origin: `http://localhost:${port}`, "sec-fetch-site": "same-origin", "content-type": "application/json; charset=utf-8" },
        body: "{}",
      })).status,
    ).toBe(200);
    expect(
      (await rawReq(port, "/api/projects/good/stop", { method: "POST", headers: { host, "content-type": "application/json" }, body: "{}" })).status,
    ).toBe(200);
  });

  it("rejects dot-prefixed slugs, render CLI flag injection, and library filename traversal", async () => {
    const host = `localhost:${port}`;
    expect((await rawReq(port, "/api/projects/.uploads", { headers: { host } })).status).toBe(404);
    expect((await rawReq(port, "/api/projects/.uploads/stop", { method: "POST", headers: { host, "content-type": "application/json" }, body: "{}" })).status).toBe(404);

    // CLI flag injection in render action.
    expect(
      (await rawReq(port, "/api/projects/good/render", { method: "POST", headers: { host, "content-type": "application/json" }, body: JSON.stringify({ part: "--force" }) })).status,
    ).toBe(400);
    expect(
      (await rawReq(port, "/api/projects/good/render", { method: "POST", headers: { host, "content-type": "application/json" }, body: JSON.stringify({ from: 1 }) })).status,
    ).toBe(400);

    // Traversal filename on library upload.
    expect(
      (await rawReq(port, "/api/library?name=../../evil.mp4", { method: "POST", headers: { host }, body: "video" })).status,
    ).toBe(400);
    expect(
      (await rawReq(port, "/api/library?name=.hidden.mp4", { method: "POST", headers: { host }, body: "video" })).status,
    ).toBe(400);
  });

  it("returns 400 on malformed percent-encoded URLs and 416 on invalid Range headers", async () => {
    const host = `localhost:${port}`;
    expect((await rawReq(port, "/%E0%A4%A", { headers: { host } })).status).toBe(400);
    expect((await rawReq(port, "/api/projects/%E0%A4%A", { headers: { host } })).status).toBe(400);
    expect((await rawReq(port, "/good/sample.txt", { headers: { host, range: "bytes=999-" } })).status).toBe(416);
    expect((await rawReq(port, "/good/sample.txt", { headers: { host, range: "bytes=5-2" } })).status).toBe(416);
    const ok = await rawReq(port, "/good/sample.txt", { headers: { host, range: "bytes=0-3" } });
    expect(ok.status).toBe(206);
    expect(ok.body).toBe("abcd");
  });

  it("survives corrupt per-project JSON in GET /api/projects, GET /api/gallery, and GET /api/projects/:slug", async () => {
    const host = `localhost:${port}`;
    const projRes = await rawReq(port, "/api/projects", { headers: { host } });
    expect(projRes.status).toBe(200);
    const list = JSON.parse(projRes.body) as { slug: string; title: string; status: { error?: string } | null }[];
    expect(list.find((p) => p.slug === "good")).toMatchObject({ slug: "good", title: "Good Project" });
    expect(list.find((p) => p.slug === "corrupt-edit")?.status?.error).toMatch(/edit\.json/);
    expect(list.find((p) => p.slug === "corrupt-status")?.status?.error).toMatch(/status\.json/);

    const galRes = await rawReq(port, "/api/gallery", { headers: { host } });
    expect(galRes.status).toBe(200);
    const gallery = JSON.parse(galRes.body) as { slug: string }[];
    expect(gallery.map((g) => g.slug)).toEqual(["good"]);

    const detailRes = await rawReq(port, "/api/projects/corrupt-edit", { headers: { host } });
    expect(detailRes.status).toBe(200);
    const detail = JSON.parse(detailRes.body) as { slug: string; resolved?: unknown; issues?: { level: string; message: string }[] };
    expect(detail.slug).toBe("corrupt-edit");
    expect(detail.resolved).toBeUndefined();
    expect(detail.issues?.some((i) => i.level === "error" && /edit\.json/.test(i.message))).toBe(true);
  });

  it("emits an initial hello event with a stable boot ID per server instance", async () => {
    const host = `localhost:${port}`;
    const first = await readFirstSseEvent(port, host);
    const second = await readFirstSseEvent(port, host);
    expect(first.type).toBe("hello");
    expect(typeof first.boot).toBe("string");
    expect((first.boot as string).length).toBeGreaterThan(8);
    expect(second.boot).toBe(first.boot);

    // A separate server instance emits a distinct boot ID.
    const other = await startServer(0, { projects: projectsDir });
    try {
      const otherPort = Number(new URL(other.url).port);
      const third = await readFirstSseEvent(otherPort, `localhost:${otherPort}`);
      expect(third.type).toBe("hello");
      expect(third.boot).not.toBe(first.boot);
    } finally {
      await other.close();
    }
  }, 15000);

  it("does not leak job.log file descriptors across spawned jobs", async () => {
    if (!existsSync("/proc/self/fd")) return;
    const savedPath = process.env.PATH;
    const binDir = mkdtempSync(join(tmpdir(), "studio-fake-npx-"));
    const npxPath = join(binDir, "npx");
    writeFileSync(npxPath, "#!/bin/sh\nexit 0\n");
    chmodSync(npxPath, 0o755);
    process.env.PATH = `${binDir}:${savedPath ?? ""}`;
    try {
      const host = `localhost:${port}`;
      const openJobLogFds = () =>
        readdirSync("/proc/self/fd").filter((fd) => {
          try {
            return readlinkSync(join("/proc/self/fd", fd)).endsWith("job.log");
          } catch {
            return false;
          }
        }).length;

      for (let i = 0; i < 5; i++) {
        const res = await rawReq(port, "/api/projects/good/qc", { method: "POST", headers: { host, "content-type": "application/json" }, body: "{}" });
        expect(res.status).toBe(200);
      }
      expect(openJobLogFds()).toBe(0);
    } finally {
      if (savedPath === undefined) delete process.env.PATH;
      else process.env.PATH = savedPath;
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});
