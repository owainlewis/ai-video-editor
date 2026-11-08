// A reel as beats of about 2 seconds, for checking every graphic before an export: a beat starts
// wherever something on screen changes (a shot, a reveal, a hit, a chip, a title), and a stretch with
// nothing new is split so no beat runs much past 2 s. Pure, over the resolved shots, so the beats
// follow the same times the player shows.
import type { ResolvedShot, Word } from "./schema.ts";

export type Beat = {
  start: number;
  end: number;
  // The frame to look at: after what landed in this beat has settled, before the next beat.
  at: number;
  // Index into the shots: the shot on screen at the beat's start.
  shot: number;
  // What changes as the beat starts, in the order it lands ("shot", "reveal 2/3", "hit", "held").
  changes: string[];
  // The words that start inside the beat.
  said: string;
};

// Changes this close together read as one arrival, so they share a beat.
const MERGE = 0.35;
// A beat longer than this is split; the house rule is a change every 2 s at most in a reel.
const LONGEST = 2.5;
const TARGET = 2;
// The frame to look at sits this long before the next beat: typing and line draws are done by then,
// and a hit has not yet started to fade out (it fades over 0.25 s before its end).
const BEFORE = 0.3;
// A short beat is looked at once its reveal or move has landed (the clean style's slower speed is 0.6 s).
const SETTLE = 0.7;

type Change = { t: number; what: string };

const snap = (t: number, fps: number) => Math.round(t * fps) / fps;

// Everything that lands on screen in one shot, at its resolved time.
const changesIn = (s: ResolvedShot): Change[] => {
  const out: Change[] = [{ t: s.start, what: s.keep ? "header" : "shot" }];
  const times = s.visual?.times ?? [];
  // A kept shot carries the visual it continues, so only the reveals inside its own span count.
  times.forEach((t, n) => out.push({ t, what: `${s.visual?.kind === "image" ? "highlight" : "reveal"} ${n + 1}/${times.length}` }));
  if (s.hit) out.push({ t: s.hit.at, what: `hit ${s.hit.text}` }, { t: s.hit.until, what: "hit ends" });
  if (s.chip) out.push({ t: s.chip.at, what: `chip ${s.chip.name}` });
  if (s.title) out.push({ t: s.title.at, what: "title" });
  return out.filter((c) => c.t >= s.start - 0.001 && c.t < s.end - 0.05);
};

export const reelBeats = (shots: ResolvedShot[], words: Word[], duration: number, fps = 30): Beat[] => {
  if (!shots.length || duration <= 0) return [];
  const changes = shots.flatMap(changesIn).sort((a, b) => a.t - b.t);

  // Group the changes into arrivals: each starts a beat and holds all that lands with it.
  const groups: { t: number; last: number; what: string[] }[] = [];
  for (const c of changes) {
    const g = groups[groups.length - 1];
    // A new shot always starts its own beat: the whole frame changes.
    if (g && c.t - g.t < MERGE && c.what !== "shot") (g.last = c.t), g.what.push(c.what);
    else groups.push({ t: c.t, last: c.t, what: [c.what] });
  }
  if (groups[0].t > 0) groups.unshift({ t: 0, last: 0, what: ["shot"] });

  // Split long stretches with nothing new, on a word's start where one is near.
  const starts = words.map((w) => w.start);
  const spans: { start: number; end: number; last: number; what: string[] }[] = [];
  groups.forEach((g, i) => {
    const end = groups[i + 1]?.t ?? duration;
    const parts = end - g.t > LONGEST ? Math.ceil((end - g.t) / TARGET) : 1;
    let a = g.t;
    for (let k = 1; k <= parts; k++) {
      let b = k === parts ? end : g.t + ((end - g.t) * k) / parts;
      if (k < parts) {
        const near = starts.filter((t) => t > a + 0.6 && t < end - 0.6 && Math.abs(t - b) < 0.5);
        if (near.length) b = near.reduce((x, y) => (Math.abs(y - b) < Math.abs(x - b) ? y : x));
        b = snap(b, fps);
      }
      spans.push(k === 1 ? { start: a, end: b, last: g.last, what: g.what } : { start: a, end: b, last: a, what: ["held"] });
      a = b;
    }
  });

  return spans.map((s) => {
    const shot = Math.max(0, shots.findIndex((x) => s.start >= x.start - 0.001 && s.start < x.end));
    const late = s.end - BEFORE;
    const at = snap(Math.max(s.start, late >= s.last + BEFORE ? late : Math.min(s.last + SETTLE, s.end - 1 / fps)), fps);
    const said = words.filter((w) => w.start >= s.start && w.start < s.end).map((w) => w.text).join(" ");
    return { start: s.start, end: s.end, at, shot, changes: s.what, said };
  });
};

// The beat playing at time t.
export const beatAt = (beats: Beat[], t: number) => {
  for (let i = beats.length - 1; i >= 0; i--) if (t >= beats[i].start - 0.001) return i;
  return 0;
};
