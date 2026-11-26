// The `chart` in the clean kit (2026-11-26): a bar or line chart on a white card, in the diagram
// cards' neutral look (near-black type, grey bars and guides, the accent on the point that matters).
// Each point grows on its word; its value lands as it settles, never counting through numbers nobody
// said. The source prints at the foot: the page the numbers come from, or "Illustration".
import React from "react";
import type { ResolvedVisual } from "../../engine/schema";
import { fmt } from "../elements";
import { cardTone } from "./flow";
import { k, move, SANS, usePalette } from "./kit";

type ChartV = Extract<ResolvedVisual, { kind: "chart" }>;

const GROW = 0.6;

export const ChartView: React.FC<{
  v: ChartV;
  time: number;
  start: number;
  w: number;
  h: number;
}> = ({ v, time: t, start, w, h }) => {
  const c = cardTone(usePalette());
  const u = Math.max(0.75, Math.min(1.15, w / 960, h / 724));
  const n = v.points.length;
  const times = v.points.map((_, i) => v.times?.[i] ?? start + 0.25 + i * 0.25);
  const hi = v.highlight ?? n - 1;
  const max = Math.max(...v.points.map((p) => p.value)) || 1;
  const pad = 52 * u;
  const titleH = v.title ? 64 * u : 0;
  const foot = 56 * u;
  // Room above the tallest bar for its value, and below the baseline for the labels.
  const top = pad + titleH + 76 * u;
  const base = h - pad - foot - 52 * u;
  const plotH = base - top;
  const left = pad,
    right = w - pad,
    plotW = right - left;
  const y = (val: number) => base - (val / max) * plotH;
  const grow = (i: number) => move(t, times[i], GROW);
  const label = {
    fontFamily: SANS,
    fontWeight: 500,
    fontSize: 30 * u,
    color: c.sub,
    letterSpacing: "-0.01em",
  } as const;
  const value = (on: boolean) =>
    ({
      fontFamily: SANS,
      fontWeight: 700,
      fontSize: (on ? 50 : 38) * u,
      color: on ? c.accent : c.text,
      letterSpacing: "-0.02em",
      lineHeight: 1,
    }) as const;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 28 * u,
        background: c.fill,
        border: `${c.weight}px solid ${c.line}`,
        boxShadow: c.shadow ? "0 6px 22px rgba(17,17,17,0.06)" : "none",
        boxSizing: "border-box",
      }}
    >
      {v.title && (
        <div
          style={{
            position: "absolute",
            left: pad,
            top: pad,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 42 * u,
            letterSpacing: "-0.02em",
            color: c.text,
            whiteSpace: "nowrap",
          }}
        >
          {v.title}
        </div>
      )}
      {/* Three quiet guides and a firmer baseline, there on the cut: only the data moves. */}
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {[0.5, 1].map((g) => (
          <line key={g} x1={left} x2={right} y1={base - plotH * g} y2={base - plotH * g} stroke={c.line} strokeWidth={1.5} strokeDasharray="6 8" />
        ))}
        <line data-qc="edge" x1={left} x2={right} y1={base} y2={base} stroke={c.wire} strokeWidth={2} />
        {v.type === "line" && <Line v={v} t={t} times={times} xs={lineXs(n, left, plotW)} y={y} base={base} c={c} hi={hi} u={u} />}
      </svg>
      {v.type === "bar"
        ? v.points.map((pt, i) => {
            const slot = plotW / n;
            const bw = Math.min(150 * u, slot * 0.58);
            const x = left + slot * i + (slot - bw) / 2;
            const g = grow(i);
            const bh = Math.max(pt.value > 0 && g > 0 ? 6 : 0, (pt.value / max) * plotH * g);
            const on = i === hi;
            const shown = k(t, times[i] + GROW * 0.7, 0.2);
            return (
              <React.Fragment key={i}>
                {/* An upper bound is a dashed outline, not a filled bar: a limit, not a result. */}
                <div
                  data-qc="mark"
                  style={{
                    position: "absolute",
                    left: x,
                    width: bw,
                    top: base - bh,
                    height: bh,
                    boxSizing: "border-box",
                    borderRadius: `${12 * u}px ${12 * u}px 0 0`,
                    background: pt.bound ? "transparent" : on ? c.accent : "#C9CCC8",
                    border: pt.bound ? `3px dashed ${on ? c.accent : c.sub}` : "none",
                    borderBottom: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: x - 40 * u,
                    width: bw + 80 * u,
                    top: base - bh - (on ? 66 : 54) * u,
                    textAlign: "center",
                    opacity: shown,
                    ...value(on),
                  }}
                >
                  {pt.bound ? "≤" : ""}
                  {fmt(pt.value, v.unit)}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: x - 50 * u,
                    width: bw + 100 * u,
                    top: base + 18 * u,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    ...label,
                  }}
                >
                  {pt.label}
                </div>
              </React.Fragment>
            );
          })
        : lineLabels(v, t, times, lineXs(n, left, plotW), y, base, hi, u, label, value)}
      <div
        style={{
          position: "absolute",
          left: pad,
          bottom: pad - 8 * u,
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 26 * u,
          color: c.sub,
          whiteSpace: "nowrap",
        }}
      >
        {v.source}
      </div>
    </div>
  );
};

// The points' x positions: room on the left for the first value and on the right for the big one.
const lineXs = (n: number, left: number, plotW: number) => range(n).map((i) => left + 70 + ((plotW - 70 - 220) * i) / Math.max(1, n - 1));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

type Tone = ReturnType<typeof cardTone>;

// The line draws through each point as it is said; a faint wash of the accent fills under it.
const Line: React.FC<{
  v: ChartV;
  t: number;
  times: number[];
  xs: number[];
  y: (n: number) => number;
  base: number;
  c: Tone;
  hi: number;
  u: number;
}> = ({ v, t, times, xs, y, base, c, hi, u }) => {
  const n = v.points.length;
  // How far along the line has drawn: segment by segment, each reaching its point on its word.
  let reach = xs[0];
  for (let i = 1; i < n; i++) reach = Math.max(reach, xs[i - 1] + (xs[i] - xs[i - 1]) * move(t, times[i] - 0.1, GROW));
  const on0 = k(t, times[0], 0.2);
  const pts = v.points.map((p, i) => `${xs[i]},${y(p.value)}`).join(" L");
  const id = `chart-clip-${Math.round(times[0] * 100)}`;
  return (
    <g opacity={on0}>
      <defs>
        <clipPath id={id}>
          <rect x={0} y={0} width={reach} height={base + 10} />
        </clipPath>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.accent} stopOpacity={0.14} />
          <stop offset="1" stopColor={c.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id})`}>
        <path d={`M${pts} L${xs[n - 1]} ${base} L${xs[0]} ${base} Z`} fill={`url(#${id}-fill)`} />
        <path d={`M${pts}`} fill="none" stroke={c.accent} strokeWidth={5 * u} strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {v.points.map((p, i) => (
        <circle
          data-qc="mark"
          key={i}
          cx={xs[i]}
          cy={y(p.value)}
          r={(i === hi ? 12 : 8) * u}
          fill={i === hi ? c.accent : c.fill}
          stroke={c.accent}
          strokeWidth={4 * u}
          opacity={k(t, times[i] + GROW * 0.6, 0.2)}
        />
      ))}
    </g>
  );
};

const lineLabels = (
  v: ChartV,
  t: number,
  times: number[],
  xs: number[],
  y: (n: number) => number,
  base: number,
  hi: number,
  u: number,
  label: React.CSSProperties,
  value: (on: boolean) => React.CSSProperties,
) =>
  v.points.map((p, i) => {
    const shown = k(t, times[i] + GROW * 0.6, 0.2);
    const on = i === hi;
    return (
      <React.Fragment key={i}>
        <div
          style={{
            position: "absolute",
            left: xs[i] - 80 * u,
            width: 160 * u,
            top: base + 18 * u,
            textAlign: "center",
            whiteSpace: "nowrap",
            ...label,
          }}
        >
          {p.label}
        </div>
        {on ? (
          <div
            style={{
              position: "absolute",
              left: xs[i] + 28 * u,
              top: y(p.value) - 30 * u,
              opacity: shown,
              whiteSpace: "nowrap",
            }}
          >
            <div style={value(true)}>{fmt(p.value, v.unit)}</div>
            {p.note && <div style={{ ...label, fontSize: 26 * u, marginTop: 8 * u }}>{p.note}</div>}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: xs[i] - 70 * u,
              width: 140 * u,
              top: y(p.value) - 64 * u,
              textAlign: "center",
              opacity: shown,
              ...value(false),
              fontSize: 30 * u,
            }}
          >
            {fmt(p.value, v.unit)}
          </div>
        )}
      </React.Fragment>
    );
  });
