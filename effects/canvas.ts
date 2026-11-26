import type { Resolved, ResolvedShot } from "../engine/schema";

// Which composition renders a plan, and at what size.
export const compositionFor = (canvas: "reel" | "youtube" | undefined) =>
  canvas === "youtube" ? { id: "Wide", width: 1920, height: 1080 } : { id: "Reel", width: 1080, height: 1920 };

// The shot active at `time`, falling back to the last shot at or past the end so the final frame
// never flashes shot 0.
export const shotAt = (shots: ResolvedShot[], time: number): { index: number; shot: ResolvedShot | undefined } => {
  if (!shots.length) return { index: -1, shot: undefined };
  const found = shots.findIndex((s) => time >= s.start && time < s.end);
  const index = found >= 0 ? found : time < shots[0].start ? 0 : shots.length - 1;
  return { index, shot: shots[index] };
};

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
