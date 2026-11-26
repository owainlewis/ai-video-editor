// The gallery wall (`gallery`) and the floating pages (`float`): where each capture sits and when it
// lands. Pure, so the renderer (effects/clean/gallery.tsx), the sound and the tests agree.
import type { VisualSpec } from "./schema.ts";

type Gallery = Extract<VisualSpec, { kind: "gallery" }>;
type Float = Extract<VisualSpec, { kind: "float" }>;
export type Tile = { x: number; y: number; w: number; h: number };

export const GALLERY = { gap: 10, land: 0.35, focus: 0.55 };

// Columns and rows for a count: two by two, three by two, three by three. A short last row is centred.
export const galleryGrid = (n: number) => (n <= 4 ? { cols: 2, rows: 2 } : n <= 6 ? { cols: 3, rows: 2 } : { cols: 3, rows: 3 });

// Every tile's box in a w x h panel, edge to edge with thin gaps between (none at the frame's edge).
export const galleryTiles = (n: number, w: number, h: number): Tile[] => {
  const { cols, rows } = galleryGrid(n);
  const g = GALLERY.gap;
  const tw = (w - g * (cols - 1)) / cols, th = (h - g * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const shift = ((cols - inRow) * (tw + g)) / 2;
    return { x: shift + c * (tw + g), y: r * (th + g), w: tw, h: th };
  });
};

export const galleryAnchors = (v: Gallery) => [...v.items.map((it) => it.at), ...(v.focus ? [v.focus.at] : [])];

// Each tile lands on its time (the resolver cascades unanchored ones 0.12 s apart: a wave); the focus
// grows on its word, never before the last tile has landed.
export const galleryBeats = (v: Gallery, start: number, times: number[] = []) => {
  const tiles = v.items.map((_, i) => times[i] ?? start + i * 0.12);
  const last = Math.max(...tiles) + GALLERY.land;
  const focus = v.focus ? Math.max(times[v.items.length] ?? last, last) : undefined;
  return { tiles, focus };
};

export const galleryIssues = (v: Gallery): string[] =>
  v.focus && v.focus.item > v.items.length ? [`focus on item ${v.focus.item}, but the gallery has ${v.items.length}`] : [];

// The floating pages' places, as shares of the panel: x and y of each page's centre, its width, its
// depth (0 front, 1 back) and a slight turn. Back pages sit higher and smaller; the front ones overlap
// them, so the stack reads as depth, not as a grid.
const PLACES: { x: number; y: number; w: number; z: number; turn: number }[] = [
  { x: 0.36, y: 0.4, w: 0.54, z: 0.5, turn: 8 },
  { x: 0.73, y: 0.32, w: 0.48, z: 0.75, turn: -9 },
  { x: 0.6, y: 0.58, w: 0.56, z: 0, turn: -5 },
  { x: 0.17, y: 0.66, w: 0.42, z: 0.3, turn: 10 },
  { x: 0.87, y: 0.66, w: 0.4, z: 0.38, turn: -11 },
  { x: 0.46, y: 0.2, w: 0.38, z: 1, turn: 3 },
];
export const floatPlaces = (n: number) => {
  // Fewer pages take the strongest places, the front one last so it draws on top.
  const order = [[0, 1, 2], [0, 1, 3, 2], [0, 1, 3, 4, 2], [5, 0, 1, 3, 4, 2]][Math.min(3, Math.max(0, n - 3))];
  return order.map((k) => PLACES[k]);
};

export const floatAnchors = (v: Float) => v.items.map((it) => it.at);
export const floatBeats = (v: Float, start: number, times: number[] = []) => v.items.map((_, i) => times[i] ?? start + i * 0.12);
export const FLOAT = { fly: 0.7, push: 0.035 };
