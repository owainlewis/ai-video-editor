// Changes to a plan that do not need Claude: inserting shots at times (drag and drop, accepted
// suggestions). Each is checked by resolving the plan; if it adds an error, the plan is put back and
// the reason is returned.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeShots, phraseAt, planIndex, stripAnchors, wordAt } from "../engine/insert.ts";
import { cards } from "../styles/blueprint/style.ts";
import { cardLayout } from "../effects/preview.ts";
import { findPhrase, lastKept } from "../engine/resolve.ts";
import { resolveProject } from "../media/project.ts";
import { probeDuration, readJson, writeJson } from "../media/tools.ts";
import { loadLibrary } from "../media/broll.ts";
import { timeline } from "../media/bin.ts";

const brollLength = (id: string) => loadLibrary().find((c) => c.id === id)?.duration ?? 0;

type Shot = { at: string; layout: string; [k: string]: unknown };
type Part = { name: string; at: string };
// A shot by its id, or by where it starts on the timeline (a few frames either way: a shot leads its word slightly).
export type ShotRef = { id?: string; start?: number };
const shotAt = (shots: { id?: string; start: number }[], ref: ShotRef) => {
  if (ref.id !== undefined) return shots.findIndex((s) => s.id === ref.id);
  const start = ref.start ?? NaN;
  return shots.reduce((best, s, i) => (Math.abs(s.start - start) < 0.3 && (best < 0 || Math.abs(s.start - start) < Math.abs(shots[best].start - start)) ? i : best), -1);
};

// The plan, ready to change. `save` writes the change; if it adds an error, the plan goes back byte
// for byte and the reason is thrown.
function openPlan(projects: string, slug: string) {
  const dir = join(projects, slug);
  const file = join(dir, "edit.json");
  const before = readFileSync(file, "utf8");
  const { resolved, issues } = resolveProject(projects, slug);
  if (!resolved) throw Object.assign(new Error("the plan has errors; fix them first"), { code: 409 });
  const errorsBefore = new Set(issues.filter((i) => i.level === "error").map((i) => i.message));
  const plan = JSON.parse(before) as { shots: Shot[]; parts?: Part[] };
  const save = () => {
    writeJson(file, plan);
    const fresh = resolveProject(projects, slug).issues.filter((i) => i.level === "error" && !errorsBefore.has(i.message));
    if (fresh.length) {
      writeFileSync(file, before);
      resolveProject(projects, slug);
      throw Object.assign(new Error(fresh.map((i) => i.message).join("; ")), { code: 409 });
    }
  };
  return { dir, file, plan, resolved, save };
}

export function insertAt(projects: string, slug: string, added: { start: number; shot: Shot }[], shown?: number) {
  const { dir, plan, save } = openPlan(projects, slug);
  const words = timeline(dir).words;
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
  save();
}

// The editor's edits to the video's parts: add one on the next word after a time, rename one, or take
// one out (the part before it runs on). Parts cover the video, so the first one added past the first
// word brings an "intro" with it.
export function changeParts(projects: string, slug: string, change: { add?: { name: string; at: number }; rename?: { name: string; to: string }; remove?: string }) {
  const { dir, plan, save } = openPlan(projects, slug);
  const parts = plan.parts ?? [];
  const words = timeline(dir).words;
  if (change.remove !== undefined) plan.parts = parts.filter((p) => p.name !== change.remove);
  if (change.rename) plan.parts = parts.map((p) => (p.name === change.rename!.name ? { ...p, name: change.rename!.to } : p));
  if (change.add) {
    const index = wordAt(words, change.add.at);
    if (index < 0) throw Object.assign(new Error("nothing is said after that point to start a part on"), { code: 400 });
    let cursor = 0;
    const anchored = parts.map((part) => {
      const i = findPhrase(words, part.at, cursor);
      if (i >= 0) cursor = i + 1;
      return { index: i < 0 ? Number.MAX_SAFE_INTEGER : i, part };
    });
    if (anchored.some((a) => a.index === index)) throw Object.assign(new Error("a part already starts on that word"), { code: 409 });
    const after = anchored.reduce((last, a) => (a.index < index ? Math.max(last, a.index) : last), -1);
    const at = phraseAt(words, index, after);
    if (at === null) throw Object.assign(new Error(`no unique phrase at "${words[index].text}" to start a part on`), { code: 409 });
    const opening = !parts.length && index > 0 ? [{ index: 0, part: { name: change.add.name === "intro" ? "opening" : "intro", at: phraseAt(words, 0, -1)! } }] : [];
    plan.parts = [...opening, ...anchored, { index, part: { name: change.add.name, at } }].sort((a, b) => a.index - b.index).map((a) => a.part);
  }
  save();
}

// Place one shot over a stretch of plain picture, from `start` to about `end`, then bring back the
// shot that was showing. Never cuts into a graphic. Used by drag and drop and accepted suggestions.
export function placeOver(projects: string, slug: string, shot: Shot, start: number, length: number, stretch = 1): number {
  const { resolved } = resolveProject(projects, slug);
  if (!resolved) throw Object.assign(new Error("the plan has errors; fix them first"), { code: 409 });
  const words = timeline(join(projects, slug)).words;
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
  return from;
}

// Dropping a clip on the timeline: b-roll from that moment for the clip's length.
export function dropBroll(projects: string, slug: string, ref: string, at: number, length: number) {
  const src = ref.startsWith("broll:") || ref.startsWith("assets/") ? ref : `assets/broll/${ref}`;
  // Short clips may be slowed to as little as 0.65x to reach the next word.
  placeOver(projects, slug, { at: "", layout: "cutaway", visual: { kind: "video", src, start: 0 } }, at, length - 0.1, 1 / 0.65);
}

// Move the start of the shot that starts at timeline time `from` to the word at `to`: trimming the
// edge of a b-roll clip on the timeline (its in edge is its own start, its out edge the start of
// the shot after it). The shot is re-anchored on the words there, so it still follows them through
// a re-cut. Like any insert, a change that adds an error is put back and the reason returned.
export function moveShotStart(projects: string, slug: string, from: number, to: number) {
  const { dir, file, plan, resolved, save } = openPlan(projects, slug);
  const k = resolved.shots.findIndex((s) => Math.abs(s.start - from) < 0.02);
  if (k < 0) throw Object.assign(new Error("nothing follows this clip to move; it runs to the end"), { code: 409 });
  if (k === 0) throw Object.assign(new Error("the first shot always starts the video"), { code: 409 });
  const words = timeline(dir).words;
  const index = wordAt(words, to);
  const prev = resolved.shots[k - 1].start;
  const next = resolved.shots[k + 1]?.start ?? resolved.duration;
  if (index < 0 || words[index].start <= prev + 0.3 || words[index].start >= next - 0.3)
    throw Object.assign(new Error("a clip edge has to stay between the shots either side of it"), { code: 409 });
  const at = phraseAt(words, index, wordAt(words, prev));
  if (!at) throw Object.assign(new Error(`no unique phrase at "${words[index].text}" to anchor on`), { code: 409 });
  const target = planIndex(plan.shots, resolved.shots, k);
  if (target < 0) throw Object.assign(new Error(`no shot "${resolved.shots[k].anchor}" in the plan`), { code: 409 });
  // A b-roll clip on either side of the edge is slowed to fill its new length, as on a drop.
  const video = [k - 1, k].map((j) => planIndex(plan.shots, resolved.shots, j)).filter((p) => p >= 0 && (plan.shots[p] as { visual?: { kind?: string } }).visual?.kind === "video");
  // The shot stays itself when its words move: its id is written in once the anchor changes.
  plan.shots[target] = { id: resolved.shots[k].id, ...plan.shots[target], at };
  if (video.length) {
    writeJson(file, plan);
    const moved = resolveProject(projects, slug).resolved;
    for (const p of video) {
      const shot = plan.shots[p] as Shot & { visual: { src: string; start?: number; rate?: number } };
      const now = moved?.shots.find((s) => s.anchor === shot.at);
      if (!now) continue;
      const file = shot.visual.src.startsWith("broll:") ? null : join(dir, shot.visual.src);
      const clip = file && existsSync(file) ? probeDuration(file) : brollLength(shot.visual.src.slice(6));
      const rate = clip ? Math.min(1, (clip - (shot.visual.start ?? 0)) / (now.end - now.start + 0.05)) : 1;
      shot.visual = { ...shot.visual, rate: Math.max(0.65, Math.floor(rate * 100) / 100) };
      if (rate >= 1) delete shot.visual.rate;
    }
  }
  save();
}

// A change made in the inspector to one graphic: `shot`
// replaces its shot in the plan, `remove` takes the graphic off (and the shots that keep it), so the
// picture plays as cut. Like any insert, a change that adds an error is put back and the reason returned.
export function editShot(projects: string, slug: string, ref: ShotRef, change: { shot?: Shot; remove?: boolean }) {
  const { plan, resolved, save } = openPlan(projects, slug);
  const k = shotAt(resolved.shots, ref);
  const target = planIndex(plan.shots, resolved.shots, k);
  if (target < 0) throw Object.assign(new Error("no graphic starts there"), { code: 404 });
  if (change.remove) {
    let kept = 0;
    while ((plan.shots[target + 1 + kept] as { keep?: boolean } | undefined)?.keep) kept++;
    plan.shots.splice(target, 1 + kept, { at: plan.shots[target].at, layout: "full" });
  } else if (change.shot) {
    if (!change.shot.at || !change.shot.layout) throw Object.assign(new Error("a shot needs its words (at) and a layout"), { code: 400 });
    // New words to start on do not make it a new shot: it keeps the id it had.
    plan.shots[target] = change.shot.at !== plan.shots[target].at && !change.shot.id ? { id: resolved.shots[k].id, ...change.shot } : change.shot;
  }
  save();
}

// A library card at the playhead: its sample, without the sample's own anchors, on plain picture
// for about four seconds, in the layout the card takes on this canvas. Returns the new shot's id and where it starts.
export function placeCard(projects: string, slug: string, cardId: string, at: number) {
  const card = cards.find((c) => c.id === cardId);
  if (!card?.sample) throw Object.assign(new Error(`no library card ${cardId}`), { code: 404 });
  const plan = readJson<{ canvas?: string; style?: string }>(join(projects, slug, "edit.json"));
  const canvas = plan.canvas === "youtube" ? "youtube" : "reel";
  const clean = canvas === "reel" && plan.style === "clean";
  const layout = cardLayout(card, canvas, plan.style);
  const visual = stripAnchors(card.sample.visual) as Shot["visual"];
  // A clean reel has no headers; its cards sit on ink and its panels draw light on ink.
  const look = clean ? (layout === "card" ? { bg: "ink" } : { tone: "dark" }) : canvas === "reel" && card.sample.header ? { header: card.sample.header } : {};
  const from = placeOver(projects, slug, { at: "", layout, visual, ...look }, at, 4, 1.6);
  // Where the new shot really starts: a shot leads its word by a few frames.
  const shots = resolveProject(projects, slug).resolved?.shots ?? [];
  const shot = shots.reduce((best, s) => (Math.abs(s.start - from) < Math.abs(best.start - from) ? s : best), shots[0] ?? { start: from });
  return { start: shot.start, id: shot.id };
}

// End a graphic on the word at `to`: the shot after it starts there. With no
// word left to start on (the graphic should run to the end), a plain shot after it is taken out, so
// the graphic runs on to the shot after that.
export function moveShotEnd(projects: string, slug: string, ref: ShotRef, to: number) {
  const { dir, plan, resolved, save } = openPlan(projects, slug);
  const shots = resolved.shots;
  const k = shotAt(shots, ref);
  if (k < 0) throw Object.assign(new Error("no graphic starts there"), { code: 404 });
  const last = lastKept(shots, k);
  const next = shots[last + 1];
  if (!next) throw Object.assign(new Error("this graphic already runs to the end"), { code: 409 });
  const words = timeline(dir).words;
  const after = shots[last + 2]?.start ?? resolved.duration;
  const word = words[wordAt(words, to)];
  if (word && word.start < after - 0.3) return moveShotStart(projects, slug, next.start, to);
  if (next.visual) throw Object.assign(new Error("the shot after this one has its own graphic; end before it"), { code: 409 });
  const target = planIndex(plan.shots, shots, last + 1);
  if (target < 0) throw Object.assign(new Error("no shot to take out after this graphic"), { code: 409 });
  plan.shots.splice(target, 1);
  save();
}
