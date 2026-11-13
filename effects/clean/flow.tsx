// The `flow` diagram, drawn from the layout engine (engine/flow.ts): cards, arrows and labels where
// the engine puts them, nothing placed by hand. Thin lines in the palette's line colour, the accent on
// the one node that matters, each part landing on its word. Card outlines and arrows carry
// data-qc="edge", so QC measures every label's clearance from them.
import React, { useMemo } from "react";
import { Img, staticFile } from "remotion";
import type { ResolvedVisual } from "../../engine/schema";
import { accentOf, ARROW_DRAW, FLOW, flowBeats, isImageIcon, layoutFlow, TRACK, type FlowLayout } from "../../engine/flow";
import { k, move, type Palette, SANS, usePalette } from "./kit";

type FlowV = Extract<ResolvedVisual, { kind: "flow" }>;

// A card's colours on each stage: white cards on the light stage, deep cards on forest.
export const cardTone = (p: Palette) =>
  p.name === "light"
    ? { fill: "#FFFFFF", line: p.line, text: p.text, sub: "#46665B", accent: p.accent, accentFill: "#EAF3ED", item: "#FFFFFF", itemLine: "rgba(18,58,46,0.32)" }
    : { fill: "#15211B", line: p.line, text: "#FFFFFF", sub: "#BFCCC5", accent: p.accent, accentFill: "#203A2F", item: "#15211B", itemLine: "rgba(245,245,242,0.34)" };

// ---------- line icons, on a 48 grid ----------

const spokes = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4, [c, s] = [Math.cos(a), Math.sin(a)];
  return `M${24 + c * 12} ${24 + s * 12}L${24 + c * 17} ${24 + s * 17}`;
}).join("");
const GLYPHS: Record<string, string> = {
  file: "M12 5h17l9 9v29H12z M29 5v9h9 M18 24h14 M18 31h14 M18 38h8",
  folder: "M5 12h14l4 5h20v24H5z",
  terminal: "M5 9h38v30H5z M13 20l6 5-6 5 M24 31h11",
  browser: "M5 9h38v30H5z M5 17h38 M10 13h1 M15 13h1 M20 13h1",
  database: "M8 11c0-3 7-5 16-5s16 2 16 5-7 5-16 5-16-2-16-5z M8 11v26c0 3 7 5 16 5s16-2 16-5V11 M8 24c0 3 7 5 16 5s16-2 16-5",
  server: "M7 7h34v14H7z M7 27h34v14H7z M13 14h3 M13 34h3",
  cloud: "M14 37h21a8 8 0 0 0 1-16 11 11 0 0 0-21-3 9 9 0 0 0-1 19z",
  user: "M24 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M9 42c1.5-8.5 7.6-13 15-13s13.5 4.5 15 13",
  agent: "M10 16h28v24H10z M24 16V9 M24 6v1 M18 26v4 M30 26v4 M6 24v8 M42 24v8",
  chat: "M6 9h36v24H22l-9 8v-8H6z M14 18h20 M14 25h12",
  mail: "M5 11h38v26H5z M5 12l19 14 19-14",
  code: "M17 15l-9 9 9 9 M31 15l9 9-9 9 M27 10l-6 28",
  branch: "M15 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M15 34a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M33 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M15 14v20 M33 18c0 9-18 7-18 14",
  lock: "M11 22h26v20H11z M17 22v-6a7 7 0 0 1 14 0v6 M24 30v5",
  check: "M24 43a19 19 0 1 0 0-38 19 19 0 0 0 0 38z M15 24l6 6 12-12",
  gear: `M24 36a12 12 0 1 0 0-24 12 12 0 0 0 0 24z M24 29a5 5 0 1 0 0-10 5 5 0 0 0 0 10z ${spokes}`,
};
export const Glyph: React.FC<{ name: string; size: number; color: string }> = ({ name, size, color }) =>
  GLYPHS[name] ? (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block", overflow: "visible" }}>
      <path d={GLYPHS[name]} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  ) : null;

const Icon: React.FC<{ src: string; size: number; color: string; slug?: string }> = ({ src, size, color, slug }) => {
  if (!isImageIcon(src)) return <Glyph name={src} size={size} color={color} />;
  // An unresolved "logo:" (a plan the resolver has not seen) draws nothing rather than a broken image.
  if (src.startsWith("logo:")) return <div style={{ width: size, height: size }} />;
  const url = src.startsWith("data:") || /^https?:/.test(src) ? src : staticFile(`${slug}/${src}`);
  return <Img src={url} style={{ width: size, height: size, objectFit: "contain", display: "block" }} />;
};

// ---------- paths ----------

// A path through `pts` with its corners rounded, and its length (for drawing it on).
const pathOf = (pts: [number, number][], r = 18) => {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    if (i < pts.length - 1) {
      const [px, py] = pts[i - 1], [nx, ny] = pts[i + 1];
      const a = Math.min(r, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
      const [ux, uy] = [(x - px) / (Math.hypot(x - px, y - py) || 1), (y - py) / (Math.hypot(x - px, y - py) || 1)];
      const [vx, vy] = [(nx - x) / (Math.hypot(nx - x, ny - y) || 1), (ny - y) / (Math.hypot(nx - x, ny - y) || 1)];
      d += ` L${x - ux * a} ${y - uy * a} Q${x} ${y} ${x + vx * a} ${y + vy * a}`;
    } else d += ` L${x} ${y}`;
  }
  return { d, len };
};

const Arrow: React.FC<{ pts: [number, number][]; p: number; color: string }> = ({ pts, p, color }) => {
  if (p <= 0) return null;
  const { d, len } = pathOf(pts);
  const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
  const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [ux, uy] = [(b[0] - a[0]) / dl, (b[1] - a[1]) / dl];
  const h = FLOW.head, wing = h * 0.6;
  const head = `M${b[0] - ux * h - uy * wing} ${b[1] - uy * h + ux * wing} L${b[0]} ${b[1]} L${b[0] - ux * h + uy * wing} ${b[1] - uy * h - ux * wing}`;
  return (
    <g>
      <path data-qc="edge" d={d} fill="none" stroke={color} strokeWidth={FLOW.stroke} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${len * p} ${len}`} />
      {p > 0.92 && <path data-qc="edge" d={head} fill="none" stroke={color} strokeWidth={FLOW.stroke} strokeLinecap="round" strokeLinejoin="round" opacity={Math.min(1, (p - 0.92) / 0.08)} />}
    </g>
  );
};

// ---------- the view ----------

// Words as laid out, one line per row. `strike` (0 to 1) draws a line through each row, left to right.
const Words: React.FC<{ lines: string[]; size: number; color: string; weight: number; track: number; lead: number; align: "center" | "left"; strike?: number }> = ({ lines, size, color, weight, track, lead, align, strike = 0 }) => (
  <div style={{ fontFamily: SANS, fontWeight: weight, fontSize: size, lineHeight: lead, letterSpacing: `${track}em`, color, textAlign: align, whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start" }}>
    {lines.map((l, i) => (
      <span key={i} style={{ position: "relative", display: "block" }}>
        {l}
        {strike > 0 && <span style={{ position: "absolute", left: -6, top: "54%", width: `calc(${strike * 100}% + 12px)`, height: Math.max(4, size * 0.08), marginTop: -Math.max(2, size * 0.04), borderRadius: 4, background: color }} />}
      </span>
    ))}
  </div>
);

export const FlowView: React.FC<{ v: FlowV; time: number; start: number; w: number; h: number; slug?: string }> = ({ v, time: t, start, w, h, slug }) => {
  const L: FlowLayout = useMemo(() => layoutFlow(v, w, h), [v, w, h]);
  const c = cardTone(usePalette());
  const beats = flowBeats(v, start, v.times ?? []);
  const hot = accentOf(v);
  const strike = beats.strike;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {L.cards.map((b, i) => {
          const p = k(t, beats.nodes[i], 0.5);
          if (p <= 0) return null;
          const accent = i === hot && (v.shape !== "before-after" || t >= beats.nodes[i]);
          const len = 2 * (b.w + b.h);
          // The old one in a before/after fades back once it is struck.
          const dim = strike !== undefined && i === 0 ? 1 - 0.55 * k(t, strike + 0.15, 0.3) : 1;
          return (
            <g key={i} opacity={dim}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={L.radius} fill={accent ? c.accentFill : c.fill} opacity={p} />
              <rect data-qc="edge" x={b.x} y={b.y} width={b.w} height={b.h} rx={L.radius} fill="none" stroke={accent ? c.accent : c.line} strokeWidth={accent ? 4 : 2.5} strokeDasharray={`${len * p} ${len}`} />
            </g>
          );
        })}
        {L.items.map((b) => {
          const p = k(t, beats.items[b.node][b.item], 0.4);
          if (p <= 0) return null;
          const len = 2 * (b.w + b.h);
          return (
            <g key={`${b.node}-${b.item}`}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={L.radius * 0.7} fill={c.item} opacity={p} />
              <rect data-qc="edge" x={b.x} y={b.y} width={b.w} height={b.h} rx={L.radius * 0.7} fill="none" stroke={c.itemLine} strokeWidth={2} strokeDasharray={`${len * p} ${len}`} />
            </g>
          );
        })}
        {L.arrows.map((a, j) => (
          <Arrow key={j} pts={a.points} p={move(t, beats.arrows[j].t, ARROW_DRAW)} color={c.line} />
        ))}
      </svg>

      {L.cards.map((b, i) => {
        const nd = v.nodes[i];
        const q = k(t, beats.nodes[i] + 0.1, 0.3);
        if (q <= 0) return null;
        const accent = i === hot;
        const struck = strike !== undefined && i === 0 ? k(t, strike + 0.05, 0.3) : 0;
        const tile = b.mode === "tile";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x + L.pad,
              top: b.y + L.pad,
              width: b.w - 2 * L.pad,
              height: b.h - 2 * L.pad,
              display: "flex",
              flexDirection: tile ? "column" : "row",
              alignItems: "center",
              justifyContent: "center",
              gap: Math.round(L.size * 0.42),
              opacity: q * (1 - 0.55 * struck),
              filter: `blur(${(1 - q) * 8}px)`,
              transform: `translateY(${(1 - q) * 16}px)`,
            }}
          >
            {nd.icon && <Icon src={nd.icon} size={L.icon} color={accent ? c.accent : c.line} slug={slug} />}
            <div style={{ display: "flex", flexDirection: "column", alignItems: tile ? "center" : "flex-start", gap: Math.round(L.size * 0.22), position: "relative", flex: tile ? undefined : 1, minWidth: 0 }}>
              <Words lines={b.label} size={L.size} color={c.text} weight={700} track={TRACK.label} lead={1.12} align={tile ? "center" : "left"} strike={struck} />
              {b.sub.length > 0 && <Words lines={b.sub} size={L.sub} color={c.sub} weight={400} track={TRACK.text} lead={1.25} align={tile ? "center" : "left"} />}
            </div>
          </div>
        );
      })}

      {L.arrows.map((a, j) =>
        a.label ? (
          <div key={j} style={{ position: "absolute", left: a.label.x, top: a.label.y, width: a.label.w, height: a.label.h, display: "flex", alignItems: "center", justifyContent: "center", opacity: k(t, beats.arrows[j].t + 0.25, 0.25) }}>
            <Words lines={[a.label.text]} size={a.label.size} color={c.sub} weight={500} track={TRACK.text} lead={1.2} align="center" />
          </div>
        ) : null,
      )}

      {L.items.map((b) => {
        const at = beats.items[b.node][b.item];
        const q = k(t, at + 0.08, 0.3);
        if (q <= 0) return null;
        return (
          <div key={`${b.node}-${b.item}`} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, display: "flex", alignItems: "center", justifyContent: "center", opacity: q, transform: `translateY(${(1 - q) * 12}px)` }}>
            <Words lines={b.lines} size={L.itemSize} color={c.text} weight={500} track={TRACK.text} lead={1.25} align="center" />
          </div>
        );
      })}

      {L.vs && (
        <div style={{ position: "absolute", left: L.vs.x, top: L.vs.y, width: L.vs.w, height: L.vs.h, display: "flex", alignItems: "center", justifyContent: "center", opacity: k(t, Math.max(beats.nodes[0], beats.nodes[1] ?? 0), 0.3) }}>
          <Words lines={["vs"]} size={L.vs.size} color={c.sub} weight={700} track={TRACK.label} lead={1.2} align="center" />
        </div>
      )}
    </div>
  );
};
