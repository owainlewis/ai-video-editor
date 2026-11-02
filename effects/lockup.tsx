// The hook lockup (2026-11-01, from a reel Owain sent; approved 2026-11-02: "I love that first text
// example"): the opening line as a stacked composition over his b-roll. Huge bold words, tiny glue
// words tucked beside them, the emotional phrase in Signifier italic, lower case. Each word cuts in on
// its word: no fade, no slide. Warm cream, a very soft shadow, no box, no dim.
import React from "react";
import { AbsoluteFill } from "remotion";
import { t } from "./theme";

export const CREAM = "#E9D8C4";
export const SHADOW = "0 1px 3px rgba(0,0,0,0.3), 0 4px 24px rgba(0,0,0,0.35)";

type LockWord = { text: string; style: "big" | "small" | "serif" };

export const Lockup: React.FC<{ lines: LockWord[][]; times: number[]; time: number; start: number; end: number; width: number; height: number }> = ({ lines, times, time, start, end, width, height }) => {
  if (time >= end) return null;
  const big = height * 0.15;
  let k = 0;
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: width * 0.09 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: big * 0.02 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: big * 0.12 }}>
            {line.map((w, j) => {
              const at = times[k] ?? start + 0.2 * k;
              k++;
              const on = time >= at - 0.04;
              const style: React.CSSProperties =
                w.style === "big"
                  ? { fontFamily: t.sans, fontWeight: 700, fontSize: big, letterSpacing: -big * 0.045, lineHeight: 0.95 }
                  : w.style === "serif"
                    ? { fontFamily: t.serif, fontStyle: "italic", fontSize: big * 0.82, letterSpacing: -big * 0.01, lineHeight: 1.05 }
                    : { fontFamily: t.sans, fontWeight: 700, fontSize: big * 0.24, letterSpacing: -big * 0.006, lineHeight: 1, marginTop: big * 0.12 };
              return (
                <span key={j} style={{ ...style, color: CREAM, textShadow: SHADOW, opacity: on ? 1 : 0, whiteSpace: "nowrap" }}>
                  {w.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
