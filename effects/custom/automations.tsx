// ChatGPT scheduled automations (projects/hybrid-automations, 2026-11-08), in the clean style. Labels
// are the words Owain says. The split diagram stays above y 830; the full-screen one above y 1400.
import React from "react";
import { at, C, k, Label, Line, Rect, Ring, Stage } from "../clean/kit";
import type { CustomProps } from "./index";

const Mail: React.FC<{ x: number; y: number; w: number; h: number; p: number; color?: string }> = ({ x, y, w, h, p, color = C.white }) => (
  <g opacity={p}>
    <Rect x={x} y={y} w={w} h={h} p={1} sw={3} r={8} color={color} />
    <path d={`M ${x + 6} ${y + 8} L ${x + w / 2} ${y + h * 0.58} L ${x + w - 6} ${y + 8}`} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
  </g>
);

// "Imagine you've got a large number of emails": the inbox fills. times: [large number, emails]
export const AutoFlood: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [large, mail] = [0, 1].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      {Array.from({ length: 24 }, (_, i) => (
        <Mail key={i} x={110 + (i % 6) * 145} y={210 + Math.floor(i / 6) * 135} w={125} h={100} p={k(t, large + i * 0.035, 0.12)} color={i === 8 && t > mail ? C.sage : C.white} />
      ))}
    </Stage>
  );
};

// "Every single morning at 9am, go through my emails, triage them and then find things that need
// improving": a clock, the inbox, three piles, the one that matters. Full screen.
// times: [9am, go through, triage, improving]
export const AutoMorning: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [nine, through, triage, improve] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const piles = [220, 540, 860];
  return (
    <Stage width={width} height={height}>
      <Ring x={540} y={340} r={130} p={k(t, shot.start, 0.35)} w={3} />
      <Line a={[540, 340]} b={[540, 250]} p={k(t, shot.start + 0.1, 0.2)} w={5} />
      <Line a={[540, 340]} b={[465, 340]} p={k(t, nine, 0.25)} w={5} color={C.sage} />
      <Label x={750} y={365} size={72} weight={700} color={C.sage} opacity={k(t, nine)}>9am</Label>
      <Line a={[540, 490]} b={[540, 585]} p={k(t, through - 0.1, 0.2)} w={3} head />
      <Mail x={430} y={610} w={220} h={165} p={k(t, through, 0.2)} />
      <Label x={685} y={705} size={42} anchor="start" opacity={k(t, through + 0.1)}>my emails</Label>
      {piles.map((x, i) => (
        <g key={x}>
          <Line a={[540 + (x - 540) * 0.25, 860]} b={[x, 985]} p={k(t, triage + i * 0.08, 0.25)} w={3} head />
          <Mail x={x - 75} y={1005} w={150} h={115} p={k(t, triage + 0.1 + i * 0.08, 0.2)} color={i === 2 && t > improve ? C.sage : C.white} />
        </g>
      ))}
      <Label x={380} y={1215} size={50} weight={700} opacity={k(t, triage + 0.2)}>triage</Label>
      <Label x={860} y={1215} size={50} weight={700} color={C.sage} opacity={k(t, improve)}>improving</Label>
    </Stage>
  );
};
