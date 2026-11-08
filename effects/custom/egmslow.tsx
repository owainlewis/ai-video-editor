// EGM, "it forces you to slow down" (projects/reel-natural-2, 2026-11-08), in the clean style. Labels
// are the words Owain says. Split diagrams stay above y 830; the full-screen one above y 1400.
import React from "react";
import { at, C, Doc, Dots, k, Label, Line, Rect, Ring, Stage } from "../clean/kit";
import { Fish } from "./egmnatural";
import type { CustomProps } from "./index";

// "Two different types of agents to write plans": one full ring, one empty, one plan between them.
// times: [two different, plans]
export const SlowTwo: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [two, plans] = [0, 1].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Ring x={180} y={450} r={130} p={k(t, two, 0.3)} w={3} />
      <Dots x={180} y={450} r={130} p={k(t, two + 0.2, 0.5)} n={90} />
      <Ring x={900} y={450} r={130} p={k(t, two + 0.25, 0.3)} w={3} />
      <Line a={[325, 450]} b={[415, 450]} p={k(t, plans, 0.2)} w={3} head />
      <Line a={[755, 450]} b={[665, 450]} p={k(t, plans + 0.08, 0.2)} w={3} head />
      <Doc x={430} y={290} w={220} h={320} p={k(t, plans, 0.3)} n={6} lines={6 * k(t, plans + 0.1, 0.4)} color={C.sage} />
    </Stage>
  );
};

// "A deep context agent that knows all about your project... the agent you actually talk to": the ring
// fills, then you and it talk. times: [deep context, knows all, all of the context, talk]
export const SlowDeep: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [deep, knows, all, talk] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Label x={350} y={175} size={46} color={C.sage} opacity={k(t, deep)}>deep context</Label>
      <Ring x={350} y={465} r={235} p={k(t, deep, 0.35)} w={3} color={C.sage} />
      <Dots x={350} y={465} r={235} p={0.5 * k(t, knows, 0.5) + 0.5 * k(t, all, 0.5)} n={200} />
      <Line a={[770, 440]} b={[610, 440]} p={k(t, talk, 0.25)} w={3} head />
      <Line a={[610, 490]} b={[770, 490]} p={k(t, talk + 0.12, 0.25)} w={3} head color={C.sage} />
      <Ring x={880} y={465} r={95} p={k(t, talk, 0.3)} w={3} />
      <Label x={880} y={465} size={50} weight={700} opacity={k(t, talk + 0.1)}>you</Label>
    </Stage>
  );
};

// "Zero context subagents called Goldfish that are going to review your specs and your plans": three
// empty rings, a fish in each, looking up at the two documents. Full screen.
// times: [zero context, Goldfish, specs, plans]
export const SlowGoldfish: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [zero, gold, specs, plans] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const xs = [220, 540, 860], y = 1000;
  const docs: [string, number, number][] = [[String(props.first ?? "specs"), 270, specs], ["plans", 620, plans]];
  return (
    <Stage width={width} height={height}>
      {docs.map(([name, x, a]) => (
        <g key={name}>
          <Doc x={x} y={270} w={190} h={280} p={k(t, a, 0.3)} n={6} lines={6 * k(t, a + 0.1, 0.4)} />
          <Label x={x + 95} y={225} size={46} opacity={k(t, a + 0.1)}>{name}</Label>
        </g>
      ))}
      {xs.map((x, i) => (
        <g key={x}>
          <Ring x={x} y={y} r={125} p={k(t, zero + i * 0.12, 0.3)} w={3} />
          <Fish x={x} y={y} opacity={k(t, gold + i * 0.1, 0.2)} />
          <Line a={[x, y - 145]} b={[x + (i === 0 ? 120 : i === 2 ? -120 : -40), 600]} p={k(t, specs + i * 0.1, 0.3)} w={3} head dash color={C.sage} />
        </g>
      ))}
      <Label x={540} y={1230} size={72} weight={700} color={C.sage} opacity={k(t, gold)}>Goldfish</Label>
      <Label x={540} y={1315} size={48} opacity={k(t, zero)}>zero context</Label>
    </Stage>
  );
};

// "Then provide feedback to the primary agent": the arrows turn round, into the full ring.
// times: [feedback, primary agent]
export const SlowFeedback: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [feedback, primary] = [0, 1].map((i) => at(times, i, shot.start));
  const ys = [230, 450, 670];
  return (
    <Stage width={width} height={height}>
      <Ring x={280} y={440} r={190} p={1} w={3} color={t > primary ? C.sage : C.white} />
      <Dots x={280} y={440} r={190} p={1} n={150} />
      <Label x={280} y={695} size={42} opacity={k(t, primary)}>{String(props.primary ?? "primary agent")}</Label>
      {ys.map((y, i) => (
        <g key={y}>
          <Ring x={900} y={y} r={85} p={1} w={3} />
          <Fish x={900} y={y} opacity={1} />
          <Line a={[800, y]} b={[490, 440 + (y - 450) * 0.35]} p={k(t, feedback + i * 0.1, 0.3)} w={3} head color={C.sage} />
        </g>
      ))}
      <Label x={640} y={190} size={46} weight={700} color={C.sage} opacity={k(t, feedback + 0.1)}>{String(props.label ?? "feedback")}</Label>
    </Stage>
  );
};

// "Most agentic coding tools are too eager to get started, to write code and start building. That
// causes a lot of problems over time": an agent charges into code, the build stacks up, then cracks.
// times: [coding tools, too eager, write code, start building, problems]
export const SlowEager: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [tools, eager, write, build, problems] = [0, 1, 2, 3, 4].map((i) => at(times, i, shot.start));
  const rows = [560, 480, 400, 320];
  return (
    <Stage width={width} height={height}>
      <Ring x={130} y={440} r={75} p={k(t, tools, 0.3)} w={3} />
      <Label x={330} y={350} size={50} weight={700} color={C.sage} opacity={k(t, eager)}>too eager</Label>
      <Line a={[225, 440]} b={[435, 440]} p={k(t, eager, 0.18)} w={7} head color={C.sage} />
      <Doc x={460} y={290} w={200} h={300} p={k(t, write, 0.25)} n={6} lines={6 * k(t, write + 0.05, 0.3)} />
      {rows.map((y, i) => (
        <g key={y}>
          <Rect x={720} y={y} w={250} h={64} p={k(t, build + i * 0.1, 0.18)} sw={3} r={6} />
          <Line a={[735 + (i % 2) * 40, y + 56]} b={[850 + (i % 3) * 40, y + 8]} p={k(t, problems + i * 0.1, 0.2)} w={4} color={C.sage} />
        </g>
      ))}
      <Label x={845} y={695} size={46} color={C.sage} opacity={k(t, problems + 0.2)}>problems</Label>
    </Stage>
  );
};

// "Consider all of the subtle trade-offs that are needed to build real software": the paths fork, and
// one route is chosen. times: [Consider all, subtle, trade-offs, real software]
export const SlowTradeoffs: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [consider, subtle, trade, real] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const ys = [240, 450, 660];
  const pick = 0;
  return (
    <Stage width={width} height={height}>
      <Ring x={110} y={450} r={38} p={k(t, consider, 0.25)} w={3} />
      {ys.map((y, i) => {
        const on = i === pick && t > trade;
        return (
          <g key={y} opacity={t > real && i !== pick ? 0.35 : 1}>
            <Line a={[150, 450 + (y - 450) * 0.08]} b={[455, y]} p={k(t, consider + 0.1 + i * 0.12, 0.3)} w={on ? 5 : 3} color={on ? C.sage : C.white} />
            <Ring x={490} y={y} r={32} p={k(t, subtle + i * 0.12, 0.25)} w={3} color={on ? C.sage : C.white} />
            <Line a={[525, y]} b={[770, 450 + (y - 450) * 0.1]} p={k(t, trade + i * 0.1, 0.3)} w={on ? 5 : 3} color={on ? C.sage : C.white} dash={!on} />
          </g>
        );
      })}
      <Label x={490} y={170} size={50} weight={700} color={C.sage} opacity={k(t, trade + 0.1)}>trade-offs</Label>
      <Ring x={880} y={450} r={110} p={k(t, real, 0.3)} w={4} color={C.sage} />
      <Label x={880} y={435} size={42} weight={700} color={C.sage} opacity={k(t, real + 0.1)}>real</Label>
      <Label x={880} y={490} size={42} weight={700} color={C.sage} opacity={k(t, real + 0.1)}>software</Label>
    </Stage>
  );
};
