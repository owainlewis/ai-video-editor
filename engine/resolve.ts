// Turn an edit plan plus a word-timed transcript into exact times.
// Pure functions, so they are easy to test.
import type { Chunk, EditPlan, ResolvedShot, SfxEvent, VisualSpec, Word } from "./schema.ts";
import { appAnchors, appBeats, isApp, typeRate } from "./apps.ts";

export const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");

const tokens = (phrase: string) => phrase.split(/\s+/).map(norm).filter(Boolean);

// Index of the first word of `phrase` at or after `from`, or -1.
export const findPhrase = (words: Word[], phrase: string, from = 0): number => {
  const want = tokens(phrase);
  if (!want.length) return -1;
  for (let i = from; i <= words.length - want.length; i++) {
    if (want.every((w, j) => norm(words[i + j].text) === w)) return i;
  }
  return -1;
};

// How the checks name a shot.
export const shotLabel = (s: ResolvedShot, i: number) => `shot ${i + 1} (${s.start.toFixed(2)}s "${s.anchor}")`;

// A shot that puts up a graphic of its own, as opposed to the picture or a shot continuing one.
export const isGraphic = (s: ResolvedShot) => !!s.visual && !s.keep && s.layout !== "full";

// The last shot of the run that holds shot i's visual: i, and every `keep` straight after it.
export const lastKept = (shots: { keep?: boolean }[], i: number) => {
  let last = i;
  while (shots[last + 1]?.keep) last++;
  return last;
};

const slugify = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

// Every shot's id: its own from the plan, else made from its spoken anchor, which stays put while
// its look changes. A repeat gets -2, -3. The plain picture that fills the start of a cut is "start".
export const shotIds = (shots: { id?: string; anchor: string }[]) => {
  const seen = new Map<string, number>();
  return shots.map((s) => {
    const base = s.id ?? (slugify(s.anchor) || "start");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
};

// How long the shots matching `pred` stay on screen.
const timeIn = (shots: ResolvedShot[], pred: (s: ResolvedShot) => boolean) => shots.filter(pred).reduce((t, s) => t + s.end - s.start, 0);

// Cuts land slightly before the word so the new shot is up as the word starts.
export const CUT_LEAD = 0.05;

export type Issue = { level: "error" | "warn"; message: string };

// Shot boundaries sit exactly on frames, so the layout and its visual always switch on the same frame.
export const snap = (t: number, fps: number) => Math.round(t * fps) / fps;

// The spoken anchors inside a visual, in the order its parts reveal. `times` in the resolved plan
// follows this order, one time per anchor (an unanchored part cascades in after the shot starts).
export const visualAnchors = (v: VisualSpec): (string | undefined)[] => {
  switch (v.kind) {
    case "list":
    case "steps":
    case "agenda":
    case "levels":
    case "checklist":
    case "matrix":
    case "timeline":
    case "windows":
      return v.items.map((it) => it.at);
    case "terminal": return v.lines.map((it) => it.at);
    case "logos": return v.items.map((it) => it.at);
    case "image": return [...v.highlight.map((h) => h.at), ...(v.lift ? [v.lift.at] : [])];
    case "compare": return [v.right.at];
    case "beforeafter": return [v.after.at];
    case "prompt":
    case "quote":
    case "logowall":
    case "ring":
    case "meter":
    case "waffle":
    case "journey":
      return [v.at];
    case "chart": return v.points.map((pt) => pt.at);
    case "odometer": return [...v.steps.map((x) => x.at), ...(v.result ? [v.result.at] : [])];
    case "lift": return [v.from, v.to];
    case "reviewmd": return v.marks.map((m) => m.at);
    case "claudecode": return [...v.lines.map((l) => l.at), ...(v.mark ? [v.mark.at] : [])];
    case "cli":
    case "claudeapp":
    case "grokbot": return appAnchors(v);
    case "search": return [v.at, v.result?.at];
    case "tiers": return v.items.flatMap((it) => [it.at, it.markAt]);
    case "custom": return v.at;
    case "compose": return [v.at, v.send];
    case "divisions": return [v.count?.at, ...v.items.map((it) => it.at)];
    case "chips": return [v.count?.at];
    case "runs": return [...v.steps.map((st) => st.at), v.done];
    case "kpi": return v.items.map((it) => it.at);
    case "bento": return v.cells.map((c) => c.at);
    case "pipeline": return v.stages.map((st) => st.at);
    case "constraint": return [...v.stages.map((st) => st.at), v.at];
    case "flow": return [...v.nodes.map((n) => n.at), ...v.edges.map((e) => e.at)];
    case "grid": return [v.at, ...v.groups.map((g) => g.at)];
    case "funnel": return [...v.items.map((it) => it.at), v.at, ...v.target.lines.map((l) => l.at)];
    case "type": return [v.at, v.settle, ...v.chips.map((c) => c.at)];
    case "words": return v.lines.map((l) => l.at);
    case "focus": return v.items.map((it) => it.at);
    case "shift": return [v.from.at, v.to.at];
    case "map": return [...v.nodes.map((n) => n.at), ...v.edges.map((e) => e.at)];
    case "beats": return [...v.items.map((it) => it.at), ...(v.line ? [v.line.at] : [])];
    default: return [];
  }
};

// `cut`: the words are the cut's (engine/cut.ts), which can reorder and drop what was said. A shot
// whose anchor now plays earlier is found anyway and moved to where its words play, and a shot
// whose words were cut out is left out with a warning, so graphics follow the words through a re-cut.
export const resolveShots = (plan: EditPlan, words: Word[], duration: number, fps = 30, cut = false) => {
  const issues: Issue[] = [];
  const shots: (ResolvedShot & { index: number })[] = [];
  let cursor = 0;
  let header = plan.header;
  const found: { s: (typeof plan.shots)[number]; i: number }[] = [];
  for (const s of plan.shots) {
    let i = findPhrase(words, s.at, cursor);
    if (i < 0 && cut) {
      const used = new Set(found.map((f) => f.i));
      for (let from = 0; (i = findPhrase(words, s.at, from)) >= 0 && used.has(i); from = i + 1);
    }
    if (i < 0) {
      if (cut) issues.push({ level: "warn", message: `"${s.at}" is no longer said in the cut, so its shot is left out` });
      else issues.push({ level: "error", message: `shot anchor not found after word ${cursor}: "${s.at}"` });
      continue;
    }
    cursor = i + 1;
    found.push({ s, i });
  }
  if (cut) found.sort((a, b) => a.i - b.i);
  // Over a cut, a shot starts on its own words, so a shot whose words moved later never stretches
  // back over what now plays first. Plain picture fills the start until the first shot (all of it
  // when every anchor's words were cut out).
  if (cut && duration > 0 && (!found.length || found[0].i > 0)) shots.push({ start: 0, end: duration, layout: "full", anchor: "", index: -1, header });
  for (const { s, i } of found) {
    const start = shots.length === 0 ? 0 : snap(Math.max(0, words[i].start - CUT_LEAD + (s.shift ?? 0)), fps);
    // The header carries forward until a shot sets a new one, or false to hide it.
    header = s.header === false ? undefined : (s.header ?? header);
    const prev = shots[shots.length - 1];
    if (s.keep && (!(prev?.visual || prev?.keep) || prev.layout !== s.layout || s.visual))
      issues.push({ level: "error", message: `"${s.at}" keeps the previous visual, so it needs the same layout as a previous shot with a visual and no visual of its own` });
    // A kept shot carries the tone of the scene it continues.
    const tone = s.keep && prev ? prev.tone : s.tone;
    shots.push({ start, end: duration, layout: s.layout, visual: s.visual, sfx: s.sfx, anchor: s.at, index: i, header, ...(s.id ? { id: s.id } : {}), ...(s.keep ? { keep: true } : {}), ...(s.zoom ? { zoom: s.zoom } : {}), ...(tone ? { tone } : {}), ...(s.enter ? { enter: s.enter } : {}), ...clean(s) });
  }
  for (let k = 0; k < shots.length - 1; k++) shots[k].end = shots[k + 1].start;
  shotIds(shots).forEach((id, k) => (shots[k].id = id));

  // The clean style's words on screen (a hit, a title, a chip) land on their own words, searched
  // from the shot's anchor; a hit holds until its `until` words or the end of the shot.
  shots.forEach((shot) => {
    const s = found.find((f) => f.i === shot.index)?.s;
    if (!s) return;
    const at = (a: string | undefined, what: string) => {
      if (!a) return shot.start;
      const j = findPhrase(words, a, shot.index);
      if (j < 0 || words[j].start >= shot.end) {
        issues.push({ level: cut ? "warn" : "error", message: `${what} "${a}" in shot "${shot.anchor}" is not said in that shot` });
        return shot.start;
      }
      return Math.max(shot.start, words[j].start - CUT_LEAD);
    };
    if (s.hit) {
      const from = at(s.hit.at, "hit");
      let until = shot.end;
      if (s.hit.until) {
        const j = findPhrase(words, s.hit.until, shot.index);
        // Shot edges snap to frames, so a word on the next shot's edge can sit half a frame past it.
        if (j < 0 || words[j].start - CUT_LEAD > shot.end + 1 / fps) issues.push({ level: cut ? "warn" : "error", message: `hit end "${s.hit.until}" in shot "${shot.anchor}" is not said in that shot` });
        else until = Math.min(shot.end, Math.max(from + 0.3, words[j].start - CUT_LEAD));
      }
      shot.hit = { text: s.hit.text, ...(s.hit.tag ? { tag: s.hit.tag } : {}), at: from, until };
    }
    if (s.title) shot.title = { lines: s.title.lines, at: at(s.title.at, "title") };
    if (s.chip) shot.chip = { name: s.chip.name, at: at(s.chip.at, "chip") };
  });

  // Reveals inside a visual land on their own spoken words, searched from the shot's anchor.
  for (let k = 0; k < shots.length; k++) {
    const shot = shots[k];
    // A kept shot shows the same visual, already resolved from the shot that started it.
    if (shot.keep && k > 0) {
      shot.visual = shots[k - 1].visual;
      continue;
    }
    const v = shot.visual;
    if (!v) continue;
    if ((v.kind === "quote" || v.kind === "title") && v.sync) {
      shot.visual = { ...v, words: syncWords(v.text, words, shot.index, shot.start, shots[k + 1]?.start ?? duration) };
      continue;
    }
    const anchors = visualAnchors(v);
    if (!anchors.length) continue;
    let from = shot.index;
    // A flow's edges are searched from the shot's start again, so they can interleave with its nodes.
    const edgesFrom = v.kind === "flow" || v.kind === "map" ? v.nodes.length : -1;
    // The house graphics show one part at a time, so parts without a word of their own are spread
    // over the shot instead of cascading in together.
    const spread = v.kind === "words" || v.kind === "focus" || v.kind === "map" || v.kind === "shift";
    const last = lastKept(shots, k);
    const span = shots[last].end - shot.start;
    const gap = Math.min(1.1, Math.max(0.35, (span - 1.5) / Math.max(1, anchors.length - 1)));
    const times = anchors.map((a, n) => {
      if (n === edgesFrom) from = shot.index;
      // Unanchored items cascade in quickly so a group reads as one arrival.
      if (!a) return spread ? shot.start + 0.3 + n * gap : shot.start + n * 0.12;
      const j = findPhrase(words, a, from);
      if (j < 0) {
        issues.push(cut
          ? { level: "warn", message: `reveal "${a}" in shot "${shot.anchor}" is no longer said after it in the cut; it shows at the start` }
          : { level: "error", message: `reveal anchor not found in shot "${shot.anchor}": "${a}"` });
        return shot.start;
      }
      from = j + 1;
      return Math.max(shot.start, words[j].start - CUT_LEAD);
    });
    shot.visual = { ...v, times };
  }
  return { shots: shots.map(({ index, ...s }) => s), issues };
};

// The clean style's shot fields that need no times.
const clean = (s: EditPlan["shots"][number]): Partial<ResolvedShot> => ({
  ...(s.picture ? { picture: typeof s.picture === "string" ? { src: s.picture, start: 0, rate: 1 } : s.picture } : {}),
  ...(s.bg ? { bg: s.bg } : {}),
  ...(s.inside ? { inside: true } : {}),
});

// When each word of a quote is said: matched in order against the words spoken in the shot. A word
// matches if it is the same or one starts with the other ("make", "makes"). Unmatched words take the
// time of the word before, so they arrive with it.
export const syncWords = (text: string, words: Word[], from: number, start: number, end: number): number[] => {
  const said = words.slice(Math.max(0, from)).filter((w) => w.start < end);
  const same = (a: string, b: string) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));
  let j = 0;
  let last = start;
  return text.split(/\s+/).map((raw) => {
    const t = norm(raw);
    const k = said.findIndex((w, i) => i >= j && same(norm(w.text), t));
    if (k >= 0) {
      j = k + 1;
      last = Math.max(start, said[k].start);
    }
    return last;
  });
};

// Caption chunks: one to three words, broken at punctuation, pauses and cuts.
// Accent words stand alone so the serif reads as a deliberate beat.
export const chunkWords = (words: Word[], accents: string[], cuts: number[], fps: number): Chunk[] => {
  const accentSet = new Set(accents.flatMap(tokens));
  const isAccent = (w: Word) => accentSet.has(norm(w.text));
  const out: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({
      words: cur.map((w) => ({ ...w, accent: isAccent(w) })),
      start: cur[0].start,
      end: cur[cur.length - 1].end,
    });
    cur = [];
  };
  words.forEach((w, i) => {
    const next = words[i + 1];
    if (isAccent(w)) flush();
    cur.push(w);
    const crossesCut = next ? cuts.some((c) => c > w.end - 0.02 && c <= next.start + 0.02) : false;
    if (
      !next ||
      isAccent(w) ||
      isAccent(next) ||
      cur.length >= 3 ||
      /[.,!?;:]$/.test(w.text) ||
      next.start - w.end > 0.25 ||
      crossesCut
    )
      flush();
  });
  // Show each chunk two frames early and hold it until the next one when the gap is short.
  const lead = 2 / fps;
  out.forEach((c, i) => {
    c.start = Math.max(0, c.start - lead);
    const next = out[i + 1];
    c.end = next && next.words[0].start - lead - c.end < 0.6 ? next.words[0].start - lead : c.end + 0.15;
  });
  // A chunk that starts just before a cut starts on the cut instead, so it never
  // flashes for two frames in the previous shot's caption style.
  for (const cut of cuts) {
    out.forEach((c, i) => {
      if (c.start < cut && c.words[0].start >= cut - 0.15) {
        c.start = cut;
        if (out[i - 1] && out[i - 1].end > cut) out[i - 1].end = cut;
      }
    });
  }
  return out;
};

// Sound comes from the plan's cut sounds plus quiet taps on visible reveals.
// Sound comes from the plan's cut sounds, quiet taps on visible reveals, and the motion system's
// sounds (2026-10-25 motion lab): a soft whoosh when the speaker card or a lifted paragraph moves, a
// click when a highlighter sweeps, ticks while an odometer rolls, a riser into its result.
const MOVE_S = 0.46;
const marked = (text?: string) => !!text && /\*[^*]+\*/.test(text);
export const sfxEvents = (shots: ResolvedShot[]): SfxEvent[] => {
  const ev: SfxEvent[] = [];
  const whoosh = (t: number, gain = 0.42) => ev.push({ kind: "whoosh", t, gain, exact: true });
  const click = (t: number, gain = 0.7) => ev.push({ kind: "blip", t, gain, exact: true });
  shots.forEach((s, i) => {
    // A riser ends on the cut (the mixer lines up a real riser's end with t + dur).
    if (s.sfx === "riser") ev.push({ kind: "riser", t: s.start - 1, dur: 1, gain: 0.6, exact: true });
    else if (s.sfx) ev.push({ kind: s.sfx, t: s.start });
    if (s.keep) return;
    const v = s.visual;
    // The speaker card shrinks in and grows back out.
    // The half split dissolves in and out: one soft whoosh in, none out.
    if (s.layout === "half" && shots[i - 1]?.layout !== "half") whoosh(s.start, 0.3);
    if (s.layout === "side") {
      if (shots[i - 1]?.layout !== "side") whoosh(s.start);
      if (shots[i + 1]?.layout !== "side") whoosh(s.end - MOVE_S, 0.36);
    }
    if (!v) return;
    if (v.kind === "lift") {
      whoosh(s.start);
      whoosh(s.end - MOVE_S, 0.32);
      if (v.mark && v.times?.[0] !== undefined) click(v.times[0]);
      return;
    }
    if (v.kind === "custom" || v.kind === "claudecode" || isApp(v) || v.kind === "search" || v.kind === "tiers" || v.kind === "compose" || v.kind === "divisions" || v.kind === "chips" || v.kind === "runs") {
      whoosh(s.start);
      (v.times ?? []).forEach((t, n) => n && click(t));
      return;
    }
    if (v.kind === "reviewmd") {
      whoosh(s.start);
      (v.times ?? []).forEach((t) => click(t));
      return;
    }
    if (v.kind === "odometer") {
      const times = v.times ?? [];
      v.steps.forEach((_, n) => {
        const at = times[n] ?? s.start;
        const [a, b] = n ? [at - 0.45, at + 0.3] : [at - 0.35, at + 0.1];
        for (let t = a; t < b; t += 0.05) ev.push({ kind: "pop", t, gain: 0.3, exact: true });
      });
      const r = times[v.steps.length];
      if (v.result && r !== undefined) {
        ev.push({ kind: "riser", t: r - 1, dur: 1, gain: 0.55, exact: true });
        click(r, 0.9);
      }
      return;
    }
    if (v.kind === "chapter" && v.hit) {
      whoosh(s.start);
      if (marked(v.label)) click(s.start + 1.0);
    }
    if (v.kind === "title" && v.sync && marked(v.text) && v.words?.length) {
      const first = v.text.split(/\s+/).findIndex((w) => w.startsWith("*"));
      if (first >= 0 && v.words[first] !== undefined) click(v.words[first] + 0.1);
    }
    if (!v.times) return;
    const kind = v.kind === "terminal" || v.kind === "prompt" || v.kind === "type" ? "key" : v.kind === "image" ? "blip" : "pop";
    v.times.forEach((t, n) => {
      if (n === 0 && Math.abs(t - s.start) < 0.05 && s.sfx) return;
      ev.push({ kind, t, gain: 0.45 });
      // A pipeline's connector draws to each next stage with a quiet whoosh.
      if (v.kind === "pipeline" && n > 0) whoosh(t - 0.45, 0.22);
    });
  });
  return ev.sort((a, b) => a.t - b.t);
};

// House rules from docs/STYLE.md that can be checked mechanically. Each format has its own.
//   react: the speaker stays on screen in a split while the top panel walks through the source.
//   mixed: every layout, cut fast, the speaker can step away for b-roll and full visuals.
//   film: full-frame scenes that build across shots; a reveal or a headline swap counts as a beat.
export type Format = "react" | "mixed" | "film";

// The longest stretch inside a shot with nothing new on screen: reveals inside its visual count.
const longestStill = (s: ResolvedShot) => {
  const beats = [s.start, ...(s.visual?.times ?? []).filter((x) => x > s.start && x < s.end), s.end].sort((a, b) => a - b);
  return Math.max(...beats.slice(1).map((b, i) => b - beats[i]));
};

// On-camera stretches from a picture scan: each sample's distance to the talking-head look, turned
// into [start, end] ranges. Short gaps (a blink, a gesture) are bridged; short runs are dropped.
export const cameraRanges = (dist: number[], rate: number, threshold = 20, minRun = 2, bridge = 0.5): [number, number][] => {
  const out: [number, number][] = [];
  dist.forEach((d, i) => {
    if (d >= threshold) return;
    const t = i / rate;
    const last = out[out.length - 1];
    if (last && t - last[1] <= bridge + 1 / rate) last[1] = t + 1 / rate;
    else out.push([t, t + 1 / rate]);
  });
  // Samples can sit up to one interval inside a cut, so trim each edge by half a second to be safe.
  return out.map(([a, b]): [number, number] => [a + 0.5, b - 0.5]).filter(([a, b]) => b - a >= minRun);
};

// Graphics go on the talking head only, never over b-roll or a screen recording (Owain,
// 2026-10-24). Every shot that adds a visual must sit inside an on-camera stretch.
// Stretches Owain wants left alone (demos): nothing but his picture inside them.
export const lintLeave = (shots: ResolvedShot[], leave: [number, number][]): Issue[] =>
  shots.flatMap((s, i) =>
    s.layout !== "full" && leave.some(([a, b]) => s.start < b && s.end > a)
      ? [{ level: "error" as const, message: `${shotLabel(s, i)}: inside a stretch to leave alone (a demo)` }]
      : [],
  );

export const lintOnCamera = (shots: ResolvedShot[], ranges: [number, number][], slack = 0.3): Issue[] =>
  shots.flatMap((s, i) => {
    if (s.layout === "full" || s.layout === "punch" || !s.visual) return [];
    // A full-frame card replaces the picture for a moment rather than sitting over it, so it may cut
    // in over a screen recording (Owain, 2026-10-25: the article sections "might benefit from
    // something"). Demos are fenced off with the plan's `leave` instead (lintLeave).
    if (s.layout === "media") return [];
    // The title over the opening b-roll (Owain, 2026-11-09: "we normally have a title overlay on the intro").
    if (s.layout === "over" && s.start < 3) return [];
    const inside = ranges.some(([a, b]) => s.start >= a - slack && s.end <= b + slack);
    if (inside) return [];
    const near = ranges.filter(([a, b]) => b > s.start - 60 && a < s.end + 60).map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)}s`).join(", ");
    const what = s.layout === "cutaway" ? "b-roll covers the talking head, not a screen recording or other b-roll" : "graphics go on the talking head only";
    return [{ level: "error" as const, message: `${shotLabel(s, i)}: not on camera; ${what}${near ? ` (on camera nearby: ${near})` : ""}` }];
  });

// YouTube (16:9) over a hand-edited rough cut: sparse and calm. Graphics hold longer, the
// speaker is rarely away, and most of the video is the picture as cut.
export const lintWide = (shots: ResolvedShot[], duration: number): Issue[] => {
  const issues: Issue[] = [];
  let away = 0;
  shots.forEach((s, i) => {
    const len = s.end - s.start;
    const label = shotLabel(s, i);
    if (s.layout === "split" || s.layout === "scene") issues.push({ level: "error", message: `${label}: ${s.layout} is a reel layout; use side, media or over on YouTube` });
    if ((s.layout === "side" || s.layout === "half" || s.layout === "media" || s.layout === "cutaway") && !s.visual) issues.push({ level: "error", message: `${label} is ${s.layout} but has no visual` });
    if (s.layout === "over" && s.visual?.kind !== "lower" && s.visual?.kind !== "title" && s.visual?.kind !== "words")
      issues.push({ level: "error", message: `${label}: over takes words, a title or a lower third` });
    // A full-frame card that waits for its first word is a blank screen (Owain, 2026-11-09).
    const v = s.layout === "media" ? s.visual : undefined;
    const first = v && "times" in v ? v.times?.[0] : v && "words" in v && Array.isArray(v.words) ? (v.words[0] as number | undefined) : undefined;
    if (first !== undefined && first - s.start > 1) issues.push({ level: "warn", message: `${label}: the card is blank for ${(first - s.start).toFixed(1)}s; start the shot on its first word` });
    // Owain does not like lower thirds (2026-10-24): only when he asks for one.
    if (s.visual?.kind === "lower") issues.push({ level: "warn", message: `${label}: a lower third; Owain does not like them, so use one only when he asks` });
    // A punch-in re-renders the whole picture from the working copy, which shifts its colour and
    // brightness against the original (Owain, 2026-10-24: "they change the color and brightness").
    if (s.layout === "punch") issues.push({ level: "error", message: `${label}: no punch-ins on YouTube; they re-render the footage and change its colour` });
    if (s.layout === "over" && len < 2.5) issues.push({ level: "warn", message: `${label}: an overlay for ${len.toFixed(1)}s is too quick to read` });
    // How long a graphic holds is QC's job now (engine/qc.ts: it warns when one lingers after its
    // last reveal). B-roll still should not hide the speaker for long.
    away = s.layout === "cutaway" ? away + len : 0;
    if (away > 8) issues.push({ level: "warn", message: `${label}: b-roll hides the speaker for ${away.toFixed(1)}s` });
  });
  const graphics = shots.filter((s) => s.layout !== "full" && s.layout !== "punch" && !s.keep).length;
  if (duration > 60 && graphics / (duration / 60) > 4)
    issues.push({ level: "warn", message: `${graphics} graphics in ${(duration / 60).toFixed(1)} min; keep YouTube sparse, about one every 20 to 60 s` });
  return issues;
};

export const lintShots = (shots: ResolvedShot[], duration: number, format: Format = "react", canvas: "reel" | "youtube" = "reel"): Issue[] => {
  if (canvas === "youtube") return lintWide(shots, duration);
  const issues: Issue[] = [];
  for (const s of shots)
    if (s.layout === "side" || s.layout === "half" || s.layout === "over") issues.push({ level: "error", message: `"${s.anchor}": ${s.layout} is a YouTube layout; set "canvas": "youtube"` });
  const speaker = (l: string) => l !== "media" && l !== "cutaway" && l !== "scene";
  let away = 0;
  let lastScene: ResolvedShot | undefined;
  shots.forEach((s, i) => {
    const len = s.end - s.start;
    const label = shotLabel(s, i);
    // One camera move per shot, and never a rushed one: a capture's from-to move needs time.
    const v = s.visual;
    if (!s.keep && v?.kind === "image" && v.from && v.to && v.from.some((x, k) => Math.abs(x - v.to![k]) > 0.005)) {
      const end = lastKept(shots, i);
      const moveLen = shots[end].end - s.start - (s.enter ? 0.7 : 0);
      if (moveLen < 1.2) issues.push({ level: "warn", message: `${label}: the camera move lasts ${moveLen.toFixed(2)}s; under 1.2s it reads as a jolt. Lock the camera or give it time` });
    }
    // Only the stages that are named (Owain, 2026-10-24): empty circles look unfinished.
    if (v?.kind === "pipeline" && v.stages.some((st) => !st.label))
      issues.push({ level: "warn", message: `${label}: the pipeline has unnamed stages; show only the stages that are said` });
    if (format === "film") {
      const still = longestStill(s);
      if (still > 3.6) issues.push({ level: "warn", message: `${label}: nothing new on screen for ${still.toFixed(1)}s; add a reveal or a headline swap` });
      if (s.layout === "scene" && !s.keep) {
        if (lastScene && (lastScene.tone ?? "light") === (s.tone ?? "light"))
          issues.push({ level: "warn", message: `${label}: two ${s.tone ?? "light"} scenes in a row; alternate light and dark` });
        lastScene = s;
      }
      if (len < 0.4) issues.push({ level: "warn", message: `${label} is only ${len.toFixed(2)}s` });
      if (s.layout !== "full" && s.layout !== "punch" && !s.visual)
        issues.push({ level: "error", message: `${label} is ${s.layout} but has no visual` });
      if (s.enter && (s.layout !== "scene" || shots[i - 1]?.layout !== "scene"))
        issues.push({ level: "error", message: `${label}: a shared-element entrance needs a scene before it and a scene to grow into` });
      if (s.enter && s.enter.from !== "rect") {
        let h = i - 1;
        while (h > 0 && shots[h].keep) h--;
        const kind = shots[h]?.visual?.kind;
        const want = { tile: "grid", card: "funnel", input: "type" }[s.enter.from];
        if (kind !== want) issues.push({ level: "error", message: `${label}: enters from a ${s.enter.from}, but the scene before it is not a ${want}` });
      }
      if (s.layout === "scene" && s.header && !s.keep && s.header.replace(/\*/g, "").length > 26)
        issues.push({ level: "warn", message: `${label}: headline "${s.header}" is long for a scene; keep it under 26 characters` });
      return;
    }
    // Something changes every 2 to 3 s (Owain, 2026-10-22): a cut, a reveal on its word, a header
    // swap or a punch-in. A long shot is fine while its reveals keep landing.
    const still = longestStill(s);
    // Tightened to 2 s (Owain, 2026-10-25: "The editing is very slow... a move every 2s max").
    if (still > 2.2) issues.push({ level: "warn", message: `${label}: nothing changes for ${still.toFixed(1)}s; something should change every 2 s at most (a cut, a reveal, a header swap or a punch-in)` });
    if (len < 0.4) issues.push({ level: "warn", message: `${label} is only ${len.toFixed(2)}s` });
    if ((s.layout === "split" || s.layout === "media" || s.layout === "cutaway" || s.layout === "scene") && !s.visual)
      issues.push({ level: "error", message: `${label} is ${s.layout} but has no visual` });
    if (format === "react" && !speaker(s.layout))
      issues.push({ level: "warn", message: `${label}: ${s.layout} hides the speaker; react reels keep the face on screen (use split)` });
    away = speaker(s.layout) ? 0 : away + len;
    if (away > 3.5) issues.push({ level: "warn", message: `${label}: speaker off screen for ${away.toFixed(1)}s` });
    const prev = shots[i - 1];
    // A keep shot (a header swap over the same visual) continues its shot, so runs count shots that change the picture.
    const [prev1, prev2] = shots.slice(0, i).filter((x) => !x.keep).reverse();
    if (format === "mixed" && !s.keep && prev1 && prev2 && prev1.layout === s.layout && prev2.layout === s.layout)
      issues.push({ level: "warn", message: `${label}: third ${s.layout} shot in a row` });
    if (format === "react" && prev && s.layout !== "split" && prev.layout !== "split")
      issues.push({ level: "warn", message: `${label}: two face-only shots in a row; react reels return to the split` });
  });
  if (shots[0] && shots[0].layout !== "split" && !(format === "film" && shots[0].layout === "scene" && shots[0].header))
    issues.push({ level: "warn", message: "first shot should be a split with the topic on top" });
  if (format === "react" && duration > 0) {
    const split = timeIn(shots, (s) => s.layout === "split") / duration;
    if (split < 0.6) issues.push({ level: "warn", message: `split is ${Math.round(split * 100)}% of the reel; react reels sit around 70 to 85%` });
    const sources = shots.filter((s) => s.visual?.kind === "image").length;
    if (sources < 2) issues.push({ level: "warn", message: `only ${sources} source captures; a react reel walks through the source (repo, README, post)` });
  }
  return issues;
};

// ---------- the clean style (style "clean", research/reels/STUDY.md) ----------

// The text hook (Owain, 2026-11-11: "How could we add a visual hook to all our reels... Like a text
// hook"): one short headline at the top of the frame from the first frame. Its geometry, shared by the
// renderer (effects/clean/hook.tsx) and the checks. `top` sits under Instagram's top bar (QC's safe
// area starts at y 96); `band` is where a split's panel starts again under two lines.
// Owain, 2026-11-11: "We should keep the text hook short": six words at most.
export const HOOK = { top: 124, size: 80, lineHeight: 1.06, width: 960, words: 6, lines: 2, min: 3, max: 5 };
export const HOOK_BAND = Math.round(HOOK.top + HOOK.size * HOOK.lineHeight * HOOK.lines + 36);

// The hook's one *marked* phrase, split out: [plain, marked, plain, ...].
export const hookParts = (text: string) => text.split("*");

// Helvetica Bold's advance widths, in thousandths of an em, less the display style's tight tracking:
// enough to tell a hook that wraps to three lines before QC measures it.
const BOLD: Record<string, number> = Object.fromEntries(
  ["278 .,:;!il'|ijft ", "333 frt-()[]", "389 r", "500 z", "556 acesvxyk0123456789J", "611 bdghnopquFLTZ?", "667 ESPVXY", "722 ABCDHKNRU", "778 GOQw", "833 M", "889 m", "944 W"]
    .flatMap((row) => { const [n, cs] = [Number(row.slice(0, 3)), row.slice(4)]; return [...cs].map((c) => [c, n]); }),
);
const ems = (s: string) => [...s].reduce((w, c) => w + (BOLD[c] ?? 600) / 1000 - 0.0625, 0);
// Lines the hook wraps to at `size` in `width`, filled greedily as a browser does.
export const hookLines = (text: string, size = HOOK.size, width = HOOK.width) => {
  const words = text.replace(/\*/g, "").split(/\s+/).filter(Boolean);
  let lines = 0, line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ems(next) * size > width) lines++, (line = w);
    else line = next;
  }
  return lines + (line ? 1 : 0);
};

// When the hook leaves: on its `until` words, else on the first cut after the first shot or 3 s,
// whichever is later, so it leaves with the picture; never past 5 s.
export const resolveHook = (hook: EditPlan["hook"], words: Word[], shots: ResolvedShot[], duration: number, fps = 30, cut = false): { hook?: { text: string; until: number }; issues: Issue[] } => {
  if (!hook) return { issues: [] };
  const issues: Issue[] = [];
  const from = Math.max(shots[0]?.end ?? HOOK.min, HOOK.min);
  let until = from > HOOK.max ? HOOK.max : (shots.map((s) => s.start).find((t) => t >= from - 1e-6 && t <= HOOK.max) ?? from);
  if (hook.until) {
    const j = findPhrase(words, hook.until);
    if (j < 0) issues.push({ level: cut ? "warn" : "error", message: `hook end "${hook.until}" is not said` });
    else {
      until = snap(Math.max(0.5, words[j].start - CUT_LEAD), fps);
      if (until > HOOK.max) {
        issues.push({ level: "warn", message: `the hook holds until ${until.toFixed(2)}s ("${hook.until}"); it ends by ${HOOK.max}s, so it was cut there` });
        until = HOOK.max;
      }
    }
  }
  return { hook: { text: hook.text, until: Math.min(until, duration) }, issues };
};

// The cover's title: two lines of big type in the 3:4 band Instagram's grid shows (effects/clean/cover.tsx).
export const COVER = { size: 96, width: 1000, words: 7, lines: 2 };

export const lintCover = (cover: { title: string } | undefined): Issue[] => {
  if (!cover) return [{ level: "warn", message: `no cover: every reel starts on the standard cover (Owain, 2026-11-11). Add "cover": { "title": "..." }, the title in Owain's words, so frame 0 is his card and never a face mid-word` }];
  const issues: Issue[] = [];
  const n = cover.title.split(/\s+/).filter(Boolean).length;
  if (n > COVER.words) issues.push({ level: "warn", message: `cover title "${cover.title}" is ${n} words; keep it to ${COVER.words}` });
  const lines = hookLines(cover.title, COVER.size, COVER.width);
  if (lines > COVER.lines) issues.push({ level: "warn", message: `cover title "${cover.title}" wraps to about ${lines} lines; keep it to ${COVER.lines}` });
  return issues;
};

// The hook's own rules: short, two lines at most, one marked phrase.
export const lintHook = (hook: { text: string } | undefined): Issue[] => {
  if (!hook) return [{ level: "warn", message: `no text hook; add "hook": { "text": "..." } with one *marked* phrase, in Owain's own words` }];
  const issues: Issue[] = [];
  const n = hook.text.replace(/\*/g, "").split(/\s+/).filter(Boolean).length;
  if (n > HOOK.words) issues.push({ level: "warn", message: `hook "${hook.text}" is ${n} words; keep it to ${HOOK.words}` });
  const lines = hookLines(hook.text);
  if (lines > HOOK.lines) issues.push({ level: "warn", message: `hook "${hook.text}" wraps to about ${lines} lines; keep it to ${HOOK.lines}` });
  const marks = hookParts(hook.text).length - 1;
  if (marks % 2) issues.push({ level: "warn", message: `hook "${hook.text}" has an unclosed *; mark one phrase as *this*` });
  else if (marks > 2) issues.push({ level: "warn", message: `hook "${hook.text}" marks ${marks / 2} phrases; mark one` });
  return issues;
};

export const CLEAN_LAYOUTS = ["split", "full", "card", "diagram", "over", "cutaway"] as const;

// Sounds in the clean style: each marks something the eye can see land (Owain, 2026-11-07: "we kept
// reusing the same sound effect... in random places"). A low whoosh as a graphic takes over, a sub hit
// under a hit word, a ring for a logo, a tick per item and per diagram, a click per marker, keys under
// typing. A diagram draws on many small beats, so only its first beat sounds, and only in the clear.
// A kind has several files that take turns (audio/library.py). Nothing on a cut back to the speaker.
const CLEAR = 1;
// A recorded screen's camera at time t: its scale and offset (tx a share of the panel's width, ty of the
// page's height; box is panel height / page height). Each zoom eases these straight from where the last
// one left them. Easing the offset, not the centre, moves every point on the page in one line: an eased
// centre slid the page one way and back, and stuck at the page's edge, then lurched free (Owain, 2026-11-08).
export type ScreenZoom = { t: number; x: number; y: number; s: number; ms: number };
export const zoomAt = (zooms: ScreenZoom[], t: number, box = 1) => {
  const place = (x: number, y: number, s: number) => ({ s, tx: Math.min(0, Math.max(1 - s, 0.5 - x * s)), ty: Math.min(0, Math.max(box - s, box / 2 - y * s)) });
  const cur = place(0.5, 0, 1); // Unzoomed, a recording taller than its panel hangs from the top.
  for (const z of zooms) {
    if (t < z.t) break;
    const p = z.ms ? Math.min(1, ((t - z.t) * 1000) / z.ms) : 1;
    const e = p ** 3 * (p * (6 * p - 15) + 10); // Starts and stops with no sudden change of speed.
    const to = place(z.x, z.y, z.s);
    cur.s += (to.s - cur.s) * e;
    cur.tx += (to.tx - cur.tx) * e;
    cur.ty += (to.ty - cur.ty) * e;
  }
  return cur;
};
// A move that starts before the last one has settled reads as a jerk. A hard cut (ms 0) ends one cleanly.
export const zoomClashes = (zooms: ScreenZoom[]) =>
  zooms.filter((z, i) => {
    const next = zooms[i + 1];
    return !!next?.ms && next.t < z.t + z.ms / 1000 + 0.15;
  });

export const cleanSfx = (shots: ResolvedShot[]): SfxEvent[] => {
  const ev: SfxEvent[] = [];
  const diagram: SfxEvent[] = [];
  const takesOver = (s?: ResolvedShot) => !!s && (s.layout === "diagram" || s.layout === "over" || s.layout === "card");
  const typing = (at: number, chars: number, cps: number) => {
    for (let n = 0; n <= chars; n += 3) ev.push({ kind: "key", t: at + n / cps, gain: 0.5, exact: true });
  };
  shots.forEach((s, i) => {
    if (s.sfx === "riser") ev.push({ kind: "riser", t: s.start - 1, dur: 1, gain: 0.5, exact: true });
    else if (s.sfx) ev.push({ kind: s.sfx, t: s.start });
    else if (takesOver(s) && !takesOver(shots[i - 1])) ev.push({ kind: "thud", t: s.start, gain: 0.7, exact: true });
    if (s.hit) ev.push({ kind: "impact", t: s.hit.at, gain: 0.6, exact: true });
    if (s.chip) typing(s.chip.at + 0.25, s.chip.name.length, 1 / 0.035);
    const v = s.visual;
    if (!v || s.keep) return;
    const times = v.times ?? [];
    if (v.kind === "claudecode") v.lines.forEach((l, n) => { if (l.style === "prompt") typing(times[n] ?? s.start + 0.35, l.text.length, 26); });
    // Keys under every prompt the app mock-ups type, at the speed they type it.
    if (isApp(v)) appBeats(v, s.start, times).forEach((b, n) => { const st = v.steps[n]; if (st.type === "prompt" || st.type === "user") typing(b.t0, st.text.length, typeRate(st.text.length)); });
    if (v.kind === "custom" && times.length) diagram.push({ kind: "pop", t: times[0], gain: 0.6, exact: true });
    const each = v.kind === "image" ? "blip" : v.kind === "logos" ? "chime" : v.kind === "list" || v.kind === "beats" ? "pop" : null;
    if (each) times.forEach((t) => ev.push({ kind: each, t, gain: 0.6, exact: true }));
    // A click or a mark on a recorded screen; the file spans the reel, so only this shot's.
    if (v.kind === "video") for (const t of v.ticks ?? []) if (t >= s.start && t < s.end) ev.push({ kind: "pop", t, gain: 0.45, exact: true });
  });
  const loud = ev.filter((e) => e.kind !== "key");
  return [...ev, ...diagram.filter((d) => loud.every((e) => Math.abs(e.t - d.t) >= CLEAR))].sort((a, b) => a.t - b.t);
};

// The clean style's house rules, from the samples Owain chose (2026-11-06). `faceless`: a reel with
// no footage of the speaker (a voiced script), so every picture comes from b-roll.
export const lintClean = (shots: ResolvedShot[], duration: number, faceless: boolean, hook?: { text: string }, cover?: { title: string }): Issue[] => {
  const issues: Issue[] = [...lintHook(hook), ...lintCover(cover)];
  shots.forEach((s, i) => {
    const len = s.end - s.start;
    const label = shotLabel(s, i);
    const v = s.visual;
    if (!(CLEAN_LAYOUTS as readonly string[]).includes(s.layout)) issues.push({ level: "error", message: `${label}: ${s.layout} is not a clean layout; use ${CLEAN_LAYOUTS.join(", ")}` });
    if ((s.layout === "split" || s.layout === "over" || s.layout === "diagram") && !v) issues.push({ level: "error", message: `${label} is ${s.layout} but has no visual` });
    if (s.layout === "card" && v && v.kind !== "beats" && v.kind !== "list") issues.push({ level: "warn", message: `${label}: a card holds beats, a bracketed list or the caption alone, not a ${v.kind}` });
    if (faceless && (s.layout === "full" || s.layout === "split" || s.layout === "over") && !s.picture)
      issues.push({ level: "error", message: `${label}: there is no footage of the speaker, so a ${s.layout} shot needs a picture (b-roll)` });
    if (len < 0.4) issues.push({ level: "warn", message: `${label} is only ${len.toFixed(2)}s` });
    if (len > 7 && s.layout !== "split") issues.push({ level: "warn", message: `${label} holds ${len.toFixed(1)}s; the cinematic references cut about every 3 s` });
    if (v?.kind === "custom" && v.times?.length && s.layout !== "card") {
      const beats = [s.start, ...v.times, s.end];
      const hold = Math.max(...beats.slice(1).map((t, n) => t - beats[n]));
      if (hold > 2) issues.push({ level: "warn", message: `${label}: the diagram holds still for ${hold.toFixed(1)}s; land a part or cut away within 2 s` });
    }
    if (s.hit) {
      if (s.hit.text.length > 12) issues.push({ level: "warn", message: `${label}: hit "${s.hit.text}" is long; a hit is one to three short words (12 letters at most)` });
      // A hit wraps at spaces, so one long word runs off the frame: "SLOW DOWN" (9) already fills 85% of it.
      for (const w of s.hit.text.split(/\s+/)) if (w.length > 10) issues.push({ level: "error", message: `${label}: hit word "${w}" is too wide for the frame; use a word of 10 letters at most` });
      if (s.hit.tag && s.hit.tag.length > 24) issues.push({ level: "warn", message: `${label}: hit tag "${s.hit.tag}" is long; keep it under 24 letters` });
      if (s.layout === "card" && v?.kind === "beats") issues.push({ level: "warn", message: `${label}: a hit over card beats; one text treatment at a time` });
    }
    if (s.title) for (const l of s.title.lines) if (l.length > 18) issues.push({ level: "warn", message: `${label}: title line "${l}" is long; keep each line under 18 letters` });
    if (s.title && s.layout !== "diagram") issues.push({ level: "warn", message: `${label}: a title names a full-screen diagram; put it on a diagram shot` });
    if (s.inside && s.layout !== "diagram") issues.push({ level: "warn", message: `${label}: inside puts the caption in a diagram; it only applies to diagram shots` });
    if (v?.kind === "beats") {
      const max = { huge: 7, mid: 10, small: 16 };
      for (const b of v.items) if (b.text.length > max[b.size]) issues.push({ level: "warn", message: `${label}: beat "${b.text}" is long for ${b.size}; keep it under ${max[b.size]} letters` });
    }
    if (s.layout === "diagram" && shots[i + 1]?.layout === "diagram" && !shots[i + 1].keep) issues.push({ level: "warn", message: `${label}: two diagrams back to back; cut to a split or the picture between them` });
  });
  if (duration > 0) {
    // Split is the main view (Owain, 2026-11-06: "the split screen should be the primary view").
    const split = timeIn(shots, (s) => s.layout === "split") / duration;
    if (split < 0.45) issues.push({ level: "warn", message: `split is ${Math.round(split * 100)}% of the reel; it is the main view, so aim for half or more` });
    // Owain, 2026-11-11: "we end the reel with my face in an unflattering shot. Stop on a blank screen or text card."
    const last = shots[shots.length - 1];
    if (last && last.layout === "full" && !faceless) issues.push({ level: "warn", message: `the reel ends on ${shotLabel(last, shots.length - 1)}, full frame on the face; end on a card` });
    // Owain, 2026-11-13: "Let's avoid opening on a full screen of me as I hate that - I prefer the split screen."
    const first = shots[0];
    if (first && first.layout === "full" && !faceless) issues.push({ level: "warn", message: `the reel opens on ${shotLabel(first, 0)}, full frame on the face; open on a split under the hook` });
    // A full-screen diagram only now and then, where it adds value.
    const diagram = timeIn(shots, (s) => s.layout === "diagram") / duration;
    if (diagram > 0.2) issues.push({ level: "warn", message: `diagrams fill ${Math.round(diagram * 100)}% of the reel; use one only now and then` });
  }
  return issues;
};
