// The filmstrip the editor's timeline draws each clip with: a small file in the clip's build folder,
// made in the background with ffmpeg the first time the editor asks and again only when the clip's
// preview changes. It never blocks a request: the server answers at once, and a status event brings
// the editor back once it is drawn.
import { existsSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Strip } from "../app/film.ts";
import { clipDir } from "./bin.ts";
import { ffmpegProgress, probeSize, probeVideoDuration, readJson, writeJson } from "./tools.ts";

// Tall enough for a sharp 40 px track on a Retina screen.
export const STRIP_HEIGHT = 80;
// JPEG stops at 65,535 px wide; keep well under, and keep the file small.
const MAX_STRIP_WIDTH = 32000;
const MAX_TILES = 600;

// How often a strip takes a frame: every second where it fits, sparser for a long clip.
export function stripPlan(duration: number, aspect: number): { every: number; width: number; count: number } {
  const width = Math.max(8, Math.round(STRIP_HEIGHT * aspect));
  const most = Math.max(1, Math.min(MAX_TILES, Math.floor(MAX_STRIP_WIDTH / width)));
  const every = Math.max(1, Math.ceil(duration / most));
  return { every, width, count: Math.max(1, Math.ceil(duration / every)) };
}

const busy = new Set<string>();

// A clip's strip if it is made and current, else null. `made` is the preview's time when the strip was drawn.
export function stripInfo(dir: string, id: string, path: string): Strip | null {
  const at = clipDir(dir, id);
  const preview = join(at, "build/preview.mp4");
  const json = join(at, "build/strip.json");
  if (!existsSync(preview) || !existsSync(json) || !existsSync(join(at, "build/strip.jpg"))) return null;
  try {
    const s = readJson<Omit<Strip, "file"> & { made: number }>(json);
    if (s.made !== statSync(preview).mtimeMs) return null;
    return { file: `${path}/build/strip.jpg?v=${Math.round(s.made)}`, every: s.every, width: s.width, height: s.height, count: s.count };
  } catch {
    return null;
  }
}

// Draws a clip's strip in the background unless it is current or already being drawn. Resolves true
// when a new strip was written.
export async function makeStrip(dir: string, id: string): Promise<boolean> {
  const at = clipDir(dir, id);
  const preview = join(at, "build/preview.mp4");
  if (!existsSync(preview) || busy.has(preview) || stripInfo(dir, id, "")) return false;
  busy.add(preview);
  try {
    const made = statSync(preview).mtimeMs;
    const [w, h] = probeSize(preview);
    const duration = probeVideoDuration(preview);
    const plan = stripPlan(duration, w / h);
    const tmp = join(at, "build/strip.tmp.jpg");
    // ffmpeg in the background, so the server keeps answering while it works.
    await ffmpegProgress([
      "-i", preview,
      "-vf", `fps=1/${plan.every}:start_time=0,scale=${plan.width}:${STRIP_HEIGHT},tile=${plan.count}x1`,
      "-frames:v", "1", "-q:v", "5", tmp,
    ], duration, () => {});
    renameSync(tmp, join(at, "build/strip.jpg"));
    writeJson(join(at, "build/strip.json"), { made, ...plan, height: STRIP_HEIGHT });
    return true;
  } catch {
    return false;
  } finally {
    busy.delete(preview);
  }
}
