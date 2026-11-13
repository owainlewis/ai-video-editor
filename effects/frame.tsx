// Full-frame graphics laid out on the 1920x1080 frame itself (not the scaled panel the shared visuals
// use): the chapter card, the odometer and the focus lift, from the motion lab Owain approved
// (2026-10-25). They share effects/motion.tsx.
import React from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, getRemotionEnvironment, interpolate, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { UI_KINDS, UiVisual } from "./ui";
import type { Resolved, ResolvedShot } from "../engine/schema";
import { easeInOut, FAST, In, lerp, Mark, markColor, MOVE, prog, runs, STAG } from "./motion";
import { pal, isBlack, type V } from "./soft";
import { CutVideo } from "./cut";
import { t as type } from "./theme";

type Props = { r: Resolved; shot: ResolvedShot; time: number };

export const FRAME_KINDS = new Set(["odometer", "lift", ...UI_KINDS]);
export const isFrame = (s: ResolvedShot) => s.layout === "media" && !!s.visual && (FRAME_KINDS.has(s.visual.kind) || (s.visual.kind === "chapter" && !!s.visual.hit));

// Footage from the shot's own start. Exports read frames exactly (OffthreadVideo), so the picture
// matches the original; the editor plays it live.
export const Footage: React.FC<{ r: Resolved; from: number; style?: React.CSSProperties }> = ({ r, from, style }) => {
  const s: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: 1920, height: 1080, ...style };
  if (r.cut) return <CutVideo r={r} from={from} style={s} />;
  // The render of one part: its flattened picture starts at the part's first frame, which can be
  // after this shot's own start.
  const first = Math.round(from * r.fps) - (r.pictureFrom ?? 0);
  return getRemotionEnvironment().isRendering ? (
    <Sequence from={Math.max(0, -first)} layout="none">
      <OffthreadVideo src={staticFile(r.video)} startFrom={Math.max(0, first)} muted style={s} />
    </Sequence>
  ) : (
    <Video src={staticFile(r.video)} trimBefore={Math.round(from * r.fps)} muted style={s} />
  );
};

// ---------- chapter: "05 / 06", a bold title with one marked phrase, the route as segments ----------
const Chapter: React.FC<Props & { v: V<"chapter"> }> = ({ shot, time, v }) => {
  const c = pal(shot.tone);
  const at = shot.start;
  const here = parseInt(v.number, 10);
  const n = v.of ?? 0;
  const travel = prog(time, at + 2 * STAG, MOVE, easeInOut);
  // A 9:16 reel has a narrow frame: a smaller margin and a title that still fills it.
  const narrow = useVideoConfig().width < 1200;
  const side = narrow ? 90 : 200;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: side, right: side, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <In t={time} at={at}>
          <div style={{ fontFamily: type.sans, fontWeight: 500, fontSize: 32, letterSpacing: 7, color: c.muted }}>
            <span style={{ color: c.accent }}>{v.number}</span>
            {n ? ` / ${String(n).padStart(2, "0")}` : ""}
          </div>
        </In>
        <In t={time} at={at + STAG} style={{ marginTop: 24 }}>
          <div style={{ fontFamily: type.sans, fontWeight: 700, fontSize: narrow ? 150 : 124, letterSpacing: "-0.035em", lineHeight: 1.02, color: c.ink, textWrap: "balance" }}>
            {runs(v.label).map((p, i) =>
              // On black the marked phrase is set in Signifier italic instead of the highlighter.
              p.marked && isBlack() ? (
                <span key={i} style={{ fontFamily: type.serif, fontStyle: "italic", fontWeight: 400, fontSize: "1.1em", letterSpacing: "-0.01em" }}>{p.text}</span>
              ) : p.marked ? (
                <Mark key={i} t={time} at={at + 1.0} color={markColor(c.accent)}>
                  {p.text}
                </Mark>
              ) : (
                <React.Fragment key={i}>{p.text}</React.Fragment>
              ),
            )}
          </div>
        </In>
        {n > 1 && (
          <In t={time} at={at + 2 * STAG} rise={8} style={{ marginTop: 60, display: "flex", gap: 14 }}>
            {Array.from({ length: n }, (_, i) => {
              const fill = i < here - 1 ? 1 : i === here - 1 ? travel : 0;
              return (
                <div key={i} data-qc="mark" style={{ position: "relative", width: narrow ? Math.min(104, (900 - 14 * n) / n) : 104, height: 6, borderRadius: 3, background: "rgba(247,243,236,0.14)", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: i === here - 1 ? c.accent : c.ink, opacity: i === here - 1 ? 1 : 0.55, transformOrigin: "left", scale: `${fill} 1` }} />
                </div>
              );
            })}
          </In>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ---------- odometer: the digits roll to each number as it is said; a result punches in ----------
export const Digits: React.FC<{ value: number; size: number }> = ({ value, size }) => {
  const n = Math.max(1, String(Math.floor(value)).length);
  const out: React.ReactNode[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = (value / 10 ** k) % 10;
    // A column only turns as the one below it passes 9, like a real counter.
    const shown = k === 0 ? d : Math.floor(d) + Math.max(0, (value % 10 ** k) / 10 ** k - 0.9) * 10;
    out.push(
      // Each digit rolls inside its own window, as wide as a digit plus a little air: tight tracking
      // made the windows narrower than the digits and clipped the zeros together (Owain, 2026-10-25).
      <span key={k} style={{ display: "inline-block", width: "0.6em", textAlign: "center", letterSpacing: 0, height: size, overflow: "hidden", verticalAlign: "top" }}>
        <span style={{ display: "block", translate: `0 ${-(shown % 10) * size}px` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((x, i) => (
            <span key={i} style={{ display: "block", height: size, lineHeight: `${size}px` }}>
              {x}
            </span>
          ))}
        </span>
      </span>,
    );
    if (k % 3 === 0 && k) out.push(<span key={`c${k}`} style={{ letterSpacing: 0, marginRight: "0.02em" }}>,</span>);
  }
  return <>{out}</>;
};

const Odometer: React.FC<Props & { v: V<"odometer"> }> = ({ shot, time, v }) => {
  const c = pal(shot.tone);
  const times = v.times ?? [];
  const steps = v.steps.map((s, i) => ({ value: s.value, at: times[i] ?? shot.start + 0.3 + i }));
  // Roll into each value so it lands as the number is said.
  let value = 0;
  steps.forEach((s, i) => {
    const prev = i ? steps[i - 1].value : 0;
    const k = interpolate(time, [s.at - (i ? 0.45 : 0.35), s.at + (i ? 0.3 : 0.1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: i ? easeInOut : undefined });
    if (time >= s.at - (i ? 0.45 : 0.35)) value = lerp(prev, s.value, k);
  });
  const resultAt = v.result ? (times[steps.length] ?? Infinity) : Infinity;
  const hit = prog(time, resultAt, 0.22);
  // As big as the frame allows: a six-digit count at 260 px runs off a 9:16 frame.
  const { width } = useVideoConfig();
  const chars = Math.max(...steps.map((s) => Math.round(s.value).toLocaleString("en-US").length));
  const size = Math.min(260, Math.floor((width * 0.84) / (chars * 0.62)));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - hit, filter: `blur(${hit * 10}px)`, scale: String(1 - hit * 0.06) }}>
        <In t={time} at={steps[0].at - 0.4}>
          <div style={{ fontFamily: type.sans, fontWeight: 700, fontSize: size, color: c.ink, height: size, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            <Digits value={value} size={size} />
          </div>
        </In>
        <In t={time} at={steps[0].at}>
          <div style={{ marginTop: 44, fontFamily: type.serif, fontStyle: "italic", fontSize: 54, color: c.muted }}>{v.label}</div>
        </In>
      </AbsoluteFill>
      {v.result && time >= resultAt && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ opacity: hit, scale: String(1.12 - 0.12 * hit), fontFamily: type.sans, fontWeight: 700, fontSize: 380, letterSpacing: "-0.04em", color: c.ink }}>
            {runs(v.result.text).map((p, i) => (
              <span key={i} style={p.marked ? { color: c.accent, marginLeft: "0.05em" } : undefined}>
                {p.text}
              </span>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ---------- focus lift: the paragraph comes off the page, larger, over the blurred screen ----------
const Lift: React.FC<Props & { v: V<"lift"> }> = ({ r, shot, time, v }) => {
  // Lifts over MOVE as the shot starts; settles back over MOVE so it is flat again when the shot ends.
  const k = time < shot.end - MOVE ? prog(time, shot.start, MOVE, easeInOut) : 1 - prog(time, shot.end - MOVE, MOVE, easeInOut);
  const [sx, sy, sw, sh] = v.region;
  const big = Math.min(1.85, (1920 * 0.78) / sw, (1080 * 0.6) / sh);
  const s = lerp(1, big, k);
  const pad = { x: 28 * k, y: 24 * k };
  const dx = lerp(sx, (1920 - sw * big) / 2, k), dy = lerp(sy, (1080 - sh * big) / 2, k);
  const times = v.times ?? [];
  const sweep = v.mark ? interpolate(time, [times[0] ?? shot.start + 0.8, (times[1] ?? shot.start + 1.4) + 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut }) : 0;
  const [mx, my, mw, mh] = v.mark ?? [0, 0, 0, 0];
  return (
    <AbsoluteFill>
      <Footage r={r} from={shot.start} style={{ filter: `blur(${k * 10}px) brightness(${1 - k * 0.45})` }} />
      {k > 0 && (
        <div style={{ position: "absolute", left: dx - pad.x, top: dy - pad.y, width: sw * s + 2 * pad.x, height: sh * s + 2 * pad.y, borderRadius: 18 * k, background: "#FAF8F3", boxShadow: `0 ${30 * k}px ${90 * k}px rgba(0,0,0,${0.45 * k})`, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: pad.x, top: pad.y, width: sw * s, height: sh * s, overflow: "hidden" }}>
            <Footage r={r} from={shot.start} style={{ left: -sx * s, top: -sy * s, width: 1920 * s, height: 1080 * s }} />
            {v.mark && <div style={{ position: "absolute", left: (mx - sx) * s - 4, top: (my - sy) * s, width: (mw * s + 8) * sweep, height: mh * s, background: "rgba(183,205,191,0.55)", mixBlendMode: "multiply", borderRadius: 4 }} />}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const FrameVisual: React.FC<Props> = (p) => {
  const v = p.shot.visual!;
  if (v.kind === "odometer") return <Odometer {...p} v={v} />;
  if (v.kind === "lift") return <Lift {...p} v={v} />;
  if (UI_KINDS.has(v.kind)) return <UiVisual shot={p.shot} time={p.time} />;
  if (v.kind === "chapter") return <Chapter {...p} v={v} />;
  return null;
};
export { FAST };
