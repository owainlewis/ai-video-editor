// "Talk to a finished subagent" (projects/subagent-tasks, 2026-11-07), in the clean style. The row
// name is the real one, from the Claude Code changelog (2.1.319): "Earlier in this session" in
// /tasks. Agents are rings, their work is dots. Split diagrams stay above y 830; the full-screen one
// above y 1400.
import React from "react";
import { at, C, Dots, k, Label, Line, Rect, Ring, Stage } from "../clean/kit";
import type { CustomProps } from "./index";

const Check: React.FC<{ x: number; y: number; p: number; color?: string }> = ({ x, y, p, color = C.sage }) =>
  p <= 0 ? null : <path d={`M ${x - 14} ${y} l 10 11 l 20 -22`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={60 * (1 - p)} />;

// "Your Claude Code subagents aren't gone when they finish": three agents finish and stay.
// times: [subagents, gone, finish]
export const SubAlive: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [subs, , finish] = [0, 1, 2].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      {[0, 1, 2].map((i) => {
        const y = 260 + i * 190, a = subs + i * 0.15;
        return (
          <g key={i} opacity={k(t, a)}>
            <Rect x={180} y={y - 70} w={720} h={140} p={k(t, a, 0.3)} sw={3} r={70} />
            <Ring x={260} y={y} r={38} p={1} w={3} color={t > finish + i * 0.12 ? C.sage : C.white} />
            <Check x={260} y={y} p={k(t, finish + i * 0.12, 0.2)} />
            <line x1={330} y1={y} x2={330 + [430, 340, 390][i]} y2={y} stroke={C.white} strokeWidth={10} strokeLinecap="round" opacity={0.55} />
          </g>
        );
      })}
    </Stage>
  );
};

// "A subagent does its job, reports back and drops off the list": Claude Code hands out the job, the
// subagent fills with work, sends a report back, then fades off. times: [does its job, reports back, drops off]
export const SubLife: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [job, back, drops] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const y = 460, off = k(t, drops, 0.5, "io");
  return (
    <Stage width={width} height={height}>
      <Ring x={260} y={y} r={110} p={k(t, shot.start, 0.3)} w={3} />
      <Label x={260} y={y + 160} size={34}>Claude Code</Label>
      <Line a={[390, y - 40]} b={[650, y - 40]} p={k(t, shot.start + 0.2, 0.3)} w={3} head opacity={0.7} />
      <g opacity={1 - off * 0.8} transform={`translate(0 ${off * 120})`}>
        <Ring x={800} y={y} r={110} p={k(t, shot.start + 0.3, 0.3)} w={3} />
        <Dots x={800} y={y} r={110} p={k(t, job, 0.9)} n={60} />
        <Label x={800} y={y + 160} size={34}>subagent</Label>
      </g>
      <Line a={[650, y + 40]} b={[390, y + 40]} p={k(t, back, 0.35)} w={3} head color={C.sage} />
      <Label x={520} y={y + 90} size={30} color={C.sage} opacity={k(t, back + 0.2) * (1 - off)}>report</Label>
    </Stage>
  );
};

// "So when you have a follow-up, it feels like you have to start a new one from zero": the agent
// that knows the work sits dim; the follow-up goes to an empty ring. times: [follow-up, new one, zero]
export const SubZero: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [follow, fresh, zero] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const y = 470;
  return (
    <Stage width={width} height={height}>
      <g opacity={0.35}>
        <Ring x={250} y={y} r={110} p={1} w={3} />
        <Dots x={250} y={y} r={110} p={1} n={60} />
      </g>
      <Label x={540} y={170} size={36} opacity={k(t, follow)}>follow-up</Label>
      <Line a={[540, 210]} b={[740, 330]} p={k(t, follow + 0.15, 0.3)} w={3} head />
      <Ring x={810} y={y} r={110} p={k(t, fresh, 0.4)} w={3} />
      <Label x={810} y={y} size={90} weight={700} opacity={k(t, zero)}>0</Label>
      <Label x={810} y={y + 165} size={34} opacity={k(t, zero + 0.1)}>from zero</Label>
    </Stage>
  );
};

// "Open the one you want and send it a message": the finished agents under their row, one opens, a
// message goes in, it wakes with all its work. times: [Open, send it, message]
export const SubReopen: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [open, send, msg] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const pick = 1;
  return (
    <Stage width={width} height={height}>
      <Label x={160} y={150} size={40} weight={700} anchor="start">Earlier in this session</Label>
      {[0, 1, 2].map((i) => {
        const y = 270 + i * 150, on = i === pick && t > open;
        return (
          <g key={i} opacity={on || t < open ? 1 : 0.45}>
            <Rect x={160} y={y - 58} w={760} h={116} p={1} sw={3} r={58} color={on ? C.sage : C.white} />
            <Ring x={230} y={y} r={32} p={1} w={3} color={on ? C.sage : C.white} />
            <Check x={230} y={y} p={1} color={on ? C.sage : C.white} />
            <line x1={290} y1={y} x2={290 + [380, 300, 340][i]} y2={y} stroke={on ? C.sage : C.white} strokeWidth={10} strokeLinecap="round" opacity={0.6} />
          </g>
        );
      })}
      <g opacity={k(t, send) * (1 - k(t, msg + 0.3, 0.2))} transform={`translate(0 ${-200 * k(t, send + 0.1, 0.5, "io")})`}>
        <Rect x={640} y={720} w={240} h={90} p={k(t, send, 0.25)} sw={3} r={20} color={C.sage} />
        <line x1={670} y1={765} x2={830} y2={765} stroke={C.sage} strokeWidth={8} strokeLinecap="round" />
      </g>
    </Stage>
  );
};

// "You're talking to the agent that did the work, not a new one starting from scratch": the full ring
// in sage against an empty one, struck out. Full screen. times: [agent that did, not a new, scratch]
export const SubSame: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [did, notNew, scratch] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const y = 820;
  return (
    <Stage width={width} height={height}>
      <Ring x={300} y={y} r={190} p={k(t, did, 0.4)} w={4} color={C.sage} />
      <Dots x={300} y={y} r={190} p={k(t, did + 0.1, 0.6)} n={110} />
      <Label x={300} y={y + 260} size={40} color={C.sage} opacity={k(t, did + 0.3)}>did the work</Label>
      <g opacity={1 - 0.55 * k(t, scratch, 0.3)}>
        <Ring x={790} y={y} r={150} p={k(t, notNew, 0.4)} w={3} />
        <Label x={790} y={y + 220} size={40} opacity={k(t, notNew + 0.2)}>a new one</Label>
        <Line a={[650, y + 150]} b={[930, y - 150]} p={k(t, notNew + 0.45, 0.25)} w={4} />
      </g>
    </Stage>
  );
};
