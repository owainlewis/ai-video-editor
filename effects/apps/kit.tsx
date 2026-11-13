// Parts shared by the app mock-ups: the box a mock-up is drawn in, the window's entrance, typing,
// the caret, the shimmer a working line sweeps with, and inline `code` and **bold** in text.
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { easeInOut, lerp, prog } from "../motion";
import { t as type } from "../theme";

export const SANS = type.sans;
export const SERIF = type.serif;
// Terminals draw in a monospace, as the real ones do (JetBrains Mono is installed on this machine).
export const MONO = '"JetBrains Mono", "SF Mono", Menlo, monospace';

// The box a mock-up is drawn in: the whole frame, or a split's panel (then no stage of its own).
export const BoxCtx = React.createContext<{ width: number; height: number; panel: boolean } | null>(null);
export const useBox = () => {
  const cfg = useVideoConfig();
  return React.useContext(BoxCtx) ?? { width: cfg.width, height: cfg.height, panel: false };
};

// Full frame, the window sits on a flat graphite stage; in a panel it floats on the panel. With
// `dots`, it sits on light paper with a fine dot grid (a card of its own inside a panel).
export const Stage: React.FC<{ children: React.ReactNode; backdrop?: "none" | "dots" }> = ({ children, backdrop = "none" }) => {
  const { panel } = useBox();
  const dots = backdrop === "dots";
  return (
    <AbsoluteFill
      style={{
        background: dots ? "radial-gradient(circle, rgba(31,31,29,0.16) 1.6px, transparent 1.8px) 0 0 / 30px 30px, #F2F0EB" : panel ? undefined : "#141413",
        borderRadius: dots && panel ? 28 : 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// The window's size in its box: the whole panel, or inset on a stage or on the dots.
export const windowSize = (box: { width: number; height: number; panel: boolean }, backdrop: "none" | "dots" = "none", maxW = 1700) => {
  const bare = box.panel && backdrop !== "dots";
  return { winW: Math.min(box.width * (bare ? 1 : 0.9), maxW), winH: box.height * (bare ? 1 : box.panel ? 0.88 : 0.82) };
};

// The window lands: up from a little below, out of a soft blur, then a slow push across the shot.
export const enter = (time: number, start: number, end: number): React.CSSProperties => {
  const k = prog(time, start, 0.45, easeInOut);
  const push = Math.min(1, Math.max(0, (time - start) / Math.max(1, end - start)));
  return { opacity: k, translate: `0 ${(1 - k) * 40}px`, scale: String(lerp(0.96, 1, k) + push * 0.015), filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined };
};

// Characters of `text` typed by `time`, starting at `at`, at `cps` characters a second.
export const typed = (text: string, time: number, at: number, cps: number) => text.slice(0, Math.max(0, Math.floor((time - at) * cps)));

// A block caret that blinks while idle and holds solid while typing.
export const Caret: React.FC<{ time: number; color: string; busy?: boolean; w?: string; h?: string; bar?: boolean }> = ({ time, color, busy, w = "0.6em", h = "1.2em", bar }) => (
  <span style={{ display: "inline-block", width: bar ? 3 : w, height: h, marginLeft: bar ? 2 : 0, verticalAlign: bar ? "-0.2em" : "-0.22em", background: color, opacity: busy || Math.floor(time * 1.9) % 2 === 0 ? 1 : 0 }} />
);

// A shimmer: a lighter band sweeping left to right through the letters, as a working line does.
export const Shimmer: React.FC<{ text: string; time: number; base: string; hi: string; speed?: number }> = ({ text, time, base, hi, speed = 14 }) => {
  const span = text.length + 8;
  const head = ((time * speed) % span) - 4;
  return (
    <>
      {[...text].map((ch, i) => {
        const d = Math.abs(i - head);
        const k = Math.max(0, 1 - d / 3);
        return <span key={i} style={{ color: k > 0.05 ? mix(base, hi, k) : base }}>{ch}</span>;
      })}
    </>
  );
};

const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, k: number) => {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`;
};

// Text with `code` and **bold** spans, as segments.
export type Seg = { s: string; code?: boolean; bold?: boolean };
export const segs = (text: string): Seg[] => {
  const out: Seg[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > i) out.push({ s: text.slice(i, m.index) });
    out.push(m[1] !== undefined ? { s: m[1], code: true } : { s: m[2], bold: true });
    i = m.index + m[0].length;
  }
  if (i < text.length) out.push({ s: text.slice(i) });
  return out;
};
export const plain = (text: string) => segs(text).map((x) => x.s).join("");

// A label's size: never under 25 px, so QC never finds it small at 1080p.
export const px = (v: number) => Math.max(25, v);

// A rough line count for proportional text: how many lines `text` takes at `size` px in `width` px.
export const linesFor = (text: string, width: number, size: number, per = 0.5) => Math.max(1, Math.ceil((text.length * size * per) / Math.max(1, width)));
