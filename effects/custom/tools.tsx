// The tools Owain names most (2026-10-31: "I talk about Claude Code and Codex a lot so graphics for
// those would be good"). Real logos from library/logos only, never redrawn.
//   tools  each tool lands as it is said: its logo in a dark tile, its name typing in below.
//          Later tools join beside it; the one being said is bright, the rest step back.
// props: { tools: { name: string, logo: "logo:<name>", mono?: true }[], kicker?: string }
//   mono: a black-on-white logo, shown white on the dark tile.
// times: one per tool, as it is said
import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { easeInOut, easeOut, lerp, prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

type Tool = { name: string; logo: string; mono?: boolean };

export const Tools: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const tools = (props.tools ?? []) as Tool[];
  const kicker = props.kicker ? String(props.kicker) : "";
  const at = (i: number) => times[i] ?? shot.start + 0.3 + i * 0.8;
  const said = tools.reduce((n, _, i) => (time >= at(i) - 0.1 ? i : n), -1);
  const shown = Math.max(1, said + 1);
  // Tiles share the row; the row re-centres smoothly as each new tool joins.
  const tile = Math.min(width * 0.34, height * 0.42, width / (tools.length * 1.35));
  const gap = tile * 0.35;
  const fs = Math.round(tile * 0.17);
  const join = (i: number) => prog(time, at(i) - 0.1, 0.46, easeInOut);
  const rowW = (n: number) => n * tile + (n - 1) * gap;
  const visible = tools.reduce((s, _, i) => s + (i === 0 ? 1 : join(i)), 0);
  const left = width / 2 - lerp(rowW(Math.floor(visible)), rowW(Math.ceil(visible)), visible % 1) / 2;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {kicker && (
        <div style={{ position: "absolute", top: height * 0.12, width: "100%", textAlign: "center", fontFamily: type.serif, fontStyle: "italic", fontSize: fs * 1.1, color: "#8C8C88", opacity: prog(time, shot.start, 0.3) }}>{kicker}</div>
      )}
      {tools.slice(0, shown + 1).map((tool, i) => {
        const k = i === 0 ? prog(time, Math.min(at(0) - 0.1, shot.start + 0.1), 0.18, easeOut) : prog(time, at(i) - 0.1, 0.18, easeOut);
        const active = i === said || (said < 0 && i === 0);
        const dim = active ? 1 : 0.4;
        const name = tool.name.slice(0, Math.max(0, Math.floor((time - at(i) + 0.1) / 0.035)));
        return (
          <div key={i} style={{ position: "absolute", left: left + i * (tile + gap), top: height * 0.5 - tile * 0.62, width: tile, opacity: k * lerp(1, dim, prog(time, (times[said] ?? 0) - 0.1, 0.3)), filter: `blur(${(1 - k) * 10}px)`, translate: `0 ${(1 - k) * 24}px` }}>
            <div style={{ width: tile, height: tile, borderRadius: tile * 0.24, background: "#121212", border: "1.5px solid rgba(245,245,242,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <Img src={tool.logo} style={{ width: tile * 0.56, height: tile * 0.56, objectFit: "contain", ...(tool.mono ? { filter: "invert(1)", mixBlendMode: "screen" } : {}) }} />
            </div>
            <div style={{ marginTop: tile * 0.14, textAlign: "center", fontFamily: type.sans, fontWeight: 700, fontSize: fs, letterSpacing: "-0.02em", color: "#F5F5F2", whiteSpace: "nowrap", minHeight: fs * 1.2 }}>{name || " "}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
