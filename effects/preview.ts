// Plans for the gallery (app/Gallery.tsx): one graphic on its own, played live in the browser with
// the real compositions. Nothing is rendered to a file, so a change to a visual shows in seconds.
import type { Resolved, ResolvedShot } from "../engine/schema";
import { visualAnchors } from "../engine/resolve";
import { atMax } from "../styles/catalog";
import { cards } from "../styles/blueprint/style";

export type Canvas = "reel" | "youtube";

export const effectList = (canvas: Canvas) =>
  cards
    .filter((c) => c.sample && (canvas === "youtube" ? c.layouts.some((l) => l === "side" || l === "over" || l === "media") || c.tier === "overlay" : c.tier !== "overlay"))
    .map((c) => ({ id: c.id, kind: c.kind, purpose: c.purpose, summary: c.summary }));

const blank = (canvas: Canvas): Omit<Resolved, "title" | "duration" | "shots"> => ({
  slug: "",
  fps: 30,
  video: "",
  videoSize: canvas === "youtube" ? [1920, 1080] : [1080, 1920],
  audio: null,
  face: { x: 0.5, y: 0.3, h: 0.17 },
  grade: { brightness: 1, contrast: 1, saturate: 1 },
  split: "half",
  canvas,
  captions: false,
  chunks: [],
  sfx: [],
});

// A library card's sample, its parts landing 0.3 s apart, then held for 2 s. `longest` fills every
// text slot to its maxChars, to see that the layout holds at the limit.
export function cardPlan(cardId: string, canvas: Canvas, theme?: Resolved["theme"], longest = false): Resolved {
  const card = cards.find((c) => c.id === cardId)!;
  const v = (longest ? atMax(card) : card.sample)!.visual;
  const n = Math.max(1, visualAnchors(v).length);
  const times = Array.from({ length: n }, (_, i) => 0.3 + i * 0.3);
  const duration = times[times.length - 1] + 2;
  const youtube = canvas === "youtube";
  const layout = !youtube ? "split" : card.tier === "overlay" ? "over" : card.layouts.includes("side") ? "side" : "media";
  // As media/project.ts does: the video's theme is the graphic's tone.
  const tone = theme === "dark" || theme === "black" ? "dark" : undefined;
  const shot: ResolvedShot = { start: 0, end: duration, layout, visual: { ...v, times }, anchor: card.id, header: youtube ? undefined : card.sample!.header, tone };
  return { ...blank(canvas), title: card.id, duration, theme, shots: [shot] };
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
