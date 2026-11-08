// EGM, the natural take (projects/reel-natural, 2026-11-08), in the clean style. Labels are the words
// Owain says. Agents are rings, what they know is dots. Split diagrams stay above y 830; the
// full-screen one above y 1400.
import React from "react";
import { at, C, Doc, Dots, k, Label, Line, Ring, Stage } from "../clean/kit";
import type { CustomProps } from "./index";

// "You have two different types of agent": two rings; one fills, the other stays empty.
// times: [two different, types]
export const NatTwo: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [two, types] = [0, 1].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Ring x={320} y={450} r={180} p={k(t, two, 0.35)} w={3} />
      <Dots x={320} y={450} r={180} p={k(t, types, 0.6)} n={120} />
      <Ring x={760} y={450} r={180} p={k(t, two + 0.25, 0.35)} w={3} />
    </Stage>
  );
};

// "A full context agent that knows everything about your project, your architecture, and the way your
// system works": one ring fills as each thing goes in. times: [full context, knows, project, architecture, system]
export const NatFull: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [full, knows, project, arch, system] = [0, 1, 2, 3, 4].map((i) => at(times, i, shot.start));
  const names = (props.rows as string[] | undefined) ?? ["your project", "your architecture", "your system"];
  const rows: [string, number, number][] = [[names[0], 300, project], [names[1], 460, arch], [names[2], 620, system]];
  const fill = (project > knows ? 0.25 * k(t, knows, 0.3) : 0) + rows.reduce((p, r) => p + 0.25 * k(t, r[2], 0.3), 0);
  return (
    <Stage width={width} height={height}>
      <Label x={270} y={185} size={44} color={C.sage} opacity={k(t, full)}>{String(props.label ?? "full context")}</Label>
      <Ring x={270} y={460} r={210} p={k(t, full, 0.35)} w={3} color={C.sage} />
      <Dots x={270} y={460} r={210} p={fill} n={160} />
      {rows.map(([name, y, a]) => (
        <g key={name}>
          <Line a={[590, y]} b={[500, y]} p={k(t, a, 0.2)} w={3} head />
          <Label x={610} y={y + 16} size={46} weight={700} anchor="start" opacity={k(t, a + 0.06)}>{name}</Label>
        </g>
      ))}
    </Stage>
  );
};

export const Fish: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <g opacity={opacity} fill="none" stroke={C.sage} strokeWidth={4} strokeLinejoin="round">
    <path d={`M ${x - 66.5} ${y} Q ${x - 16.5} ${y - 46} ${x + 30.5} ${y} Q ${x - 16.5} ${y + 46} ${x - 66.5} ${y} Z`} />
    <path d={`M ${x + 30.5} ${y} L ${x + 66.5} ${y - 30} L ${x + 66.5} ${y + 30} Z`} />
    <circle cx={x - 39.5} cy={y - 7} r={4} fill={C.sage} stroke="none" />
  </g>
);

// "This agent will delegate to subagents called Goldfish who have no context about your project": the
// full ring above, three empty ones below, a fish in each. Full screen. times: [delegate, subagents, Goldfish, no context]
export const NatGoldfish: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [delegate, subs, gold, none] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const xs = [220, 540, 860], y = 960;
  return (
    <Stage width={width} height={height}>
      <Ring x={540} y={470} r={200} p={k(t, shot.start, 0.35)} w={3} />
      <Dots x={540} y={470} r={200} p={k(t, shot.start + 0.1, 0.5)} n={170} />
      {xs.map((x, i) => (
        <g key={x}>
          <Line a={[540 + (x - 540) * 0.32, 680]} b={[540 + (x - 540) * 0.92, y - 150]} p={k(t, delegate + i * 0.1, 0.3)} w={3} head />
          <Ring x={x} y={y} r={125} p={k(t, subs + i * 0.12, 0.3)} w={3} />
          <Fish x={x} y={y} opacity={k(t, gold + i * 0.1, 0.2)} />
        </g>
      ))}
      <Label x={540} y={1190} size={72} weight={700} color={C.sage} opacity={k(t, gold)}>Goldfish</Label>
      <Label x={540} y={1275} size={48} opacity={k(t, none)}>no context</Label>
    </Stage>
  );
};

// "Multiple different subagents that will review your specs": rings all round one spec, each looking
// in from its own side. times: [multiple different, review, specs]
export const NatAngles: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [many, review, specs] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const cx = 540, cy = 440;
  return (
    <Stage width={width} height={height}>
      <Doc x={cx - 105} y={cy - 145} w={210} h={290} p={k(t, shot.start, 0.3)} n={6} lines={6 * k(t, specs, 0.4)} color={C.sage} />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const a = (deg * Math.PI) / 180, x = cx + Math.cos(a) * 410, y = cy + Math.sin(a) * 270;
        return (
          <g key={deg}>
            <Ring x={x} y={y} r={56} p={k(t, many + i * 0.09, 0.25)} w={3} />
            <Line a={[x + (cx - x) * 0.2, y + (cy - y) * 0.2]} b={[x + (cx - x) * 0.62, y + (cy - y) * 0.62]} p={k(t, review + i * 0.07, 0.25)} w={3} head dash color={C.sage} />
          </g>
        );
      })}
    </Stage>
  );
};
