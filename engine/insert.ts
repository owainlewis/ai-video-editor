// Put new shots into a plan at moments in time. A plan anchors shots on spoken phrases, matched in
// order, so a new shot needs a phrase that is found exactly where it should start: the words from
// that moment, lengthened until the search from the previous anchor lands on them. Used by drag and
// drop and by accepted suggestions. Pure, so it is easy to test.
import { findPhrase } from "./resolve.ts";
import type { Word } from "./schema.ts";

// The first word that starts at or after `t`, or -1.
export const wordAt = (words: Word[], t: number) => words.findIndex((w) => w.start >= t - 0.02);

// A phrase starting at word `index` that the in-order search, starting after word `after`, finds
// at `index` and nowhere earlier. Null when no phrase of up to 12 words does.
export function phraseAt(words: Word[], index: number, after: number): string | null {
  for (let n = 3; n <= 12 && index + n <= words.length; n++) {
    const phrase = words.slice(index, index + n).map((w) => w.text).join(" ");
    if (findPhrase(words, phrase, after + 1) === index) return phrase;
  }
  const last = words.slice(index).map((w) => w.text).join(" ");
  return last && findPhrase(words, last, after + 1) === index ? last : null;
}

type Placed<S> = { index: number; shot: S; added: boolean };

// Merge new shots (each at a word index) into existing ones (each with the word index its anchor
// resolved to), in time order, and rewrite every new shot's anchor so it is found in place. An
// existing shot that starts on the same word as a new one is replaced by it.
export function mergeShots<S extends { at: string }>(words: Word[], existing: { index: number; shot: S }[], added: { index: number; shot: S }[]): S[] {
  const taken = new Set(added.map((a) => a.index));
  const all: Placed<S>[] = [
    ...existing.filter((e) => !taken.has(e.index)).map((e) => ({ ...e, added: false })),
    ...added.map((a) => ({ ...a, added: true })),
  ].sort((a, b) => a.index - b.index || Number(a.added) - Number(b.added));
  let after = -1;
  return all.map((p) => {
    const at = p.added ? phraseAt(words, p.index, after) : p.shot.at;
    if (at === null) throw new Error(`no unique phrase at "${words[p.index]?.text ?? "the end"}" to anchor a shot on`);
    after = p.added ? p.index : Math.max(after, findPhrase(words, at, after + 1));
    return { ...p.shot, at };
  });
}

// The plan's shot behind resolved shot k: the same anchor, counted in order. -1 for none (the plain
// picture that fills the start of a cut has no shot in the plan).
export const planIndex = (plan: { at: string }[], resolved: { anchor: string }[], k: number) => {
  const anchor = resolved[k]?.anchor;
  if (!anchor) return -1;
  const nth = resolved.slice(0, k).filter((s) => s.anchor === anchor).length;
  return plan.map((s, i) => ({ s, i })).filter(({ s }) => s.at === anchor)[nth]?.i ?? -1;
};

// A library sample made ready for a plan: its `at` anchors are the sample's own words, which this
// video never says, so they are dropped and every part lands in turn after the shot starts.
export function stripAnchors<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripAnchors) as T;
  if (!v || typeof v !== "object") return v;
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => !(k === "at" && typeof x === "string")).map(([k, x]) => [k, stripAnchors(x)])) as T;
}
