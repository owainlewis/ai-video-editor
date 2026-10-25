// The motion system (Owain, 2026-10-25, after studying Ben's edit frame by frame and approving the
// motion lab): two speeds, one long-tailed ease, tight staggers, and a second beat on the spoken word.
//   FAST  ~180 ms  content arriving or swapping (blur in, small rise)
//   MOVE  ~460 ms  anything that moves through space (the speaker card, a lifted paragraph)
//   STAG   80 ms   between elements that arrive together (label, title, rule)
// Content eases out (quick start, long soft settle); moves ease in and out with a long tail and no
// overshoot. Nothing appears without easing; nothing jumps inside the frame.
import React from "react";
import { Easing, interpolate } from "remotion";

export const FAST = 0.18;
export const MOVE = 0.46;
export const STAG = 0.08;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.55, 0, 0.1, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Progress 0..1 from `at` over `d` seconds; 0 before, 1 after.
export const prog = (t: number, at: number, d = FAST, e = easeOut) => (isFinite(at) ? interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: e }) : 0);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Blur in: the one way content arrives.
export const In: React.FC<{ t: number; at: number; rise?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ t, at, rise = 18, children, style }) => {
  const k = prog(t, at);
  return <div style={{ opacity: k, filter: `blur(${(1 - k) * 8}px)`, translate: `0 ${(1 - k) * rise}px`, ...style }}>{children}</div>;
};

// The second beat: a highlighter that sweeps behind words, left to right, about a second after the
// graphic settles or as the words are said.
export const Mark: React.FC<{ t: number; at: number; d?: number; color: string; children: React.ReactNode }> = ({ t, at, d = 0.35, color, children }) => (
  <span style={{ position: "relative", display: "inline-block" }}>
    <span style={{ position: "absolute", left: "-0.08em", right: "-0.08em", top: "0.14em", bottom: "0.02em", background: color, borderRadius: 4, transformOrigin: "left", scale: `${prog(t, at, d, easeInOut)} 1` }} />
    <span style={{ position: "relative" }}>{children}</span>
  </span>
);

// The highlighter's colour: the accent, translucent, so the type stays on top.
export const markColor = (accent: string, light = false) => {
  const [r, g, b] = (accent.match(/[0-9a-f]{2}/gi) ?? ["b7", "cd", "bf"]).map((h) => parseInt(h, 16));
  return `rgba(${r},${g},${b},${light ? 0.55 : 0.32})`;
};

// Split "words with *marked* words" into plain and marked runs.
export const runs = (text: string) => text.split(/(\*[^*]+\*)/).filter(Boolean).map((s) => ({ text: s.replace(/\*/g, ""), marked: s.startsWith("*") }));
