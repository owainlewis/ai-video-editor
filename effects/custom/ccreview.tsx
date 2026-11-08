// "How the Claude Code team reviews AI code" (projects/cc-review, 2026-11-07), in the clean style.
// Thin white lines that draw on their words, sage on the one thing that matters. Split diagrams
// draw in the top panel (1080 x 960) and stay above y 830; the full-screen diagram keeps above the
// caption at y 1520.
import React from "react";
import { C, k, Label, Line, Rect, Ring } from "../clean/kit";
import type { CustomProps } from "./index";

const Stage: React.FC<{ width: number; height: number; children: React.ReactNode }> = ({ width, height, children }) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    {children}
  </svg>
);
const at = (times: number[], i: number, fallback: number) => times[i] ?? fallback;

// "AI opens pull requests faster than anyone can read them": pull requests pile up in a queue while
// one person reads one. times: [opens pull, faster, read them]
export const CcrFlood: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [opens, faster, read] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const cards = Array.from({ length: 20 }, (_, i) => ({ x: 110 + (i % 4) * 140, y: 250 + Math.floor(i / 4) * 105, a: opens + (i < 4 ? i * 0.2 : 0.8 + (i - 4) * 0.09) }));
  return (
    <Stage width={width} height={height}>
      <Label x={385} y={190} size={36} opacity={k(t, opens)}>pull requests</Label>
      {cards.map((c, i) => (
        <g key={i} opacity={k(t, c.a, 0.15)}>
          <Rect x={c.x} y={c.y} w={115} h={78} p={k(t, c.a, 0.2)} sw={3} r={10} />
          <line x1={c.x + 18} y1={c.y + 28} x2={c.x + 82} y2={c.y + 28} stroke={C.white} strokeWidth={7} strokeLinecap="round" opacity={0.55} />
          <line x1={c.x + 18} y1={c.y + 52} x2={c.x + 62} y2={c.y + 52} stroke={C.white} strokeWidth={7} strokeLinecap="round" opacity={0.35} />
        </g>
      ))}
      <Line a={[690, 500]} b={[770, 500]} p={k(t, faster, 0.3)} w={3} head />
      <Ring x={880} y={500} r={70} p={k(t, read, 0.35)} w={3} color={C.sage} />
      <Label x={880} y={500} size={34} color={C.sage} opacity={k(t, read + 0.2)}>you</Label>
    </Stage>
  );
};

// "After three review rounds, the reviewer stops and tells the author to rethink the approach": three
// rounds, a stop where a fourth would be, and the way back to the start. Full screen.
// times: [three, rounds, stops, rethink]
export const CcrRounds: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [three, rounds, stops, rethink] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const y = 820, xs = [190, 420, 650];
  return (
    <Stage width={width} height={height}>
      <Label x={420} y={650} size={40} opacity={k(t, rounds)}>review rounds</Label>
      {xs.map((x, i) => (
        <g key={i}>
          <Ring x={x} y={y} r={78} p={k(t, three + i * 0.22, 0.3)} w={3} />
          <Label x={x} y={y} size={64} weight={700} opacity={k(t, three + i * 0.22 + 0.1)}>{i + 1}</Label>
          {i < 2 && <Line a={[x + 90, y]} b={[x + 140, y]} p={k(t, three + i * 0.22 + 0.15, 0.2)} w={3} head />}
        </g>
      ))}
      <Line a={[740, y]} b={[790, y]} p={k(t, stops - 0.1, 0.2)} w={3} />
      <rect x={800} y={y - 90} width={18} height={180} rx={4} fill={C.sage} opacity={k(t, stops, 0.15)} />
      <Label x={809} y={y + 140} size={36} weight={700} color={C.sage} opacity={k(t, stops + 0.1)}>stop</Label>
      <path d={`M 809 ${y + 200} C 809 ${y + 360}, 190 ${y + 360}, 190 ${y + 100}`} fill="none" stroke={C.sage} strokeWidth={3} strokeDasharray="1400" strokeDashoffset={1400 * (1 - k(t, rethink, 0.6, "io"))} />
      <Label x={500} y={y + 400} size={46} color={C.sage} opacity={k(t, rethink + 0.4)}>rethink the approach</Label>
    </Stage>
  );
};

// "Before that rule, one pull request ran more than 50 rounds overnight": a round counter that keeps
// going, to 50+, under a moon. times: [Before, 50, overnight]
export const CcrFifty: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [before, fifty, night] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const n = Math.max(1, Math.min(50, Math.round(1 + 49 * k(t, before + 0.4, Math.max(0.3, fifty - before - 0.4), "io"))));
  const spin = (t - before) * 540;
  return (
    <Stage width={width} height={height}>
      <g opacity={k(t, before)}>
        <circle cx={540} cy={450} r={230} fill="none" stroke={C.faint} strokeWidth={3} />
        <circle cx={540} cy={450} r={230} fill="none" stroke={C.white} strokeWidth={3} strokeDasharray="300 1145" transform={`rotate(${spin} 540 450)`} />
        <Label x={540} y={430} size={170} weight={700}>{t >= fifty ? "50+" : n}</Label>
        <Label x={540} y={560} size={36} opacity={0.8}>rounds</Label>
      </g>
      <g opacity={k(t, night, 0.3)}>
        <path d="M 880 150 a 60 60 0 1 0 60 80 a 48 48 0 1 1 -60 -80 z" fill={C.sage} />
        <Label x={880} y={290} size={34} color={C.sage}>overnight</Label>
      </g>
    </Stage>
  );
};

// "pull requests needing five or more rounds fell from 8.9% to 1.5": two bars, before and after the
// rule. times: [five or more, 8.9%, 1.5]
export const CcrDrop: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [five, before, after] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const base = 700, full = 420;
  const bar = (x: number, v: number, a: number, color: string) => {
    const h = (full * v) / 8.9 * k(t, a, 0.5, "io");
    return <rect x={x - 90} y={base - h} width={180} height={h} rx={6} fill={color === C.sage ? C.sage : "none"} stroke={color} strokeWidth={3} />;
  };
  return (
    <Stage width={width} height={height}>
      <Label x={540} y={150} size={38} opacity={k(t, five)}>pull requests needing 5+ rounds</Label>
      <line x1={220} y1={base} x2={860} y2={base} stroke={C.white} strokeWidth={3} opacity={k(t, five) * 0.6} />
      {bar(380, 8.9, before, C.white)}
      <Label x={380} y={base - full - 50} size={64} weight={700} opacity={k(t, before + 0.3)}>8.9%</Label>
      <Label x={380} y={base + 50} size={32} opacity={k(t, before + 0.3) * 0.8}>before</Label>
      {bar(700, 1.5, after, C.sage)}
      <Label x={700} y={base - (full * 1.5) / 8.9 - 50} size={64} weight={700} color={C.sage} opacity={k(t, after + 0.3)}>1.5%</Label>
      <Label x={700} y={base + 50} size={32} color={C.sage} opacity={k(t, after + 0.3)}>after</Label>
    </Stage>
  );
};
