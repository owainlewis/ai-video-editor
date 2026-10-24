// Changes to a plan that do not need Claude: inserting shots at times (drag and drop, accepted
// suggestions). Each is checked by resolving the plan; if it adds an error, the plan is put back and
// the reason is returned.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeShots, wordAt } from "../engine/insert.ts";
import { findPhrase } from "../engine/resolve.ts";
import type { Word } from "../engine/schema.ts";
import { resolveProject } from "../media/project.ts";
import { probeDuration, readJson } from "../media/tools.ts";
import { loadLibrary } from "../media/broll.ts";

const brollLength = (id: string) => loadLibrary().find((c) => c.id === id)?.duration ?? 0;

type Shot = { at: string; layout: string; [k: string]: unknown };

export function insertAt(projects: string, slug: string, added: { start: number; shot: Shot }[], shown?: number) {
  const dir = join(projects, slug);
  const before = readFileSync(join(dir, "edit.json"), "utf8");
  const plan = JSON.parse(before) as { shots: Shot[] };
  const words = readJson<Word[]>(join(dir, "transcript.json"));
  const { resolved, issues } = resolveProject(projects, slug);
  if (!resolved) throw Object.assign(new Error("the plan has errors; fix them first"), { code: 409 });
  const errorsBefore = new Set(issues.filter((i) => i.level === "error").map((i) => i.message));
  // Where each shot's anchor lands, matched in order the way the resolver does.
  let cursor = 0;
  const existing = plan.shots.map((shot) => {
    const i = findPhrase(words, shot.at, cursor);
    if (i >= 0) cursor = i + 1;
    return { index: i < 0 ? Number.MAX_SAFE_INTEGER : i, shot };
  });
  // A video shown longer than it runs is slowed to fit (never below 0.65x).
  const first = added[0]?.shot as { visual?: { kind?: string; src?: string; start?: number; rate?: number } };
  if (shown && first?.visual?.kind === "video" && first.visual.src) {
    const file = first.visual.src.startsWith("broll:") ? null : join(dir, first.visual.src);
    const clip = file && existsSync(file) ? probeDuration(file) : brollLength(first.visual.src.slice(6));
    const rate = clip ? Math.min(1, (clip - (first.visual.start ?? 0)) / shown) : 1;
    if (rate < 1) first.visual.rate = Math.max(0.65, Math.floor(rate * 100) / 100);
  }
  const placed = added.map((a) => {
    const index = wordAt(words, a.start);
    if (index < 0) throw Object.assign(new Error("nothing is said after that point to anchor on"), { code: 400 });
    return { index, shot: a.shot };
  });
  plan.shots = mergeShots(words, existing, placed);
  writeFileSync(join(dir, "edit.json"), JSON.stringify(plan, null, 2) + "\n");
  const after = resolveProject(projects, slug);
  const fresh = after.issues.filter((i) => i.level === "error" && !errorsBefore.has(i.message));
  if (fresh.length) {
    writeFileSync(join(dir, "edit.json"), before);
    resolveProject(projects, slug);
    throw Object.assign(new Error(fresh.map((i) => i.message).join("; ")), { code: 409 });
  }
}

// Place one shot over a stretch of plain picture, from `start` to about `end`, then bring back the
// shot that was showing. Never cuts into a graphic. Used by drag and drop and accepted suggestions.
export function placeOver(projects: string, slug: string, shot: Shot, start: number, length: number, stretch = 1) {
  const { resolved } = resolveProject(projects, slug);
  if (!resolved) throw Object.assign(new Error("the plan has errors; fix them first"), { code: 409 });
  const words = readJson<Word[]>(join(projects, slug, "transcript.json"));
  const from = words[wordAt(words, start)]?.start;
  if (from === undefined) throw Object.assign(new Error("nothing is said after that point"), { code: 400 });
  const here = resolved.shots.find((s) => from >= s.start && from < s.end);
  if (!here || (here.layout !== "full" && here.layout !== "punch") || here.visual)
    throw Object.assign(new Error("that moment already has a graphic or b-roll; place it on plain picture"), { code: 409 });
  // The shot ends where a word starts. Its length is measured from where it really starts (the
  // next word after the drop), not from the drop point. Prefer the last word inside `length`; if
  // none, the next word, as long as it is within `stretch` times the length (the caller slows the
  // clip to fit).
  const nextShot = here.end - 0.05;
  const inside = [...words].reverse().find((w) => w.start > from + 0.4 && w.start <= Math.min(from + length, nextShot));
  const after = words.find((w) => w.start > from + length && w.start <= Math.min(from + length * stretch, nextShot));
  const endWord = inside ?? after;
  // Running to the next shot needs no word of its own.
  const toNext = !endWord && here.end - from <= length * stretch && here.end - from > 0.4;
  if (!endWord && !toNext) throw Object.assign(new Error("no word to end on within that clip's length there; try a moment a little earlier or later"), { code: 409 });
  const shown = (endWord ? endWord.start : here.end) - from + 0.05;
  const added: { start: number; shot: Shot }[] = [{ start: from, shot: { ...shot, at: "" } }];
  if (endWord && endWord.start < here.end - 0.3) added.push({ start: endWord.start, shot: { at: "", layout: here.layout } });
  insertAt(projects, slug, added, shown);
}

// Dropping a clip on the timeline: b-roll from that moment for the clip's length.
export function dropBroll(projects: string, slug: string, ref: string, at: number, length: number) {
  const src = ref.startsWith("broll:") || ref.startsWith("assets/") ? ref : `assets/broll/${ref}`;
  // Short clips may be slowed to as little as 0.65x to reach the next word.
  placeOver(projects, slug, { at: "", layout: "cutaway", visual: { kind: "video", src, start: 0 } }, at, length - 0.1, 1 / 0.65);
}
