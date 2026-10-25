import React from "react";
import { isFrame } from "./frame";
import { H, MEDIA, splitGeom, t } from "./theme";
import { pal, SCENE } from "./soft";
import { look, style } from "./style";
import type { Chunk, Resolved, ResolvedShot } from "../engine/schema";

const clean = (s: string) => s.replace(/^["“'(]+|["”,.;:)]+$/g, "");

// Small words never get the big keyword treatment: the last content word holds instead.
const FILLER = new Set("a an the and or but so to of in on at by for with from as is are was were be been it its it's this that these those i you we they he she me my our your their them us if then than there here what which who how do does did can will would just really very also into onto about up out not no that's what's there's here's i'm i'll you're you'll we're they're going".split(" "));
export const isKeyword = (text: string) => {
  const w = text.replace(/^["“'(]+|["”,.;:!?)]+$/g, "").toLowerCase();
  return w.length > 0 && !FILLER.has(w);
};

// Captions hard-swap, with no pop, and appear two frames before the first word
// (the timing is set in engine/resolve.ts). Their look depends on what is behind them:
// ink on the canvas, white with a soft shadow on the speaker, large serif on full visuals.
export const Captions: React.FC<{ r: Resolved; shot: ResolvedShot; time: number }> = ({ r, shot, time }) => {
  const chunk: Chunk | undefined = r.chunks.find((c) => time >= c.start && time < c.end);
  if (!chunk) return null;

  // In the 50/50 split the caption sits on the speaker's half; in the inset it sits on the canvas seam.
  const onCanvas = shot.layout === "media" || (shot.layout === "split" && r.split === "inset");
  const serifAll = shot.layout === "media";
  // On a scene the headline leads; the caption sits low and quieter, in the scene's ink.
  const scene = shot.layout === "scene";
  const c = pal(shot.tone);
  // On the speaker the caption sits on the chest, below the chin and clear of the mouth.
  // face.h is the head's height, so the chin sits half of it below the centre.
  // Landscape footage is framed with the face a third down (see Speaker), portrait keeps its own framing.
  const faceY = r.videoSize[0] > r.videoSize[1] ? 0.36 : r.face.y;
  const chin = (faceY + r.face.h * 0.5) * H;
  const y =
    shot.layout === "split"
      ? splitGeom(r.split).seam
      : scene
        ? SCENE.caption
        : shot.layout === "media"
        ? MEDIA.caption
        : shot.layout === "cutaway"
          ? 1480
          : shot.layout === "punch"
          ? Math.min(H - 420, (0.3 + 0.5 * 0.5) * H + 110)
          : Math.min(H - 420, chin + 170);

  // Keyword captions (Ivory): the one word being said, big, heavy and lowercase, in warm ivory on
  // the speaker or ink on paper. An accent word is set in Signifier italic. Sized to fit the width.
  if (look.captions === "keyword") {
    // A chapter card is its own big word: no caption over it.
    // So is a full-frame counter or chapter hit: the number or title on screen is the word.
    if (shot.visual?.kind === "chapter" || isFrame(shot)) return null;
    // The latest content word said so far, across chunks; filler words hold the previous one.
    const said = r.chunks.flatMap((ch) => ch.words).filter((w) => time >= w.start - 2 / 30 && w.start >= shot.start - 0.05 && isKeyword(w.text));
    const now = said[said.length - 1];
    if (!now || time > now.end + 1.2) return null;
    const word = clean(now.text).toLowerCase();
    const onPaper = onCanvas || scene;
    // On the speaker: the near-white used for type on green. An accent word keeps the same face and
    // weight and changes colour only (sage on footage), never switching to the serif.
    const ink = now.accent ? (onPaper ? c.accentText : style.color.dark.accent) : scene ? c.ink : onCanvas ? t.ink : style.color.dark.ink;
    // On an inset split the caption sits in the 150 px gap between the panel and the speaker's window:
    // at 170 px its descenders ran into the window (Owain, 2026-10-25: "some text was misaligned").
    // On a 50/50 split the caption sits on the seam between the halves, in a dark pill, clear of
    // Instagram's caption and buttons at the bottom (it used to sit low on the speaker, at y 1790).
    const seamPill = shot.layout === "split" && r.split === "half";
    const cap = shot.layout === "split" && r.split === "inset" ? 84 : seamPill ? 76 : 170;
    const size = Math.min(cap, (1080 - 180) / Math.max(3, word.length * style.font.sansWidth));
    return (
      <div style={{ position: "absolute", left: 90, right: 90, top: seamPill ? splitGeom("half").speaker.top : y, translate: "0 -50%", textAlign: "center" }}>
        <span
          style={{
            fontFamily: t.sans,
            fontWeight: 800,
            fontSize: size,
            letterSpacing: -size * 0.045,
            lineHeight: 1,
            color: seamPill ? (now.accent ? style.color.dark.accent : style.color.dark.ink) : ink,
            textShadow: onPaper || seamPill ? "none" : "0 2px 24px rgba(0,0,0,0.35)",
            ...(seamPill ? { display: "inline-block", padding: `${size * 0.18}px ${size * 0.42}px ${size * 0.24}px`, borderRadius: size * 0.32, background: "rgba(26,25,24,0.88)", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" } : {}),
          }}
        >
          {word}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: 90,
        top: y,
        translate: "0 -50%",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        gap: "0 20px",
        textAlign: "center",
      }}
    >
      {chunk.words.map((w, i) => {
        // Accent words stand alone as a beat (see chunkWords) but keep the caption's face; on paper
        // and scenes they take the accent colour. Media captions are the display serif, upright.
        const serif = serifAll;
        const accent = w.accent && (scene || onCanvas);
        return (
          <span
            key={i}
            style={{
              fontFamily: serif ? t.display : t.sans,
              fontWeight: serif ? 400 : 700,
              fontSize: scene ? 56 : serifAll ? 108 : 74,
              letterSpacing: serif ? 108 * style.type.display.tracking : scene ? -1 : -1.8,
              lineHeight: 1.04,
              color: accent ? c.accentText : scene ? c.ink : onCanvas ? t.ink : "#FFFFFF",
              opacity: scene && !accent ? 0.82 : 1,
              textShadow: onCanvas || scene ? "none" : "0 2px 18px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            {clean(w.text)}
          </span>
        );
      })}
    </div>
  );
};
