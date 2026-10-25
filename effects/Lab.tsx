// The motion lab: short, self-contained experiments on real moments of a project, to choose a
// direction before it goes into the real visuals (Owain, 2026-10-25: "generate ideas with sfx and
// beautiful motion graphics - vary your ideas so we can choose the best ones"). Not used by exports.
//
// The motion system the experiments share, from studying Ben's edit frame by frame: two speeds
// (content ~180 ms, moves ~460 ms), one long-tailed ease, 80 ms staggers, a second beat on the
// spoken word, a background that drifts, never a hard jump inside the stage.
import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";

export type LabProps = { idea: string; from: number; dur: number; video: string; t: Record<string, number> };

const W = 1920, H = 1080;
const C = { bg: "#1B1B1A", ink: "#F7F3EC", muted: "#A3A19C", faint: "rgba(247,243,236,0.14)", sage: "#B7CDBF", mark: "rgba(183,205,191,0.32)" };
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Signifier, "Iowan Old Style", Georgia, serif';
const FAST = 0.18, MOVE = 0.46, STAG = 0.08;
const out = Easing.bezier(0.16, 1, 0.3, 1); // content: quick start, long soft settle
const inOut = Easing.bezier(0.55, 0, 0.1, 1); // moves: slow start, fast middle, long tail, no overshoot
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const p = (t: number, at: number, d = FAST, e = out) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: e });
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Blur-in: the one way content arrives.
const In: React.FC<{ t: number; at: number; rise?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ t, at, rise = 18, children, style }) => {
  const k = p(t, at);
  return <div style={{ opacity: k, filter: `blur(${(1 - k) * 8}px)`, translate: `0 ${(1 - k) * rise}px`, ...style }}>{children}</div>;
};

// The second beat: a highlighter sweeping behind words, left to right, on the spoken word.
const Mark: React.FC<{ t: number; at: number; d?: number; children: React.ReactNode; color?: string }> = ({ t, at, d = 0.35, children, color = C.mark }) => (
  <span style={{ position: "relative", display: "inline-block" }}>
    <span style={{ position: "absolute", left: "-0.08em", right: "-0.08em", top: "0.12em", bottom: "0.02em", background: color, borderRadius: 4, transformOrigin: "left", scale: `${p(t, at, d, inOut)} 1` }} />
    <span style={{ position: "relative" }}>{children}</span>
  </span>
);

// Graphite with a faint grid and crosses that drift about a pixel a second: a stage that is alive.
const Stage: React.FC<{ t: number }> = ({ t }) => {
  const drift = (t * 1.2) % 64;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.faint} 1px, transparent 1px), linear-gradient(90deg, ${C.faint} 1px, transparent 1px)`, backgroundSize: "64px 64px", backgroundPosition: `${drift}px ${drift * 0.5}px`, opacity: 0.22 }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)" }} />
    </AbsoluteFill>
  );
};

// The footage, playing from the clip's source time.
const Footage: React.FC<{ v: LabProps; style?: React.CSSProperties }> = ({ v, style }) => (
  <OffthreadVideo src={staticFile(v.video)} startFrom={Math.round(v.from * 30)} muted style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...style }} />
);

// ---------- 1. chapter, polished ----------
const Chapter: React.FC<{ t: number; v: LabProps }> = ({ t, v }) => {
  const at = v.t.card;
  if (t < at || t >= v.t.end) return <Footage v={v} />;
  const n = 6, here = 5, seg = 96, gap = 14;
  const travel = p(t, at + 2 * STAG, MOVE, inOut);
  return (
    <AbsoluteFill>
      <Stage t={t} />
      <div style={{ position: "absolute", left: 220, top: 360 }}>
        <In t={t} at={at}>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, letterSpacing: 6, color: C.muted }}>
            <span style={{ color: C.sage }}>05</span> / 06
          </div>
        </In>
        <In t={t} at={at + STAG} style={{ marginTop: 22 }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 120, letterSpacing: "-0.035em", color: C.ink, lineHeight: 1 }}>
            Human approval <Mark t={t} at={at + 1.0}>by risk</Mark>
          </div>
        </In>
        <In t={t} at={at + 2 * STAG} rise={8} style={{ marginTop: 56, display: "flex", gap }}>
          {Array.from({ length: n }, (_, i) => {
            const fill = i < here - 1 ? 1 : i === here - 1 ? travel : 0;
            return (
              <div key={i} style={{ position: "relative", width: seg, height: 6, borderRadius: 3, background: C.faint, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: i === here - 1 ? C.sage : C.ink, opacity: i === here - 1 ? 1 : 0.55, transformOrigin: "left", scale: `${fill} 1` }} />
              </div>
            );
          })}
        </In>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 2. stage: the speaker shrinks into a card, the graphic builds beside ----------
const StageCard: React.FC<{ t: number; v: LabProps }> = ({ t, v }) => {
  const k = t < v.t.exit ? p(t, v.t.in, MOVE, inOut) : 1 - p(t, v.t.exit, MOVE, inOut);
  // The card and the part of the picture it shows move on one curve: one move, not two.
  const card = { x: lerp(0, W - 64 - 500, k), y: lerp(0, 110, k), w: lerp(W, 500, k), h: lerp(H, 860, k) };
  const srcW = lerp(1920, 1080 * (500 / 860), k), srcX = lerp(0, 960 - srcW / 2, k);
  const scale = card.w / srcW;
  const rows = [
    { tier: "Low", text: "Auto-merge", at: v.t.low },
    { tier: "Medium", text: "One reviewer", at: v.t.med },
    { tier: "High", text: "Two reviewers", at: v.t.high },
  ];
  const on = t >= v.t.in && t < v.t.exit + MOVE;
  const gone = t >= v.t.exit ? 1 - p(t, v.t.exit, FAST) : 1;
  return (
    <AbsoluteFill>
      {k > 0 && <Stage t={t} />}
      {on && (
        <div style={{ position: "absolute", left: 110, top: 200, width: 1140, opacity: gone, filter: `blur(${(1 - gone) * 8}px)` }}>
          <In t={t} at={v.t.in + 0.2}>
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 32, letterSpacing: 7, color: C.muted, textTransform: "uppercase" }}>Review effort by risk</div>
          </In>
          {rows.map((r, i) => (
            <In key={i} t={t} at={r.at} rise={24} style={{ marginTop: i ? 26 : 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 40, padding: "40px 44px", borderRadius: 20, background: "rgba(247,243,236,0.05)", border: `1px solid ${t >= r.at && (i === 2 || t < rows[i + 1].at) ? "rgba(183,205,191,0.6)" : C.faint}` }}>
                <div style={{ width: 190, fontFamily: SANS, fontWeight: 500, fontSize: 30, letterSpacing: 5, textTransform: "uppercase", color: C.sage }}>{r.tier}</div>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 76, letterSpacing: "-0.02em", color: C.ink }}>{i === 2 ? <Mark t={t} at={r.at + 0.9}>{r.text}</Mark> : r.text}</div>
              </div>
            </In>
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: card.x, top: card.y, width: card.w, height: card.h, overflow: "hidden", borderRadius: 24 * k, boxShadow: `0 ${30 * k}px ${80 * k}px rgba(0,0,0,${0.5 * k})` }}>
        <Footage v={v} style={{ left: -srcX * scale, top: 0, width: 1920 * scale, height: 1080 * scale }} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3. odometer ----------
const Odometer: React.FC<{ value: number; size: number }> = ({ value, size }) => {
  const digits = Math.max(1, String(Math.floor(value)).length);
  const cols: React.ReactNode[] = [];
  for (let k = digits - 1; k >= 0; k--) {
    const d = (value / 10 ** k) % 10;
    // Each column rolls continuously; the next one only turns when this one passes 9.
    const shown = k === 0 ? d : Math.floor(d) + Math.max(0, (value % 10 ** k) / 10 ** k - 0.9) * 10;
    cols.push(
      <span key={k} style={{ display: "inline-block", height: size, overflow: "hidden", verticalAlign: "top" }}>
        <span style={{ display: "block", translate: `0 ${-(shown % 10) * size}px` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((x, i) => (
            <span key={i} style={{ display: "block", height: size, lineHeight: `${size}px` }}>{x}</span>
          ))}
        </span>
      </span>,
    );
    if (k % 3 === 0 && k) cols.push(<span key={`c${k}`}>,</span>);
  }
  return <>{cols}</>;
};

const Counter: React.FC<{ t: number; v: LabProps }> = ({ t, v }) => {
  const first = interpolate(t, [v.t.a - 0.35, v.t.a + 0.1], [0, 2500], { ...clamp, easing: out });
  const second = interpolate(t, [v.t.b - 0.45, v.t.b + 0.3], [2500, 30000], { ...clamp, easing: inOut });
  const value = t < v.t.b - 0.45 ? first : second;
  const hit = p(t, v.t.x, 0.22);
  return (
    <AbsoluteFill>
      <Stage t={t} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - hit, filter: `blur(${hit * 10}px)`, scale: String(1 - hit * 0.06) }}>
        <In t={t} at={v.t.a - 0.4}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 260, letterSpacing: "-0.04em", color: C.ink, fontVariantNumeric: "tabular-nums", height: 260, lineHeight: 1 }}>
            <Odometer value={value} size={260} />
          </div>
        </In>
        <In t={t} at={v.t.a}>
          <div style={{ marginTop: 40, fontFamily: SERIF, fontStyle: "italic", fontSize: 52, color: C.muted }}>changes merged per day</div>
        </In>
      </AbsoluteFill>
      {t >= v.t.x && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ opacity: hit, scale: String(1.12 - 0.12 * hit), fontFamily: SANS, fontWeight: 700, fontSize: 380, letterSpacing: "-0.04em", color: C.ink }}>
            12<span style={{ marginLeft: "0.05em", color: C.sage }}>x</span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ---------- 4. focus lift: the paragraph comes off the page ----------
const Lift: React.FC<{ t: number; v: LabProps }> = ({ t, v }) => {
  const k = t < v.t.drop ? p(t, v.t.lift, MOVE, inOut) : 1 - p(t, v.t.drop, MOVE, inOut);
  // The paragraph's place on the page, in source pixels, and where it lands, larger, in the middle.
  const src = { x: 500, y: 298, w: 745, h: 208 };
  const s = lerp(1, 1.85, k);
  const dst = { x: lerp(src.x, (W - src.w * 1.85) / 2, k), y: lerp(src.y, (H - src.h * 1.85) / 2, k) };
  // The highlight follows the words as they are said: "two to three times better".
  const hl = { x: 834 - src.x, y: 375 - src.y, w: 222, h: 30 };
  const sweep = interpolate(t, [v.t.two, v.t.better + 0.25], [0, 1], { ...clamp, easing: inOut });
  return (
    <AbsoluteFill>
      <Footage v={v} style={{ filter: `blur(${k * 10}px) brightness(${1 - k * 0.45})` }} />
      {k > 0 && (
        <div style={{ position: "absolute", left: dst.x - 28 * k, top: dst.y - 24 * k, width: src.w * s + 56 * k, height: src.h * s + 48 * k, borderRadius: 18 * k, background: "#FAF8F3", boxShadow: `0 ${30 * k}px ${90 * k}px rgba(0,0,0,${0.45 * k})`, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 28 * k, top: 24 * k, width: src.w * s, height: src.h * s, overflow: "hidden" }}>
            <Footage v={v} style={{ left: -src.x * s, top: -src.y * s, width: W * s, height: H * s }} />
            <div style={{ position: "absolute", left: hl.x * s - 4, top: hl.y * s, width: (hl.w * s + 8) * sweep, height: hl.h * s, background: "rgba(183,205,191,0.55)", mixBlendMode: "multiply", borderRadius: 4 }} />
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- 5. kinetic line with a highlighter beat ----------
const Kinetic: React.FC<{ t: number; v: LabProps }> = ({ t, v }) => {
  const words = ["Assume", "your", "code", "review", "process", "is", "not", "perfect"];
  const times = words.map((w) => v.t[w]);
  return (
    <AbsoluteFill>
      <Stage t={t} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 1400, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 104, lineHeight: 1.08, letterSpacing: "-0.03em", color: C.ink, textWrap: "balance" }}>
          {words.map((w, i) => {
            const k = p(t, times[i] - 0.04);
            const word = (
              <span style={{ display: "inline-block", opacity: 0.14 + 0.86 * k, filter: `blur(${(1 - k) * 6}px)`, translate: `0 ${(1 - k) * 14}px` }}>
                {w}
                {i === words.length - 1 && <span style={{ color: C.sage }}>.</span>}
              </span>
            );
            return (
              <React.Fragment key={i}>
                {i > 0 && " "}
                {i === 6 ? (
                  <Mark t={t} at={v.t.perfect + 0.45}>
                    {word} <WordIn t={t} at={times[7]} last>{words[7]}</WordIn>
                  </Mark>
                ) : i === 7 ? null : (
                  word
                )}
              </React.Fragment>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const WordIn: React.FC<{ t: number; at: number; last?: boolean; children: React.ReactNode }> = ({ t, at, last, children }) => {
  const k = p(t, at - 0.04);
  return (
    <span style={{ display: "inline-block", opacity: 0.14 + 0.86 * k, filter: `blur(${(1 - k) * 6}px)`, translate: `0 ${(1 - k) * 14}px` }}>
      {children}
      {last && <span style={{ color: C.sage }}>.</span>}
    </span>
  );
};

// ---------- 6. flow with a traveller ----------
const Flow: React.FC<{ t: number; v: LabProps }> = ({ t, v }) => {
  const stages = [
    { label: "Missed in review", at: v.t.s1 },
    { label: "Eval", at: v.t.s2 },
    { label: "Future reviewers", at: v.t.s3 },
  ];
  const xs = [400, 960, 1520], y = 560;
  // Each connector draws from the last stage to the next just before it lands; the bug rides its tip.
  const leg = (i: number) => p(t, stages[i + 1].at - 0.45, 0.45, inOut);
  return (
    <AbsoluteFill>
      <Stage t={t} />
      <In t={t} at={v.t.title} style={{ position: "absolute", top: 290, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, letterSpacing: 7, color: C.muted, textTransform: "uppercase" }}>Mistakes become evals</div>
      </In>
      {[0, 1].map((i) => (
        <div key={i} style={{ position: "absolute", left: xs[i] + 90, top: y - 1.5, width: (xs[i + 1] - xs[i] - 180) * leg(i), height: 3, borderRadius: 2, background: C.sage, opacity: 0.9 }} />
      ))}
      {[0, 1].map((i) => {
        const k = leg(i);
        if (k <= 0 || k >= 1) return null;
        return <div key={`b${i}`} style={{ position: "absolute", left: xs[i] + 90 + (xs[i + 1] - xs[i] - 180) * k - 10, top: y - 10, width: 20, height: 20, borderRadius: 10, background: C.sage, boxShadow: "0 0 24px rgba(183,205,191,0.8)" }} />;
      })}
      {stages.map((s, i) => {
        const k = p(t, s.at - 0.05);
        const now = t >= s.at && (i === 2 || t < stages[i + 1].at - 0.45);
        const pulse = Math.max(0, 1 - Math.abs(t - s.at - 0.12) / 0.2);
        return (
          <div key={i} style={{ position: "absolute", left: xs[i] - 90, top: y - 90, width: 180, height: 180, borderRadius: 90, border: `3px solid ${now ? C.sage : C.ink}`, background: now ? "rgba(183,205,191,0.14)" : C.bg, opacity: 0.25 + 0.75 * k, scale: String(0.9 + 0.1 * k + 0.05 * pulse), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 52, color: now ? C.sage : C.ink }}>
            {String(i + 1).padStart(2, "0")}
          </div>
        );
      })}
      {stages.map((s, i) => (
        <In key={`l${i}`} t={t} at={s.at + STAG} style={{ position: "absolute", left: xs[i] - 270, width: 540, top: y + 130, textAlign: "center" }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, letterSpacing: "-0.02em", color: C.ink }}>{s.label}</div>
        </In>
      ))}
    </AbsoluteFill>
  );
};

export const Lab: React.FC<LabProps> = (v) => {
  const t = v.from + useCurrentFrame() / 30;
  const Idea = { chapter: Chapter, stage: StageCard, counter: Counter, lift: Lift, kinetic: Kinetic, flow: Flow }[v.idea] ?? Chapter;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Idea t={t} v={v} />
    </AbsoluteFill>
  );
};
