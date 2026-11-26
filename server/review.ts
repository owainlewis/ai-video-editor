// The review's file (projects/<slug>/review.json) and what the server does with it: bring it up to
// date with the plan, save a decision or a note, and send the open ones to Claude as one run. The
// rules are in engine/review.ts.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { phraseAt, wordAt } from "../engine/insert.ts";
import { counts, emptyReview, formatFeedback, type Item, mergeReview, type Note, openChanges, openNotes, type Review, reviewItems, seenPath, type Status } from "../engine/review.ts";
import type { Resolved, ResolvedShot, Word } from "../engine/schema.ts";
import { readJson, writeJson } from "../media/tools.ts";

const file = (dir: string) => join(dir, "review.json");
const repliesFile = (dir: string) => join(dir, "review-replies.json");

const read = (dir: string): Review => {
  if (!existsSync(file(dir))) return emptyReview();
  try {
    return { ...emptyReview(), ...readJson<Review>(file(dir)) };
  } catch {
    return emptyReview();
  }
};

export type ReviewState = { review: Review; items: Item[]; counts: ReturnType<typeof counts>; open: number };

// The review, merged with the plan as it is now. Writes the file when the merge changed it, so a
// read can write to disk.
export function loadReview(dir: string, r: Resolved, words: Word[]): ReviewState {
  const before = read(dir);
  const items = reviewItems(r, words);
  const { review, changed, added, removed } = mergeReview(before, items);
  if (changed.length || added.length || removed.length || !existsSync(file(dir))) writeJson(file(dir), review);
  return { review, items, counts: counts(review, items), open: openNotes(review).length + openChanges(review, items).length };
}

// A decision on one item. `hash` is the item as the page last saw it; if the item has changed
// since, the save is refused and the page reloads.
export function setItem(dir: string, r: Resolved, words: Word[], id: string, hash: string, change: { status?: Status; comment?: string }) {
  const { review, items } = loadReview(dir, r, words);
  const item = items.find((it) => it.id === id);
  const rv = review.items[id];
  if (!item || !rv) throw Object.assign(new Error(`no graphic ${id} to review`), { code: 404 });
  if (item.hash !== hash) throw Object.assign(new Error("this graphic changed since you looked at it"), { code: 409 });
  const comment = change.comment ?? rv.comment;
  // A note on a waiting item asks for a change; a new note or decision clears Claude's last answer.
  const status = change.status ?? (rv.status === "waiting" && comment.trim() ? "change" : rv.status);
  review.items[id] = { ...rv, status, comment, reply: undefined, at: new Date().toISOString() };
  writeJson(file(dir), review);
  if (status !== "waiting") {
    const seen = join(dir, seenPath(id, hash));
    if (!existsSync(seen)) {
      mkdirSync(join(dir, "build/review"), { recursive: true });
      writeJson(seen, r.shots.slice(item.index, item.last + 1) satisfies ResolvedShot[]);
    }
  }
}

// A note on the timeline: a new one at `t`, a change to one, or its removal.
export function saveNote(dir: string, words: Word[], change: { id?: string; t?: number; text?: string; status?: Note["status"]; remove?: boolean }) {
  const review = read(dir);
  if (change.id === undefined) {
    const text = change.text?.trim();
    if (!text || change.t === undefined) throw Object.assign(new Error("a note needs a time and some words"), { code: 400 });
    // The phrase said from there, so the note follows its words through a re-cut.
    const i = wordAt(words, change.t);
    const anchor = i >= 0 && words[i].start - change.t < 1.5 ? (phraseAt(words, i, -1) ?? undefined) : undefined;
    const n = review.notes.reduce((max, x) => Math.max(max, parseInt(x.id.slice(1), 10) || 0), 0) + 1;
    review.notes.push({ id: `n${n}`, t: +change.t.toFixed(3), ...(anchor ? { anchor } : {}), text, status: "open", at: new Date().toISOString() });
  } else {
    const note = review.notes.find((x) => x.id === change.id);
    if (!note) throw Object.assign(new Error(`no note ${change.id}`), { code: 404 });
    if (change.remove) review.notes = review.notes.filter((x) => x !== note);
    else {
      if (change.text !== undefined) note.text = change.text.trim();
      if (change.status) note.status = change.status;
      // Opened again, it goes to Claude afresh.
      if (change.status === "open" || change.text !== undefined) delete note.reply;
    }
  }
  writeJson(file(dir), review);
}

// What Claude is told when Owain sends the review.
export const REVIEW = (slug: string, feedback: string) => `Owain reviewed projects/${slug} before rendering and wants these changes. Each has a key in [brackets].

${feedback}

Work through every one, in projects/${slug}/edit.json, following CLAUDE.md and docs/RULES.md. Read edit.json fresh first. Keep each
change to what its note asks; leave graphics he did not mention alone, since he has already approved them and any change sends them
back for review. After the last change run \`npm run studio -- check ${slug}\` and fix every error, and look at a still of each graphic you changed.

Then write projects/${slug}/review-replies.json: one entry per key above, {"item:<id>": "<one plain sentence: what you changed, or why you did not>", "note:<id>": "..."}.
Reply with one or two sentences for the chat panel.`;

// Start of a send: the prompt for Claude, and the notes marked as sent. Null when nothing is open.
export function startSend(dir: string, slug: string, r: Resolved, words: Word[]): { prompt: string; count: number } | null {
  const { review, items } = loadReview(dir, r, words);
  const count = openNotes(review).length + openChanges(review, items).length;
  if (!count) return null;
  const prompt = REVIEW(slug, formatFeedback(review, items, words));
  for (const n of review.notes) if (n.status === "open") n.status = "sent";
  writeJson(file(dir), review);
  rmSync(repliesFile(dir), { force: true });
  return { prompt, count };
}

// End of a send: Claude's answers go on their notes and items. An item Claude changed is already
// back to waiting (its hash moved), so its answer goes on the note it answers, now in its history.
// Any note left in "sent" without a reply (e.g. Claude failed before writing review-replies.json)
// goes back to "open" so it is not stuck.
export function finishSend(dir: string, ok = true) {
  const hasReplies = existsSync(repliesFile(dir));
  let replies: Record<string, unknown> = {};
  if (hasReplies) {
    try {
      const parsed = readJson<unknown>(repliesFile(dir));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) replies = parsed as Record<string, unknown>;
    } catch {
      // A file Claude left half-written: the changes are in the plan either way.
    }
  }
  const review = read(dir);
  let dirty = hasReplies;
  for (const [key, value] of Object.entries(replies)) {
    if (typeof value !== "string") continue;
    const [kind, ...rest] = key.split(":");
    const id = rest.join(":");
    if (kind === "note") {
      const note = review.notes.find((x) => x.id === id);
      if (note) (note.reply = value), (dirty = true);
    } else if (kind === "item") {
      const rv = review.items[id] ?? review.removed[id];
      const last = rv?.history.at(-1);
      if (rv?.status === "waiting" && last) (last.reply = value), (dirty = true);
      else if (rv) (rv.reply = value), (dirty = true);
    }
  }
  for (const note of review.notes) {
    if (note.status === "sent" && (!note.reply || (!ok && !hasReplies))) {
      note.status = "open";
      dirty = true;
    }
  }
  if (dirty) writeJson(file(dir), review);
  if (hasReplies) rmSync(repliesFile(dir), { force: true });
}
