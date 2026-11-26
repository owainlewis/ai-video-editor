// How the timeline draws the film itself: frames along a clip, and the shape of its voice. Pure, so
// the maths is tested apart from the drawing (tests/strip.test.ts).

// A filmstrip (media/strip.ts): one row of frames, `width` x `height` px each, one every `every`
// seconds of the clip from 0, so the frame for time t is tile floor(t / every).
export type Strip = { file: string; every: number; width: number; height: number; count: number };

// The frames along a segment that plays its clip from `inSec`, `boxWidth` px wide at `pps` pixels a
// second, each frame `height` px high in its own shape. Frames sit side by side from the segment's
// left edge; each shows the clip at the time under its left edge. `x` is where it sits in the
// segment, `pos` the background offset that shows its tile.
export function stripTiles(s: Pick<Strip, "every" | "width" | "height" | "count">, inSec: number, boxWidth: number, pps: number, height: number) {
  const tile = (s.width * height) / s.height;
  const out: { x: number; pos: number }[] = [];
  if (!(tile > 0) || !(pps > 0)) return { tile, tiles: out };
  for (let x = 0; x < boxWidth; x += tile) {
    const t = inSec + x / pps;
    const i = Math.max(0, Math.min(s.count - 1, Math.floor(t / s.every)));
    out.push({ x, pos: -i * tile });
  }
  return { tile, tiles: out };
}

// A waveform as an SVG path in a box `w` x `h`, mirrored about its middle, from values 0 to 1 at
// `rate` a second, for the stretch [from, to) of them. About one point every 2 px.
export function wavePath(values: (i: number) => number, count: number, rate: number, from: number, to: number, w: number, h: number): string {
  if (w <= 0 || to <= from || count === 0) return "";
  const n = Math.max(2, Math.min(2000, Math.round(w / 2)));
  const top: string[] = [];
  const bottom: string[] = [];
  const mid = h / 2;
  for (let k = 0; k <= n; k++) {
    const t = from + ((to - from) * k) / n;
    // The loudest value in this step, so short peaks are not lost between points.
    // The last point reads the last value, not one past the end.
    const a = Math.max(0, Math.min(count - 1, Math.floor(t * rate)));
    const b = Math.min(count, Math.max(a + 1, Math.floor((t + (to - from) / n) * rate)));
    let v = 0;
    for (let i = a; i < b; i++) v = Math.max(v, values(i));
    const y = Math.max(0.5, Math.min(1, v) * mid);
    const x = ((w * k) / n).toFixed(1);
    top.push(`${x},${(mid - y).toFixed(1)}`);
    bottom.push(`${x},${(mid + y).toFixed(1)}`);
  }
  return `M${top.join("L")}L${bottom.reverse().join("L")}Z`;
}

// A clip's loudness (dB every 1 / rate s, as in build/level.json) as 0 to 1: silence (its quiet line
// less 12 dB) at 0, its loud speech at 1.
export const levelValue = (db: number[], quiet: number) => {
  const floor = quiet - 12;
  const top = quiet + 26;
  return (i: number) => Math.max(0, Math.min(1, (db[i] - floor) / (top - floor)));
};
