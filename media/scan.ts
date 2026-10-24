// Where the speaker is on camera in a YouTube video. Graphics go only there, never over b-roll or a
// screen recording (Owain, 2026-10-24). `frames` makes a contact sheet to pick talking-head moments
// from; `scan` compares every half second with those moments and writes build/camera.json, which
// `check` uses to reject graphics placed off camera.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cameraRanges } from "../engine/resolve.ts";
import { ffmpeg, type Log, writeJson } from "./tools.ts";

const source = (dir: string) => (existsSync(join(dir, "build/preview.mp4")) ? join(dir, "build/preview.mp4") : join(dir, "source/talking.mp4"));

// A frame every `every` seconds, stamped with its time, tiled into checks/frames-N.jpg sheets.
export function frameSheets(dir: string, every = 15, log?: Log): string[] {
  const out = join(dir, "checks/frames");
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) rmSync(join(out, f));
  ffmpeg(["-i", source(dir), "-vf", `fps=1/${every},scale=256:-2,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6:fontfile=/System/Library/Fonts/Helvetica.ttc`,
    "-fps_mode", "vfr", join(out, "%03d.jpg")], log);
  const n = readdirSync(out).length;
  const sheets: string[] = [];
  for (let start = 1, k = 1; start <= n; start += 54, k++) {
    const file = join(dir, "checks", `frames-${k}.jpg`);
    ffmpeg(["-start_number", String(start), "-i", join(out, "%03d.jpg"), "-frames:v", "1", "-vf", "tile=9x6:padding=4", file], log);
    sheets.push(file);
  }
  return sheets;
}

export function scanCamera(dir: string, refs: number[]) {
  if (!refs.length) throw new Error("scan needs --ref with a few times (seconds) where the speaker is on camera, e.g. --ref 6,1215");
  const rate = 2, W = 32, H = 18;
  const raw = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", source(dir), "-vf", `fps=${rate},scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  const n = Math.floor(raw.length / (W * H));
  const frame = (i: number) => raw.subarray(i * W * H, (i + 1) * W * H);
  const ref = refs.map((t) => frame(Math.min(n - 1, Math.round(t * rate))));
  const diff = (a: Uint8Array, b: Uint8Array) => a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0) / a.length;
  const ranges = cameraRanges(Array.from({ length: n }, (_, i) => Math.min(...ref.map((r) => diff(frame(i), r)))), rate);
  writeJson(join(dir, "build/camera.json"), { refs, rate, ranges });
  return ranges;
}
