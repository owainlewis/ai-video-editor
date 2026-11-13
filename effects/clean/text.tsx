// The clean style's text kit (research/reels/STUDY.md, "The text kit", after Tom Noske): the parts
// every treatment is made of. Used by the renderer (Clean.tsx) and the hook (hook.tsx).
import React from "react";
import { t as type } from "../theme";
import { C, k, SANS, type Word } from "./kit";

export const WHITE = "#FFFFFF"; // all type over footage and dark stages
export const GREEN = "#1D3832"; // diagrams, and type on paper
export const MONO = type.mono; // code only: commands, skills, file names

// The one type style of a clean reel (Owain, 2026-11-08): tight white lower-case Helvetica Bold, at
// any size. Every caption, hit, card and title is this, so a reel reads as one voice.
export const display = (size: number): React.CSSProperties => ({ fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.0625, textTransform: "lowercase" });

// Letter by letter: the visible part of `s`, the next letter half in. The rest is laid out but
// hidden, so the line never shifts as it types.
export const Typed: React.FC<{ s: string; t: number; at: number; per?: number }> = ({ s, t, at, per = 0.035 }) => {
  if (t < at) return null;
  const n = (t - at) / per;
  const whole = Math.floor(n);
  return (
    <>
      {s.slice(0, whole)}
      {whole < s.length && <span style={{ opacity: n - whole }}>{s[whole]}</span>}
      {whole < s.length - 1 && <span style={{ opacity: 0 }}>{s.slice(whole + 1)}</span>}
    </>
  );
};

// Words arrive with a short blur and rise, not a fade.
export const blurIn = (t: number, at: number): React.CSSProperties => {
  const p = k(t, at, 0.14);
  return { opacity: p, filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * 18}px)` };
};

// A block centred on the frame's centre line, its top at `y`.
export const Center: React.FC<{ y: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ y, children, style }) => (
  <div style={{ position: "absolute", left: 60, right: 60, top: y, textAlign: "center", ...style }}>{children}</div>
);

// A label naming the real command or skill a step runs, typed on with a cursor. The pill is sage at
// 12% over ink, as a solid colour, so QC reads the colour the text really sits on.
export const Chip: React.FC<{ t: number; at: number; name: string; y: number }> = ({ t, at, name, y }) => {
  if (t < at) return null;
  const typing = t < at + 0.3 + name.length * 0.035;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", ...blurIn(t, at) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 28px", borderRadius: 999, background: "#222C27", border: "1.5px solid rgba(183,205,191,0.35)", fontFamily: MONO, fontSize: 36, color: C.sage }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: C.sage }} />
        <span>
          <Typed s={`/${name.replace(/^\//, "")}`} t={t} at={at + 0.25} />
          <span style={{ opacity: typing || Math.floor(t * 2) % 2 ? 1 : 0, marginLeft: 2 }}>▍</span>
        </span>
      </div>
    </div>
  );
};

// Captions: one or two words at a time, sized by weight. A connective word joins the word after it,
// and a chunk made only of connective words is set small, so the eye skips it.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
const SMALL = new Set("a an and the to of it is in on for with that this then so or as at by be can you your you'll it's there's there are which they if i'll".split(" "));
export type CleanChunk = { text: string; start: number; end: number; small: boolean };
export function chunkClean(words: Word[]): CleanChunk[] {
  const out: CleanChunk[] = [];
  for (let i = 0; i < words.length; i++) {
    const c = [words[i]];
    const stop = /[.,?!]$/.test(words[i].text);
    if (!stop && SMALL.has(norm(words[i].text)) && i + 1 < words.length && words[i + 1].start - words[i].end < 0.3) c.push(words[++i]);
    out.push({ text: c.map((x) => x.text.replace(/[.,?!]+$/, "")).join(" "), start: c[0].start, end: c[c.length - 1].end, small: c.every((x) => SMALL.has(norm(x.text))) });
  }
  return out;
}
