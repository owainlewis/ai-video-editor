// "Too many skills": drawn for the skills reel (projects/skills-reel/DESIGN.md, 2026-10-26).
// Claude Code sits in the middle; real skill names (anthropics/skills) crowd round it.
//   mode "pile"     skills fly in one after another and crowd the agent, which shrinks
//                   times: [first skill lands, more pile on, the rest pile on]
//   mode "confuse"  the pile is there; skills light up red and pull, the agent shakes and doubts
//                   times: [first pair pull, everything pulls]
//   mode "clear"    the pile falls away; a couple of skills settle neatly; the agent is calm
//                   times: [the pile drops, the agent settles, the label lands]
import React from "react";
import { AbsoluteFill } from "remotion";
import { easeInOut, easeOut, lerp, prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

const SAGE = "#B7CDBF";
const PINE = "#2C4441";
const RED = "#D9534F";
const jitter = (i: number) => {
  const x = Math.sin(i * 78.233 + 1.3) * 43758.5453;
  return x - Math.floor(x);
};

export const Skills: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const paper = panel && shot.tone !== "dark";
  const names = (Array.isArray(props.names) ? props.names : []) as string[];
  const mode = String(props.mode ?? "pile");
  const keep = Number(props.keep ?? 2);
  const n = names.length;
  const fs = Math.round(Math.min(width, height * 1.4) / 25);
  const cx = width / 2, cy = height * 0.5;
  const t0 = times[0] ?? shot.start + 0.2;
  const t1 = times[1] ?? t0 + 1.2;
  const t2 = times[2] ?? t1 + 1.2;
  const ink = paper ? "#1F1F1D" : "#F2EFEA";
  const chipBg = paper ? "#FBFAF7" : "#232220";
  const edge = paper ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";

  // Where each skill sits in the crowd: a loose grid round the agent (two rows above, one either
  // side, two below), each nudged and tilted a little so it reads as a pile, never overlapping.
  const SPOTS: [number, number][] = [];
  for (const ry of [-4.3, -2.5]) for (const cxk of [-1, 0, 1]) SPOTS.push([cxk * 7.2, ry]);
  SPOTS.push([-7.9, 0], [7.9, 0]);
  for (const ry of [2.5, 4.3]) for (const cxk of [-1, 0, 1]) SPOTS.push([cxk * 7.2, ry]);
  const slot = (i: number): [number, number] => {
    const [gx, gy] = SPOTS[i % SPOTS.length];
    return [cx + (gx + (jitter(i) - 0.5) * 0.8) * fs, cy + (gy + (jitter(i + 3) - 0.5) * 0.3) * fs];
  };
  const tilt = (i: number) => (jitter(i + 11) - 0.5) * 8;
  // When each skill arrives in "pile": in three waves on the three spoken beats.
  const arrive = (i: number) => {
    const wave = i < n / 3 ? t0 : i < (2 * n) / 3 ? t1 : t2;
    return wave + (i % Math.ceil(n / 3)) * 0.09;
  };

  const settled = mode !== "pile";
  const crowd = settled ? 1 : names.reduce((s, _, i) => s + prog(time, arrive(i), 0.3, easeOut), 0) / Math.max(1, n);
  const pull = mode === "confuse" ? prog(time, t0, 0.25, easeOut) : 0;
  const pullAll = mode === "confuse" ? prog(time, t1, 0.3, easeOut) : 0;
  const shake = mode === "confuse" ? Math.sin(time * 38) * fs * 0.18 * (0.4 * pull + 0.6 * pullAll) : 0;
  const drop = mode === "clear" ? Math.max(0, time - t0) : 0;
  const calm = mode === "clear" ? prog(time, t1, 0.46, easeInOut) : 0;
  const label = mode === "clear" ? prog(time, t2, 0.25, easeOut) : 0;
  const agentScale = mode === "clear" ? lerp(0.82, 1.08, calm) : 1 - 0.18 * crowd;

  return (
    <AbsoluteFill>
      {/* pull lines from the conflicting skills to the agent */}
      {mode === "confuse" && (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {names.map((_, i) => {
            const lit = i < 2 ? pull : pullAll * (i % 2 ? 1 : 0.6);
            if (lit < 0.02) return null;
            const [x, y] = slot(i);
            return <line key={i} x1={cx + shake} y1={cy} x2={x} y2={y} stroke={RED} strokeWidth={2.5} opacity={0.55 * lit} strokeDasharray="6 8" />;
          })}
        </svg>
      )}
      {names.map((name, i) => {
        const [sx, sy] = slot(i);
        let x = sx, y = sy, o = 1, rot = tilt(i), s = 1;
        if (mode === "pile") {
          const k = prog(time, arrive(i), 0.35, easeOut);
          const a = Math.atan2(sy - cy, sx - cx);
          x = lerp(cx + Math.cos(a) * width * 0.7, sx, k);
          y = lerp(cy + Math.sin(a) * height * 0.7, sy, k);
          o = k;
        }
        const kept = mode === "clear" && i < keep;
        if (mode === "clear" && !kept) {
          // Falls out of frame with a little spin, each a beat after the last.
          const d = Math.max(0, drop - (i % 6) * 0.05);
          y = sy + 2400 * d * d;
          rot = tilt(i) + (jitter(i) - 0.5) * 120 * Math.min(1, d * 2);
          o = 1 - Math.min(1, d * 1.6);
        }
        if (kept) {
          // The ones worth keeping move into a neat row under the agent.
          const row = [cx + (i - (keep - 1) / 2) * fs * 7.2, cy + fs * 3.4];
          x = lerp(sx, row[0], calm);
          y = lerp(sy, row[1], calm);
          s = 1 + 0.08 * calm;
          rot = tilt(i) * (1 - calm);
        }
        const red = mode === "confuse" ? (i < 2 ? pull : pullAll * (i % 2 ? 1 : 0.6)) : 0;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", rotate: `${rot}deg`, scale: String(s), opacity: o, padding: `${fs * 0.28}px ${fs * 0.6}px`, borderRadius: fs, background: kept && calm > 0.5 ? SAGE : chipBg, border: `1.5px solid ${red > 0.3 ? RED : edge}`, color: kept && calm > 0.5 ? "#1B1B1A" : ink, fontFamily: '"SF Mono", Menlo, monospace', fontSize: fs * 0.62, whiteSpace: "nowrap", boxShadow: `0 8px 22px rgba(0,0,0,0.14)` }}>
            {name}
          </div>
        );
      })}
      {/* the agent */}
      <div style={{ position: "absolute", left: cx + shake, top: cy, translate: "-50% -50%", scale: String(agentScale), padding: `${fs * 0.55}px ${fs * 1.0}px`, borderRadius: fs * 0.6, background: "#1A1918", color: "#F2EFEA", fontFamily: type.sans, fontWeight: 800, fontSize: fs * 1.05, whiteSpace: "nowrap", boxShadow: `0 20px 50px rgba(0,0,0,0.3), 0 0 0 ${10 * calm}px rgba(183,205,191,0.5)`, zIndex: 2 }}>
        <span style={{ fontFamily: '"SF Mono", Menlo, monospace', color: "#D97757", marginRight: fs * 0.4 }}>&gt;_</span>
        Claude Code
        {mode === "confuse" && pullAll > 0.3 && (
          <span style={{ position: "absolute", right: -fs * 0.5, top: -fs * 0.6, width: fs * 1.1, height: fs * 1.1, borderRadius: fs, background: RED, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs * 0.7, opacity: pullAll }}>?</span>
        )}
      </div>
      {mode === "clear" && (
        <div style={{ position: "absolute", left: cx, top: cy + fs * 5.4, translate: "-50% 0", fontFamily: type.serif, fontStyle: "italic", fontSize: fs * 1.1, color: paper ? PINE : SAGE, opacity: label }}>{String(props.label ?? "a minimal setup")}</div>
      )}
    </AbsoluteFill>
  );
};
