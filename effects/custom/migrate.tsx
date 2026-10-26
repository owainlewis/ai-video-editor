// "AX moves them onto shared infrastructure. Every agent runs isolated, in its own sandbox."
// Agents sit on a laptop; on their word they arc across into a shared cluster, then each gets its
// own sandbox drawn round it. Built for the Google AX reel (from Owain's post on the shift).
// props: { agents?: number, laptop?: string, cluster?: string, sandbox?: string, mode?: "laptop" | "blind", tags?: string[] }
// times: [agents move, cluster label lands, sandboxes draw]. mode "laptop" shows only the laptop, its
// edge warming on times[0] (a risk); mode "blind" fogs the screen on times[0] and pops one question
// tag per later time (what you can't see).
import React from "react";
import { AbsoluteFill } from "remotion";
import { easeInOut, lerp, prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

const PINE = "#2C4441";
const SAGE = "#B7CDBF";

export const Migrate: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const paper = panel && shot.tone !== "dark";
  const n = Number(props.agents ?? 6);
  const laptopOnly = props.mode === "laptop" || props.mode === "blind";
  const blind = props.mode === "blind";
  const tags = (Array.isArray(props.tags) ? props.tags : []) as string[];
  const warm = props.mode === "laptop" ? prog(time, times[0] ?? Infinity, 0.3, easeInOut) : 0;
  const fog = blind ? prog(time, times[0] ?? Infinity, 0.4, easeInOut) : 0;
  const moveAt = laptopOnly ? Infinity : (times[0] ?? shot.start + 0.6);
  const infraAt = times[1] ?? moveAt + 0.6;
  const boxAt = times[2] ?? infraAt + 1.5;
  const ink = paper ? "#1F1F1D" : "#F2EFEA";
  const muted = paper ? "#6E6B65" : "#A3A19C";
  const edge = paper ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.14)";
  const fs = Math.round(width / 22);

  // Laptop: centred when it is the whole story, on the left once agents leave it.
  const lw = width * (laptopOnly ? 0.72 : 0.4);
  const lh = lw * 0.62;
  const lx = laptopOnly ? (width - lw) / 2 : width * 0.05;
  const ly = height * 0.48 - lh / 2 - fs * 0.6;
  const appear = prog(time, shot.start, 0.35, easeInOut);
  const left = prog(time, moveAt + 0.3 + n * 0.08, 0.4, easeInOut);

  // Cluster on the right: a grid of slots, one per agent.
  const cw = width * 0.52, chh = height * 0.72;
  const cx = width * 0.46, cy = height * 0.5 - chh / 2;
  const cols = 3, rows = Math.ceil(n / cols);
  const slot = (i: number) => ({ x: cx + (cw / cols) * ((i % cols) + 0.5), y: cy + fs * 1.6 + ((chh - fs * 2.2) / rows) * (Math.floor(i / cols) + 0.5) });
  const home = (i: number) => {
    const c = 3, r = Math.ceil(n / c);
    return { x: lx + (lw / c) * ((i % c) + 0.5), y: ly + (lh / r) * (Math.floor(i / c) + 0.5) };
  };
  const clusterIn = prog(time, laptopOnly ? Infinity : moveAt - 0.1, 0.4, easeInOut);
  const label = prog(time, infraAt, 0.3, easeInOut);
  const r = fs * 0.72;

  return (
    <AbsoluteFill style={{ opacity: appear }}>
      {/* laptop */}
      <div style={{ position: "absolute", left: lx, top: ly, width: lw, height: lh, borderRadius: fs * 0.5, background: paper ? "#1A1918" : "#0F0F0E", border: `${fs * 0.25}px solid ${warm > 0.5 ? "#D97757" : paper ? "#2A2927" : "#5E5B56"}`, opacity: lerp(1, 0.4, left), boxShadow: `0 24px 60px rgba(0,0,0,0.25), 0 0 0 ${8 * warm}px rgba(217,119,87,0.3)` }} />
      <div style={{ position: "absolute", left: lx - lw * 0.08, top: ly + lh, width: lw * 1.16, height: fs * 0.55, borderRadius: `0 0 ${fs}px ${fs}px`, background: paper ? "#2A2927" : "#5E5B56", opacity: lerp(1, 0.4, left) }} />
      <div style={{ position: "absolute", left: lx, width: lw, top: ly + lh + fs * 1.1, textAlign: "center", fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.95, color: lerp(1, 0, left) > 0.5 ? ink : muted, opacity: lerp(1, 0.6, left) }}>{String(props.laptop ?? "Your laptop")}</div>

      {/* cluster */}
      <div style={{ position: "absolute", left: cx, top: cy, width: cw, height: chh, borderRadius: fs * 0.7, border: `2px dashed ${paper ? edge : "rgba(183,205,191,0.5)"}`, background: paper ? "rgba(255,255,255,0.55)" : "rgba(183,205,191,0.08)", opacity: clusterIn, scale: String(0.94 + 0.06 * clusterIn) }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: fs * 0.45, textAlign: "center", fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.95, color: ink, opacity: label }}>{String(props.cluster ?? "Shared infrastructure")}</div>
      </div>

      {/* sandboxes: one outline per agent, drawn in turn */}
      {Array.from({ length: laptopOnly ? 0 : n }, (_, i) => {
        const k = prog(time, boxAt + i * 0.08, 0.3, easeInOut);
        const s = slot(i);
        const b = fs * 2.6;
        return <div key={`b${i}`} style={{ position: "absolute", left: s.x - b / 2, top: s.y - b / 2, width: b, height: b, borderRadius: fs * 0.4, border: `2.5px solid ${paper ? PINE : SAGE}`, background: "rgba(183,205,191,0.18)", opacity: k, scale: String(0.6 + 0.4 * k) }} />;
      })}
      {!laptopOnly && (
        <div style={{ position: "absolute", left: cx, width: cw, top: cy + chh + fs * 0.5, textAlign: "center", fontFamily: type.serif, fontStyle: "italic", fontSize: fs * 0.95, color: paper ? PINE : SAGE, opacity: prog(time, boxAt + n * 0.08, 0.3) }}>{String(props.sandbox ?? "one sandbox each")}</div>
      )}

      {/* blind: the screen fogs over the agents, and a question pops for each thing you can't see */}
      {blind && (
        <div style={{ position: "absolute", left: lx + fs * 0.25, top: ly + fs * 0.25, width: lw - fs * 0.5, height: lh - fs * 0.5, borderRadius: fs * 0.3, background: `rgba(120,118,114,${0.85 * fog})`, backdropFilter: `blur(${fog * 10}px)`, zIndex: 2 }} />
      )}
      {blind &&
        tags.map((tag, i) => {
          const k = prog(time, times[i + 1] ?? Infinity, 0.25, easeInOut);
          const spots = [[lx + lw * 0.5, ly - fs * 1.2], [lx + lw * 0.5, ly + lh * 0.45], [lx + lw * 0.5, ly + lh + fs * 2.6]];
          const [x, y] = spots[i % 3];
          return (
            <div key={`q${i}`} style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", zIndex: 3, padding: `${fs * 0.35}px ${fs * 0.7}px`, borderRadius: fs, background: "#1A1918", color: "#F2EFEA", fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.95, whiteSpace: "nowrap", opacity: k, scale: String(0.8 + 0.2 * k), boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}>
              <span style={{ color: "#D97757", marginRight: fs * 0.35 }}>?</span>
              {tag}
            </div>
          );
        })}
      {/* agents: they idle on the laptop, then arc across into their slots */}
      {Array.from({ length: n }, (_, i) => {
        const a = home(i);
        const b = slot(i);
        const k = prog(time, moveAt + i * 0.06, 0.46, easeInOut);
        const bob = Math.sin(time * 3 + i * 1.7) * fs * 0.12 * (1 - k);
        const x = lerp(a.x, b.x, k);
        const y = lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * height * 0.18 + bob;
        return <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r * 2, background: k > 0.5 ? (paper ? PINE : "#E3EEE6") : SAGE, boxShadow: `0 6px 16px rgba(0,0,0,0.25), 0 0 ${fs * 0.6}px rgba(183,205,191,0.55)` }} />;
      })}
    </AbsoluteFill>
  );
};
