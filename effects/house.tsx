// The house motion library (2026-11-02, "less AI slop"): three graphics drawn for Owain's style
// instead of a card with a small label and outlined rows. Big type, no boxes around text, one
// accent, things not yet said stay away, and every part lands on its word.
//   words  big lines of type beside the speaker, over the picture, each on its word
//   focus  one item at a time, huge; as the next lands, the last one moves up into a quiet column
//   shift  the old way, then the new: the old moves up, dims and is struck through
//   map    a diagram drawn large: nodes land, arrows draw between them, a dot travels the newest one
// Each fills whatever box it is given (a reel's panel, the 16:9 frame), sizing type to the box.
import React from "react";
import { interpolate } from "remotion";
import type { ResolvedShot, ResolvedVisual } from "../engine/schema";
import { easeInOut, FAST, lerp, MOVE, prog, runs } from "./motion";
import { pal, type Tone, type V } from "./soft";
import { t } from "./theme";

type Props<K extends ResolvedVisual["kind"]> = { shot: ResolvedShot; time: number; w: number; h: number; v: V<K> };

const toneOf = (shot: ResolvedShot): Tone => shot.tone ?? "light";
// When part n lands: its word, or in turn after the shot starts.
const when = (v: { times?: number[] }, n: number, shot: ResolvedShot) => v.times?.[n] ?? shot.start + 0.3 + n * 0.9;
// Everything leaves together, softly, as the shot ends.
const leave = (time: number, shot: ResolvedShot) => 1 - prog(time, shot.end - 0.35, 0.35, easeInOut);
const plain = (s: string) => s.replace(/\*/g, "");

// A line with its *marked* words in Signifier italic and a thin rule that draws under them after it
// lands. A rule, not a highlighter box: on black a translucent box reads as a grey slab.
const Line: React.FC<{ text: string; time: number; at: number; accent: string; light: boolean }> = ({ text, time, at, accent }) => (
  <>
    {runs(text).map((r, i) =>
      r.marked ? (
        <span key={i} style={{ position: "relative", display: "inline-block", fontFamily: t.serif, fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.01em", fontSize: "1.08em" }}>
          {r.text}
          <span style={{ position: "absolute", left: "0.04em", right: "0.04em", bottom: "-0.1em", height: "0.05em", minHeight: 2, background: accent, transformOrigin: "left", scale: `${prog(time, at + 0.45, 0.4, easeInOut)} 1` }} />
        </span>
      ) : (
        <React.Fragment key={i}>{r.text}</React.Fragment>
      ),
    )}
  </>
);

// The size that fits the longest line in `width`, capped by height.
const fit = (lines: string[], width: number, cap: number) => Math.min(cap, width / (Math.max(...lines.map((l) => plain(l).length), 4) * 0.52));

export const WordsVisual: React.FC<Props<"words"> & { align?: "left" | "right" | "center"; ink?: string }> = ({ shot, time, w, h, v, align = "left", ink }) => {
  const c = pal(toneOf(shot));
  const fs = fit(v.lines.map((l) => l.text), w * 0.92, (h * 0.8) / (v.lines.length * 1.05));
  const out = leave(time, shot);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", textAlign: align, opacity: out, filter: `blur(${(1 - out) * 10}px)` }}>
      {v.lines.map((l, i) => {
        const at = when(v, i, shot);
        const k = prog(time, at, FAST);
        return (
          <div key={i} style={{ fontFamily: t.sans, fontWeight: 700, fontSize: fs, lineHeight: 1.04, letterSpacing: "-0.035em", color: ink ?? c.ink, opacity: k, filter: `blur(${(1 - k) * 12}px)`, translate: `0 ${(1 - k) * fs * 0.18}px`, whiteSpace: "nowrap" }}>
            <Line text={l.text} time={time} at={at} accent={c.accent} light={!ink && toneOf(shot) === "light"} />
          </div>
        );
      })}
    </div>
  );
};

// `words` over the 16:9 picture: in the open side of the frame, away from the face.
export const WordsOver: React.FC<{ shot: ResolvedShot; time: number; v: V<"words">; face: number; width: number; height: number }> = ({ shot, time, v, face, width, height }) => {
  const side = v.side === "auto" || !v.side ? (face < 0.5 ? "right" : "left") : v.side;
  const boxW = side === "center" ? width * 0.8 : width * 0.44;
  const x = side === "left" ? width * 0.07 : side === "right" ? width - width * 0.07 - boxW : (width - boxW) / 2;
  return (
    <div style={{ position: "absolute", left: x, top: height * 0.15, width: boxW, height: height * 0.7 }}>
      <WordsVisual shot={shot} time={time} w={boxW} h={height * 0.7} v={v} align={side === "center" ? "center" : side} ink={pal("dark").ink} />
    </div>
  );
};

export const FocusVisual: React.FC<Props<"focus">> = ({ shot, time, w, h, v }) => {
  const c = pal(toneOf(shot));
  const pad = w * 0.07;
  // Each item as big as its own words allow, so a short one ("Skills") lands huge. The column
  // they move into is one size for all, and never under 30 px.
  const bigs = v.items.map((it) => fit([it.text], w - pad * 2 - w * 0.08, h * 0.2));
  const big = Math.max(...bigs);
  const col = Math.max(30, Math.min(h * 0.06, Math.min(...bigs) * 0.6));
  const row = col * 1.45;
  // The whole block (title, the column the items move into, the current item) sits centred.
  const titleFs = Math.max(col * 1.1, 30);
  const titleH = v.title ? titleFs * 1.5 : 0;
  const block = titleH + row * (v.items.length - 1) + col + big * 1.1;
  const head = Math.max(h * 0.06, (h - block) / 2);
  const top = head + titleH;
  const bigY = top + row * (v.items.length - 1) + col;
  const out = leave(time, shot);
  return (
    <div style={{ position: "relative", width: w, height: h, opacity: out, filter: `blur(${(1 - out) * 10}px)` }}>
      {v.title && (
        <div style={{ position: "absolute", left: pad, top: head, fontFamily: t.serif, fontStyle: "italic", fontSize: titleFs, color: c.muted, opacity: prog(time, shot.start, FAST) }}>
          {plain(v.title)}
        </div>
      )}
      {v.items.map((it, i) => {
        const at = when(v, i, shot);
        const next = i + 1 < v.items.length ? when(v, i + 1, shot) : Infinity;
        const k = prog(time, at, FAST);
        // It starts moving up just before the next word, so the new item lands on a clear stage
        // even when the two are said half a second apart.
        const m = prog(time, next - 0.3, 0.4, easeInOut);
        const y = lerp(bigY, top + row * i, m);
        const size = bigs[i];
        const s = lerp(1, col / size, m);
        return (
          <div key={i} style={{ position: "absolute", left: pad, top: y, transformOrigin: "0 0", scale: `${s}`, display: "flex", alignItems: "baseline", gap: size * 0.3, opacity: k * lerp(1, 0.62, m), filter: `blur(${(1 - k) * 12}px)`, translate: `0 ${(1 - k) * size * 0.2}px`, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: t.serif, fontStyle: "italic", fontSize: size * 0.9, color: c.muted }}>{i + 1}</span>
            <span style={{ fontFamily: t.sans, fontWeight: 700, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.05, color: c.ink }}>
              <Line text={it.text} time={time} at={at} accent={c.accent} light={toneOf(shot) === "light"} />
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Where a line from the centre of a box towards (dx, dy) leaves the box.
const exit = (cx: number, cy: number, bw: number, bh: number, dx: number, dy: number) => {
  const sx = dx ? bw / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? bh / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
};

// A label over ten letters on two balanced lines, split at the space nearest its middle.
const wrap = (label: string) => {
  if (label.length <= 10 || !label.includes(" ")) return [label];
  const spaces = [...label.matchAll(/ /g)].map((m) => m.index!);
  const cut = spaces.reduce((best, i) => (Math.abs(i - label.length / 2) < Math.abs(best - label.length / 2) ? i : best), spaces[0]);
  return [label.slice(0, cut), label.slice(cut + 1)];
};

// Nodes placed where the plan says ([0..1] of the box), else in two rows.
export const mapLayout = (v: V<"map">) => {
  const n = v.nodes.length;
  return v.nodes.map((node, i) => {
    if (node.x !== undefined && node.y !== undefined) return [node.x, node.y];
    const perRow = Math.ceil(n / 2);
    const r = Math.floor(i / perRow);
    const col = i % perRow;
    return [(col + 0.5 + (r ? 0.5 : 0)) / (perRow + 0.5), r ? 0.7 : 0.3];
  });
};

export const MapVisual: React.FC<Props<"map">> = ({ shot, time, w, h, v }) => {
  const c = pal(toneOf(shot));
  // A long label takes two lines, so a row of nodes keeps its type big.
  const lines = v.nodes.map((n) => wrap(n.label));
  const widest = Math.max(...lines.flat().map((l) => l.length), 4);
  const own = lines.map((ls) => Math.max(...ls.map((l) => l.length)) * 0.56 + 1.6);
  const label = Math.max(0, ...v.edges.map((e) => (e.label ?? "").length));
  const placed = v.nodes.some((n) => n.x !== undefined);
  const n = v.nodes.length;
  // A row: nodes as wide as their words, with gaps that fit the longest arrow label, filling the
  // width. A column: nodes stacked, labels beside the arrows. A column wins only when its type is
  // bigger, since a flow reads most naturally left to right. Six or seven, or nodes the plan
  // places itself, use the grid layout.
  const gapEm = Math.max(1.8, label * 0.34 + 0.8);
  const rowFs = Math.min(h * 0.15, (w * 0.92) / (own.reduce((a, b) => a + b, 0) + (n - 1) * gapEm));
  const colFs = Math.min(h * 0.15, (h * 0.86) / (n * 1.1 * Math.max(...lines.map((l) => l.length)) + n * 1.0 + (n - 1) * 1.6), (w * 0.86) / Math.max(...own));
  const mode = placed || n > 5 ? "grid" : colFs > rowFs * 1.1 ? "column" : "row";
  const grid = mapLayout(v);
  const gridFs = Math.min(h * 0.07, (w * 0.86) / Math.ceil(n / 2) / (widest * 0.56 + 2.4));
  const fs = mode === "row" ? rowFs : mode === "column" ? colFs : gridFs;
  const padX = fs * 0.8;
  const padY = fs * 0.5;
  const sizes = lines.map((ls) => ({ bw: Math.max(...ls.map((l) => l.length)) * fs * 0.56 + padX * 2, bh: ls.length * fs * 1.1 + padY * 2 }));
  const total = sizes.reduce((a, b) => a + b.bw, 0) + (n - 1) * gapEm * fs;
  const tallest = sizes.reduce((a, b) => a + b.bh, 0) + (n - 1) * 1.6 * fs;
  let run = 0;
  const boxes = sizes.map((b, i) => {
    let cx = grid[i][0] * w, cy = grid[i][1] * h;
    if (mode === "row") (cx = (w - total) / 2 + run + b.bw / 2), (cy = h / 2), (run += b.bw + gapEm * fs);
    if (mode === "column") (cx = w / 2), (cy = (h - tallest) / 2 + run + b.bh / 2), (run += b.bh + 1.6 * fs);
    return { cx, cy, ...b };
  });
  const nodeAt = v.nodes.map((_, i) => when(v, i, shot));
  const edgeAt = v.edges.map((e, j) => {
    const a = v.nodes.findIndex((n) => n.id === e.from);
    const b = v.nodes.findIndex((n) => n.id === e.to);
    return e.at ? when(v, v.nodes.length + j, shot) : Math.max(nodeAt[a] ?? 0, nodeAt[b] ?? 0) + 0.3;
  });
  // The newest thing to land is lit: a node until the next node or edge lands.
  const landed = [...nodeAt.map((at, i) => ({ at, node: i })), ...edgeAt.map((at, j) => ({ at, node: v.nodes.findIndex((n) => n.id === v.edges[j].to) }))].filter((x) => x.at <= time).sort((a, b) => b.at - a.at);
  const lit = landed[0]?.node ?? -1;
  const out = leave(time, shot);
  return (
    <div style={{ position: "relative", width: w, height: h, opacity: out, filter: `blur(${(1 - out) * 10}px)` }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {v.edges.map((e, j) => {
          const a = boxes[v.nodes.findIndex((n) => n.id === e.from)];
          const b = boxes[v.nodes.findIndex((n) => n.id === e.to)];
          if (!a || !b) return null;
          const dx = b.cx - a.cx, dy = b.cy - a.cy;
          const [x1, y1] = exit(a.cx, a.cy, a.bw + 24, a.bh + 24, dx, dy);
          const [x2, y2] = exit(b.cx, b.cy, b.bw + 24, b.bh + 24, -dx, -dy);
          const len = Math.hypot(x2 - x1, y2 - y1);
          const k = prog(time, edgeAt[j], MOVE, easeInOut);
          const ux = (x2 - x1) / (len || 1), uy = (y2 - y1) / (len || 1);
          const head = fs * 0.32;
          const tipX = x1 + (x2 - x1) * k, tipY = y1 + (y2 - y1) * k;
          // A dot rides the newest drawn edge, so the diagram reads as something flowing.
          const ride = k >= 1 && lit === v.nodes.findIndex((n) => n.id === e.to) ? ((time - edgeAt[j] - MOVE) % 1.4) / 1.4 : -1;
          return (
            <g key={j}>
              <line x1={x1} y1={y1} x2={tipX} y2={tipY} stroke={c.muted} strokeWidth={Math.max(2, fs * 0.05)} strokeLinecap="round" />
              {k > 0.02 && <path d={`M ${tipX} ${tipY} L ${tipX - ux * head - uy * head * 0.6} ${tipY - uy * head + ux * head * 0.6} L ${tipX - ux * head + uy * head * 0.6} ${tipY - uy * head - ux * head * 0.6} Z`} fill={c.muted} opacity={k} />}
              {ride >= 0 && <circle cx={x1 + (x2 - x1) * ride} cy={y1 + (y2 - y1) * ride} r={fs * 0.13} fill={c.accent} />}

            </g>
          );
        })}
      </svg>
      {v.edges.map((e, j) => {
        const a = boxes[v.nodes.findIndex((n) => n.id === e.from)];
        const b = boxes[v.nodes.findIndex((n) => n.id === e.to)];
        if (!e.label || !a || !b) return null;
        // The label sits over the middle of its arrow (beside it when the arrow runs down), as wide as the gap allows.
        const down = Math.abs(b.cy - a.cy) > Math.abs(b.cx - a.cx);
        const gap = down ? w * 0.4 : Math.max(fs * 2.5, Math.abs(b.cx - a.cx) - (a.bw + b.bw) / 2 + fs * 0.4);
        // The middle of the gap between the two nodes, not between their centres.
        const [l, r] = a.cx < b.cx ? [a, b] : [b, a];
        const [u, d] = a.cy < b.cy ? [a, b] : [b, a];
        const mx = down ? (a.cx + b.cx) / 2 : (l.cx + l.bw / 2 + r.cx - r.bw / 2) / 2;
        const my = down ? (u.cy + u.bh / 2 + d.cy - d.bh / 2) / 2 : (a.cy + b.cy) / 2;
        return (
          <div key={`l${j}`} style={{ position: "absolute", left: down ? mx + fs * 0.5 : mx - gap / 2, top: down ? my - fs * 0.4 : undefined, bottom: down ? undefined : h - my + fs * 0.25, width: gap, textAlign: down ? "left" : "center", fontFamily: t.sans, fontWeight: 500, fontSize: fs * 0.6, lineHeight: 1.15, color: c.muted, opacity: prog(time, edgeAt[j] + MOVE * 0.6, FAST) }}>
            {e.label}
          </div>
        );
      })}
      {v.nodes.map((n, i) => {
        const b = boxes[i];
        const k = prog(time, nodeAt[i], FAST);
        const on = i === lit;
        return (
          <div
            key={n.id}
            style={{
              position: "absolute", left: b.cx - b.bw / 2, top: b.cy - b.bh / 2, width: b.bw, height: b.bh, boxSizing: "border-box",
              display: "flex", alignItems: "center", justifyContent: "center", borderRadius: Math.min(b.bh / 2, fs * 0.9),
              border: `${Math.max(2, fs * 0.045)}px solid ${on ? c.accent : c.line}`, background: on ? c.chip : c.card,
              fontFamily: t.sans, fontWeight: 700, fontSize: fs, letterSpacing: "-0.02em", color: c.ink, whiteSpace: "nowrap",
              opacity: k, filter: `blur(${(1 - k) * 10}px)`, scale: `${interpolate(k, [0, 1], [0.92, 1])}`,
            }}
          >
            <span style={{ textAlign: "center", lineHeight: 1.1 }}>{lines[i].map((l, j) => <div key={j}>{l}</div>)}</span>
          </div>
        );
      })}
    </div>
  );
};

export const ShiftVisual: React.FC<Props<"shift">> = ({ shot, time, w, h, v }) => {
  const c = pal(toneOf(shot));
  const pad = w * 0.08;
  const big = fit([v.from.text, v.to.text], w - pad * 2, h * 0.16);
  const a = when(v, 0, shot);
  const b = when(v, 1, shot);
  const kA = prog(time, a, FAST);
  const kB = prog(time, b, FAST);
  // The old one makes room as the new one is said: up, smaller, dimmer, then struck.
  const m = prog(time, b - 0.3, 0.4, easeInOut);
  const strike = v.even ? 0 : prog(time, b + 0.25, 0.4, easeInOut);
  const label = (text: string | undefined, k: number) =>
    text ? <div style={{ fontFamily: t.serif, fontStyle: "italic", fontSize: Math.max(big * 0.42, 28), color: c.muted, marginBottom: big * 0.12, opacity: k }}>{text}</div> : null;
  const fromY = lerp(h / 2 - big * 0.75, h * 0.22, m);
  const s = lerp(1, 0.62, m);
  const out = leave(time, shot);
  return (
    <div style={{ position: "relative", width: w, height: h, opacity: out, filter: `blur(${(1 - out) * 10}px)` }}>
      <div style={{ position: "absolute", left: pad, top: fromY, transformOrigin: "0 0", scale: `${s}`, opacity: kA * lerp(1, v.even ? 0.8 : 0.55, m), filter: `blur(${(1 - kA) * 12}px)` }}>
        {label(v.from.label, 1)}
        <div style={{ position: "relative", display: "inline-block", fontFamily: t.sans, fontWeight: 700, fontSize: big, letterSpacing: "-0.035em", lineHeight: 1.05, color: c.ink, whiteSpace: "nowrap" }}>
          {plain(v.from.text)}
          <span style={{ position: "absolute", left: "-0.04em", right: "-0.04em", top: "54%", height: Math.max(3, big * 0.06), background: c.ink, transformOrigin: "left", scale: `${strike} 1` }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: pad, top: h * 0.5, opacity: kB, filter: `blur(${(1 - kB) * 12}px)`, translate: `0 ${(1 - kB) * big * 0.2}px` }}>
        {label(v.to.label, 1)}
        <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: big, letterSpacing: "-0.035em", lineHeight: 1.05, color: c.ink, whiteSpace: "nowrap" }}>
          <Line text={v.to.text} time={time} at={b} accent={c.accent} light={toneOf(shot) === "light"} />
        </div>
      </div>
    </div>
  );
};
