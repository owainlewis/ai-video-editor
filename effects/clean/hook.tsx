// The clean style's text hook (Owain, 2026-11-11; geometry in engine/resolve.ts, HOOK): one headline
// at the top of the frame from the first frame, set as written, with its one *marked* phrase in
// Signifier italic sage. It cuts in and out with no fade. On a split it sits on the top of the panel,
// which starts again below it; over the speaker it sits in the top third on a soft scrim, its type
// sized to keep two lines above his brow.
import React from "react";
import { HOOK, HOOK_BAND, hookParts } from "../../engine/resolve";
import type { Resolved, ResolvedShot } from "../../engine/schema";
import { faceRect } from "../Speaker";
import { PALETTES, SERIF, W } from "./kit";
import { display, GREEN, WHITE } from "./text";

// A shot the hook is on screen in. A split among them keeps its panel below the hook's band for the
// whole shot, so nothing jumps when the hook cuts out.
export const underHook = (r: Resolved, s: ResolvedShot) => !!r.hook && s.start < r.hook.until;

// The part of the head the hook keeps off: the brow down to the chin.
const BROW = 0.3;

export const Hook: React.FC<{ r: Resolved; shot: ResolvedShot; time: number; faceless: boolean }> = ({ r, shot, time, faceless }) => {
  if (!r.hook || time >= r.hook.until) return null;
  const footage = shot.layout === "full" || shot.layout === "over" || shot.layout === "cutaway";
  const paper = shot.layout === "card" && shot.bg === "paper";
  // Sage is too light on paper; there the phrase is set apart by its face alone. On the stage the hook
  // takes the palette; over footage it is white.
  const pal = PALETTES[r.palette ?? "forest"];
  const [color, accent] = paper ? [GREEN, GREEN] : footage ? [WHITE, PALETTES.forest.accent] : [pal.text, pal.accent];
  const head = shot.layout === "full" && !shot.picture && !faceless ? faceRect({ ...r, split: "half" }, shot, time) : undefined;
  const face = head && { left: head.left, top: head.top + head.height * BROW, width: head.width, height: head.height * (1 - BROW) };
  const room = face ? face.top - 24 - HOOK.top : Infinity;
  const size = Math.max(56, Math.min(HOOK.size, room / (HOOK.lines * HOOK.lineHeight)));
  return (
    <>
      {shot.layout === "split" && <div data-qc="hook-plate" style={{ position: "absolute", left: 0, top: 0, width: W, height: HOOK_BAND, background: pal.stage }} />}
      {footage && <div data-qc="hook-plate" style={{ position: "absolute", left: 0, top: 0, width: W, height: HOOK_BAND + 260, background: "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.38) 55%, rgba(0,0,0,0))" }} />}
      {face && <div data-qc="face" style={{ position: "absolute", ...face }} />}
      <div
        data-qc="hook"
        style={{
          position: "absolute",
          left: (W - HOOK.width) / 2,
          width: HOOK.width,
          top: HOOK.top,
          ...display(size),
          lineHeight: HOOK.lineHeight,
          textTransform: "none",
          textAlign: "center",
          textWrap: "balance",
          color,
          ...(footage ? { textShadow: "0 2px 22px rgba(0,0,0,0.55)" } : {}),
        }}
      >
        {hookParts(r.hook.text).map((p, i) =>
          i % 2 ? (
            <span key={i} style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: "1.08em", lineHeight: HOOK.lineHeight / 1.08, letterSpacing: -1, color: accent }}>
              {p}
            </span>
          ) : (
            p
          ),
        )}
      </div>
    </>
  );
};
