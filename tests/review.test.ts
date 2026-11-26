import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Actions, isAction } from "../engine/api.ts";
import { shotIds } from "../engine/resolve.ts";
import { emptyReview, formatFeedback, mergeReview, noteTime, reviewItems, seenPath } from "../engine/review.ts";
import type { Resolved } from "../engine/schema.ts";
import { resolveProject } from "../media/project.ts";
import { editShot } from "../server/insert.ts";
import { finishSend, loadReview, saveNote, setItem, startSend } from "../server/review.ts";

const words = "one two three four five six seven eight nine ten".split(" ").map((t, i) => ({ text: t, start: i * 0.4, end: i * 0.4 + 0.3 }));
const shots = [
  { at: "one two", layout: "full" },
  { at: "three four", layout: "split", visual: { kind: "title", text: "Three" } },
  { at: "seven eight", layout: "split", visual: { kind: "title", text: "Seven" } },
  { at: "nine ten", layout: "full" },
];

// A small project on disk, as the server sees one.
const setup = (plan: object = {}) => {
  const projects = mkdtempSync(join(tmpdir(), "studio-review-"));
  const dir = join(projects, "p");
  mkdirSync(dir);
  writeFileSync(join(dir, "project.json"), JSON.stringify({ slug: "p", size: [1080, 1920], duration: 4 }));
  writeFileSync(join(dir, "transcript.json"), JSON.stringify(words));
  const file = join(dir, "edit.json");
  const write = (p: object) => writeFileSync(file, JSON.stringify({ title: "t", face: { x: 0.5, y: 0.3, h: 0.2 }, music: false, shots, ...p }, null, 2));
  write(plan);
  const resolved = () => resolveProject(projects, "p").resolved as Resolved;
  return { projects, dir, file, write, resolved };
};

describe("shot ids", () => {
  it("come from the anchor, with a number on a repeat, and the plan's own id wins", () => {
    expect(shotIds([{ anchor: "It's called EGM" }, { anchor: "it's called egm" }, { anchor: "", id: undefined }, { anchor: "two", id: "hero" }])).toEqual(["it-s-called-egm", "it-s-called-egm-2", "start", "hero"]);
  });
  it("are on every resolved shot", () => {
    expect(setup().resolved().shots.map((s) => s.id)).toEqual(["one-two", "three-four", "seven-eight", "nine-ten"]);
  });
  it("stay with a shot when the editor moves its anchor", () => {
    const { projects, file, resolved } = setup();
    editShot(projects, "p", { id: "three-four" }, { shot: { at: "four five", layout: "split", visual: { kind: "title", text: "Three" } } });
    expect(JSON.parse(readFileSync(file, "utf8")).shots[1]).toMatchObject({ id: "three-four", at: "four five" });
    expect(resolved().shots[1]).toMatchObject({ id: "three-four", anchor: "four five" });
  });
});

describe("review items", () => {
  it("are the graphics, not the plain picture", () => {
    expect(reviewItems(setup().resolved(), words).map((it) => [it.n, it.id, it.kind, it.said])).toEqual([[1, "three-four", "title", "three four five six"], [2, "seven-eight", "title", "seven eight"]]);
  });
  it("keep their hash when only their place in the video moves", () => {
    const { resolved } = setup();
    const r = resolved();
    const [a] = reviewItems(r, words);
    const later = (t: number) => t + 2;
    const moved: Resolved = { ...r, shots: r.shots.map((s) => ({ ...s, start: later(s.start), end: later(s.end), visual: s.visual && { ...s.visual, times: s.visual.times?.map(later) } })) };
    const [b] = reviewItems(moved, words.map((w) => ({ ...w, start: later(w.start), end: later(w.end) })));
    expect(b.start).toBe(a.start + 2);
    expect(b.hash).toBe(a.hash);
  });
  it("change their hash when what they show changes", () => {
    const one = setup();
    const two = setup({ shots: shots.map((s) => (s.at === "three four" ? { ...s, visual: { kind: "title", text: "3" } } : s)) });
    const [a, a2] = reviewItems(one.resolved(), words);
    const [b, b2] = reviewItems(two.resolved(), words);
    expect(b.hash).not.toBe(a.hash);
    expect(b2.hash).toBe(a2.hash);
  });
  it("invalidate itemHash when palette or hook changes", () => {
    const base = setup({ palette: "light", hook: { text: "Give agents *email*." } }).resolved();
    const darkPalette = setup({ palette: "forest", hook: { text: "Give agents *email*." } }).resolved();
    const changedHookText = setup({ palette: "light", hook: { text: "Give agents *mail*." } }).resolved();
    const changedHookUntil = { ...base, hook: { text: base.hook!.text, until: base.hook!.until - 0.5 } };
    const noHook = setup({ palette: "light" }).resolved();
    const h = (r: Resolved) => reviewItems(r, words)[0].hash;
    expect(h(darkPalette)).not.toBe(h(base));
    expect(h(changedHookText)).not.toBe(h(base));
    expect(h(changedHookUntil)).not.toBe(h(base));
    expect(h(noHook)).not.toBe(h(base));
  });
  it("formats feedback timestamps near minute boundaries without 0:60.0", () => {
    const review = {
      ...emptyReview(),
      notes: [
        { id: "n1", t: 59.96, text: "minute boundary", status: "open" as const, at: "" },
        { id: "n2", t: 119.96, text: "two minutes", status: "open" as const, at: "" },
      ],
    };
    const text = formatFeedback(review, [], []);
    expect(text).toContain("1:00.0 (59.96s)");
    expect(text).not.toContain("0:60.0");
    expect(text).toContain("2:00.0 (119.96s)");
    expect(text).not.toContain("1:60.0");
  });
});

describe("the review file", () => {
  it("starts every item waiting and takes a decision", () => {
    const { dir, resolved } = setup();
    const r = resolved();
    const first = loadReview(dir, r, words);
    expect(first.counts).toEqual({ approved: 0, change: 0, waiting: 2 });
    setItem(dir, r, words, "three-four", first.items[0].hash, { status: "approved" });
    setItem(dir, r, words, "seven-eight", first.items[1].hash, { comment: "bigger" });
    const now = loadReview(dir, r, words);
    expect(now.counts).toEqual({ approved: 1, change: 1, waiting: 0 });
    expect(now.open).toBe(1);
    // What each looked like when it was decided is kept, to show beside a later change.
    expect(existsSync(join(dir, seenPath("seven-eight", first.items[1].hash)))).toBe(true);
  });
  it("refuses a decision on a graphic that changed since it was seen", () => {
    const { dir, resolved } = setup();
    expect(() => setItem(dir, resolved(), words, "three-four", "an-old-hash", { status: "approved" })).toThrow(expect.objectContaining({ code: 409 }));
  });
  it("sends a changed item back to waiting and keeps the old note", () => {
    const { dir, write, resolved } = setup();
    const item = loadReview(dir, resolved(), words).items[1];
    setItem(dir, resolved(), words, item.id, item.hash, { status: "change", comment: "bigger" });
    write({ shots: shots.map((s) => (s.at === "seven eight" ? { ...s, visual: { kind: "title", text: "SEVEN" } } : s)) });
    const { review, counts } = loadReview(dir, resolved(), words);
    expect(counts).toEqual({ approved: 0, change: 0, waiting: 2 });
    expect(review.items["seven-eight"]).toMatchObject({ status: "waiting", comment: "", history: [{ hash: item.hash, status: "change", comment: "bigger" }] });
  });
  it("brings a decision back when an undo brings back the version it was made on", () => {
    const { dir, write, resolved } = setup();
    const item = loadReview(dir, resolved(), words).items[1];
    setItem(dir, resolved(), words, item.id, item.hash, { status: "approved" });
    write({ shots: shots.map((s) => (s.at === "seven eight" ? { ...s, visual: { kind: "title", text: "SEVEN" } } : s)) });
    expect(loadReview(dir, resolved(), words).review.items["seven-eight"].status).toBe("waiting");
    write({});
    expect(loadReview(dir, resolved(), words).review.items["seven-eight"]).toMatchObject({ status: "approved", hash: item.hash, history: [] });
  });
  it("keeps the review of a graphic that leaves the plan, for when it comes back", () => {
    const { review } = mergeReview({ ...emptyReview(), items: { gone: { hash: "h", status: "approved", comment: "", at: "", history: [] } } }, []);
    expect(review.removed.gone.status).toBe("approved");
    const back = mergeReview(review, [{ id: "gone", hash: "h", n: 1, index: 0, last: 0, start: 0, end: 1, layout: "split", anchor: "a", said: "" }]);
    expect(back.review.items.gone.status).toBe("approved");
    expect(back.review.removed.gone).toBeUndefined();
  });
});

describe("notes", () => {
  it("are pinned to the words said there, and follow them", () => {
    const { dir, resolved } = setup();
    saveNote(dir, words, { t: 1.62, text: "late" });
    const [note] = loadReview(dir, resolved(), words).review.notes;
    expect(note).toMatchObject({ id: "n1", status: "open", text: "late", anchor: "five six seven" });
    expect(noteTime(note, words.map((w) => ({ ...w, start: w.start + 10, end: w.end + 10 })))).toBeCloseTo(11.6);
    // With its words cut out, it stays where it was written.
    expect(noteTime(note, words.slice(0, 3))).toBe(1.62);
  });
  it("go to Claude with the changes, in one prompt, and take its answers", () => {
    const { dir, resolved } = setup();
    const r = resolved();
    const item = loadReview(dir, r, words).items[0];
    setItem(dir, r, words, item.id, item.hash, { comment: "make it bigger" });
    saveNote(dir, words, { t: 3.2, text: "cut this" });
    const { review, items } = loadReview(dir, r, words);
    const text = formatFeedback(review, items, words);
    expect(text).toContain("[item:three-four]");
    expect(text).toContain("> make it bigger");
    expect(text).toContain("[note:n1]");
    expect(text).toContain("on plain picture");

    const sent = startSend(dir, "p", r, words)!;
    expect(sent.count).toBe(2);
    expect(sent.prompt).toContain("projects/p/review-replies.json");
    expect(loadReview(dir, r, words).review.notes[0].status).toBe("sent");
    writeFileSync(join(dir, "review-replies.json"), JSON.stringify({ "item:three-four": "Left it: it is at the size limit.", "note:n1": "Cut the last two words." }));
    finishSend(dir);
    const after = loadReview(dir, r, words);
    expect(after.review.items["three-four"].reply).toBe("Left it: it is at the size limit.");
    expect(after.review.notes[0].reply).toBe("Cut the last two words.");
    expect(existsSync(join(dir, "review-replies.json"))).toBe(false);
    // Answered and unchanged, it is not sent again until Owain writes a new note.
    expect(after.open).toBe(0);
    expect(startSend(dir, "p", r, words)).toBeNull();
  });
});

describe("the editor's actions", () => {
  it("check what arrives", () => {
    expect(isAction("review")).toBe(true);
    expect(isAction("constructor")).toBe(false);
    expect(Actions.chat.safeParse({ note: "  " }).success).toBe(false);
    expect(Actions.chat.parse({ note: "hi" })).toEqual({ note: "hi", playhead: 0 });
    expect(Actions.shot.safeParse({ id: 5 }).success).toBe(false);
    expect(Actions.shot.parse({ id: "a", shot: { at: "one", layout: "full", visual: { kind: "title" } } }).shot).toMatchObject({ visual: { kind: "title" } });
    expect(Actions.cut.safeParse({ cut: { segments: [{ id: "a", src: "main", in: 2, out: 1 }] } }).success).toBe(false);
  });
});
