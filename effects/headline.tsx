// Owain's own on-screen text (2026-10-31: "my text styles tend to be minimalist"): one to three
// words in huge bold Helvetica, warm cream, straight over the picture. His footage is never dimmed
// (2026-11-01); a soft shadow holds the words instead. An optional small Signifier italic line sits above. A soft fade with a slight settle in
// scale, no bounce. Works over b-roll or A-roll, 16:9 and 9:16.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { prog } from "./motion";
import { clamp, t } from "./theme";

const CREAM = "#F7F3E8";

// The word size that makes the longest line span about three quarters of the frame's width.
export const headlineSize = (text: string, width: number, height: number) => {
  const lines = text.split("//").map((l) => l.trim());
  const longest = Math.max(...lines.map((l) => l.length), 4);
  // Bold Helvetica at -0.045em tracking measures about 0.46 em a character (measured on "Delegate real work").
  return Math.min(height * (lines.length > 1 ? 0.2 : 0.26), (width * 0.75) / (longest * 0.46));
};

export const Headline: React.FC<{ text: string; kicker?: string; start: number; end: number; time: number; width: number; height: number }> = ({ text, kicker, start, end, time, width, height }) => {
  const a = prog(time, start, 0.5);
  const out = interpolate(time, [end - 0.4, end], [1, 0], clamp);
  const k = a * out;
  const size = headlineSize(text, width, height);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: height * 0.08, opacity: k }}>
        <div style={{ transform: `scale(${1.03 - 0.03 * a})`, display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.12 }}>
          {kicker && <div style={{ fontFamily: t.serif, fontStyle: "italic", fontSize: size * 0.26, color: "#FFFFFF", letterSpacing: -size * 0.004, textShadow: "0 2px 18px rgba(0,0,0,0.35)" }}>{kicker}</div>}
          {text.split("//").map((line, i) => (
            <div key={i} style={{ fontFamily: t.sans, fontWeight: 700, fontSize: size, lineHeight: 0.92, letterSpacing: -size * 0.045, color: CREAM, whiteSpace: "nowrap", textShadow: "0 2px 6px rgba(0,0,0,0.35), 0 8px 48px rgba(0,0,0,0.45)" }}>
              {line.trim()}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
