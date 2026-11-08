// "REVIEW.md" (projects/review-md and review-md-short, 2026-11-08), in the clean style. Labels are the
// words Owain says. Split diagrams stay above y 830; the full-screen one above y 1400.
import React from "react";
import { C, Doc, k, Label, Line, Rect, Ring } from "../clean/kit";
import { MONO } from "../clean/text";
import type { CustomProps } from "./index";

const Stage: React.FC<{ width: number; height: number; children: React.ReactNode }> = ({ width, height, children }) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    {children}
  </svg>
);
const at = (times: number[], i: number, fallback: number) => times[i] ?? fallback;
const FileName: React.FC<{ x: number; y: number; size: number; opacity: number }> = ({ x, y, size, opacity }) => (
  <text x={x} y={y} textAnchor="middle" fill={C.sage} fontFamily={MONO} fontSize={size} opacity={opacity}>REVIEW.md</text>
);

// "One of the best ways is to write a REVIEW.md file": one page writes itself and gets its name.
// times: [best ways, write, REVIEW.md]
export const RmdFile: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [best, write, name] = [0, 1, 2].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Doc x={370} y={180} w={340} h={460} p={k(t, best, 0.35)} n={7} lines={7 * k(t, write, Math.max(0.3, name - write + 0.3))} />
      <FileName x={540} y={750} size={84} opacity={k(t, name)} />
    </Stage>
  );
};

// "A file you put inside your repository that your agents are going to read": the file drops into the
// repo, then the agents read it. props.label names the box. props.agentsOnly: the file is already in
// and times are [agents, read]; otherwise times: [put inside, repository, agents, read]
export const RmdRepo: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const only = !!props.agentsOnly;
  const [put, repo, agents, read] = only
    ? [shot.start, shot.start, at(times, 0, shot.start), at(times, 1, shot.start)]
    : [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const drop = only ? 0 : 1 - k(t, put, 0.45, "io");
  const ys = [300, 470, 640];
  return (
    <Stage width={width} height={height}>
      <Label x={345} y={170} size={38} opacity={only ? 1 : k(t, repo)}>{String(props.label ?? "your repository")}</Label>
      <Rect x={90} y={210} w={510} h={560} p={only ? 1 : k(t, shot.start, 0.35)} sw={3} r={22} />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={140} y1={290 + i * 62} x2={140 + [250, 340, 200][i]} y2={290 + i * 62} stroke={C.white} strokeWidth={9} strokeLinecap="round" opacity={0.4} />
      ))}
      <g opacity={only ? 1 : k(t, put, 0.2)} transform={`translate(0 ${-150 * drop})`}>
        <Doc x={150} y={480} w={150} h={210} p={1} n={5} lines={5} color={C.sage} />
        <FileName x={420} y={600} size={40} opacity={1} />
      </g>
      <Label x={860} y={210} size={38} opacity={k(t, agents)}>agents</Label>
      {ys.map((y, i) => (
        <g key={i}>
          <Ring x={860} y={y + 20} r={62} p={k(t, agents + i * 0.12, 0.3)} w={3} color={t > read + i * 0.12 ? C.sage : C.white} />
          <Line a={[770, y + 20]} b={[560, 575]} p={k(t, read + i * 0.12, 0.3)} w={3} head dash color={C.sage} />
        </g>
      ))}
    </Stage>
  );
};

// "You can include rules about what to look for, problem areas": the page and the two kinds of rule.
// times: [rules, look for, problem areas]
export const RmdRules: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [rules, look, problem] = [0, 1, 2].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Doc x={110} y={190} w={360} h={520} p={k(t, shot.start, 0.3)} n={7} lines={7 * k(t, rules, 0.5)} />
      <Line a={[490, 340]} b={[580, 340]} p={k(t, look, 0.2)} w={3} head />
      <Label x={610} y={356} size={52} weight={700} anchor="start" opacity={k(t, look + 0.08)}>what to</Label>
      <Label x={610} y={420} size={52} weight={700} anchor="start" opacity={k(t, look + 0.08)}>look for</Label>
      <Line a={[490, 580]} b={[580, 580]} p={k(t, problem, 0.2)} w={3} head color={C.sage} />
      <Label x={610} y={596} size={52} weight={700} anchor="start" color={C.sage} opacity={k(t, problem + 0.08)}>problem</Label>
      <Label x={610} y={660} size={52} weight={700} anchor="start" color={C.sage} opacity={k(t, problem + 0.08)}>areas</Label>
    </Stage>
  );
};

// "Anytime you encounter a problem, you can update this file and improve it": a loop that feeds the
// file. Full screen. times: [problem, update, improve]
export const RmdLoop: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [problem, update, improve] = [0, 1, 2].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Ring x={540} y={520} r={140} p={k(t, problem, 0.35)} w={3} />
      <Label x={540} y={520} size={48} weight={700} opacity={k(t, problem + 0.1)}>problem</Label>
      <Line a={[640, 640]} b={[770, 860]} p={k(t, update - 0.1, 0.3)} w={3} head />
      <Doc x={700} y={880} w={240} h={320} p={k(t, update, 0.3)} n={6} lines={6 * k(t, update + 0.1, 0.6)} />
      <Label x={820} y={1270} size={42} opacity={k(t, update + 0.2)}>update this file</Label>
      <Line a={[680, 1040]} b={[420, 1040]} p={k(t, improve - 0.1, 0.3)} w={3} head color={C.sage} />
      <Ring x={260} y={1040} r={140} p={k(t, improve, 0.35)} w={4} color={C.sage} />
      <Label x={260} y={1040} size={48} weight={700} color={C.sage} opacity={k(t, improve + 0.1)}>improve</Label>
      <Line a={[320, 900]} b={[440, 640]} p={k(t, improve + 0.3, 0.3)} w={3} head dash color={C.sage} />
    </Stage>
  );
};
