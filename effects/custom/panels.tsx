// Diagrams drawn as panels (Owain, 2026-11-09: "my graphics feel muddy"): the content carries the frame.
// Real panels, the real Elephant and Goldfish marks, thin lines, no empty shapes. Bars stand for text.
//   panelminds  the full context agent drafts a page; isolated sub-agents read it from different places
//     props: { knows: [4], page, zero, isolated, ends }   at: [agent, each of knows, page, zero, angles, isolated, ends]
//   panellens   a document; empty goldfish each read a different part of it
//     props: { file, label, angles: [3] }   at: [document, each angle]
import React from "react";
import { FAST, lerp, MOVE, prog } from "../motion";
import { pal } from "../soft";
import { t as type } from "../theme";
import { ELEPHANT, GOLDFISH } from "./egmicons";
import type { CustomProps } from "./index";

const kit = ({ shot, width, height }: CustomProps) => {
  const tone = shot.tone ?? "light", c = pal(tone), u = Math.min(width / 1000, height / 580);
  const panel: React.CSSProperties = { background: tone === "light" ? "#FBF9F4" : c.chip, border: `${1.2 * u}px solid ${c.line}`, borderRadius: 14 * u, boxSizing: "border-box" };
  const word = (size: number, weight: number, color: string = c.ink): React.CSSProperties => ({ fontFamily: type.sans, fontSize: size * u, fontWeight: weight, color, letterSpacing: "-0.01em", lineHeight: 1.15 });
  return { c, u, cx: width / 2, cy: height / 2, panel, word };
};
const shown = (t: number, at: number, extra: React.CSSProperties = {}): React.CSSProperties => ({ position: "absolute", opacity: prog(t, at, FAST), ...extra });
const BAR_WIDTH = [1, 0.74, 0.9, 0.62, 0.95, 0.7, 0.86, 0.55];

export const PanelMinds: React.FC<CustomProps> = (p) => {
  const { time: t, times, props, width, height } = p, { c, u, cx, cy, panel, word } = kit(p);
  const at = (i: number) => times[i] ?? 0;
  const knows = props.knows as string[], n = knows.length;
  const PAGE = n + 1, ZERO = n + 2, ANGLES = n + 3, WALL = n + 4, ENDS = n + 5;
  const left = cx - 463 * u, lw = 306 * u, lh = 344 * u, ly = cy - lh / 2 - 22 * u;
  const sx = cx - 115 * u, sw = 206 * u;
  const wall = cx + 129 * u, rx = cx + 167 * u, rw = 296 * u, gap = 22 * u, rh = (lh - 2 * gap) / 3;
  const rowY = (i: number) => ly + i * (rh + gap), barY = (i: number) => ly + 78 * u + i * 31 * u;
  // Each reader takes the page from a different place: "lots of different angles".
  const reads = [1, 4, 6];
  const arrow = prog(t, at(PAGE), MOVE), mid = ly + lh / 2;
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {arrow > 0 && <line x1={left + lw + 10 * u} y1={mid} x2={lerp(left + lw + 10 * u, sx - 12 * u, arrow)} y2={mid} stroke={c.ink} strokeWidth={2.4 * u} strokeLinecap="round" />}
        {arrow >= 1 && <polygon points={`${sx - 8 * u},${mid} ${sx - 22 * u},${mid - 8 * u} ${sx - 22 * u},${mid + 8 * u}`} fill={c.ink} />}
        {reads.map((row, i) => {
          const g = prog(t, at(ANGLES) + i * 0.25, MOVE), x0 = sx + sw + 4 * u, y0 = barY(row) + 4 * u;
          return g > 0 ? <line key={i} x1={x0} y1={y0} x2={lerp(x0, rx - 8 * u, g)} y2={lerp(y0, rowY(i) + rh / 2, g)} stroke={c.accent} strokeWidth={2.4 * u} /> : null;
        })}
        <line x1={wall} y1={ly - 8 * u} x2={wall} y2={ly - 8 * u + (lh + 16 * u) * prog(t, at(WALL), MOVE)} stroke={c.muted} strokeWidth={2 * u} strokeDasharray={`${7 * u} ${7 * u}`} />
      </svg>

      <div style={shown(t, at(0), { ...panel, left, top: ly, width: lw, height: lh, padding: 22 * u })}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 * u }}>
          <img src={ELEPHANT} style={{ height: 44 * u }} />
          <div style={word(29, 700)}>Full context agent</div>
        </div>
        <div style={{ height: 1.2 * u, background: c.line, margin: `${20 * u}px 0 ${12 * u}px` }} />
        {knows.map((w, i) => (
          <div key={i} style={{ ...word(25, 500), opacity: prog(t, at(i + 1), FAST), padding: `${9 * u}px 0`, whiteSpace: "nowrap" }}>{w}</div>
        ))}
      </div>

      <div style={shown(t, at(PAGE), { ...panel, left: sx, top: ly, width: sw, height: lh })}>
        <div style={{ ...word(24, 700), padding: `${22 * u}px ${18 * u}px` }}>{String(props.page)}</div>
      </div>
      {BAR_WIDTH.map((b, i) => {
        const r = reads.indexOf(i);
        return <div key={i} style={shown(t, at(PAGE), { left: sx + 20 * u, top: barY(i), height: 8 * u, borderRadius: 4 * u, width: (sw - 40 * u) * b, background: r >= 0 && t >= at(ANGLES) + r * 0.25 ? c.accent : c.line })} />;
      })}

      {[0, 1, 2].map((i) => (
        <div key={i} style={shown(t, at(ZERO) + i * 0.12, { ...panel, left: rx, top: rowY(i), width: rw, height: rh, display: "flex", alignItems: "center", gap: 18 * u, padding: `0 ${22 * u}px` })}>
          <img src={GOLDFISH} style={{ height: 46 * u }} />
          <div>
            <div style={word(27, 700)}>Sub-agent</div>
            <div style={{ ...word(23, 500, c.muted), marginTop: 3 * u }}>{String(props.zero)}</div>
          </div>
        </div>
      ))}

      <div style={shown(t, at(WALL), { left: wall - 130 * u, top: ly - 48 * u, width: 260 * u, textAlign: "center", ...word(24, 500, c.muted) })}>{String(props.isolated)}</div>
      <div style={shown(t, at(ENDS), { left: cx - 400 * u, top: ly + lh + 34 * u, width: 800 * u, textAlign: "center", ...word(34, 700) })}>{String(props.ends)}</div>
    </>
  );
};

export const PanelLens: React.FC<CustomProps> = (p) => {
  const { time: t, times, props, width, height } = p, { c, u, cx, cy, panel, word } = kit(p);
  const at = (i: number) => times[i] ?? 0;
  const angles = (props.angles as string[]).slice(0, 3);
  const h = 370 * u, y = cy - h / 2 + 18 * u, dw = 320 * u, dx = cx - 430 * u, rx = cx + 40 * u, rw = 390 * u, gap = 22 * u, rh = (h - 2 * gap) / 3;
  const rowY = (i: number) => y + i * (rh + gap), barY = (i: number) => y + 84 * u + i * 33 * u;
  const reads = [1, 4, 6];
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {angles.map((_, i) => {
          const g = prog(t, at(i + 1), MOVE), x0 = dx + dw + 4 * u, y0 = barY(reads[i]) + 4 * u;
          return g > 0 ? <line key={i} x1={x0} y1={y0} x2={lerp(x0, rx - 8 * u, g)} y2={lerp(y0, rowY(i) + rh / 2, g)} stroke={c.accent} strokeWidth={2.4 * u} /> : null;
        })}
      </svg>
      <div style={shown(t, at(0), { ...panel, left: dx, top: y, width: dw, height: h })}>
        <div style={{ ...word(29, 700), padding: `${24 * u}px ${24 * u}px` }}>{String(props.file)}</div>
      </div>
      {BAR_WIDTH.map((b, i) => {
        const r = reads.indexOf(i);
        return <div key={i} style={shown(t, at(0), { left: dx + 24 * u, top: barY(i), height: 9 * u, borderRadius: 4.5 * u, width: (dw - 48 * u) * b, background: r >= 0 && t >= at(r + 1) ? c.accent : c.line })} />;
      })}
      <div style={shown(t, at(0), { left: rx, top: y - 48 * u, width: rw, ...word(26, 500, c.muted) })}>{String(props.label)}</div>
      {angles.map((a, i) => (
        <div key={i} style={shown(t, at(i + 1), { ...panel, left: rx, top: rowY(i), width: rw, height: rh, display: "flex", alignItems: "center", gap: 22 * u, padding: `0 ${26 * u}px` })}>
          <img src={GOLDFISH} style={{ height: 52 * u }} />
          <div style={word(34, 700)}>{a}</div>
        </div>
      ))}
    </>
  );
};
