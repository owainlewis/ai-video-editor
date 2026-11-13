// Review before render: one entry per moment that changes on screen (a graphic and the shots that
// keep it), and notes pinned to the timeline, in projects/<slug>/review.json. Owain approves each
// item or asks for a change; an item that changes afterwards goes back to waiting with its old note
// kept. Ported from the reel review board (reels/review/model.ts). Pure, so it is easy to test.
import { findPhrase, lastKept } from "./resolve.ts";
import type { Resolved, ResolvedShot, Word } from "./schema.ts";

export type Status = "waiting" | "approved" | "change";
// A past review of an item, kept when the item changes so the old note is never lost.
export type Past = { hash: string; status: Status; comment: string; reply?: string; at: string };
export type ItemReview = { hash: string; status: Status; comment: string; reply?: string; at: string; history: Past[] };
// A note at a moment on the timeline. `anchor` is the phrase said there, so the note follows its
// words through a re-cut; `t` is where it was when written, for when the words are gone.
// open: written. sent: Claude has it (and `reply` once it answers). done: closed by Owain.
export type Note = { id: string; t: number; anchor?: string; text: string; status: "open" | "sent" | "done"; reply?: string; at: string };
export type Review = {
  version: 1;
  items: Record<string, ItemReview>;
  // Reviews of items no longer in the plan. One that comes back picks its review up again.
  removed: Record<string, ItemReview>;
  notes: Note[];
};

// What the review page shows for each item.
export type Item = {
  id: string;
  hash: string;
  n: number;
  // The shot in the resolved plan, and the last shot that keeps its visual.
  index: number;
  last: number;
  start: number;
  end: number;
  layout: ResolvedShot["layout"];
  kind?: string;
  anchor: string;
  said: string;
};

// An item as it looked when Owain decided on it (the resolved shots, in the project's folder), kept
// so a later change can be shown beside it.
export const seenPath = (id: string, hash: string) => `build/review/${id.replace(/[^\p{L}\p{N}_-]+/gu, "_")}-${hash}.json`;

export const emptyReview = (): Review => ({ version: 1, items: {}, removed: {}, notes: [] });

// cyrb53: a small stable string hash, the same in Node and the browser.
export const hash = (s: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
};

// JSON with sorted keys, so the same plan always hashes the same.
export const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`
      : JSON.stringify(v);

// A shot worth a look of its own: anything but the plain picture, and not a shot that only keeps
// the graphic before it (that one is reviewed with its graphic).
export const reviewable = (s: ResolvedShot) =>
  !s.keep && (!!s.visual || !!s.hit || !!s.title || !!s.chip || !!s.picture || (s.layout !== "full" && s.layout !== "punch"));

const saidIn = (words: Word[], start: number, end: number) => words.filter((w) => w.start >= start - 0.05 && w.start < end).map((w) => w.text).join(" ");

// Everything that changes what the item looks like: its shots, its visual, its length and its
// words. Times are counted in frames from the item's start, so a re-cut earlier in the video, which
// moves every later graphic without changing it, does not reopen them all.
export const itemHash = (r: Resolved, index: number, said: string) => {
  const first = r.shots[index];
  const rel = (t: number) => Math.round((t - first.start) * r.fps);
  const times = (v: ResolvedShot["visual"]) => {
    if (!v) return v;
    const o = { ...v } as Record<string, unknown>;
    for (const k of ["times", "ticks", "words"]) if (Array.isArray(o[k]) && (o[k] as unknown[]).every((x) => typeof x === "number")) o[k] = (o[k] as number[]).map(rel);
    if (Array.isArray(o.zooms)) o.zooms = (o.zooms as { t: number }[]).map((z) => ({ ...z, t: rel(z.t) }));
    return o;
  };
  const run = r.shots.slice(index, lastKept(r.shots, index) + 1).map((s) => ({
    anchor: s.anchor, layout: s.layout, header: s.header, keep: s.keep, sfx: s.sfx, zoom: s.zoom, tone: s.tone, enter: s.enter, bg: s.bg, inside: s.inside,
    picture: s.picture,
    frames: rel(s.end) - rel(s.start),
    hit: s.hit && { ...s.hit, at: rel(s.hit.at), until: rel(s.hit.until) },
    title: s.title && { ...s.title, at: rel(s.title.at) },
    chip: s.chip && { ...s.chip, at: rel(s.chip.at) },
  }));
  const look = { canvas: r.canvas, style: r.style, theme: r.theme, split: r.split, captions: r.captions, face: r.face, grade: r.grade };
  return hash(stable({ look, run, visual: times(first.visual), said }));
};

export const reviewItems = (r: Resolved, words: Word[]): Item[] =>
  r.shots.flatMap((s, index) => {
    if (!reviewable(s)) return [];
    const last = lastKept(r.shots, index);
    const end = r.shots[last].end;
    const said = saidIn(words, s.start, end);
    return [{ id: s.id ?? `shot-${index + 1}`, hash: itemHash(r, index, said), n: 0, index, last, start: s.start, end, layout: s.layout, kind: s.visual?.kind, anchor: s.anchor, said }];
  }).map((it, k) => ({ ...it, n: k + 1 }));

// Bring a review up to date with the current plan. An item whose hash changed goes back to
// "waiting", and its old status, comment and reply move to history. New items start waiting.
// Reviews of items that left the plan move to `removed`.
export const mergeReview = (review: Review, items: Item[], now = new Date().toISOString()) => {
  const out: Review = { ...emptyReview(), ...review, items: {}, removed: { ...review.removed } };
  const changed: string[] = [];
  const added: string[] = [];
  for (const it of items) {
    const old = review.items[it.id] ?? review.removed[it.id];
    delete out.removed[it.id];
    if (!old) {
      out.items[it.id] = { hash: it.hash, status: "waiting", comment: "", at: now, history: [] };
      added.push(it.id);
    } else if (old.hash !== it.hash) {
      const past: Past[] = old.status !== "waiting" || old.comment ? [{ hash: old.hash, status: old.status, comment: old.comment, ...(old.reply ? { reply: old.reply } : {}), at: old.at }] : [];
      // An undo can bring back the very version Owain decided on: his decision comes back with it.
      const seen = old.history.map((h) => h.hash).lastIndexOf(it.hash);
      const back = old.history[seen];
      out.items[it.id] = back
        ? { hash: it.hash, status: back.status, comment: back.comment, ...(back.reply ? { reply: back.reply } : {}), at: back.at, history: [...old.history.filter((_, k) => k !== seen), ...past] }
        : { hash: it.hash, status: "waiting", comment: "", at: now, history: [...old.history, ...past] };
      changed.push(it.id);
    } else out.items[it.id] = old;
  }
  const ids = new Set(items.map((it) => it.id));
  const removed = Object.keys(review.items).filter((id) => !ids.has(id));
  for (const id of removed) out.removed[id] = review.items[id];
  return { review: out, changed, added, removed };
};

export const counts = (review: Review, items: Item[]) => {
  const c = { approved: 0, change: 0, waiting: 0 };
  for (const it of items) c[review.items[it.id]?.status ?? "waiting"]++;
  return c;
};

// Where a note sits now: on its words if they are still said, else where it was written.
export const noteTime = (note: Note, words: Word[]) => {
  const i = note.anchor ? findPhrase(words, note.anchor) : -1;
  return i >= 0 ? words[i].start : note.t;
};

// Notes not yet closed, and items asking for a change: what "Send to Claude" sends.
export const openNotes = (review: Review) => review.notes.filter((n) => n.status === "open");
export const openChanges = (review: Review, items: Item[]) => items.filter((it) => review.items[it.id]?.status === "change" && !review.items[it.id]?.reply);

const time = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")} (${t.toFixed(2)}s)`;

// The open changes and notes, compact, for Claude to act on. Each has a key to answer under.
export const formatFeedback = (review: Review, items: Item[], words: Word[]) => {
  const lines: string[] = [];
  for (const it of openChanges(review, items)) {
    const rv = review.items[it.id];
    lines.push("", `[item:${it.id}] graphic #${it.n}, ${time(it.start)} for ${(it.end - it.start).toFixed(1)}s, ${it.layout}${it.kind ? ` ${it.kind}` : ""}, starts on "${it.anchor}"`);
    if (it.said) lines.push(`  said: ${it.said}`);
    lines.push(...(rv.comment.trim() || "(no comment: Owain wants this one changed; look at it and improve it)").split("\n").map((l) => `  > ${l}`));
    const last = rv.history.filter((h) => h.status === "change" && h.comment).at(-1);
    if (last) lines.push(`  earlier note on it: ${last.comment.replace(/\s+/g, " ")}`);
  }
  for (const n of openNotes(review)) {
    const t = noteTime(n, words);
    const on = items.find((it) => t >= it.start && t < it.end);
    lines.push("", `[note:${n.id}] at ${time(t)}${on ? `, on graphic #${on.n} (${on.id})` : ", on plain picture"}`);
    const said = saidIn(words, t - 2, t + 3);
    if (said) lines.push(`  said around it: ${said}`);
    lines.push(...n.text.trim().split("\n").map((l) => `  > ${l}`));
  }
  return lines.join("\n").trim();
};
