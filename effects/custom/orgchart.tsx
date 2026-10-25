// "Turns Claude Code into an entire company": Claude Code at the top, lines drawing out to the
// divisions, each division sprouting a couple of its real agents. Built for the Agency Agents reel.
// props: { root: string, branches: [{ label, color, agents: string[] }] }
// times: [root lands, lines start drawing]
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { easeInOut, prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

type Branch = { label: string; color: string; agents?: string[] };

export const OrgChart: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const root = String(props.root ?? "Claude Code");
  const branches = (props.branches ?? []) as Branch[];
  const rootAt = times[0] ?? shot.start;
  const growAt = times[1] ?? rootAt + 0.5;
  const fs = Math.round(width / 20);
  const ink = panel ? "#1F1F1D" : "#F2EFEA";
  const muted = panel ? "#6E6B65" : "#A3A19C";
  const card = panel ? "#FBFAF7" : "#232220";
  const edge = panel ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.09)";
  // The whole chart drifts closer over the shot, so it never sits still.
  const push = interpolate(time, [shot.start, shot.end], [0.95, 1.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // A vertical tree, so names stay large on a phone: Claude Code on top, a trunk down the left,
  // each division a row with its agents beside it.
  const n = branches.length;
  const rootH = fs * 2.1;
  const top = height * 0.06;
  const rowGap = Math.min(fs * 2.9, (height - top - rootH - fs * 1.5) / Math.max(1, n));
  // Centred: the tree is about 14 type sizes wide (trunk, a division, its agents).
  const trunkX = Math.max(fs * 1.6, (width - fs * 14) / 2);
  const rows = branches.map((b, i) => ({ ...b, y: top + rootH + fs * 1.2 + i * rowGap + rowGap / 2, at: growAt + i * 0.1 }));
  const r = prog(time, rootAt, 0.3, easeInOut);
  const trunk = prog(time, growAt, 0.35 + n * 0.1, easeInOut);
  const lastY = rows.length ? rows[rows.length - 1].y : top + rootH;

  return (
    <AbsoluteFill style={{ scale: String(push) }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={`M ${trunkX} ${top + rootH} L ${trunkX} ${lastY}`} pathLength={1} fill="none" stroke={edge.replace(/0\.09\)/, "0.3)")} strokeWidth={3} strokeLinecap="round" strokeDasharray="1" strokeDashoffset={1 - trunk} />
        {rows.map((row, i) => {
          const k = prog(time, row.at + 0.2, 0.25, easeInOut);
          return <path key={i} d={`M ${trunkX} ${row.y} L ${trunkX + fs * 1.4} ${row.y}`} pathLength={1} fill="none" stroke={row.color} strokeWidth={3} strokeLinecap="round" strokeDasharray="1" strokeDashoffset={1 - k} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: trunkX - fs * 0.9, top, height: rootH, display: "flex", alignItems: "center", gap: fs * 0.5, padding: `0 ${fs * 1}px`, borderRadius: fs * 0.6, background: "#1A1918", color: "#F2EFEA", fontFamily: type.sans, fontWeight: 700, fontSize: fs * 1.05, boxShadow: `0 ${24 * r}px ${60 * r}px rgba(0,0,0,0.35)`, opacity: r, scale: String(0.85 + 0.15 * r), transformOrigin: "left center", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: '"SF Mono", Menlo, monospace', color: "#D97757" }}>&gt;_</span>
        {root}
      </div>
      {rows.map((row, i) => {
        const k = prog(time, row.at + 0.35, 0.22, easeInOut);
        return (
          <div key={i} style={{ position: "absolute", left: trunkX + fs * 1.5, top: row.y, translate: "0 -50%", display: "flex", alignItems: "center", gap: fs * 0.4, opacity: k }}>
            <div style={{ padding: `${fs * 0.28}px ${fs * 0.55}px`, borderRadius: fs, background: row.color, color: "#FFFFFF", fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.8, whiteSpace: "nowrap", boxShadow: `0 10px 26px ${row.color}55`, scale: String(0.8 + 0.2 * k), transformOrigin: "left center" }}>{row.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: fs * 0.18 }}>
            {(row.agents ?? []).map((a, j) => {
              const q = prog(time, row.at + 0.5 + j * 0.08, 0.2);
              return (
                <div key={j} style={{ padding: `${fs * 0.22}px ${fs * 0.45}px`, borderRadius: fs * 0.4, background: card, border: `1px solid ${edge}`, color: j ? muted : ink, fontFamily: type.sans, fontWeight: 600, fontSize: fs * 0.6, whiteSpace: "nowrap", opacity: q, translate: `${(1 - q) * -12}px 0` }}>{a}</div>
              );
            })}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
