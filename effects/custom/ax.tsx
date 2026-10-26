// Pictures drawn for the Google AX reel (projects/ax-reel/DESIGN.md, 2026-10-26).
//   swarm     a field of sandboxes filling with agents in waves from the centre: scale without a number
//   analogy   a Kubernetes column of containers; on the word the containers become agents in an AX column
import React from "react";
import { AbsoluteFill } from "remotion";
import { easeInOut, easeOut, lerp, prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

const PINE = "#2C4441";
const SAGE = "#B7CDBF";

// A fixed scatter so the wave front is irregular but every render is identical.
const jitter = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// props: { cols?, rows? }   times: [the field starts filling]
export const Swarm: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const cols = Number(props.cols ?? 13), rows = Number(props.rows ?? 8);
  const at = times[0] ?? shot.start;
  const gap = Math.min((width * 0.92) / cols, (height * 0.86) / rows);
  const cell = gap * 0.78;
  const ox = (width - gap * cols) / 2, oy = (height - gap * rows) / 2;
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  const maxD = Math.hypot(cx, cy);
  const edge = panel ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.14)";
  return (
    <AbsoluteFill>
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const d = Math.hypot(c - cx, r - cy) / maxD;
        const t0 = at + d * 1.1 + jitter(i) * 0.25;
        const box = prog(time, t0 - 0.25, 0.25, easeOut);
        const agent = prog(time, t0, 0.22, easeOut);
        // A soft ripple keeps passing through the filled field.
        const ripple = 0.5 + 0.5 * Math.sin((time - at) * 3 - d * 6);
        return (
          <div key={i} style={{ position: "absolute", left: ox + c * gap + (gap - cell) / 2, top: oy + r * gap + (gap - cell) / 2, width: cell, height: cell, borderRadius: cell * 0.22, border: `1.5px solid ${edge}`, opacity: box, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: cell * 0.42, height: cell * 0.42, borderRadius: cell, background: agent > 0.5 ? PINE : SAGE, opacity: agent * (0.75 + 0.25 * ripple), scale: String(0.4 + 0.6 * agent) }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// props: { left?: "Kubernetes", leftSub?: "containers", right?: "AX", rightSub?: "agents", n?: 4 }
// times: [left column lands, containers become agents]
export const Analogy: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const n = Number(props.n ?? 4);
  const a = times[0] ?? shot.start + 0.2;
  const b = times[1] ?? a + 1.2;
  const fs = Math.round(width / 15);
  const ink = panel ? "#1F1F1D" : "#F2EFEA";
  const muted = panel ? "#6E6B65" : "#A3A19C";
  const L = width * 0.27, R = width * 0.73;
  const top = height * 0.4, step = (height * 0.52) / n;
  const head = (x: number, title: string, sub: string, k: number) => (
    <div style={{ position: "absolute", left: x, top: height * 0.08, translate: "-50% 0", textAlign: "center", opacity: k, filter: `blur(${(1 - k) * 8}px)` }}>
      <div style={{ fontFamily: type.sans, fontWeight: 800, fontSize: fs * 1.25, letterSpacing: "-0.02em", color: ink }}>{title}</div>
      <div style={{ fontFamily: type.serif, fontStyle: "italic", fontSize: fs * 0.9, color: muted }}>{sub}</div>
    </div>
  );
  const lk = prog(time, a, 0.18, easeOut);
  const rk = prog(time, b - 0.1, 0.18, easeOut);
  return (
    <AbsoluteFill>
      {head(L, String(props.left ?? "Kubernetes"), String(props.leftSub ?? "runs containers"), lk)}
      {head(R, String(props.right ?? "AX"), String(props.rightSub ?? "runs agents"), rk)}
      <div style={{ position: "absolute", left: width / 2, top: height * 0.44, translate: "-50% -50%", fontFamily: type.serif, fontStyle: "italic", fontSize: fs * 1.6, color: muted, opacity: prog(time, b - 0.3, 0.2) }}>→</div>
      {Array.from({ length: n }, (_, i) => {
        const appear = prog(time, a + 0.1 + i * 0.08, 0.18, easeOut);
        const k = prog(time, b + i * 0.08, 0.46, easeInOut);
        const y = top + step * i;
        const w = lerp(fs * 4.2, fs * 1.4, k), h = lerp(fs * 1.4, fs * 1.4, k);
        return (
          <div key={i} style={{ position: "absolute", left: lerp(L, R, k), top: y, translate: "-50% -50%", width: w, height: h, borderRadius: lerp(fs * 0.25, fs, k), border: `2px solid ${k > 0.5 ? PINE : panel ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)"}`, background: k > 0.5 ? SAGE : "transparent", opacity: appear, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"SF Mono", Menlo, monospace', fontSize: fs * 0.55, color: muted }}>
            {k < 0.3 ? "container" : ""}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
