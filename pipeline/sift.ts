// Sift: the first cut. Takes out dead air (measured on the audio, since Whisper stretches words
// over pauses) and retakes (a phrase Owain starts again: the last take wins). Pure, so it is tested.

export type Word = { text: string; start: number; end: number };
export type Range = { start: number; end: number };
export type Cut = Range & { reason: "pause" | "retake"; words?: string };
export type Levels = { step: number; db: number[] };

export const SIFT = {
  pause: 0.5, // a silence at least this long is cut
  pad: 0.12, // room left either side of a cut, so breaths and word tails survive
  gap: 0.35, // a gap this long between words ends a phrase
  match: 3, // words that must repeat for a phrase to count as a retake
  lookback: 20, // seconds back to look for the first attempt
};

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9']/g, "");

// The noise floor plus 12 dB, so the threshold follows each recording. Auphonic gates pauses to
// digital silence (-180 dB), so the threshold never drops below -50 dB.
export function silenceThreshold(db: number[]): number {
  const sorted = [...db].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? -90;
  return Math.min(Math.max(floor + 12, -50), -30);
}

export function silences(levels: Levels, min: number): Range[] {
  const { step, db } = levels;
  const limit = silenceThreshold(db);
  const out: Range[] = [];
  let run = -1;
  db.forEach((v, i) => {
    if (v < limit) {
      if (run < 0) run = i;
    } else if (run >= 0) {
      if ((i - run) * step >= min) out.push({ start: run * step, end: i * step });
      run = -1;
    }
  });
  return out;
}

export function pauses(levels: Levels, duration: number): Cut[] {
  const { step, db } = levels;
  const limit = silenceThreshold(db);
  const cuts: Cut[] = [];
  let runStart = -1;
  const close = (endFrame: number) => {
    const start = runStart * step;
    const end = Math.min(endFrame * step, duration);
    if (end - start < SIFT.pause) return;
    // The ends of the recording lose all their silence; inside it, keep the padding.
    const a = runStart === 0 ? 0 : start + SIFT.pad;
    const b = end >= duration - step ? duration : end - SIFT.pad;
    if (b > a) cuts.push({ start: a, end: b, reason: "pause" });
  };
  db.forEach((v, i) => {
    if (v < limit) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      close(i);
      runStart = -1;
    }
  });
  if (runStart >= 0) close(db.length);
  return cuts;
}

// Phrases end at a pause or at the end of a sentence, so a retake said straight after the first
// attempt, with no pause, is still found. Whisper often stretches a word over the pause after it
// (and drops punctuation), so with levels a pause is also any silence between two word starts.
export function phrases(words: Word[], levels?: Levels): Word[][] {
  const quiet = levels ? silences(levels, SIFT.gap) : [];
  const pauseBetween = (a: number, b: number) => quiet.some((q) => q.start >= a && q.start < b);
  const out: Word[][] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (i === 0 || w.start - prev.end >= SIFT.gap || /[.?!]$/.test(prev.text) || pauseBetween(prev.start + 0.05, w.start)) out.push([]);
    out[out.length - 1].push(w);
  });
  return out;
}

// A phrase is a retake when a later phrase opens with the same words. Short fragments (an aborted
// start of one or two words) count when the next phrase opens with all of them.
export function retakes(words: Word[]): Cut[] {
  const ps = phrases(words);
  const cuts: Cut[] = [];
  // A phrase already taken out by an earlier retake is not matched again; otherwise its cut would
  // also take out the start of the take that replaced it.
  const gone = new Set<number>();
  const head = (p: Word[], n: number) => p.slice(0, n).map((w) => norm(w.text)).join(" ");
  for (let j = 1; j < ps.length; j++) {
    for (let i = j - 1; i >= 0 && ps[j][0].start - ps[i][0].start <= SIFT.lookback; i--) {
      const n = ps[i].length < SIFT.match ? ps[i].length : SIFT.match;
      const fragment = ps[i].length < SIFT.match && i === j - 1;
      if ((n === SIFT.match || fragment) && ps[j].length >= n && head(ps[i], n) === head(ps[j], n)) {
        if (gone.has(i)) break;
        for (let k = i; k < j; k++) gone.add(k);
        // Inside continuous speech the pad shrinks to half the gap, so no word is clipped.
        const before = i > 0 ? ps[i - 1][ps[i - 1].length - 1].end : 0;
        const start = i > 0 ? before + Math.min(SIFT.pad, (ps[i][0].start - before) / 2) : 0;
        const last = ps[j - 1][ps[j - 1].length - 1].end;
        const end = ps[j][0].start - Math.min(SIFT.pad, (ps[j][0].start - last) / 2);
        const said = ps.slice(i, j).flat().map((w) => w.text).join(" ");
        if (end > start) cuts.push({ start, end, reason: "retake", words: said });
        break;
      }
    }
  }
  return cuts;
}

export function merge(cuts: Cut[]): Cut[] {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const out: Cut[] = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && c.start <= last.end + 0.05) {
      last.end = Math.max(last.end, c.end);
      if (c.reason === "retake") (last.reason = "retake"), (last.words = [last.words, c.words].filter(Boolean).join(" / "));
    } else out.push({ ...c });
  }
  return out;
}

export function keeps(cuts: Cut[], duration: number): Range[] {
  const out: Range[] = [];
  let t = 0;
  for (const c of cuts) {
    if (c.start > t) out.push({ start: t, end: c.start });
    t = Math.max(t, c.end);
  }
  if (t < duration) out.push({ start: t, end: duration });
  return out.filter((k) => k.end - k.start >= 0.2);
}

export function sift(words: Word[], levels: Levels, duration: number) {
  const cuts = merge([...pauses(levels, duration), ...retakes(words)]);
  const kept = keeps(cuts, duration);
  const after = kept.reduce((s, k) => s + k.end - k.start, 0);
  return {
    cuts,
    keeps: kept,
    summary: {
      cuts: cuts.length,
      retakes: cuts.filter((c) => c.reason === "retake").length,
      before: +duration.toFixed(2),
      after: +after.toFixed(2),
      percentCut: Math.round((1 - after / duration) * 100),
    },
  };
}

// The editor's choice of takes (takes.json): phrase ranges in the order they play, so an outro
// recorded early can still close the video. `dropStart` skips the first words of a phrase.
export type Take = [number, number] | { from: number; to: number; dropStart?: number };

export const DEAD_AIR = 0.7; // inside a chosen take, only silences this long are cut

export function fromTakes(words: Word[], levels: Levels, takes: Take[]) {
  const ps = phrases(words, levels);
  const index = new Map(words.map((w, i) => [w, i]));
  const quiet = silences(levels, DEAD_AIR);
  const ranges = takes.flatMap((t) => {
    const { from, to, dropStart = 0 } = Array.isArray(t) ? { from: t[0], to: t[1] } : t;
    const said = ps.slice(from, to + 1).flat().slice(dropStart);
    if (!said.length) return [];
    const first = index.get(said[0])!;
    const last = index.get(said[said.length - 1])!;
    const start = Math.max(words[first - 1]?.end ?? 0, said[0].start - 0.1);
    const end = Math.min(words[last + 1]?.start ?? Infinity, said[said.length - 1].end + 0.15);
    // Take the dead air out of the middle of the take, leaving a breath either side.
    const out: Range[] = [];
    let t0 = start;
    for (const q of quiet) {
      if (q.end <= start || q.start >= end) continue;
      const a = Math.max(q.start + SIFT.pad, start);
      const b = Math.min(q.end - SIFT.pad, end);
      if (a > t0) out.push({ start: t0, end: a });
      t0 = Math.max(t0, b);
    }
    if (end > t0) out.push({ start: t0, end });
    return out.filter((r) => r.end - r.start >= 0.2);
  });
  return { ranges, said: takes.length };
}
