// The clean reel system, v1 (research/reels/STUDY.md, 2026-11-06). Shared by the sample reels in
// this folder: the palette, the type, the word clock and the line-drawing parts.
//   One centre line (x = 540). Two colours and one accent. One caption, one word at a time, with
//   nothing behind it. Hard cuts between layouts; easing lives only inside a diagram, at two speeds.
// Named kit.tsx: macOS file names ignore case, so no other file here may be called Kit.tsx.
import React, { useMemo } from "react";
import { Easing, interpolate } from "remotion";

export const W = 1080;
export const H = 1920;
export const CX = W / 2;

export const C = {
  black: "#000000",
  ink: "#0E1612", // the deep green-black that suits sage
  paper: "#F0EDE6",
  white: "#F5F5F2",
  dim: "rgba(245,245,242,0.38)",
  faint: "rgba(245,245,242,0.14)",
  sage: "#B7CDBF",
  inkText: "#0E1612",
};

export const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
export const SERIF = 'Signifier, "Iowan Old Style", Georgia, serif';

// The two speeds: a reveal and a move. Never an overshoot.
export const REVEAL = 0.12;
export const MOVE = 0.6;
const io = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const k = (t: number, at: number, d = REVEAL, ease: "io" | "out" = "out") =>
  interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: ease === "io" ? io : out });
export const move = (t: number, at: number, d = MOVE) => k(t, at, d, "io");
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
// Visible from `a` until `b` (a quick fade at each end).
export const live = (t: number, a: number, b = Infinity, d = 0.25) => Math.min(k(t, a, d), isFinite(b) ? 1 - k(t, b - d, d) : 1);

export type Word = { text: string; start: number; end: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

// The time each phrase starts, found in order through the transcript: anchors are words, never seconds.
export function anchors<K extends string>(words: Word[], phrases: Record<K, string>): Record<K, number> {
  const out = {} as Record<K, number>;
  let from = 0;
  for (const key of Object.keys(phrases) as K[]) {
    const want = phrases[key].split(/\s+/).map(norm);
    let hit = -1;
    for (let i = from; i <= words.length - want.length && hit < 0; i++) if (want.every((w, j) => norm(words[i + j].text) === w)) hit = i;
    if (hit < 0) throw new Error(`anchor not found after word ${from}: "${phrases[key]}"`);
    out[key] = words[hit].start;
    from = hit + 1;
  }
  return out;
}

// The word being said at t, held through the pause after it.
export const wordAt = (words: Word[], t: number) => {
  let w: Word | undefined;
  for (const x of words) if (x.start <= t + 0.02) w = x;
  return w && t < w.end + 0.6 ? w : undefined;
};
export const clean = (s: string) => s.replace(/^[^\w']+|[^\w'%]+$/g, "");

// A thin line drawn on from a to b as p goes 0 to 1, with an optional head.
export const Line: React.FC<{ a: [number, number]; b: [number, number]; p: number; w?: number; color?: string; head?: boolean; opacity?: number; dash?: boolean }> = ({ a, b, p, w = 3, color = C.white, head, opacity = 1, dash }) => {
  if (p <= 0) return null;
  const x = lerp(a[0], b[0], p), y = lerp(a[1], b[1], p);
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, h = w * 5;
  return (
    <g opacity={opacity}>
      <line data-qc="edge" x1={a[0]} y1={a[1]} x2={x} y2={y} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash ? `${w * 3} ${w * 4}` : undefined} />
      {head && p > 0.9 && <path data-qc="edge" d={`M ${x - ux * h - uy * h * 0.6} ${y - uy * h + ux * h * 0.6} L ${x} ${y} L ${x - ux * h + uy * h * 0.6} ${y - uy * h - ux * h * 0.6}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  );
};

// A circle whose outline draws on as p goes 0 to 1.
export const Ring: React.FC<{ x: number; y: number; r: number; p: number; w?: number; color?: string; fill?: string; opacity?: number }> = ({ x, y, r, p, w = 3, color = C.white, fill = "none", opacity = 1 }) => {
  if (p <= 0) return null;
  const len = 2 * Math.PI * r;
  return <circle data-qc="edge" cx={x} cy={y} r={r} fill={fill} stroke={color} strokeWidth={w} strokeDasharray={`${len * p} ${len}`} transform={`rotate(-90 ${x} ${y})`} opacity={opacity} />;
};

// A rectangle whose outline draws on as p goes 0 to 1.
export const Rect: React.FC<{ x: number; y: number; w: number; h: number; p: number; sw?: number; color?: string; fill?: string; r?: number; opacity?: number }> = ({ x, y, w, h, p, sw = 3, color = C.white, fill = "none", r = 6, opacity = 1 }) => {
  if (p <= 0) return null;
  const len = 2 * (w + h);
  return <rect data-qc="edge" x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={color} strokeWidth={sw} strokeDasharray={`${len * p} ${len}`} opacity={opacity} />;
};

// A document: a page outline with text lines that fill in as `lines` goes 0 to n.
export const Doc: React.FC<{ x: number; y: number; w: number; h: number; p: number; lines?: number; n?: number; color?: string; opacity?: number; marks?: number[]; mark?: number }> = ({ x, y, w, h, p, lines = 0, n = 6, color = C.white, opacity = 1, marks = [], mark = 0 }) => {
  const pad = w * 0.14, gap = (h - pad * 2) / n;
  return (
    <g opacity={opacity}>
      <Rect x={x} y={y} w={w} h={h} p={p} color={color} sw={Math.max(2, w * 0.012)} r={w * 0.04} />
      {Array.from({ length: n }, (_, i) => {
        const f = Math.max(0, Math.min(1, lines - i));
        const lw = (w - pad * 2) * (i % 3 === 2 ? 0.62 : i === 0 ? 0.45 : 1);
        const ly = y + pad + gap * i + gap * 0.4;
        const marked = marks.includes(i) && mark > 0;
        return (
          <g key={i}>
            {marked && <rect x={x + pad - 8} y={ly - gap * 0.32} width={(lw + 16) * mark} height={gap * 0.64} fill={C.sage} opacity={0.9} rx={4} />}
            {f > 0 && <line data-qc="edge" x1={x + pad} y1={ly} x2={x + pad + lw * f} y2={ly} stroke={marked ? C.inkText : color} strokeWidth={Math.max(3, w * 0.03)} strokeLinecap="round" opacity={i === 0 ? 1 : 0.55} />}
          </g>
        );
      })}
    </g>
  );
};

// Text placed by its centre, for labels inside a diagram.
export const Label: React.FC<{ x: number; y: number; children: React.ReactNode; size?: number; color?: string; opacity?: number; weight?: number; anchor?: "middle" | "start" | "end" }> = ({ x, y, children, size = 34, color = C.white, opacity = 1, weight = 700, anchor = "middle" }) =>
  opacity <= 0.01 ? null : (
    <text data-qc="label" x={x} y={y} fill={color} opacity={opacity} fontFamily={SANS} fontWeight={weight} fontSize={size} textAnchor={anchor} dominantBaseline="middle" letterSpacing={-size * 0.05}>
      {children}
    </text>
  );

// Seeded noise for dot fields.
export const rand = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

// Dots scattered inside a circle (a project's files), appearing as p goes 0 to 1. `inner` keeps a
// hole in the middle for a caption.
export const Dots: React.FC<{ x: number; y: number; r: number; p: number; inner?: number; n?: number }> = ({ x, y, r, p, inner = 0, n = 140 }) => {
  const pts = useMemo(() => {
    const q = rand(11);
    return Array.from({ length: n }, () => {
      const a = q() * Math.PI * 2, d = inner + Math.sqrt(q()) * (0.9 - inner);
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, o: q() };
    });
  }, [inner, n]);
  return <g>{pts.map((d, i) => (d.o < p ? <circle key={i} cx={x + d.dx * r} cy={y + d.dy * r} r={4} fill={C.white} opacity={0.3 + d.o * 0.5} /> : null))}</g>;
};

// The svg a diagram draws in, and the time of its nth word, or a fallback when the plan names fewer.
export const Stage: React.FC<{ width: number; height: number; children: React.ReactNode }> = ({ width, height, children }) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    {children}
  </svg>
);
export const at = (times: number[], i: number, fallback: number) => times[i] ?? fallback;
