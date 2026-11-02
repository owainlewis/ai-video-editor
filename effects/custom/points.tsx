// Points on a paper panel beside the speaker (layout `half`), after Ross Harkness (Owain, 2026-10-30:
// "some layout ideas from Ross"): a big serif italic title, a grey line under it, bold bullets that
// land on their words. Always on paper, so the colours are its own.
// props: { title: string, sub?: string, items: string[] }
// times: one per item, as it is said
import React from "react";
import { prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

const INK = "#111111";
const MUTED = "#7A7975";

export const Points: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const items = (props.items ?? []) as string[];
  const a = prog(time, shot.start + 0.15, 0.5);
  const b = prog(time, shot.start + 0.3, 0.5);
  return (
    // Inset, so the custom graphic's slow push never crops the left edge.
    <div style={{ width, height, boxSizing: "border-box", padding: `0 ${width * 0.08}px`, display: "flex", flexDirection: "column", justifyContent: "center", color: INK }}>
      <div style={{ fontFamily: type.serif, fontStyle: "italic", fontWeight: 400, fontSize: 168, lineHeight: 1, letterSpacing: -3, opacity: a, filter: `blur(${(1 - a) * 6}px)` }}>{String(props.title ?? "")}</div>
      {!!props.sub && <div style={{ marginTop: 26, fontFamily: type.sans, fontWeight: 500, fontSize: 44, color: MUTED, opacity: b }}>{String(props.sub)}</div>}
      <div style={{ marginTop: 70, display: "flex", flexDirection: "column", gap: 40 }}>
        {items.map((text, i) => {
          const p = prog(time, times[i] ?? shot.start + 0.4 + i * 0.12, 0.4);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, opacity: p, translate: `${(1 - p) * 30}px 0` }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: INK, flexShrink: 0 }} />
              <div style={{ fontFamily: type.sans, fontWeight: 700, fontSize: 60, letterSpacing: -1.2 }}>{text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
