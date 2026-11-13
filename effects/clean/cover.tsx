// The clean style's cover (Owain, 2026-11-11: "a very clean card" for the Instagram feed, in place of
// a first frame that catches him mid-motion). Frame 0 only: Owain's blank card (a portrait on a dark
// ground) starts at the top of the 3:4 band Instagram's grid shows and runs to the bottom of the frame,
// so the full reel never shows it stopping short ("cut off at the bottom", 2026-11-11). The title sits in
// two lines of white Helvetica over his shirt. With `logos` (2026-11-13, after a cover Owain made with an
// image model) the title moves to the top and up to two real logos sit in angled glass tiles either side
// of his head, never on it. Above the band, the card itself, blurred, so the top edge melts into it.
import React from "react";
import { Img, staticFile } from "remotion";
import { COVER } from "../../engine/resolve";
import type { Resolved } from "../../engine/schema";
import { H, SANS, W } from "./kit";

// The grid's 3:4 crop of the 9:16 frame: 1080 x 1440, centred.
export const BAND = { top: (H - (W * 4) / 3) / 2, height: (W * 4) / 3 };
const FEATHER = "linear-gradient(transparent, black 4%)";

// Where his head sits on the blank card, in frame pixels, measured on library/covers/owain.png as
// drawn below (ear to ear, crown to chin): the tiles stay clear of it and of the frame's edges.
// Remeasured for the black-ground card (2026-11-13), which sits his head lower with more room above.
const HEAD = { left: 310, right: 723, top: 705, bottom: 1197 };
// With no logos the title sits over his shirt, below the collar.
const SHIRT = 0.79;
const TILE = 240;
// Left tile beside his temple, right tile below his jaw over the shoulder, each turned a little.
const TILES = [
  { x: 52, y: HEAD.top + 80, turn: -10 },
  { x: 770, y: HEAD.bottom + 40, turn: 8 },
];

const Tile: React.FC<{ src: string; name?: string; x: number; y: number; turn: number }> = ({ src, name, x, y, turn }) => (
  <div
    data-qc="cover-tile"
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: TILE,
      height: TILE,
      transform: `rotate(${turn}deg)`,
      borderRadius: TILE * 0.18,
      background: "linear-gradient(160deg, rgba(38,38,40,0.92), rgba(14,14,15,0.94))",
      border: "2px solid rgba(255,255,255,0.32)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(255,255,255,0.28) inset, 0 0 46px rgba(255,236,214,0.16), 0 30px 60px rgba(0,0,0,0.55)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
    }}
  >
    <Img src={src} style={{ maxWidth: TILE * 0.8, maxHeight: name ? TILE * 0.42 : TILE * 0.52, objectFit: "contain" }} />
    {name && <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, letterSpacing: -1.5, color: "#FFFFFF" }}>{name}</div>}
  </div>
);

export const Cover: React.FC<{ cover: NonNullable<Resolved["cover"]> }> = ({ cover }) => {
  const logos = cover.logos ?? [];
  const top = logos.length ? BAND.top + 64 : BAND.top + BAND.height * SHIRT;
  return (
    <div data-qc="cover" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0B0C0D" }}>
      <Img src={staticFile(cover.image)} style={{ position: "absolute", inset: -120, width: W + 240, height: H + 240, objectFit: "cover", filter: "blur(60px) brightness(0.8)" }} />
      <Img data-qc="cover-card" src={staticFile(cover.image)} style={{ position: "absolute", left: 0, top: BAND.top, width: W, height: H - BAND.top, objectFit: "cover", objectPosition: "50% 0%", maskImage: FEATHER, WebkitMaskImage: FEATHER }} />
      {logos.map((l, i) => <Tile key={i} src={l.src} name={l.name} {...TILES[i]} />)}
      <div
        style={{
          position: "absolute",
          left: (W - COVER.width) / 2,
          width: COVER.width,
          top,
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: COVER.size,
          lineHeight: 1.04,
          letterSpacing: -COVER.size * 0.0625,
          textAlign: "center",
          textWrap: "balance",
          color: "#FFFFFF",
          textShadow: "0 2px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* Typeset quotes, as in Owain's example ("Google’s"). */}
        {cover.title.replace(/'/g, "’")}
      </div>
    </div>
  );
};
