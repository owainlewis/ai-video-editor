// Plans for the gallery (app/Gallery.tsx): one graphic on its own, played live in the browser with
// the real compositions. Nothing is rendered to a file, so a change to a visual shows in seconds.
import { DOC } from "../engine/doc";
import { promptBeats } from "../engine/prompt";
import type { Resolved, ResolvedShot } from "../engine/schema";
import { visualAnchors } from "../engine/resolve";
import { appBeats, appEnd, isApp } from "../engine/apps";
import { actionBeats, actionOffset } from "../engine/actions";
import { codeBeats, codeTimes } from "../engine/code";
import { atMax, type Card } from "../styles/catalog";
import { cards } from "../styles/blueprint/style";
import { blank } from "./canvas";

export type Canvas = "reel" | "youtube";

// The house graphics (effects/house.tsx): reach for these first, so the library shows them first.
const HOUSE = ["words", "focus", "shift", "map"];
// Every reel is a clean reel. The library kinds the clean style draws as part of its kit, beside the
// cards made for it (`styles: ["clean"]`): the house graphics in the split's top panel, and real captures.
const CLEAN_KINDS = new Set([...HOUSE, "image", "windows", "cli", "claudeapp", "grokbot", "code", "flow", "chart", "prompt", "doc", "gallery", "float"]);

// Why a card does not fit a project's look, or undefined when it does (Owain, 2026-11-07: "improve
// the library so it matches my theme / brand"). The library hides these unless asked.
export function offBrand(c: Card, canvas: Canvas): string | undefined {
  if (canvas === "youtube" && c.kind === "lower") return "No lower thirds unless Owain asks for one";
  if (canvas === "reel" && !c.styles?.includes("clean") && !CLEAN_KINDS.has(c.kind)) return "Not in the clean reel kit";
}

// Whether a library card has a sample and a layout this canvas can show it in.
export const fitsCanvas = (c: Card, canvas: string) =>
  !!c.sample && (canvas === "youtube" ? c.layouts.some((l) => l === "side" || l === "over" || l === "media") || c.tier === "overlay" : c.tier !== "overlay");

// The library cards a canvas can show (`library`: styles/library.json, media/cardlibrary.ts), house
// graphics first: YouTube in the house look, reels in the clean style. `approved` is in the library,
// `removed` was taken out of it and can be added back. Cards drawn only in another style are left
// out; cards that draw but are off the brand say why in `off`.
export const effectList = (canvas: Canvas, library: { cards: string[]; removed: string[] }) =>
  cards
    .filter((c) => library.cards.includes(c.id) || library.removed.includes(c.id))
    .filter((c) => fitsCanvas(c, canvas))
    .filter((c) => !c.styles || c.styles.includes(canvas === "reel" ? "clean" : "ivory"))
    .map((c, i) => ({ c, rank: (c.styles ? 0 : HOUSE.includes(c.kind) ? 1 : 2) * 1000 + i }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ c }) => ({ id: c.id, kind: c.kind, purpose: c.purpose, summary: c.summary, name: c.kind === "custom" ? (c.sample!.visual as { name: string }).name : undefined, off: offBrand(c, canvas), approved: library.cards.includes(c.id), removed: library.removed.includes(c.id) }));

// A library card's sample, its parts landing 0.3 s apart, then held for 2 s. `longest` fills every
// text slot to its maxChars, to see that the layout holds at the limit. On a reel a card draws as a
// clean reel does: on a card when it is one, else in the split's top panel, on ink.
export function cardPlan(cardId: string, canvas: Canvas, theme?: Resolved["theme"], longest = false): Resolved {
  const card = cards.find((c) => c.id === cardId)!;
  const v = (longest ? atMax(card) : card.sample)!.visual;
  const n = Math.max(1, visualAnchors(v).length);
  // The house graphics show one part at a time. Their parts land 0.6 s apart, about as close as
  // speech puts them, so library QC sees one part leaving as the next lands.
  const gap = v.kind === "words" || v.kind === "focus" || v.kind === "map" || v.kind === "shift" ? 0.6 : v.kind === "custom" ? 0.9 : 0.3;
  let times = Array.from({ length: n }, (_, i) => 0.3 + i * gap);
  let duration = times[times.length - 1] + 2;
  // An app mock-up plays its script at its own pace (engine/apps.ts): its steps follow each other,
  // and its anchored rows (a bot arriving, a switch) land 0.9 s apart once the steps are done.
  if (isApp(v)) {
    const steps = appBeats(v, 0).map((b) => b.t0);
    const after = (steps.length ? appEnd(v, 0) : 0.3) + 0.3;
    times = [...steps, ...times.slice(steps.length).map((_, i) => after + i * 0.9)];
    duration = Math.max(...times, appEnd(v, 0, times)) + 2;
  }
  // An agent on a page clicks and types at its own pace (engine/actions.ts).
  if (v.kind === "image" && v.actions?.length) {
    const beats = actionBeats(v.actions, 0, []);
    times = [...times.slice(0, actionOffset(v)), ...beats.map((b) => b.t)];
    duration = Math.max(...times, ...beats.map((b) => b.t1)) + 2;
  }
  // A code view types its lines one after another, so its parts follow its own clock (engine/code.ts).
  if (v.kind === "code") {
    // Marks land after the lines have typed, as a speaker names a range once it is on screen.
    times = codeTimes(v, 0, times.slice(0, v.lines.length));
    duration = Math.max(...times, ...codeBeats(v, 0, times).lines.map((l) => l.t1)) + 2;
  }
  // A prompt types at its own pace, then marks and sends (engine/prompt.ts).
  if (v.kind === "prompt") {
    const b = promptBeats(v, 0, times);
    duration = Math.max(b.t1, b.markAt ?? 0, b.sendAt ?? 0) + 2;
  }
  // A doc scans as it lands, then lights its rows one by one once the scan has passed.
  if (v.kind === "doc") {
    const scan = v.scan ? [0.5] : [];
    times = [...scan, ...v.marks.map((_, j) => (v.scan ? 0.5 + DOC.scan : 0.6) + 0.3 + j * 0.9)];
    duration = Math.max(...times, 1) + 2;
  }
  const youtube = canvas === "youtube";
  const clean = !youtube;
  const layout = cardLayout(card, canvas);
  // As media/project.ts does: the video's theme is the graphic's tone. Clean reels are always on ink.
  const tone = clean || theme === "dark" || theme === "black" ? "dark" : undefined;
  const shot: ResolvedShot = { start: 0, end: duration, layout, visual: { ...v, times }, anchor: card.id, tone, ...(layout === "card" ? { bg: "ink" as const } : {}) };
  return { ...blank(canvas), title: card.id, duration, theme, ...(clean ? { style: "clean", standIn: true } : {}), shots: [shot] };
}

// The clean style's text hook in the library check: a sample, and the longest the plan checks allow
// (the most that still fits two lines). Placeholder words, never a video's.
export const HOOK_SAMPLE = { text: "Google EGM: *better code* with AI.", longest: "Experienced developers *double-check* every change." };

// A clean plan with the hook over it, from its first frame to its end. Without `base`, the speaker's
// stand-in full frame, where the hook sits above the face.
export function hookPlan(longest: boolean, base?: Resolved): Resolved {
  const r = base ?? { ...blank("reel"), title: "hook", duration: 2, style: "clean", standIn: true, shots: [{ start: 0, end: 2, layout: "full" as const, anchor: "hook" }] };
  return { ...r, hook: { text: longest ? HOOK_SAMPLE.longest : HOOK_SAMPLE.text, until: r.duration } };
}

// The layout a card is placed in. YouTube: its first 16:9 layout, `over` for type over the picture,
// else beside the speaker or full frame. Reels: a card when the card is one, else the split.
export function cardLayout(card: Card, canvas: Canvas): ResolvedShot["layout"] {
  if (canvas === "reel") return card.layouts.includes("card") ? "card" : "split";
  return card.tier === "overlay" ? "over" : (card.layouts.find((l) => l === "over" || l === "side" || l === "media") ?? "media");
}

// One shot of a project, alone and silent. Without footage the speaker is the placeholder.
export function shotPlan(r: Resolved, index: number, footage: boolean): Resolved {
  return {
    ...r,
    shots: [r.shots[index]],
    chunks: [],
    sfx: [],
    audio: null,
    video: footage ? r.video : "",
    preview: footage ? { video: r.preview?.video } : undefined,
    cut: footage ? r.cut?.map((c) => ({ ...c, audio: undefined })) : undefined,
  };
}

// The frame where a graphic has settled: its last part landed, before it leaves.
export function settledTime(shot: ResolvedShot): number {
  const times = (shot.visual as { times?: number[] } | undefined)?.times ?? [];
  const last = times.length ? Math.max(...times) : shot.start;
  return Math.max(shot.start, Math.min(shot.end - 0.3, last + 0.8));
}
