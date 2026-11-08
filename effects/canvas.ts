import type { Resolved } from "../engine/schema";

// Which composition renders a plan, and at what size.
export const compositionFor = (canvas: "reel" | "youtube" | undefined) =>
  canvas === "youtube" ? { id: "Wide", width: 1920, height: 1080 } : { id: "Reel", width: 1080, height: 1920 };

// A plan with no footage and nothing on it, to build on.
export const blank = (canvas: "reel" | "youtube"): Omit<Resolved, "title" | "duration" | "shots"> => ({
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
