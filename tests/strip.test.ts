import { describe, expect, it } from "vitest";
import { levelValue, stripTiles, wavePath } from "../app/film.ts";
import { STRIP_HEIGHT, stripPlan } from "../media/strip.ts";

describe("filmstrip plan", () => {
  it("takes a frame a second for a reel", () => {
    expect(stripPlan(47, 9 / 16)).toEqual({ every: 1, width: 45, count: 47 });
  });
  it("takes frames further apart for a long video, so the strip stays a sane width", () => {
    const p = stripPlan(3600, 16 / 9);
    expect(p.every).toBeGreaterThan(1);
    expect(p.count * p.width).toBeLessThanOrEqual(32000);
    expect(p.count * p.every).toBeGreaterThanOrEqual(3600);
    expect(p.width).toBe(Math.round(STRIP_HEIGHT * (16 / 9)));
  });
});

describe("filmstrip tiles", () => {
  const strip = { every: 1, width: 45, height: 80, count: 47 };
  it("lays frames side by side at the track's height, each showing the time under its left edge", () => {
    // At 40 px high a tile is 22.5 px wide. At 10 px a second the second tile's edge is 2.25 s in.
    const { tile, tiles } = stripTiles(strip, 5, 60, 10, 40);
    expect(tile).toBe(22.5);
    expect(tiles.map((t) => t.x)).toEqual([0, 22.5, 45]);
    // 5 s, 7.25 s, 9.5 s: tiles 5, 7 and 9.
    expect(tiles.map((t) => -t.pos / tile)).toEqual([5, 7, 9]);
  });
  it("holds the last frame past the end of the strip", () => {
    const { tiles, tile } = stripTiles(strip, 46.5, 50, 10, 40);
    expect(tiles.every((t) => -t.pos / tile <= 46)).toBe(true);
  });
  it("draws nothing for a broken strip", () => {
    expect(stripTiles({ ...strip, width: 0 }, 0, 100, 10, 40).tiles).toEqual([]);
  });
});

describe("waveforms", () => {
  it("draws a closed path mirrored about the middle", () => {
    const d = wavePath(() => 1, 100, 10, 0, 10, 20, 10);
    expect(d.startsWith("M0.0,0.0")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("20.0,10.0");
  });
  it("keeps a short peak between points", () => {
    const values = Array.from({ length: 1000 }, (_, i) => (i === 503 ? 1 : 0));
    const d = wavePath((i) => values[i], values.length, 100, 0, 10, 20, 10);
    expect(d).toMatch(/,0\.0/);
  });
  it("draws nothing with no room or no values", () => {
    expect(wavePath(() => 1, 0, 10, 0, 1, 20, 10)).toBe("");
    expect(wavePath(() => 1, 10, 10, 0, 1, 0, 10)).toBe("");
  });
  it("maps a clip's quiet line to near silence and loud speech to full", () => {
    const v = levelValue([-80, -46, -8, 0], -34);
    expect(v(0)).toBe(0);
    expect(v(1)).toBe(0);
    expect(v(2)).toBe(1);
    expect(v(3)).toBe(1);
  });
});
