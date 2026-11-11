// EGM, the natural take (projects/reel-natural, 2026-11-08), in the clean style. Labels are the words
// Owain says. Agents are rings, what they know is dots. Split diagrams stay above y 830; the
// full-screen one above y 1400.
import React from "react";
import { at, C, Doc, Dots, k, Label, Line, MOVE, Rect, Ring, Stage } from "../clean/kit";
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
// props.spec (egm-reel-v3): a spec writes itself beside the full ring first, and times start with it.
export const NatGoldfish: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const o = props.spec ? 1 : 0, write = at(times, 0, shot.start);
  const [delegate, subs, gold, none] = [0, 1, 2, 3].map((i) => at(times, i + o, shot.start));
  const xs = [220, 540, 860], y = 960;
  return (
    <Stage width={width} height={height}>
      <Ring x={540} y={470} r={200} p={k(t, shot.start, 0.35)} w={3} />
      <Dots x={540} y={470} r={200} p={k(t, shot.start + 0.1, 0.5)} n={170} />
      {o > 0 && <Doc x={800} y={360} w={170} h={230} p={k(t, write, 0.3)} n={5} lines={5 * k(t, write + 0.15, 0.9)} color={C.sage} />}
      {xs.map((x, i) => (
        <g key={x}>
          <Line a={[540 + (x - 540) * 0.32, 680]} b={[540 + (x - 540) * 0.92, y - 150]} p={k(t, delegate + i * 0.1, 0.3)} w={3} head />
          <Ring x={x} y={y} r={125} p={k(t, subs + i * 0.12, 0.3)} w={3} />
          <Fish x={x} y={y} opacity={k(t, gold + i * 0.1, 0.2)} />
        </g>
      ))}
      <Label x={540} y={1190} size={72} weight={700} color={C.sage} opacity={k(t, gold)}>Goldfish</Label>
      {times.length > 3 + o && <Label x={540} y={1275} size={48} opacity={k(t, none)}>no context</Label>}
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

// "Each of those subagents is going to review your spec from a different angle... flag up loads of
// problems" (projects/egm-reel-v3, 2026-11-11): a spec, three goldfish, and each one marks the line it
// looked at and names what it found. The findings are real, from Owain's YouTube IQ run in the EGM
// video, in three words each (labels: three words, five at most, off every line).
// props: { title, finds: [3], end? }. times: [review, spec, angle, find 1, find 2, find 3, end?]
export const NatReview: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [review, spec, angle, f1, f2, f3, close] = [0, 1, 2, 3, 4, 5, 6].map((i) => at(times, i, shot.start));
  const finds = [f1, f2, f3], found = props.finds as string[];
  const dx = 110, dy = 220, dw = 380, dh = 560, n = 6, pad = dw * 0.14, gap = (dh - pad * 2) / n;
  const barY = (i: number) => dy + pad + gap * i + gap * 0.4;
  const rows = [1, 3, 5], fx = 960;
  return (
    <Stage width={width} height={height}>
      <Label x={dx} y={175} size={44} anchor="start" color={C.sage} opacity={k(t, shot.start + 0.1)}>{String(props.title)}</Label>
      <Doc x={dx} y={dy} w={dw} h={dh} p={k(t, shot.start, 0.35)} n={n} lines={n * k(t, shot.start + 0.15, 0.5)} />
      {rows.map((row, i) => {
        const y = barY(row), slide = 1 - k(t, review + i * 0.15, MOVE * 0.8), lw = (dw - pad * 2) * (row % 3 === 2 ? 0.62 : 1);
        return (
          <g key={row}>
            <rect x={dx + pad - 8} y={y - gap * 0.32} width={(lw + 16) * k(t, angle + i * 0.12, 0.25)} height={gap * 0.64} fill={C.sage} opacity={0.35} rx={4} />
            <Line a={[dx + pad - 10, y]} b={[dx + pad + lw + 10, y]} p={k(t, finds[i], 0.25)} w={5} color={C.sage} />
            <Line a={[fx - 80, y]} b={[dx + dw + 24, y]} p={k(t, spec + i * 0.1, 0.3)} w={3} dash color={C.sage} />
            <Fish x={fx + slide * 240} y={y} opacity={k(t, review + i * 0.15, 0.25)} />
            <Label x={dx + dw + 40} y={y + 80} size={34} anchor="start" opacity={k(t, finds[i] + 0.1)}>{found[i]}</Label>
          </g>
        );
      })}
      {typeof props.end === "string" && times.length > 6 && <Label x={dx + dw + 40} y={250} size={40} anchor="start" color={C.sage} opacity={k(t, close)}>{props.end}</Label>}
    </Stage>
  );
};

// "One primary agent that knows all about your project... your software, your application, your
// architecture, your users... knows everything" (projects/egm-reel-v3): NatFull with a row per thing
// he names, so a part lands every phrase. props: { label, rows: [n] }.
// times: [agent, knows, context, ...one per row, everything]
export const NatKnows: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const names = props.rows as string[], n = names.length;
  const [agent, knows, context] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const rowAt = names.map((_, i) => at(times, 3 + i, shot.start)), everything = at(times, 3 + n, shot.start);
  const fill = 0.12 * k(t, knows, 0.3) + 0.12 * k(t, context, 0.3) + rowAt.reduce((p, a) => p + (0.6 / n) * k(t, a, 0.3), 0) + 0.16 * k(t, everything, 0.4);
  const step = Math.min(120, 460 / Math.max(1, n - 1));
  return (
    <Stage width={width} height={height}>
      <Label x={270} y={185} size={44} color={C.sage} opacity={k(t, agent)}>{String(props.label)}</Label>
      <Ring x={270} y={460} r={210} p={k(t, agent, 0.35)} w={3} color={C.sage} />
      <Ring x={270} y={460} r={226} p={k(t, everything, 0.4)} w={3} color={C.sage} />
      <Dots x={270} y={460} r={210} p={fill} n={160} />
      {names.map((name, i) => {
        const y = 460 - ((n - 1) * step) / 2 + i * step;
        return (
          <g key={name}>
            <Line a={[590, y]} b={[500, y]} p={k(t, rowAt[i], 0.2)} w={3} head />
            <Label x={610} y={y + 15} size={42} weight={700} anchor="start" opacity={k(t, rowAt[i] + 0.06)}>{name}</Label>
          </g>
        );
      })}
    </Stage>
  );
};
