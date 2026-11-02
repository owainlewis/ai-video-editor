// Pictures drawn for the "three things to learn" reel (projects/three-things/DESIGN.md, 2026-10-31).
// All on black, white type, Signifier for the big moments (the black theme).
//   three      three tall cards fan out from one on "three", numbered in Signifier italic
//   blueprint  a system draws itself: grid, then client, server and database, then data flowing
//   swap       the tool names land as he says them, a cursor riding after the last letter
//   commits    a Git history grows dot by dot, branches and merges, then runs on into a career
import React from "react";
import { AbsoluteFill } from "remotion";
import { easeInOut, easeOut, lerp, prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

const BG = "#000000";
const INK = "#F5F5F2";
const MUTED = "#8C8C88";
const LINE = "rgba(245,245,242,0.16)";

// props: { labels?: string[] }   times: [cards fan out, they settle]
export const Three: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const labels = (props.labels as string[] | undefined) ?? ["1", "2", "3"];
  const a = times[0] ?? shot.start + 0.2;
  const k = prog(time, a, 0.46, easeInOut);
  const w = width * 0.26, h = w * 1.45;
  return (
    <AbsoluteFill style={{ background: BG }}>
      {labels.map((label, i) => {
        const off = i - 1;
        const appear = prog(time, a - 0.25 + i * 0.08, 0.18, easeOut);
        return (
          <div key={i} style={{ position: "absolute", left: width / 2 + off * lerp(0, w * 1.12, k), top: height / 2 + Math.abs(off) * lerp(0, 40, k), width: w, height: h, translate: "-50% -50%", rotate: `${off * lerp(0, 9, k)}deg`, borderRadius: 26, border: `1.5px solid ${LINE}`, background: "#0B0B0B", opacity: appear, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ fontFamily: type.serif, fontStyle: "italic", fontSize: w * 0.62, color: INK, opacity: prog(time, a + 0.15 + i * 0.08, 0.3) }}>{label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// props: { nodes?: string[] }   times: [first node, second, third]; the grid draws in before them
export const Blueprint: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const nodes = (props.nodes as string[] | undefined) ?? ["Client", "Server", "Database"];
  const grid = prog(time, shot.start, 0.8, easeInOut);
  const gap = width / 9;
  const bw = width * 0.62, bh = height * 0.13;
  const cx = width / 2;
  const ys = nodes.map((_, i) => height * (0.2 + i * 0.3));
  const fs = Math.round(width / 16);
  return (
    <AbsoluteFill style={{ background: BG }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.55 * grid }}>
        {Array.from({ length: 10 }, (_, i) => <line key={`v${i}`} x1={i * gap} y1={0} x2={i * gap} y2={height * grid} stroke="rgba(245,245,242,0.07)" />)}
        {Array.from({ length: Math.ceil(height / gap) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * gap} x2={width * grid} y2={i * gap} stroke="rgba(245,245,242,0.07)" />)}
      </svg>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {nodes.slice(1).map((_, i) => {
          const k = prog(time, (times[i + 1] ?? shot.start + 1 + i) - 0.1, 0.4, easeInOut);
          const y0 = ys[i] + bh / 2, y1 = ys[i + 1] - bh / 2;
          // Packets ride the link once it is drawn, one every 0.6 s.
          const packets = k < 1 ? [] : [0, 1, 2].map((j) => ((time - (times[i + 1] ?? 0)) / 1.2 + j / 3) % 1);
          return (
            <g key={i}>
              <line x1={cx} y1={y0} x2={cx} y2={lerp(y0, y1, k)} stroke={INK} strokeOpacity={0.5} strokeWidth={3} strokeDasharray="10 10" />
              {packets.map((p, j) => <circle key={j} cx={cx} cy={lerp(y0, y1, i % 2 ? 1 - p : p)} r={9} fill={INK} />)}
            </g>
          );
        })}
      </svg>
      {nodes.map((label, i) => {
        const k = prog(time, times[i] ?? shot.start + 0.5 + i, 0.18, easeOut);
        const draw = prog(time, times[i] ?? shot.start + 0.5 + i, 0.46, easeInOut);
        return (
          <div key={i} style={{ position: "absolute", left: cx - bw / 2, top: ys[i] - bh / 2, width: bw, height: bh, borderRadius: 22, border: `2px solid rgba(245,245,242,${0.7 * draw})`, background: `rgba(20,20,20,${draw})`, clipPath: `inset(0 ${(1 - draw) * 100}% 0 0 round 22px)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: type.sans, fontWeight: 700, fontSize: fs, letterSpacing: "-0.02em", color: INK, opacity: k, filter: `blur(${(1 - k) * 8}px)` }}>{label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// props: { kicker?: string, names: string[] }   times: [kicker, one per name]
export const Swap: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const names = (props.names as string[] | undefined) ?? [];
  const kicker = String(props.kicker ?? "");
  const kAt = times[0] ?? shot.start;
  const idx = names.reduce((n, _, i) => (time >= (times[i + 1] ?? Infinity) - 0.05 ? i : n), -1);
  const fs = Math.round(width / 7.5);
  const blink = Math.floor(time * 2.4) % 2 === 0;
  return (
    <AbsoluteFill style={{ background: BG, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: height * 0.24, fontFamily: type.serif, fontStyle: "italic", fontSize: fs * 0.55, color: MUTED, opacity: prog(time, kAt, 0.3) }}>{kicker}</div>
      <div style={{ position: "relative", height: fs * 1.2, width }}>
        {names.map((name, i) => {
          const at = times[i + 1] ?? Infinity;
          const k = prog(time, at - 0.05, 0.18, easeOut);
          const out = i < idx ? prog(time, (times[i + 2] ?? Infinity) - 0.05, 0.18, easeOut) : 0;
          // Each name types itself in, a letter every 30 ms, then leaves upwards for the next.
          const shown = Math.max(0, Math.min(name.length, Math.floor((time - at + 0.05) / 0.03)));
          return (
            <div key={i} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: k * (1 - out), translate: `0 ${-out * fs * 0.6}px`, filter: `blur(${out * 10}px)` }}>
              <span style={{ fontFamily: type.sans, fontWeight: 800, fontSize: fs, letterSpacing: "-0.04em", color: INK }}>{name.slice(0, shown)}</span>
              {i === idx && <span style={{ width: fs * 0.08, height: fs * 0.9, marginLeft: fs * 0.08, background: INK, opacity: blink ? 1 : 0 }} />}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// props: { labels?: [string, string] }   times: [first label, second label, the history runs on]
export const Commits: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const labels = (props.labels as string[] | undefined) ?? ["Git", "GitHub"];
  const a = shot.start;
  const run = times[2] ?? shot.end;
  const step = width / 7;
  // The history: dots along main every step; a branch leaves at 2 and merges at 5.
  const n = 40;
  const grow = (time - a) / 0.22; // dots drawn so far
  const pan = Math.max(0, time - run) * step * 2.4;
  const y = height * 0.5, yb = y - height * 0.11;
  const x = (i: number) => step * (i + 0.8) - pan;
  const onBranch = (i: number) => i >= 3 && i <= 4;
  const fs = Math.round(width / 9);
  const shownBranch = Math.min(1, Math.max(0, grow - 2));
  return (
    <AbsoluteFill style={{ background: BG }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <line x1={x(0)} y1={y} x2={x(Math.max(0, Math.min(n, grow)))} y2={y} stroke={INK} strokeOpacity={0.55} strokeWidth={4} />
        {grow > 2 && <path d={`M ${x(2)} ${y} C ${x(2.6)} ${y} ${x(2.4)} ${yb} ${x(3)} ${yb} L ${x(Math.min(4, grow))} ${yb}${grow > 5 ? ` C ${x(4.6)} ${yb} ${x(4.4)} ${y} ${x(5)} ${y}` : ""}`} fill="none" stroke={INK} strokeOpacity={0.55 * shownBranch} strokeWidth={4} />}
        {Array.from({ length: n }, (_, i) => {
          const k = prog(time, a + i * 0.22, 0.18, easeOut);
          return <circle key={i} cx={x(i)} cy={onBranch(i) ? yb : y} r={lerp(0, 16, k)} fill={i === 5 ? INK : BG} stroke={INK} strokeWidth={4} />;
        })}
      </svg>
      {labels.map((label, i) => {
        const k = prog(time, times[i] ?? a + 0.5 + i, 0.18, easeOut);
        return (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i === 0 ? height * 0.16 : height * 0.68, textAlign: "center", fontFamily: i === 0 ? type.sans : type.serif, fontWeight: i === 0 ? 800 : 400, fontStyle: i === 0 ? "normal" : "italic", fontSize: fs, letterSpacing: "-0.03em", color: INK, opacity: k * (1 - prog(time, run, 0.3)), filter: `blur(${(1 - k) * 8}px)` }}>{label}</div>
        );
      })}
    </AbsoluteFill>
  );
};
