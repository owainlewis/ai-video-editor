// Changes to a plan that do not need Claude: inserting shots at times (drag and drop, accepted
// suggestions). Each is checked by resolving the plan; if it adds an error, the plan is put back and
// the reason is returned.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeShots, wordAt } from "../engine/insert.ts";
import { findPhrase } from "../engine/resolve.ts";
import type { Word } from "../engine/schema.ts";
import { resolveProject } from "../media/project.ts";
import { readJson } from "../media/tools.ts";

type Shot = { at: string; layout: string; [k: string]: unknown };

export function insertAt(projects: string, slug: string, added: { start: number; shot: Shot }[]) {
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
export function placeOver(projects: string, slug: string, shot: Shot, start: number, end: number) {
  const { resolved } = resolveProject(projects, slug);
  if (!resolved) throw Object.assign(new Error("the plan has errors; fix them first"), { code: 409 });
  const words = readJson<Word[]>(join(projects, slug, "transcript.json"));
  const from = words[wordAt(words, start)]?.start;
  if (from === undefined) throw Object.assign(new Error("nothing is said after that point"), { code: 400 });
  const here = resolved.shots.find((s) => from >= s.start && from < s.end);
  if (!here || (here.layout !== "full" && here.layout !== "punch") || here.visual)
    throw Object.assign(new Error("that moment already has a graphic or b-roll; place it on plain picture"), { code: 409 });
  // End on the last word that starts before `end`, and before the next shot.
  const limit = Math.min(end, here.end - 0.05);
  const endWord = [...words].reverse().find((w) => w.start > from + 0.8 && w.start <= limit);
  if (!endWord) throw Object.assign(new Error("too short to cover a word there"), { code: 409 });
  const added: { start: number; shot: Shot }[] = [{ start: from, shot: { ...shot, at: "" } }];
  if (endWord.start < here.end - 0.3) added.push({ start: endWord.start, shot: { at: "", layout: here.layout } });
  insertAt(projects, slug, added);
}

// Dropping a clip on the timeline: b-roll from that moment for the clip's length.
export function dropBroll(projects: string, slug: string, ref: string, at: number, length: number) {
  const src = ref.startsWith("broll:") || ref.startsWith("assets/") ? ref : `assets/broll/${ref}`;
  placeOver(projects, slug, { at: "", layout: "cutaway", visual: { kind: "video", src, start: 0 } }, at, at + length - 0.1);
}
