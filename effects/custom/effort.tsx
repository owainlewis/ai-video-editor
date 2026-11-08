// "Max effort made Claude worse" (projects/max-effort, 2026-11-07), in the clean style. Numbers are
// the ones said, from HumanLayer's SlopCodeBench write-up (Opus 5.5: medium 28/196 for $193.47,
// xhigh 25/196 for $817.04). Split diagrams stay above y 830; the full-screen one above y 1400.
import React from "react";
import { C, k, Label, Line, Rect } from "../clean/kit";
import { MONO } from "../clean/text";
import type { CustomProps } from "./index";

const Stage: React.FC<{ width: number; height: number; children: React.ReactNode }> = ({ width, height, children }) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    {children}
  </svg>
);
const at = (times: number[], i: number, fallback: number) => times[i] ?? fallback;

// "It's easy to assume more thinking is always better": two axes and the straight line everyone
// draws in their head, dashed. times: [more thinking, better]
export const EffAssume: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [thinking, better] = [0, 1].map((i) => at(times, i, shot.start));
  const o: [number, number] = [220, 740];
  return (
    <Stage width={width} height={height}>
      <Line a={o} b={[900, 740]} p={k(t, shot.start, 0.3)} w={3} head />
      <Line a={o} b={[220, 160]} p={k(t, shot.start, 0.3)} w={3} head />
      <Label x={860} y={790} size={34} anchor="end" opacity={k(t, thinking)}>more thinking</Label>
      <Label x={250} y={170} size={34} anchor="start" opacity={k(t, better)}>better</Label>
      <Line a={[240, 720]} b={[840, 240]} p={k(t, better, 0.5, "io")} w={4} dash color={C.sage} />
    </Stage>
  );
};

// "A benchmark called SlopCodeBench tested it": the benchmark as a box of tasks, ticking through.
// times: [benchmark, SlopCodeBench, tested]
export const EffBench: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [bench, name, tested] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const cols = 12, rows = 6;
  return (
    <Stage width={width} height={height}>
      <Rect x={150} y={250} w={780} h={480} p={k(t, bench, 0.4)} sw={3} r={22} />
      <Label x={540} y={180} size={54} weight={700} opacity={k(t, name)}>SlopCodeBench</Label>
      {Array.from({ length: cols * rows }, (_, i) => {
        const x = 215 + (i % cols) * 59, y = 320 + Math.floor(i / cols) * 68;
        const on = k(t, tested + (i % 17) * 0.04 + Math.floor(i / cols) * 0.05, 0.12);
        return <circle key={i} cx={x} cy={y} r={11} fill={on > 0.5 && (i * 7) % 5 === 0 ? C.sage : "none"} stroke={C.white} strokeWidth={2.5} opacity={k(t, bench + 0.2 + i * 0.004)} />;
      })}
    </Stage>
  );
};

// "That's more than four times the price for fewer passes": cost as bars, passes under each.
// Full screen. times: [four times, price, fewer passes]
export const EffCost: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [four, price, fewer] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const base = 1120, scale = 620 / 817;
  const col = (x: number, name: string, cost: number, passes: number, sage: boolean, a: number) => {
    const h = cost * scale * k(t, a, 0.6, "io");
    const c = sage ? C.sage : C.white;
    return (
      <g>
        <rect x={x - 110} y={base - h} width={220} height={h} rx={8} fill={sage ? "rgba(183,205,191,0.18)" : "none"} stroke={c} strokeWidth={3} />
        <Label x={x} y={base - cost * scale - 60} size={70} weight={700} color={c} opacity={k(t, a + 0.4)}>{`$${cost}`}</Label>
        <Label x={x} y={base + 60} size={40} color={c} opacity={k(t, a + 0.2)}>{name}</Label>
        <Label x={x} y={base + 170} size={84} weight={700} color={c} opacity={k(t, fewer + (sage ? 0 : 0.25))}>{passes}</Label>
        <Label x={x} y={base + 240} size={32} color={c} opacity={k(t, fewer + (sage ? 0 : 0.25)) * 0.8}>passed</Label>
      </g>
    );
  };
  return (
    <Stage width={width} height={height}>
      <line x1={200} y1={base} x2={880} y2={base} stroke={C.white} strokeWidth={3} opacity={0.6 * k(t, shot.start)} />
      {col(350, "medium", 193, 28, true, shot.start)}
      {col(730, "extra high", 817, 25, false, four)}
      <Label x={540} y={330} size={44} opacity={k(t, price)}>{"more than 4× the price"}</Label>
    </Stage>
  );
};

// "You get deep thinking where you need it and you stop paying for it everywhere else": a session's
// turns as bars, every one at medium but the one ultrathink raises. times: [deep thinking, need it, everywhere else]
export const EffTurns: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [deep, need, rest] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const base = 700, hard = 4;
  return (
    <Stage width={width} height={height}>
      <line x1={110} y1={base} x2={970} y2={base} stroke={C.white} strokeWidth={3} opacity={0.6} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 150 + i * 98, big = i === hard;
        const h = big ? 110 + 380 * k(t, deep, 0.5, "io") : 110 * k(t, shot.start + i * 0.04, 0.2);
        return <rect key={i} x={x - 28} y={base - h} width={56} height={h} rx={6} fill={big ? C.sage : "none"} stroke={big ? C.sage : C.white} strokeWidth={3} opacity={big || t < rest ? 1 : 0.75} />;
      })}
      <text x={150 + hard * 98} y={base - 540} textAnchor="middle" fill={C.sage} fontFamily={MONO} fontSize={38} opacity={k(t, need)}>ultrathink</text>
      <Label x={540} y={base + 70} size={36} opacity={k(t, rest)}>every other turn: medium</Label>
    </Stage>
  );
};
