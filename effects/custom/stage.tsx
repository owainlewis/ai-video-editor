// The stage moves (2026-11-06), from a frame-by-frame study of an explainer Owain liked
// (research/youtube/xxf6D9jynFw/NOTES.md): quiet cards, one thing changing state on its word, a card
// sliding over to make room. Drawn for 16:9, for `side` (beside Owain) and `media` (full frame while
// he talks); in his look, sized by the box they are given, in Ivory, Graphite and black.
//   drain   a meter holds, falls to nothing, then the number turns: what was lost
//   lens    a page, each angle throwing a beam onto the part it reads
//   wall    a reader with its inputs; a wall rises and what you said cannot reach it
//   thread  rows of a plan, each wired through an agent into the part it builds
//   gaps    a page with hatched holes; a helper fills each one and the count falls
//   drift   two sources side by side, a tag walks down them row by row, marking what no longer matches
//   surge   a flood of dots into a flow, a counter climbing to the said number, the last node gives
//   scale   a balance: the cost lands and it tips, the payoff lands and it tips back
// Bars stand for text, so nothing on screen is made up; words are real labels from the video. A number
// shows only when it is said (leave it out and the graphic still works). One accent, on the part that
// matters. Filled circles remember; empty rings know nothing. Parts arrive at FAST and move at MOVE.
// Each takes its spoken beats in `at`; a beat left out follows the one before it.
import React from "react";
import { easeInOut, FAST, lerp, MOVE, prog } from "../motion";
import { pal, type Pal } from "../soft";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

type Kit = { c: Pal; u: number; cx: number; cy: number; t: number; w: number; h: number };
const kit = ({ shot, time, width, height }: CustomProps): Kit => ({ c: pal(shot.tone ?? "light"), u: Math.min(width / 1000, height / 580), cx: width / 2, cy: height / 2, t: time, w: width, h: height });
// Beat i: its word, or a steady walk on from the last one that has a word.
const beats = ({ times, shot }: CustomProps, gap = 0.9) => (i: number) => times[i] ?? (times.length ? times[times.length - 1] + (i - times.length + 1) * gap : shot.start + 0.3 + i * gap);
const list = (v: unknown, fallback: string[]) => (Array.isArray(v) && v.length ? v.map(String) : fallback);
const text = (v: unknown, fallback = "") => (v === undefined ? fallback : String(v));

const arrive = (k: Kit, at: number): React.CSSProperties => {
  const p = prog(k.t, at);
  return { opacity: p, filter: `blur(${(1 - p) * 6}px)`, translate: `0 ${(1 - p) * 10 * k.u}px` };
};
const Abs: React.FC<{ x: number; y: number; w?: number; h?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x, y, w, h, style, children }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>{children}</div>
);
const Word: React.FC<{ k: Kit; x: number; y: number; w: number; size?: number; color?: string; align?: "left" | "right" | "center"; weight?: number; mono?: boolean; style?: React.CSSProperties; children: React.ReactNode }> = ({ k, x, y, w, size = 24, color, align = "left", weight = 500, mono, style, children }) => (
  <Abs x={x} y={y} w={w} style={{ fontFamily: mono ? type.mono : type.sans, fontWeight: weight, fontSize: size * k.u, lineHeight: 1.15, letterSpacing: mono ? 0 : "-0.01em", color: color ?? k.c.ink, textAlign: align, whiteSpace: "nowrap", ...style }}>{children}</Abs>
);
// A file, a chat or an app: one quiet card with a name on it.
const Sheet: React.FC<{ k: Kit; x: number; y: number; w: number; h: number; title?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({ k, x, y, w, h, title, style, children }) => (
  <Abs x={x} y={y} w={w} h={h} style={{ background: k.c.chip, borderRadius: 14 * k.u, ...style }}>
    {title && (
      <div style={{ height: 52 * k.u, display: "flex", alignItems: "center", padding: `0 ${20 * k.u}px`, fontFamily: /\.\w{1,4}$/.test(title) ? type.mono : type.sans, fontWeight: 500, fontSize: 22 * k.u, color: k.c.ink, borderBottom: `1px solid ${k.c.line}`, whiteSpace: "nowrap" }}>{title}</div>
    )}
    {children}
  </Abs>
);
// A line of text, as a grey bar: structure without fake words.
const LEN = [0.86, 0.62, 0.74, 0.5, 0.9, 0.68, 0.56, 0.8];
const Bar: React.FC<{ k: Kit; x: number; y: number; w: number; o?: number; color?: string }> = ({ k, x, y, w, o = 0.4, color }) => (
  <Abs x={x} y={y} w={w} h={9 * k.u} style={{ borderRadius: 5 * k.u, background: color ?? k.c.muted, opacity: o }} />
);
const Lines: React.FC<{ k: Kit; x: number; y: number; w: number; n: number; gap?: number; seed?: number; o?: number; color?: string }> = ({ k, x, y, w, n, gap = 24, seed = 0, o, color }) => (
  <>{Array.from({ length: n }, (_, i) => <Bar key={i} k={k} x={x} y={y + i * gap * k.u} w={w * LEN[(i + seed) % LEN.length]} o={o} color={color} />)}</>
);
const Art: React.FC<{ k: Kit; children: React.ReactNode }> = ({ k, children }) => (
  <svg width={k.w} height={k.h} viewBox={`0 0 ${k.w} ${k.h}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>{children}</svg>
);
const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const m = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}`;
};
// A wire that draws on as p goes 0 to 1.
const Wire: React.FC<{ d: string; p: number; color: string; width: number; o?: number; dots?: boolean }> = ({ d, p, color, width, o = 1, dots }) =>
  p <= 0 ? null : dots ? (
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`0.1 ${width * 3}`} opacity={o * p} />
  ) : (
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 1`} opacity={o} />
  );
const Tick: React.FC<{ x: number; y: number; s: number; color: string; o?: number }> = ({ x, y, s, color, o = 1 }) => (
  <path d={`M ${x - s} ${y} L ${x - s * 0.25} ${y + s * 0.75} L ${x + s} ${y - s * 0.75}`} fill="none" stroke={color} strokeWidth={s * 0.4} strokeLinecap="round" strokeLinejoin="round" opacity={o} />
);
// An empty ring knows nothing; a filled one remembers. `level` is how full it is.
const Actor: React.FC<{ k: Kit; x: number; y: number; r: number; level?: number; color?: string; o?: number }> = ({ k, x, y, r, level = 0, color, o = 1 }) => {
  const id = React.useId();
  const fill = color ?? k.c.accent;
  return (
    <g opacity={o}>
      <clipPath id={id}><rect x={x - r} y={y + r - 2 * r * level} width={2 * r} height={2 * r * level} /></clipPath>
      {level > 0 && <circle cx={x} cy={y} r={r} fill={fill} clipPath={`url(#${id})`} />}
      <circle cx={x} cy={y} r={r} fill="none" stroke={fill} strokeWidth={3 * k.u} />
    </g>
  );
};

// props: { name, label, from?: 100, to?: 0, unit?: "%", number?: true, note? }   at: [card, starts falling, note]
// Holds on the first number, falls over 1.9 s, and the number turns 0.4 s after it lands.
export const Drain: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p);
  const from = Number(p.props.from ?? 100), to = Number(p.props.to ?? 0), unit = text(p.props.unit, "%");
  const fall = prog(t, b(1), 1.9, easeInOut);
  const value = lerp(from, to, fall);
  const ratio = (unit === "%" ? value / 100 : value / Math.max(from, to, 1));
  const turned = prog(t, b(1) + 2.3, FAST);
  const note = text(p.props.note);
  const x = cx - 350 * u, y = cy - (note ? 150 : 125) * u, w = 700 * u, h = 250 * u;
  return (
    <>
      <div style={arrive(k, b(0))}>
        <Sheet k={k} x={x} y={y} w={w} h={h} />
        <Art k={k}><Actor k={k} x={x + 118 * u} y={y + 102 * u} r={58 * u} level={Math.max(0, ratio)} /></Art>
        <Word k={k} x={x + 18 * u} y={y + 178 * u} w={200 * u} align="center" size={26}>{text(p.props.name)}</Word>
        <Word k={k} x={x + 250 * u} y={y + 64 * u} w={200 * u} color={c.muted} size={28}>{text(p.props.label)}</Word>
        {p.props.number !== false && (
          <Word k={k} x={x + 400 * u} y={y + 34 * u} w={260 * u} align="right" size={92} weight={700} color={turned > 0.5 ? c.accent : c.ink} style={{ letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{Math.round(value)}{unit}</Word>
        )}
        <Abs x={x + 250 * u} y={y + 168 * u} w={410 * u} h={14 * u} style={{ borderRadius: 7 * u, background: c.faint, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(0, ratio) * 100}%`, height: "100%", background: c.accent }} />
        </Abs>
      </div>
      {note && <div style={arrive(k, b(2))}><Word k={k} x={cx - 350 * u} y={y + h + 30 * u} w={700 * u} align="center" size={34} weight={500}>{note}</Word></div>}
    </>
  );
};

// props: { file, angles: [2 to 4 labels] }   at: [page, angle 1, angle 2, ...]
// The newest beam is in the accent; the ones before it go quiet, so the eye follows the sentence.
export const Lens: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p);
  const angles = list(p.props.angles, ["Angle one", "Angle two"]).slice(0, 4);
  const n = angles.length, band = 74 * u, dw = 330 * u, dh = 72 * u + n * band, dx = cx - dw / 2, dy = cy - dh / 2;
  const by = (i: number) => dy + 62 * u + i * band;
  const now = angles.reduce((m, _, i) => (t >= b(i + 1) ? i : m), -1);
  return (
    <>
      <div style={arrive(k, b(0))}>
        <Sheet k={k} x={dx} y={dy} w={dw} h={dh} title={text(p.props.file, "plan.md")} />
      </div>
      {angles.map((_, i) => (
        <Abs key={i} x={dx + 8 * u} y={by(i)} w={dw - 16 * u} h={band - 8 * u} style={{ borderRadius: 8 * u, background: c.accent, opacity: prog(t, b(i + 1) + 0.12, FAST) * (i === now ? 0.24 : 0.09) }} />
      ))}
      <div style={arrive(k, b(0))}>
        {angles.map((_, i) => <Lines key={i} k={k} x={dx + 28 * u} y={by(i) + 18 * u} w={dw - 60 * u} n={2} gap={20} seed={i * 2} o={i <= now ? 0.7 : 0.4} />)}
      </div>
      <Art k={k}>
        {angles.map((_, i) => {
          const left = i % 2 === 0, ax = cx + (left ? -1 : 1) * 268 * u, ay = by(i) + band / 2 - 4 * u, edge = cx + (left ? -1 : 1) * dw * 0.5;
          const reach = prog(t, b(i + 1) + 0.04, FAST), a = prog(t, b(i + 1));
          const from = ax + (left ? 1 : -1) * 26 * u, to = lerp(from, edge, reach);
          return (
            <g key={i}>
              {reach > 0 && <polygon points={`${from},${ay} ${to},${lerp(ay, by(i), reach)} ${to},${lerp(ay, by(i) + band - 8 * u, reach)}`} fill={i === now ? c.accent : c.muted} opacity={i === now ? 0.3 : 0.1} />}
              <Actor k={k} x={ax} y={ay} r={20 * u} o={a * (i === now ? 1 : 0.55)} color={i === now ? c.accent : c.muted} />
            </g>
          );
        })}
      </Art>
      {angles.map((a, i) => {
        const left = i % 2 === 0;
        return (
          <div key={i} style={arrive(k, b(i + 1))}>
            <Word k={k} x={left ? cx - 492 * u : cx + 302 * u} y={by(i) + band / 2 - 19 * u} w={190 * u} align={left ? "right" : "left"} size={24} color={i === now ? c.ink : c.muted}>{a}</Word>
          </div>
        );
      })}
    </>
  );
};

// props: { name, inputs: [two labels], chat, said }   at: [reader, chat, wall, message stops]
export const Wall: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p, 1.1);
  const inputs = list(p.props.inputs, ["plan.md", "your code"]).slice(0, 2);
  // The reader starts centred, then slides over to make room as the chat arrives: one move, MOVE long.
  const room = lerp(-210 * u, 0, prog(t, b(1) - 0.2, MOVE, easeInOut));
  const wx = cx - 70 * u, ax = cx + 40 * u + room, fx = cx + 150 * u + room, fw = 290 * u, fh = 132 * u;
  const fy = [cy - 150 * u, cy + 18 * u];
  const rise = prog(t, b(2), 0.3, easeInOut);
  const send = prog(t, b(3), MOVE, easeInOut), hit = prog(t, b(3) + MOVE * 0.8, FAST), gone = prog(t, b(3) + MOVE + 0.5, MOVE);
  const said = text(p.props.said);
  const gx = cx - 430 * u, gw = 290 * u, gh = 320 * u, gy = cy - gh / 2;
  return (
    <>
      <div style={arrive(k, b(1))}>
        <Sheet k={k} x={gx} y={gy} w={gw} h={gh} title={text(p.props.chat, "Your chat")}>
          {[0, 1, 2, 3].map((i) => <Abs key={i} x={(i % 2 ? 96 : 20) * u} y={(70 + i * 58) * u} w={174 * u} h={42 * u} style={{ borderRadius: 10 * u, background: c.faint, opacity: 0.7 }} />)}
        </Sheet>
      </div>
      <Art k={k}>
        {fy.map((y, i) => <Wire key={i} d={curve(ax + 26 * u, cy, fx, y + fh / 2)} p={prog(t, b(0) + 0.3 + i * 0.1, 0.4)} color={c.muted} width={3 * u} dots />)}
        <Actor k={k} x={ax} y={cy} r={40 * u} o={prog(t, b(0))} />
        {rise > 0 && <rect x={wx - 5 * u} y={cy - 190 * u * rise} width={10 * u} height={380 * u * rise} rx={5 * u} fill={hit > 0 ? c.accent : c.muted} />}
        {hit > 0 && (
          <g opacity={hit}>
            <circle cx={wx} cy={cy} r={22 * u} fill={c.bg} stroke={c.accent} strokeWidth={3 * u} />
            <line x1={wx - 13 * u} y1={cy - 13 * u} x2={wx + 13 * u} y2={cy + 13 * u} stroke={c.accent} strokeWidth={3 * u} strokeLinecap="round" />
          </g>
        )}
      </Art>
      <div style={arrive(k, b(0))}>
        <Word k={k} x={ax - 70 * u} y={cy + 52 * u} w={140 * u} align="center" size={24}>{text(p.props.name, "Reviewer")}</Word>
      </div>
      {inputs.map((name, i) => (
        <div key={i} style={arrive(k, b(0) + 0.1 * (i + 1))}>
          <Sheet k={k} x={fx} y={fy[i]} w={fw} h={fh} title={name}><Lines k={k} x={20 * u} y={72 * u} w={fw - 40 * u} n={2} seed={i * 3} /></Sheet>
        </div>
      ))}
      {said && send > 0 && (
        <Abs x={lerp(gx + 40 * u, wx - 236 * u, send)} y={cy - 26 * u} h={52 * u} w={220 * u} style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 * u, background: c.card, border: `1px solid ${c.accent}`, opacity: prog(t, b(3)) * (1 - gone * 0.75) }}>
          <Word k={k} x={0} y={13 * u} w={220 * u} align="center" size={23}>{said}</Word>
        </Abs>
      )}
    </>
  );
};

// props: { file, agent, app, rows: [2 to 4 labels] }   at: [cards, row 1, row 2, ...]
// Each row tints, a wire runs through the agent into the app, and the part lands as the wire arrives.
export const Thread: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p, 1.3);
  const rows = list(p.props.rows, ["One", "Two", "Three"]).slice(0, 4);
  const n = rows.length, row = 70 * u, h = 76 * u + n * row, top = cy - h / 2, dw = 300 * u;
  const lx = cx - 440 * u, rx = cx + 140 * u, nw = 140 * u, nh = 72 * u, nx = cx - nw / 2 + 0 * u, ry = (i: number) => top + 64 * u + i * row + (row - 8 * u) / 2;
  const now = rows.reduce((m, _, i) => (t >= b(i + 1) ? i : m), -1);
  return (
    <>
      <div style={arrive(k, b(0))}>
        <Sheet k={k} x={lx} y={top} w={dw} h={h} title={text(p.props.file, "plan.md")} />
        <Sheet k={k} x={rx} y={top} w={dw} h={h} title={text(p.props.app, "your app")} />
      </div>
      {rows.map((label, i) => (
        <React.Fragment key={i}>
          <Abs x={lx + 8 * u} y={ry(i) - (row - 8 * u) / 2} w={dw - 16 * u} h={row - 8 * u} style={{ borderRadius: 8 * u, background: c.accent, opacity: prog(t, b(i + 1), FAST) * (i === now ? 0.24 : 0.07) }} />
          <div style={arrive(k, b(0))}><Word k={k} x={lx + 26 * u} y={ry(i) - 14 * u} w={dw - 50 * u} size={24} color={i <= now ? c.ink : c.muted}>{label}</Word></div>
          <div style={arrive(k, b(i + 1) + 0.55)}>
            <Abs x={rx + 14 * u} y={ry(i) - (row - 8 * u) / 2 + 3 * u} w={dw - 28 * u} h={row - 14 * u} style={{ borderRadius: 8 * u, background: c.faint }} />
            <Word k={k} x={rx + 30 * u} y={ry(i) - 14 * u} w={dw - 60 * u} size={24}>{label}</Word>
          </div>
        </React.Fragment>
      ))}
      <Art k={k}>
        {rows.map((_, i) => {
          const leave = i < rows.length - 1 ? 1 - prog(t, b(i + 2), 0.2) : 1;
          const o = leave > 0 ? leave : 0;
          return (
            <g key={i}>
              <Wire d={curve(lx + dw, ry(i), nx, cy)} p={prog(t, b(i + 1) + 0.05, 0.3)} color={c.accent} width={3 * u} o={o} />
              <Wire d={curve(nx + nw, cy, rx, ry(i))} p={prog(t, b(i + 1) + 0.3, 0.35)} color={c.accent} width={3 * u} o={o} />
            </g>
          );
        })}
      </Art>
      <div style={arrive(k, b(0) + 0.1)}>
        <Abs x={nx} y={cy - nh / 2} w={nw} h={nh} style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 * u, background: c.card, border: `1px solid ${c.line}` }}>
          <Word k={k} x={0} y={nh / 2 - 14 * u} w={nw} align="center" size={24} weight={700}>{text(p.props.agent, "Agent")}</Word>
        </Abs>
      </div>
    </>
  );
};

// props: { file, word?: "gaps", holes?: 4, helpers: labels }   at: [page, hole 1, hole 2, ...]
// The count on the badge is the number of open holes, so say it, or set `count: false`.
export const Gaps: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p, 1.2);
  const n = Math.min(4, Number(p.props.holes ?? 4)), word = text(p.props.word, "gaps"), helpers = list(p.props.helpers, ["agent", "skill"]);
  const dw = 540 * u, hole = 74 * u, dh = 60 * u + n * (hole + 34 * u) + 16 * u, dx = cx - dw / 2, dy = cy - dh / 2;
  const hy = (i: number) => dy + 66 * u + i * (hole + 34 * u) + 28 * u;
  const open = Array.from({ length: n }).filter((_, i) => t < b(i + 1)).length;
  const done = open === 0;
  return (
    <>
      <div style={arrive(k, b(0))}>
        <Sheet k={k} x={dx} y={dy} w={dw} h={dh} title={text(p.props.file, "plan.md")} />
        <Word k={k} x={dx + dw - 200 * u} y={dy + 13 * u} w={180 * u} align="right" size={24} color={done ? c.accent : c.muted}>{done ? `no ${word}` : p.props.count === false ? word : `${open} ${open === 1 ? word.replace(/s$/, "") : word}`}</Word>
        {Array.from({ length: n }, (_, i) => {
          const fill = prog(t, b(i + 1), FAST), y = hy(i);
          return (
            <React.Fragment key={i}>
              <Bar k={k} x={dx + 24 * u} y={y - 22 * u} w={(dw - 48 * u) * LEN[i * 2]} o={0.7} />
              <Abs x={dx + 24 * u} y={y} w={dw - 48 * u} h={hole} style={{ borderRadius: 8 * u, opacity: 1 - fill, background: `repeating-linear-gradient(135deg, ${c.faint} 0 ${3 * u}px, transparent ${3 * u}px ${11 * u}px)` }} />
              <Abs x={dx + 16 * u} y={y - 2 * u} w={dw - 32 * u} h={hole + 4 * u} style={{ borderRadius: 8 * u, background: c.accent, opacity: fill * (1 - prog(t, b(i + 1) + 0.2, 0.7)) * 0.3 }} />
              <div style={{ opacity: fill }}><Lines k={k} x={dx + 24 * u} y={y + 8 * u} w={dw - 48 * u} n={3} gap={23} seed={i + 1} /></div>
            </React.Fragment>
          );
        })}
      </div>
      {Array.from({ length: n }, (_, i) => {
        // Each helper floats round the page, then flies to its hole, landing as the hole fills.
        const angle = -2.4 + (i * 6.28) / n + (t - p.shot.start) * 0.06;
        const ox = cx + Math.cos(angle) * (dw / 2 + 96 * u), oy = cy + Math.sin(angle) * (dh / 2 + 40 * u);
        const go = prog(t, b(i + 1) - 0.36, 0.36, easeInOut), a = arrive(k, b(0) + 0.15 + i * 0.1);
        return (
          <Abs key={i} x={lerp(ox, cx, go) - 60 * u} y={lerp(oy, hy(i) + hole / 2, go) - 24 * u} w={120 * u} h={48 * u} style={{ ...a, opacity: Number(a.opacity) * (1 - prog(t, b(i + 1), FAST)), borderRadius: 24 * u, background: c.card, border: `1px solid ${c.line}` }}>
            <Word k={k} x={0} y={11 * u} w={120 * u} align="center" size={23}>{helpers[i % helpers.length]}</Word>
          </Abs>
        );
      })}
    </>
  );
};

// props: { left, right, tag, rows: [{ text, then?, ok? }], choices?: [two labels] }   at: [cards, row 1, ..., choices]
// `ok: false` marks a row that does not match: the one thing in the accent. `then` is the row's word on
// the right, when the two sides differ: each such row takes two beats (row, then), and the right word
// stays away until it is said.
export const Drift: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p, 1);
  const rows = ((p.props.rows as { text: string; then?: string; ok?: boolean }[] | undefined) ?? [{ text: "One" }, { text: "Two", ok: false }]).slice(0, 5);
  const n = rows.length, choices = list(p.props.choices, []);
  const row = 62 * u, h = 68 * u + n * row, top = cy - (h + (choices.length ? 84 * u : 0)) / 2, cw = 330 * u, gap = 170 * u;
  const lx = cx - gap / 2 - cw, rx = cx + gap / 2, y = (i: number) => top + 60 * u + i * row + row / 2 - 2 * u;
  const paired = rows.some((r) => r.then !== undefined);
  const rowAt = (i: number) => b(paired ? 1 + 2 * i : 1 + i), answer = (i: number) => (paired ? b(2 + 2 * i) : rowAt(i) + 0.3), end = b(paired ? 1 + 2 * n : 1 + n);
  // The tag steps down row by row, stopping on each one's word, and leaves after the last answer.
  let tagY = y(0);
  for (let i = 1; i < n; i++) tagY = lerp(tagY, y(i), prog(t, rowAt(i) - 0.22, 0.22, easeInOut));
  const tagGone = prog(t, answer(n - 1) + 0.7, FAST);
  const seen = (i: number) => t >= rowAt(i);
  return (
    <>
      <div style={arrive(k, b(0))}>
        <Sheet k={k} x={lx} y={top} w={cw} h={h} title={text(p.props.left, "plan.md")} />
        <Sheet k={k} x={rx} y={top} w={cw} h={h} title={text(p.props.right, "your app")} />
      </div>
      {rows.map((r, i) => {
        const wrong = r.ok === false, on = prog(t, answer(i), FAST);
        return (
          <React.Fragment key={i}>
            {[lx, rx].map((x, s) => (
              <React.Fragment key={s}>
                <Abs x={x + 8 * u} y={y(i) - row / 2 + 4 * u} w={cw - 16 * u} h={row - 8 * u} style={{ borderRadius: 8 * u, background: c.accent, opacity: wrong ? on * 0.26 : 0 }} />
                <div style={arrive(k, s && r.then ? answer(i) : b(0))}><Word k={k} x={x + 26 * u} y={y(i) - 14 * u} w={cw - 50 * u} size={24} color={seen(i) ? c.ink : c.muted}>{s ? (r.then ?? r.text) : r.text}</Word></div>
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}
      <Art k={k}>
        {rows.map((r, i) => {
          const on = prog(t, answer(i), FAST), wrong = r.ok === false, col = wrong ? c.accent : c.muted;
          if (on <= 0) return null;
          return (
            <g key={i} opacity={on}>
              <line x1={lx + cw} y1={y(i)} x2={cx - 18 * u} y2={y(i)} stroke={col} strokeWidth={2.5 * u} />
              <line x1={cx + 18 * u} y1={y(i)} x2={rx} y2={y(i)} stroke={col} strokeWidth={2.5 * u} />
              {wrong ? (
                <polygon points={`${cx},${y(i) - 15 * u} ${cx + 15 * u},${y(i)} ${cx},${y(i) + 15 * u} ${cx - 15 * u},${y(i)}`} fill={c.accent} />
              ) : (
                <Tick x={cx} y={y(i)} s={11 * u} color={c.muted} />
              )}
            </g>
          );
        })}
      </Art>
      <Abs x={cx - 66 * u} y={tagY - 22 * u} w={132 * u} h={44 * u} style={{ opacity: prog(t, b(0) + 0.3, FAST) * (1 - tagGone), borderRadius: 10 * u, background: c.card, border: `1px solid ${c.accent}` }}>
        <Word k={k} x={0} y={10 * u} w={132 * u} align="center" size={23} mono>{text(p.props.tag, "drift")}</Word>
      </Abs>
      {choices.length > 0 && (
        <div style={arrive(k, end)}>
          {choices.slice(0, 2).map((label, i) => (
            <Abs key={i} x={cx + (i ? 10 : -230) * u} y={top + h + 28 * u} w={220 * u} h={56 * u} style={{ borderRadius: 12 * u, background: c.chip }}>
              <Word k={k} x={0} y={14 * u} w={220 * u} align="center" size={24}>{label}</Word>
            </Abs>
          ))}
        </div>
      )}
    </>
  );
};

const seeded = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
// props: { nodes: [3 labels], count?, from?: 0, label?, fail?: 2 }   at: [flow, the flood starts, the number, it gives]
// `fail` is the node that gives. The counter climbs on an ease-in to a hard stop on the third beat (2.5 s
// without one), and shows only if `count` is set: use a number that is said.
export const Surge: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p, 1.2);
  const nodes = list(p.props.nodes, ["One", "Two", "Three"]).slice(0, 3);
  const RAMP = Math.max(0.5, (p.times[2] ?? b(1) + 2.5) - b(1)), load = Math.min(1, Math.max(0, t - b(1)) / RAMP), eased = load ** 2.3;
  const count = p.props.count === undefined ? null : lerp(Number(p.props.from ?? 0), Number(p.props.count), eased);
  const fx = cx - 120 * u, fw = 540 * u, fh = 190 * u, fy = cy - fh / 2, nw = 130 * u, nh = 106 * u;
  const nx = (i: number) => fx + 25 * u + i * (nw + 45 * u);
  const broke = t >= (p.times[3] ?? b(1) + RAMP), fail = Number(p.props.fail ?? nodes.length - 1);
  const entry = { x: fx, y: cy }, fieldW = fx - 40 * u;
  const dots = Array.from({ length: 150 }, (_, i) => {
    const born = (i / 150) ** (1 / 2.3) * RAMP;
    const age = t - b(1) - born;
    if (age < 0) return null;
    const life = 1.5 + seeded(i) * 0.7, phase = (age / life) % 1, sx = seeded(i + 200) * fieldW, sy = cy + (count === null ? (seeded(i + 400) - 0.5) * 380 : seeded(i + 400) * 310 - 110) * u;
    const e = phase ** 2;
    return <circle key={i} cx={lerp(sx, entry.x, e)} cy={lerp(sy, entry.y, e)} r={2.8 * u} fill={c.muted} opacity={Math.min(1, phase * 8) * 0.85} />;
  });
  return (
    <>
      <div style={arrive(k, b(0))}>
        <Sheet k={k} x={fx} y={fy} w={fw} h={fh} />
      </div>
      <Art k={k}>
        <g data-qc="ambient">{dots}</g>
        {nodes.slice(0, -1).map((_, i) => {
          const y = cy - 12 * u, x1 = nx(i) + nw, x2 = nx(i + 1);
          return (
            <g key={i} opacity={prog(t, b(0) + 0.2)}>
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={c.muted} strokeWidth={2 * u} opacity={0.6} />
              {load > 0.2 && [0, 1, 2].map((j) => <circle key={j} cx={lerp(x1, x2, ((t * 2.4 + j / 3) % 1))} cy={y} r={3.4 * u} fill={c.ink} opacity={Math.min(1, (load - 0.2) * 3)} />)}
            </g>
          );
        })}
      </Art>
      {nodes.map((label, i) => {
        const last = i === fail, warm = Math.min(1, Math.max(0, eased * 3 - i * 0.7));
        return (
          <div key={i} style={arrive(k, b(0) + 0.1 * (i + 1))}>
            <Abs x={nx(i)} y={cy - 12 * u - nh / 2 + 4 * u} w={nw} h={nh - 8 * u} style={{ borderRadius: 12 * u, background: last && broke ? c.accent : c.card, border: `1px solid ${c.line}`, opacity: 1 }}>
              <Abs x={0} y={0} w={nw} h={nh - 8 * u} style={{ borderRadius: 12 * u, background: c.accent, opacity: last && broke ? 0 : warm * 0.28 }} />
            </Abs>
            <Word k={k} x={nx(i) - 20 * u} y={cy + 52 * u} w={nw + 40 * u} align="center" size={23} color={last && broke ? c.ink : c.muted}>{label}</Word>
          </div>
        );
      })}
      {count !== null && (
        <div style={arrive(k, b(0) + 0.3)}>
          <Word k={k} x={fx - 330 * u} y={cy - 196 * u} w={300 * u} size={58} weight={700} style={{ letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{Math.round(count).toLocaleString("en-US")}</Word>
          <Word k={k} x={fx - 330 * u} y={cy - 130 * u} w={300 * u} size={26} color={c.muted}>{text(p.props.label)}</Word>
        </div>
      )}
    </>
  );
};

// props: { left, right }   at: [the balance, left lands, right lands]
export const Scale: React.FC<CustomProps> = (p) => {
  const k = kit(p), { c, u, cx, cy, t } = k, b = beats(p, 1.2);
  const TILT = 0.2, px = cx, py = cy - 150 * u, arm = 250 * u;
  const angle = -TILT * prog(t, b(1), MOVE * 1.5, easeInOut) + 2 * TILT * prog(t, b(2), MOVE * 1.5, easeInOut);
  const ends = [-1, 1].map((s) => ({ x: px + s * arm * Math.cos(angle), y: py + s * arm * Math.sin(angle) }));
  const tray = (e: { x: number; y: number }) => ({ x: e.x, y: e.y + 170 * u });
  const col = c.muted, sw = 3 * u, a = prog(t, b(0));
  const names = [text(p.props.left, "Cost"), text(p.props.right, "Payoff")];
  return (
    <>
      <Art k={k}>
        <g opacity={a}>
          <line x1={px} y1={py} x2={px} y2={cy + 200 * u} stroke={col} strokeWidth={5 * u} />
          <line x1={px - 80 * u} y1={cy + 200 * u} x2={px + 80 * u} y2={cy + 200 * u} stroke={col} strokeWidth={7 * u} strokeLinecap="round" />
          <line x1={ends[0].x} y1={ends[0].y} x2={ends[1].x} y2={ends[1].y} stroke={c.ink} strokeWidth={6 * u} strokeLinecap="round" />
          <circle cx={px} cy={py} r={12 * u} fill={c.ink} />
          {ends.map((e, i) => {
            const m = tray(e);
            return (
              <g key={i}>
                <path d={`M ${m.x - 110 * u} ${m.y} L ${e.x} ${e.y} L ${m.x + 110 * u} ${m.y}`} fill="none" stroke={col} strokeWidth={sw} />
                <line x1={m.x - 120 * u} y1={m.y} x2={m.x + 120 * u} y2={m.y} stroke={col} strokeWidth={5 * u} strokeLinecap="round" />
              </g>
            );
          })}
        </g>
      </Art>
      {ends.map((e, i) => {
        const m = tray(e), drop = prog(t, b(i + 1) - 0.1, 0.24, easeInOut);
        return (
          <Abs key={i} x={m.x - 100 * u} y={m.y - 78 * u - (1 - drop) * 40 * u} w={200 * u} h={72 * u} style={{ opacity: prog(t, b(i + 1) - 0.1), borderRadius: 12 * u, background: i === 1 ? c.accent : c.chip }}>
            <Word k={k} x={0} y={21 * u} w={200 * u} align="center" size={26} color={i === 1 ? c.bg : c.ink}>{names[i]}</Word>
          </Abs>
        );
      })}
    </>
  );
};
