// The gallery wall and the floating pages in the clean kit (engine/gallery.ts places and times them).
// Both are real captures, set full bleed in the split's top: the colour of a reel comes from the real
// products, the frame round them stays plain.
import React from "react";
import { Img, staticFile } from "remotion";
import type { ResolvedVisual } from "../../engine/schema";
import { FLOAT, floatBeats, floatPlaces, GALLERY, galleryBeats, galleryTiles } from "../../engine/gallery";
import { k, lerp, move } from "./kit";

type GalleryV = Extract<ResolvedVisual, { kind: "gallery" }>;
type FloatV = Extract<ResolvedVisual, { kind: "float" }>;

const url = (src: string, slug?: string) => (src.startsWith("data:") || /^https?:/.test(src) ? src : staticFile(`${slug}/${src}`));

// A capture shown from its top, as a page is first seen: its hero, not its footer.
const Shot: React.FC<{ src: string; slug?: string; radius: number; shadow?: string }> = ({ src, slug, radius, shadow }) => (
  <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", boxShadow: shadow, background: "#FFFFFF" }}>
    <Img src={url(src, slug)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", display: "block" }} />
  </div>
);

export const GalleryView: React.FC<{ v: GalleryV; time: number; start: number; w: number; h: number; slug?: string }> = ({ v, time: t, start, w, h, slug }) => {
  const tiles = galleryTiles(v.items.length, w, h);
  const b = galleryBeats(v, start, v.times);
  const f = v.focus ? v.focus.item - 1 : -1;
  const grow = b.focus !== undefined ? move(t, b.focus, GALLERY.focus) : 0;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {v.items.map((it, i) => {
        const on = k(t, b.tiles[i], GALLERY.land);
        const tile = tiles[i];
        // The focused tile grows to the whole panel; the others fall back and fade under it.
        const box = i === f ? { x: lerp(tile.x, 0, grow), y: lerp(tile.y, 0, grow), w: lerp(tile.w, w, grow), h: lerp(tile.h, h, grow) } : tile;
        const away = i === f ? 0 : grow;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              zIndex: i === f ? 2 : 1,
              opacity: on * (1 - away * 0.9),
              transform: `scale(${lerp(0.92, 1, on) * (1 - away * 0.04)})`,
            }}
          >
            <Shot src={it.src} slug={slug} radius={lerp(8, 0, grow * (i === f ? 1 : 0))} />
          </div>
        );
      })}
    </div>
  );
};

export const FloatView: React.FC<{ v: FloatV; time: number; start: number; w: number; h: number; slug?: string }> = ({ v, time: t, start, w, h, slug }) => {
  const places = floatPlaces(v.items.length);
  const times = floatBeats(v, start, v.times);
  // The whole stack pushes in slowly for the length of the shot.
  const push = 1 + FLOAT.push * Math.max(0, t - start);
  const order = places.map((p, i) => ({ p, i })).sort((a, b) => b.p.z - a.p.z);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* The perspective sits on the pages' own parent: a transform between them would flatten them. */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "50% 50%", perspective: 1400, perspectiveOrigin: "50% 40%" }}>
        {order.map(({ p, i }) => {
          const fly = move(t, times[i], FLOAT.fly);
          const pw = p.w * w, ph = pw * 0.62;
          // Each page drifts on its own slow path, the back ones less: parallax.
          const life = Math.max(0, t - times[i]);
          const drift = (1 - p.z * 0.6) * 10;
          const dx = Math.sin(life * 0.55 + i * 1.7) * drift, dy = Math.cos(life * 0.45 + i * 2.3) * drift;
          const depth = lerp(-900, -p.z * 260, fly);
          const dim = 1 - p.z * 0.22;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x * w - pw / 2 + dx,
                top: p.y * h - ph / 2 + dy + (1 - fly) * 120,
                width: pw,
                height: ph,
                opacity: Math.min(1, fly * 1.6),
                transform: `translateZ(${depth}px) rotateY(${p.turn}deg) rotateX(${4 - p.z * 3}deg)`,
              }}
            >
              <Shot src={v.items[i].src} slug={slug} radius={14} shadow="0 18px 50px rgba(17,17,17,0.22), 0 2px 6px rgba(17,17,17,0.08)" />
              {/* Back pages are dimmed by a veil, not a CSS filter: filters on 3D layers of full-size
                  captures stall the headless renderer past its frame timeout. */}
              <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: `rgba(17,17,17,${(1 - dim).toFixed(3)})` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
