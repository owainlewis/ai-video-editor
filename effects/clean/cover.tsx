// The clean style's cover (Owain, 2026-11-11: "a very clean card" for the Instagram feed, in place of
// a first frame that catches him mid-motion). Frame 0 only: Owain's blank card (a portrait on a dark
// ground) starts at the top of the 3:4 band Instagram's grid shows and runs to the bottom of the frame,
// so the full reel never shows it stopping short ("cut off at the bottom", 2026-11-11). The title sits in
// two lines of white Helvetica over his shirt. No logos ("they look bad. Just text for now"). Above the
// band, the card itself, blurred, so the top edge melts into it whatever its ground.
import React from "react";
import { Img, staticFile } from "remotion";
import { COVER } from "../../engine/resolve";
import type { Resolved } from "../../engine/schema";
import { H, SANS, W } from "./kit";

// The grid's 3:4 crop of the 9:16 frame: 1080 x 1440, centred.
export const BAND = { top: (H - (W * 4) / 3) / 2, height: (W * 4) / 3 };
const FEATHER = "linear-gradient(transparent, black 4%)";

export const Cover: React.FC<{ cover: NonNullable<Resolved["cover"]> }> = ({ cover }) => (
  <div data-qc="cover" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0B0C0D" }}>
    <Img src={staticFile(cover.image)} style={{ position: "absolute", inset: -120, width: W + 240, height: H + 240, objectFit: "cover", filter: "blur(60px) brightness(0.8)" }} />
    <Img data-qc="cover-card" src={staticFile(cover.image)} style={{ position: "absolute", left: 0, top: BAND.top, width: W, height: H - BAND.top, objectFit: "cover", objectPosition: "50% 0%", maskImage: FEATHER, WebkitMaskImage: FEATHER }} />
    <div
      style={{
        position: "absolute",
        left: (W - COVER.width) / 2,
        width: COVER.width,
        top: BAND.top + BAND.height * 0.69,
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
