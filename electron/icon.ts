// The menu bar icon, drawn here instead of kept as an image file: a 9:16 frame (a reel) with a play
// mark, in black with alpha so macOS tints it for light and dark menu bars (a template image).
// Returns BGRA pixels at 2x for nativeImage.createFromBitmap. The app icon below draws the same mark.
import { crc32, deflateSync } from "node:zlib";

const SIZE = 18; // points, the menu bar's icon size
const SCALE = 2;
const SAMPLES = 4; // per axis, for smooth edges

// Signed distance to a rounded rectangle centred at (cx, cy).
function roundRect(x: number, y: number, cx: number, cy: number, w: number, h: number, r: number) {
  const qx = Math.abs(x - cx) - w / 2 + r;
  const qy = Math.abs(y - cy) - h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Signed distance to a triangle (negative inside), from its three corners.
function triangle(x: number, y: number, p: [number, number][]) {
  let d = Infinity;
  let inside = true;
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = p[i];
    const [bx, by] = p[(i + 1) % 3];
    const ex = bx - ax;
    const ey = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, y - ay - ey * t));
    if (ex * (y - ay) - ey * (x - ax) < 0) inside = false;
  }
  return inside ? -d : d;
}

// Coverage of the mark at a point, in points: the frame's outline plus the play mark inside it.
function ink(x: number, y: number) {
  const frame = roundRect(x, y, 9, 9, 10, 15.5, 2.6);
  const outline = Math.abs(frame + 0.75) - 0.75; // a 1.5 pt stroke on the inside of the frame
  const play = triangle(x, y, [[7.2, 6.2], [12.4, 9], [7.2, 11.8]]);
  return Math.min(outline, play) <= 0 ? 1 : 0;
}

// ---- The app icon: the same mark, white with the play in the editor's accent, on a graphite tile ----

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const TOP = [44, 44, 50];
const BOTTOM = [22, 22, 24];
const WHITE = [246, 246, 248];
const ACCENT = [91, 108, 240];

// RGBA pixels of the icon at `size` px, on Apple's grid: an 824 tile in a 1024 canvas.
export function appIconPixels(size: number) {
  const out = Buffer.alloc(size * size * 4);
  const k = 1024 / size; // canvas units per pixel
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) * k;
      const y = (j + 0.5) * k;
      const edge = (d: number) => clamp(0.5 - d / k); // coverage of a shape at signed distance d
      const tile = edge(roundRect(x, y, 512, 512, 824, 824, 185));
      if (!tile) continue;
      let c = mix(TOP, BOTTOM, clamp((y - 100) / 824));
      const frame = roundRect(x, y, 512, 512, 330, 540, 70);
      c = mix(c, WHITE, edge(Math.abs(frame + 22) - 22));
      c = mix(c, ACCENT, edge(triangle(x, y, [[448, 420], [612, 512], [448, 604]])));
      const p = (j * size + i) * 4;
      out[p] = Math.round(c[0]);
      out[p + 1] = Math.round(c[1]);
      out[p + 2] = Math.round(c[2]);
      out[p + 3] = Math.round(255 * tile);
    }
  return out;
}

// A PNG file from RGBA pixels: no image tools needed to build the app.
export function png(rgba: Buffer, size: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let j = 0; j < size; j++) rgba.copy(rows, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

export function trayBitmap() {
  const px = SIZE * SCALE;
  const out = Buffer.alloc(px * px * 4);
  for (let j = 0; j < px; j++)
    for (let i = 0; i < px; i++) {
      let hit = 0;
      for (let sj = 0; sj < SAMPLES; sj++)
        for (let si = 0; si < SAMPLES; si++) hit += ink((i + (si + 0.5) / SAMPLES) / SCALE, (j + (sj + 0.5) / SAMPLES) / SCALE);
      out[(j * px + i) * 4 + 3] = Math.round((255 * hit) / (SAMPLES * SAMPLES)); // B, G, R stay 0: black
    }
  return { buffer: out, width: px, height: px, scaleFactor: SCALE };
}
