// Cutting by the words: the stretch of the cut that holds words i to j, and the tightening pass
// that finds what a talking-head edit usually loses (long pauses, filler words, a sentence started
// again). Pure: the editor shows each cut as a proposal in the script and applies the ones kept.
import type { Word } from "./schema.ts";

// The words' stretch, edge to edge: from just before word i to just before the word after j, so
// the pause after the last cut word goes with it and the next word starts clean. Lead-ins stay
// short (0.06 s at most) and never reach into the word before.
export function wordsRange(words: Word[], i: number, j: number): [number, number] {
  const lead = (k: number) => Math.min(0.06, (words[k].start - (words[k - 1]?.end ?? 0)) / 2);
  const a = words[i].start - lead(i);
  const b = words[j + 1] ? words[j + 1].start - lead(j + 1) : words[j].end + 0.08;
  return [Math.max(0, a), b];
}

export type Trim = { kind: "pause" | "filler" | "retake"; from: number; to: number; words: [number, number] | null; text: string };

const FILLERS = new Set(["um", "umm", "uh", "uhh", "erm", "er", "ah", "hmm", "mm"]);
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

// `pause`: gaps between words longer than this are cut down to `keep` seconds.
// A retake: the speaker says three or more words, stops, and says them again; the first attempt
// goes. Proposals never overlap and come in time order.
export function tighten(words: Word[], opts: { pause?: number; keep?: number; reach?: number } = {}): Trim[] {
  const { pause = 0.6, keep = 0.25, reach = 24 } = opts;
  const out: Trim[] = [];
  const taken = new Set<number>();
  // Retakes first: they take whole words, and a pause inside one goes with it.
  const n = words.map((w) => norm(w.text));
  for (let i = 0; i < words.length; i++) {
    if (taken.has(i)) continue;
    for (let j = i + 1; j <= Math.min(words.length - 3, i + reach); j++) {
      let k = 0;
      while (j + k < words.length && i + k < j && n[i + k] && n[i + k] === n[j + k]) k++;
      // A restart repeats nearly all of the first attempt: at most two words of it are abandoned.
      // "You need to learn three things. The first thing you need to learn is" is not a retake.
      if (k < 3 || j - i > k + 2) continue;
      for (let x = i; x < j; x++) taken.add(x);
      const [from, to] = wordsRange(words, i, j - 1);
      out.push({ kind: "retake", from, to, words: [i, j - 1], text: words.slice(i, j).map((w) => w.text).join(" ") });
      i = j - 1;
      break;
    }
  }
  words.forEach((w, i) => {
    if (taken.has(i) || !FILLERS.has(n[i])) return;
    taken.add(i);
    const [from, to] = wordsRange(words, i, i);
    out.push({ kind: "filler", from, to, words: [i, i], text: w.text });
  });
  words.forEach((w, i) => {
    const next = words[i + 1];
    if (!next || taken.has(i) || taken.has(i + 1)) return;
    const gap = next.start - w.end;
    if (gap <= pause) return;
    // Keep `keep` seconds of the pause, split around the middle of the silence.
    const from = w.end + keep / 2;
    const to = next.start - keep / 2;
    out.push({ kind: "pause", from, to, words: null, text: `${gap.toFixed(1)}s pause` });
  });
  return out.sort((a, b) => a.from - b.from);
}
