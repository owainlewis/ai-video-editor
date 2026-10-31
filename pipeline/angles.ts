// Which picture plays when. While OBS shows the talking head scene we use the camera (sharper,
// graded); when OBS shows the screen we use the screen recording, which carries its own camera inset.

import type { Range } from "./sift.ts";

export type Angle = "camera" | "screen";
export type Segment = Range & { angle: Angle };

export const LIKE_CAMERA = 0.7; // screen frames this alike to the camera are the talking head scene

// One angle per second, with one-second blips smoothed away.
export function perSecond(scores: number[]): Angle[] {
  const raw = scores.map((s) => (s >= LIKE_CAMERA ? "camera" : "screen") as Angle);
  return raw.map((a, i) => (i > 0 && i < raw.length - 1 && raw[i - 1] === raw[i + 1] ? raw[i - 1] : a));
}

// Split each kept range wherever the angle changes.
export function assign(keeps: Range[], angles: Angle[]): Segment[] {
  const at = (t: number) => angles[Math.min(Math.floor(t), angles.length - 1)] ?? "camera";
  const out: Segment[] = [];
  for (const k of keeps) {
    let start = k.start;
    let angle = at(start);
    for (let s = Math.floor(k.start) + 1; s < k.end; s++) {
      if (at(s) !== angle) {
        out.push({ start, end: s, angle });
        (start = s), (angle = at(s));
      }
    }
    out.push({ start, end: k.end, angle });
  }
  return out;
}
