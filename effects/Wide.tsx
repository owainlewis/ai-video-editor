import React from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, getRemotionEnvironment, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { shotAt } from "./canvas";
import { FrameVisual, isFrame } from "./frame";
import { easeInOut, lerp, MOVE, prog } from "./motion";
import { pal, SceneCanvas, softTheme, SoftThemeContext, type Tone, usePal } from "./soft";
import { clamp, ease, gradeFilter, t } from "./theme";
import { Accented, VisualView } from "./Visuals";
import { WordsOver } from "./house";
import type { Chunk, Resolved, ResolvedShot } from "../engine/schema";
import { lastKept } from "../engine/resolve";
import { CutVideo, Soundtrack } from "./cut";

// YouTube, 16:9. The picture is a rough cut Owain edited by hand; this only lays graphics and
// text over it, sparsely. Minimal: one idea on screen, monochrome plus one accent, serif titles,
// motion only to reveal. See references/README.md.
export const WW = 1920;
export const WH = 1080;

// The stage (Owain, 2026-10-25, from the motion lab): on a side shot the speaker shrinks into a
// portrait card on the right in one long-tailed move, the graphic builds beside it, and the card grows
// back to full frame as the shot ends. The card and the part of the picture it shows move on one
// curve, so it is one move, not a zoom and a pan.
const CARD = { x: WW - 64 - 500, y: 110, w: 500, h: 860 };
export const SIDE = { x: 110, y: 110, w: CARD.x - 80 - 110, h: WH - 220 };
export const MEDIA = { x: 160, y: 90, w: WW - 320, h: WH - 180 };
// The frame around a box, in the box's own units once scaled by `k`.
const roomOf = (b: { x: number; y: number; w: number; h: number }, k: number) => ({ l: b.x / k, t: b.y / k, r: (WW - b.x - b.w) / k, b: (WH - b.y - b.h) / k });
// The black theme (Owain, 2026-10-30): nothing hard cuts. Full-frame cards dissolve in and out over
// the picture, panels float as a dark rounded card over the picture blurred and dimmed behind it
// (after his own screen-recording shots, "this sick overlay style"), and `half` dissolves to a paper
// panel beside him (after Ross Harkness).
const FADE = 0.4;
const FLOAT = { x: 200, y: 110, w: WW - 400, h: WH - 220 };
const FLOAT_IN = { x: FLOAT.x + 90, y: FLOAT.y + 70, w: FLOAT.w - 180, h: FLOAT.h - 140 };
const HALF = { x: 150, y: 140, w: WW / 2 - 260, h: WH - 280 };
// Cards that fill the frame in black; every other kind floats.
// The house graphics fill the frame too: a floating card around big type is the look they replace.
const HOUSE = new Set(["words", "focus", "map", "shift"]);
const solid = (s: ResolvedShot) => s.visual?.kind === "chapter" || s.visual?.kind === "journey" || (s.visual?.kind === "title" && !!s.visual.cine) || HOUSE.has(s.visual?.kind ?? "");
const designed = (s?: ResolvedShot) => s?.layout === "media" || s?.layout === "half";
// How far in a black-theme shot is (0 the picture, 1 the graphic), fading at the edges it shares
// with the picture.
const fadeK = (shots: ResolvedShot[], i: number, time: number, s: ResolvedShot = shots[i]) => {
  const enter = designed(shots[i - 1]) && shots[i - 1].layout === s.layout ? 1 : prog(time, s.start, FADE, easeInOut);
  const leave = prog(time, s.end - FADE, FADE, easeInOut);
  return enter * (1 - leave);
};

// The width the shared visuals are designed at (the reel's panel).
const DESIGN_W = 900;

// How far into the card the speaker is (0 full frame, 1 card) on a side shot.
const stageK = (shots: ResolvedShot[], i: number, time: number) => {
  const s = shots[i];
  if (s?.layout !== "side") return 0;
  const enter = shots[i - 1]?.layout === "side" ? 1 : prog(time, s.start, MOVE, easeInOut);
  const leave = shots[i + 1]?.layout === "side" ? 0 : prog(time, s.end - MOVE, MOVE, easeInOut);
  return enter * (1 - leave);
};

// The footage. Exports read frames exactly (OffthreadVideo): the browser's own video decoder shifted
// the colour, which is what spoiled punch-ins (2026-10-24). The editor plays it live.
const Picture: React.FC<{ r: Resolved; style: React.CSSProperties }> = ({ r, style }) =>
  r.cut ? (
    <CutVideo r={r} style={style} />
  ) : getRemotionEnvironment().isRendering ? (
    // The render of one part: its flattened picture starts at the part's first frame.
    <Sequence from={r.pictureFrom ?? 0} layout="none">
      <OffthreadVideo src={staticFile(r.video)} muted style={{ position: "absolute", ...style }} />
    </Sequence>
  ) : (
    <Video src={staticFile(r.video)} muted={!!r.audio} style={{ position: "absolute", ...style }} />
  );

const Speaker: React.FC<{ r: Resolved; shot: ResolvedShot; k: number; dim: number; blur?: number }> = ({ r, shot, k, dim, blur = 0 }) => {
  const grade = `${gradeFilter(r.grade, dim)}${blur ? ` blur(${blur}px)` : ""}`;
  // Hidden behind a full-frame card or b-roll (on black, the backdrop draws it instead).
  if (shot.layout === "media" || shot.layout === "cutaway" || shot.layout === "half") return null;
  const box = { x: lerp(0, CARD.x, k), y: lerp(0, CARD.y, k), w: lerp(WW, CARD.w, k), h: lerp(WH, CARD.h, k) };
  // The part of the picture shown, in frame pixels: the whole frame, narrowing to a portrait slice
  // around the face.
  const srcW = lerp(WW, WH * (CARD.w / CARD.h), k);
  const scale = box.w / srcW;
  const srcH = box.h / scale;
  const srcX = Math.min(WW - srcW, Math.max(0, r.face.x * WW - srcW / 2));
  const srcY = Math.min(WH - srcH, Math.max(0, (WH - srcH) / 2));
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 24 * k, overflow: "hidden", background: "#121417", boxShadow: k > 0 ? `0 ${30 * k}px ${80 * k}px rgba(0,0,0,${0.5 * k})` : "none" }}>
      {(r.video || r.cut) && <Picture r={r} style={{ left: -srcX * scale, top: -srcY * scale, width: WW * scale, height: WH * scale, filter: grade }} />}
    </div>
  );
};

const reveal = (time: number, at: number, dur = 0.6) => interpolate(time, [at, at + dur], [0, 1], { ...clamp, easing: ease });

// A lower third on a small ivory paper card: serif title, sans line under it, a short pine rule
// that draws first. A card, not bare type, because Owain's videos are mostly screen shares on white
// pages, where light type with a shadow disappears (2026-10-24).
const Lower: React.FC<{ title: string; sub?: string; shot: ResolvedShot; time: number }> = ({ title, sub, shot, time }) => {
  const c = usePal("light");
  const card = reveal(time, shot.start, 0.5);
  const rule = reveal(time, shot.start + 0.1, 0.5);
  const a = reveal(time, shot.start + 0.2);
  const b = reveal(time, shot.start + 0.35);
  const out = interpolate(time, [shot.end - 0.4, shot.end], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        bottom: 96,
        padding: "30px 40px 32px",
        background: c.bg,
        border: `1px solid ${c.line}`,
        borderRadius: 14,
        boxShadow: "0 2px 6px rgba(0,0,0,0.18), 0 18px 48px rgba(0,0,0,0.22)",
        opacity: out * card,
        translate: `0 ${(1 - card) * 14}px`,
        color: c.ink,
      }}
    >
      <div style={{ width: 48, height: 3, background: c.accent, scale: `${rule} 1`, transformOrigin: "left", marginBottom: 20 }} />
      <div style={{ fontFamily: t.serif, fontSize: 56, lineHeight: 1.05, letterSpacing: -1, opacity: a, filter: `blur(${(1 - a) * 6}px)` }}>
        <Accented text={title} />
      </div>
      {sub && <div style={{ marginTop: 10, fontFamily: t.sans, fontWeight: 500, fontSize: 26, color: c.muted, opacity: b }}>{sub}</div>}
    </div>
  );
};

// A cinematic title over the picture: one small, tightly set serif line in the centre.
const OverTitle: React.FC<{ text: string; kicker?: string; shot: ResolvedShot; time: number }> = ({ text, kicker, shot, time }) => {
  const a = reveal(time, shot.start + 0.2, 0.8);
  const out = interpolate(time, [shot.end - 0.5, shot.end], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out }}>
      {kicker && <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: 22, letterSpacing: 8, textTransform: "uppercase", color: "rgba(236,238,241,0.7)", marginBottom: 22, opacity: a }}>{kicker}</div>}
      <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: 68, letterSpacing: -2, lineHeight: 1.05, color: "#ECEEF1", textAlign: "center", maxWidth: 1300, opacity: a, filter: `blur(${(1 - a) * 10}px)` }}>
        <Accented text={text} lift={1.2} />
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ chunk?: Chunk }> = ({ chunk }) =>
  !chunk ? null : (
    <div style={{ position: "absolute", left: 200, right: 200, bottom: 70, textAlign: "center", fontFamily: t.sans, fontWeight: 700, fontSize: 46, letterSpacing: -0.8, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6), 0 2px 18px rgba(0,0,0,0.4)" }}>
      {chunk.words.map((w) => w.text).join(" ")}
    </div>
  );

// The picture behind a black-theme card: as cut, blurred and dimmed while a floating card is up.
// Dimmed to near black so the card reads clean; a lighter dim left grey blotches (2026-11-02, "muddy").
const Backdrop: React.FC<{ r: Resolved; shots: ResolvedShot[]; index: number; time: number }> = ({ r, shots, index, time }) => {
  const s = shots[index];
  const enter = designed(shots[index - 1]) ? 1 : prog(time, s.start, FADE, easeInOut);
  const leave = designed(shots[index + 1]) ? 0 : prog(time, s.end - FADE, FADE, easeInOut);
  const k = s.layout === "media" ? enter * (1 - leave) : 0;
  return <Speaker r={r} shot={{ ...s, layout: "full" }} k={0} dim={1 - 0.86 * k} blur={60 * k} />;
};

// The half split: a paper panel with a faint grid on the left, the speaker's right half beside it.
const HalfStage: React.FC<{ r: Resolved; k: number; children: React.ReactNode }> = ({ r, k, children }) => {
  const srcX = Math.min(WW / 2, Math.max(0, r.face.x * WW - WW / 4));
  return (
    <AbsoluteFill style={{ opacity: k }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: WW / 2, height: WH, background: "#F6F5F2", overflow: "hidden" }}>
        <svg width={WW / 2} height={WH} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 17 }, (_, i) => <line key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={WH} stroke="rgba(17,17,17,0.05)" strokeWidth={1} />)}
          {Array.from({ length: 19 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 60} x2={WW / 2} y2={i * 60} stroke="rgba(17,17,17,0.05)" strokeWidth={1} />)}
        </svg>
        {children}
      </div>
      <div style={{ position: "absolute", left: WW / 2, top: 0, width: WW / 2, height: WH, overflow: "hidden", background: "#000" }}>
        {(r.video || r.cut) && <Picture r={r} style={{ left: -srcX, top: 0, width: WW, height: WH, filter: gradeFilter(r.grade) }} />}
      </div>
    </AbsoluteFill>
  );
};

export const Wide: React.FC<Resolved> = (r) => {
  const black = r.theme === "black";
  // Dark cards are neutral Black unless the whole video is the old Graphite theme (Owain, 2026-11-09).
  const theme = softTheme(true, black, r.theme !== "dark");
  const frame = useCurrentFrame();
  const time = frame / r.fps;
  const { index, shot } = shotAt(r.shots, time);
  if (!shot) return <AbsoluteFill style={{ background: r.alpha ? "transparent" : "#0E0E0D" }} />;
  // Paper by default: the shared visuals are drawn for it. "dark" suits the soft tech visuals.
  const tone: Tone = shot.tone ?? "light";
  const onCanvas = shot.layout === "side" || shot.layout === "media";
  // A cinematic title dims the picture a little so the line holds. No scrim, no gradient.
  const titled = shot.layout === "over" && (shot.visual?.kind === "title" || shot.visual?.kind === "words");
  const dim = titled ? interpolate(time, [shot.start, shot.start + 0.6, shot.end - 0.5, shot.end], [1, 0.62, 0.62, 1], clamp) : 1;

  return (
    <SoftThemeContext.Provider value={theme}>
    <AbsoluteFill style={{ background: r.alpha ? "transparent" : "#0E0E0D" }}>
      {black && !r.alpha && designed(shot) && <Backdrop r={r} shots={r.shots} index={index} time={time} />}
      {black && shot.layout === "media" && shot.visual && solid(shot) && (
        <AbsoluteFill style={{ opacity: fadeK(r.shots, index, time) }}>
          <SceneCanvas tone={tone} time={time} width={WW} height={WH} />
        </AbsoluteFill>
      )}
      {!black && onCanvas && <SceneCanvas tone={tone} time={time} width={WW} height={WH} />}
      {r.shots.map((head, i) => {
        const visual = head.visual;
        if (!visual || head.keep) return null;
        const last = lastKept(r.shots, i);
        const s = { ...head, end: r.shots[last].end };
        const from = Math.round(s.start * r.fps);
        const dur = Math.max(1, Math.round(s.end * r.fps) - from);
        if (s.layout === "cutaway")
          return (
            <Sequence key={i} from={from} durationInFrames={dur} premountFor={15} name={`${i + 1} cutaway`}>
              <VisualView slug={r.slug} shot={s} time={time} w={WW} h={WH} v={visual} bleed />
            </Sequence>
          );
        if (isFrame(s))
          return (
            <Sequence key={i} from={from} durationInFrames={dur} premountFor={15} name={`${i + 1} ${visual.kind}`}>
              {black ? (
                <AbsoluteFill style={{ opacity: fadeK(r.shots, i, time, s) }}>
                  <FrameVisual r={r} shot={s} time={time} />
                </AbsoluteFill>
              ) : (
                <FrameVisual r={r} shot={s} time={time} />
              )}
            </Sequence>
          );
        if (black && (s.layout === "media" || s.layout === "half")) {
          const kk = fadeK(r.shots, i, time, s);
          const half = s.layout === "half";
          const float = !half && !solid(s);
          const box = half ? HALF : float ? FLOAT_IN : MEDIA;
          const sc = Math.min(box.w / DESIGN_W, box.h / 520);
          const inner = (
            <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, color: pal(half ? "light" : tone, theme).ink }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: box.w / sc, height: box.h / sc, transform: `scale(${sc})`, transformOrigin: "0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <VisualView slug={r.slug} shot={s} time={time} w={box.w / sc} h={box.h / sc} v={visual} room={box === MEDIA ? roomOf(box, sc) : undefined} />
              </div>
            </div>
          );
          return (
            <Sequence key={i} from={from} durationInFrames={dur} premountFor={15} name={`${i + 1} ${s.layout} ${visual.kind}`}>
              {half ? (
                <HalfStage r={r} k={kk}>{inner}</HalfStage>
              ) : float ? (
                <AbsoluteFill style={{ opacity: kk, translate: `0 ${(1 - kk) * 24}px` }}>
                  <div style={{ position: "absolute", left: FLOAT.x, top: FLOAT.y, width: FLOAT.w, height: FLOAT.h, borderRadius: 28, background: "rgba(11,11,11,0.94)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 40px 120px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.4)" }} />
                  {inner}
                </AbsoluteFill>
              ) : (
                <AbsoluteFill style={{ opacity: kk }}>{inner}</AbsoluteFill>
              )}
            </Sequence>
          );
        }
        if (s.layout !== "side" && s.layout !== "media") return null;
        const area = s.layout === "side" ? SIDE : MEDIA;
        // On the stage the graphic leaves with the card's move back to full frame.
        const leaving = s.layout === "side" && r.shots[last + 1]?.layout !== "side" ? 1 - prog(time, s.end - MOVE, 0.2) : 1;
        // The visuals are designed for a 900 px panel (the reel's). On 16:9 they are laid out at that
        // width and scaled up to fill the panel, so type and lines grow with it instead of sitting
        // small in empty space (Owain, 2026-10-24: "a little sparse/plain").
        const k = Math.min(area.w / DESIGN_W, area.h / 520);
        const vw = area.w / k, vh = area.h / k;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} premountFor={15} name={`${i + 1} ${s.layout} ${visual.kind}`}>
            <div style={{ position: "absolute", left: area.x, top: area.y, width: area.w, height: area.h, color: pal(tone, theme).ink, opacity: leaving, filter: `blur(${(1 - leaving) * 8}px)` }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: vw, height: vh, transform: `scale(${k})`, transformOrigin: "0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <VisualView slug={r.slug} shot={s} time={time} w={vw} h={vh} v={visual} room={s.layout === "media" ? roomOf(area, k) : undefined} />
              </div>
            </div>
          </Sequence>
        );
      })}
      {r.alpha ? <AbsoluteFill style={{ background: "black", opacity: 1 - dim }} /> : <Speaker r={r} shot={shot} k={stageK(r.shots, index, time)} dim={dim} />}
      {shot.layout === "over" && shot.visual?.kind === "lower" && <Lower title={shot.visual.title} sub={shot.visual.sub} shot={shot} time={time} />}
      {titled && shot.visual?.kind === "words" && <WordsOver shot={shot} time={time} v={shot.visual} face={r.face.x} width={WW} height={WH} />}
      {titled && shot.visual?.kind === "title" && <OverTitle text={shot.visual.text} kicker={shot.visual.kicker} shot={shot} time={time} />}
      {r.captions && <Captions chunk={r.chunks.find((c) => time >= c.start && time < c.end)} />}
      <Soundtrack r={r} />
    </AbsoluteFill>
    </SoftThemeContext.Provider>
  );
};
