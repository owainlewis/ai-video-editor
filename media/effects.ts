// The effects browser: every graphic the style can draw, with a preview rendered from the card's
// sample in the real composition, the way it appears in a project: beside the speaker for YouTube,
// in the split for reels. Previews are cached in library/effects/<canvas>/<card>.jpg.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Resolved, ResolvedShot } from "../engine/schema.ts";
import { visualAnchors } from "../engine/resolve.ts";
import { cards } from "../styles/blueprint/style.ts";
import { type Log, ROOT, run, writeJson } from "./tools.ts";

export const EFFECTS = join(ROOT, "library", "effects");
export type Canvas = "reel" | "youtube";

export const effectList = (canvas: Canvas) =>
  cards
    .filter((c) => c.sample && (canvas === "youtube" ? c.layouts.some((l) => l === "side" || l === "over" || l === "media") || c.tier === "overlay" : true))
    .map((c) => ({ id: c.id, kind: c.kind, purpose: c.purpose, summary: c.summary, thumb: `effects/${canvas}/${c.id}.jpg` }));

// A one-shot plan showing the card with every part revealed.
function previewPlan(cardId: string, canvas: Canvas): Resolved {
  const card = cards.find((c) => c.id === cardId)!;
  const v = card.sample!.visual;
  const n = Math.max(1, visualAnchors(v).length);
  const times = Array.from({ length: n }, (_, i) => 0.3 + i * 0.3);
  const duration = times[times.length - 1] + 2;
  const youtube = canvas === "youtube";
  const layout = youtube ? (card.tier === "overlay" ? "over" : "side") : "split";
  const shot: ResolvedShot = { start: 0, end: duration, layout, visual: { ...v, times }, anchor: card.id, header: youtube ? undefined : card.sample!.header };
  return {
    slug: "",
    title: card.id,
    duration,
    fps: 30,
    video: "",
    videoSize: youtube ? [1920, 1080] : [1080, 1920],
    audio: null,
    face: { x: 0.5, y: 0.3, h: 0.17 },
    grade: { brightness: 1, contrast: 1, saturate: 1 },
    split: "half",
    canvas,
    captions: false,
    shots: [shot],
    chunks: [],
    sfx: [],
  };
}

export function renderEffectPreviews(canvas: Canvas, force = false, log?: Log) {
  const dir = join(EFFECTS, canvas);
  mkdirSync(dir, { recursive: true });
  const list = effectList(canvas);
  for (const e of list) {
    const out = join(dir, `${e.id}.jpg`);
    if (existsSync(out) && !force) continue;
    const plan = previewPlan(e.id, canvas);
    const props = join(dir, ".props.json");
    writeJson(props, plan);
    run("npx", ["remotion", "still", "effects/index.ts", canvas === "youtube" ? "Wide" : "Reel", out, `--props=${props}`,
      `--frame=${Math.round(plan.duration * 30) - 2}`, `--scale=${canvas === "youtube" ? 0.25 : 0.2}`, "--log=error"], { log });
  }
  return list.length;
}
