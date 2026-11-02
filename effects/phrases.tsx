// Phrase captions (2026-11-01, from a reel Owain sent): one to three words at a time, hard cut on the
// word, small for glue words and about twice the size for the words that carry the meaning. Warm
// cream Helvetica, a very soft shadow, no box, no dim. The reel caption style (2026-11-02: "full
// captions suit reels"); YouTube keeps text to key moments.
import React from "react";
import { t } from "./theme";
import { CREAM, SHADOW } from "./lockup";
import type { PhraseCap, Resolved } from "../engine/schema";

// Sizes as fractions of the frame's height, as in the reference reel: about 3% for glue words, about
// twice that for the rest.
const SMALL = 0.03;
const BIG = 0.064;
const PLACE = { upper: 0.2, middle: 0.5, lower: 0.8 };

// `y`: where an "auto" caption sits (the layout's own caption spot), as a fraction of the height.
export const PhraseCaptions: React.FC<{ r: Resolved; time: number; width: number; height: number; y?: number }> = ({ r, time, width, height, y = 0.8 }) => {
  const p: PhraseCap | undefined = r.phrases?.find((x) => time >= x.start && time < x.end);
  if (!p) return null;
  const size = height * (p.big ? BIG : SMALL);
  const top = p.place === "auto" ? y : PLACE[p.place];
  return (
    <div style={{ position: "absolute", left: width * 0.08, right: width * 0.08, top: height * top, transform: "translateY(-50%)", textAlign: "center", fontFamily: t.sans, fontWeight: 700, fontSize: size, lineHeight: 1.05, letterSpacing: -size * 0.03, color: CREAM, textShadow: SHADOW }}>
      {p.text}
    </div>
  );
};
