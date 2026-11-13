// EGM, the natural take (projects/reel-natural, 2026-11-08), in the clean style. Labels are the words
// Owain says. Agents are rings, what they know is dots. Split diagrams stay above y 830; the
// full-screen one above y 1400.
import React from "react";
import { Img } from "remotion";
import { at, C, Doc, k, tone, usePalette, Label, lerp, Line, move, MOVE, Rect, Ring, Stage } from "../clean/kit";
import { blurIn, display, GREEN, Typed } from "../clean/text";
import type { CustomProps } from "./index";

// "You have two different types of agent": two rings; one fills, the other stays empty.
// times: [two different, types]
export const NatTwo: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [two, types] = [0, 1].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Ring x={320} y={450} r={180} p={k(t, two, 0.35)} w={3} />
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
  return (
    <Stage width={width} height={height}>
      <Label x={270} y={185} size={44} color={C.sage} opacity={k(t, full)}>{String(props.label ?? "full context")}</Label>
      <Ring x={270} y={460} r={210} p={k(t, full, 0.35)} w={3} color={C.sage} />
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
  <g opacity={opacity} fill="none" stroke={tone(usePalette(), C.sage)} strokeWidth={4} strokeLinejoin="round">
    <path d={`M ${x - 66.5} ${y} Q ${x - 16.5} ${y - 46} ${x + 30.5} ${y} Q ${x - 16.5} ${y + 46} ${x - 66.5} ${y} Z`} />
    <path d={`M ${x + 30.5} ${y} L ${x + 66.5} ${y - 30} L ${x + 66.5} ${y + 30} Z`} />
    <circle cx={x - 39.5} cy={y - 7} r={4} fill={tone(usePalette(), C.sage)} stroke="none" />
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
  const pal = usePalette();
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
            <rect x={dx + pad - 8} y={y - gap * 0.32} width={(lw + 16) * k(t, angle + i * 0.12, 0.25)} height={gap * 0.64} fill={tone(pal, C.sage)} opacity={0.35} rx={4} />
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
  const step = Math.min(120, 460 / Math.max(1, n - 1));
  return (
    <Stage width={width} height={height}>
      <Label x={270} y={185} size={44} color={C.sage} opacity={k(t, agent)}>{String(props.label)}</Label>
      <Ring x={270} y={460} r={210} p={k(t, agent, 0.35)} w={3} color={C.sage} />
      <Ring x={270} y={460} r={226} p={k(t, everything, 0.4)} w={3} color={C.sage} />
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

// ---- egm-reel-v3, second cut (2026-11-11): "faster, more split, nicer graphics, nicer end screen" ----
// The real Elephant and Goldfish marks (props.logo, "logo:egm-elephant" and "logo:egm-goldfish") are the cast:
// they arrive, move and act. Labels 44 px or more, so they read on a phone.

// A real mark (a logo, never redrawn), centred on x, y, `h` tall. It rises a little as it lands.
const MARK_W = 0.92;
const Mark: React.FC<{ src: string; x: number; y: number; h: number; p?: number; r?: number }> = ({ src, x, y, h, p = 1, r = 0 }) => {
  if (p <= 0.01) return null;
  const w = h * MARK_W, rise = (1 - p) * 26;
  return <image href={src} x={x - w / 2} y={y - h / 2 + rise} width={w} height={h} opacity={Math.min(1, p * 1.6)} transform={r ? `rotate(${r} ${x} ${y})` : undefined} />;
};
const str = (v: unknown) => String(v ?? "");
// Marks come in props.logo ({ elephant, goldfish, google }: "logo:<name>", inlined when the plan resolves).
const logo = (props: Record<string, unknown>, name: string) => str((props.logo as Record<string, unknown> | undefined)?.[name]);

// "In a much better way. So the concept behind EGM is you have one primary agent that knows all about
// your project... your software, your application, your architecture, your users... knows
// everything": the two marks land, are named, then the goldfish swims off and the elephant becomes the
// agent at the centre of a ring that fills as each thing goes in. props: { elephant, goldfish, label, rows }.
// times: [better, concept, EGM, one, primary agent, knows, context, ...one per row, everything]
export const NatCast: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const names = (props.rows as string[] | undefined) ?? [], n = names.length;
  const [better, concept, egm, one, primary] = [0, 1, 2, 3, 4].map((i) => at(times, i, shot.start));
  const rowAt = names.map((_, i) => at(times, 7 + i, shot.start)), everything = times[7 + n] ?? Infinity;
  const m = move(t, one);
  const cx = 270, cy = 470, r = 190;
  const ex = lerp(350, cx, m), ey = lerp(430, cy, m), eh = lerp(230, 124, m);
  const gx = lerp(730, 1250, move(t, one, 0.5));
  const named = 1 - k(t, one, 0.2);
  const step = Math.min(118, 470 / Math.max(1, n - 1));
  const pulse = 1 + 0.07 * Math.sin(Math.PI * k(t, everything, 0.5));
  return (
    <Stage width={width} height={height}>
      <Ring x={cx} y={cy} r={r} p={k(t, primary, 0.35)} w={4} color={C.sage} />
      <Ring x={cx} y={cy} r={r + 20} p={k(t, everything, 0.45)} w={3} color={C.sage} />
      <Mark src={logo(props, "elephant")} x={ex} y={ey} h={eh * pulse} p={k(t, better, 0.3)} />
      <Mark src={logo(props, "goldfish")} x={gx} y={430} h={230} p={k(t, better + 0.25, 0.3) * (1 - k(t, one + 0.15, 0.35))} />
      <Label x={350} y={650} size={56} opacity={k(t, concept, 0.2) * named}>Elephant</Label>
      <Label x={730} y={650} size={56} opacity={k(t, egm, 0.2) * named}>Goldfish</Label>
      <Label x={cx} y={205} size={50} color={C.sage} opacity={k(t, primary + 0.1, 0.2)}>{str(props.label)}</Label>
      {names.map((name, i) => {
        const y = cy - ((n - 1) * step) / 2 + i * step;
        return (
          <g key={name}>
            <Line a={[548, y]} b={[478, y]} p={k(t, rowAt[i], 0.2)} w={4} head />
            <Label x={568} y={y + 2} size={48} anchor="start" opacity={k(t, rowAt[i] + 0.06, 0.15)}>{name}</Label>
          </g>
        );
      })}
    </Stage>
  );
};

// "When the agent will write a spec, it will then delegate that to multiple different sub-agents,
// which are called Goldfish": full screen. The elephant writes the spec beside its ring; the spec drops
// to the middle, three lines fan out to three empty rings, a copy of the spec travels down each, and a
// goldfish appears in each ring (the caption names them, so no label). props: { elephant, goldfish }.
// times: [agent, write, delegate, multiple, sub-agents, Goldfish]
export const NatDelegate: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [agent, write, delegate, multiple, subs, gold] = [0, 1, 2, 3, 4, 5].map((i) => at(times, i, shot.start));
  const top = { x: 540, y: 470, r: 180 }, xs = [220, 540, 860], ry = 1240, rr = 118;
  const d = move(t, delegate);
  const doc = { x: lerp(860, 540, d), y: lerp(440, 840, d), w: lerp(190, 150, d) };
  const dh = doc.w * 1.32;
  return (
    <Stage width={width} height={height}>
      <Ring x={top.x} y={top.y} r={top.r} p={k(t, shot.start, 0.35)} w={4} color={C.sage} />
      <Mark src={logo(props, "elephant")} x={top.x} y={top.y} h={118} p={k(t, agent, 0.3)} />
      <Doc x={doc.x - doc.w / 2} y={doc.y - dh / 2} w={doc.w} h={dh} p={k(t, write, 0.3)} n={5} lines={5 * k(t, write + 0.15, 0.9)} color={C.white} />
      <Label x={860} y={640} size={48} color={C.sage} opacity={k(t, write + 0.2, 0.2) * (1 - k(t, delegate, 0.15))}>spec</Label>
      {xs.map((x, i) => {
        const a: [number, number] = [540 + (x - 540) * 0.18, 840 + dh / 2 + 24], b: [number, number] = [540 + (x - 540) * 0.94, ry - rr - 22];
        // The spec's copy runs down its line and is taken into the ring.
        const go = move(t, subs + i * 0.08, 0.55), inside = k(t, subs + i * 0.08 + 0.45, 0.15);
        const cx = lerp(540, x, go), cy = lerp(840, ry, go), s = lerp(1, 0.45, go);
        return (
          <g key={x}>
            <Line a={a} b={b} p={k(t, multiple + i * 0.1, 0.3)} w={3} head />
            <Ring x={x} y={ry} r={rr} p={k(t, multiple + 0.15 + i * 0.12, 0.3)} w={3} />
            {t >= subs + i * 0.08 && inside < 1 && <Doc x={cx - 40 * s} y={cy - 53 * s} w={80 * s} h={106 * s} p={1} n={3} lines={3} opacity={1 - inside} color={C.sage} />}
            <Mark src={logo(props, "goldfish")} x={x} y={ry} h={104} p={k(t, gold + i * 0.12, 0.25)} />
          </g>
        );
      })}
    </Stage>
  );
};

// "Each of those sub-agents is going to review your spec from a different angle... much higher
// quality... flag up loads of problems": the spec on the left, three goldfish arrive on the right and
// look at a line each; on each finding a goldfish darts across its line, striking it through, and the
// finding lands beside the spec. The findings are real (Owain's YouTube IQ run in the EGM video,
// projects/egm-youtube-v3 at 11:28 and 14:05), three words each. props: { title, finds: [3], goldfish }.
// times: [review, spec, angle, so, find 1, find 2, find 3]
export const NatStrike: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const pal = usePalette();
  const [review, spec, angle, so, f1, f2, f3] = [0, 1, 2, 3, 4, 5, 6].map((i) => at(times, i, shot.start));
  const finds = [f1, f2, f3], found = props.finds as string[];
  const dx = 150, dy = 190, dw = 330, dh = 590, n = 6, pad = dw * 0.14, gap = (dh - pad * 2) / n;
  const rowY = (i: number) => dy + pad + gap * i + gap * 0.4;
  const rows = [1, 3, 5], lineL = dx + pad, lineR = dx + dw - pad;
  return (
    <Stage width={width} height={height}>
      <Label x={dx} y={146} size={44} anchor="start" color={C.sage} opacity={k(t, shot.start + 0.1)}>{str(props.title)}</Label>
      <Doc x={dx} y={dy} w={dw} h={dh} p={k(t, shot.start, 0.35)} n={n} lines={n * k(t, shot.start + 0.15, 0.5)} />
      {rows.map((row, i) => {
        const y = rowY(row), lw = (dw - pad * 2) * (row % 3 === 2 ? 0.62 : 1);
        // Parked on the right, then a hop closer, then the dart across the line.
        const park = lerp(1220, 930, move(t, shot.start + 0.2 + i * 0.15)) - 50 * move(t, so + i * 0.08, 0.4);
        const dart = move(t, finds[i], 0.55), fx = lerp(park, 78, dart);
        const strike = Math.max(0, Math.min(1, (lineL + lw + 10 - fx) / (lw + 20)));
        const tilt = (i - 1) * 14 * k(t, angle + i * 0.08, 0.3) * (1 - k(t, finds[i], 0.2));
        return (
          <g key={row}>
            <rect x={lineL - 8} y={y - gap * 0.32} width={(lw + 16) * k(t, spec + i * 0.12, 0.25)} height={gap * 0.64} fill={tone(pal, C.sage)} opacity={0.3 - 0.2 * k(t, finds[i], 0.3)} rx={4} />
            <Line a={[park - 60, y]} b={[lineR + 30, y]} p={k(t, review + i * 0.1, 0.3)} w={3} dash color={C.sage} opacity={1 - k(t, finds[i], 0.12)} />
            {strike > 0 && <Line a={[lineL + lw + 10, y]} b={[lineL - 10, y]} p={strike} w={6} color={C.white} />}
            <Mark src={logo(props, "goldfish")} x={fx} y={y} h={84} p={k(t, shot.start + 0.2 + i * 0.15, 0.3)} r={tilt} />
            <Label x={520} y={y + 2} size={44} anchor="start" opacity={k(t, finds[i] + 0.36, 0.15)}>{found[i]}</Label>
          </g>
        );
      })}
    </Stage>
  );
};

// "Google are one of the best engineering teams in the world": the real Google mark lands; a ring
// draws round it on "best engineering", the words land under it, and on "world" a ring of dots goes
// round the outside. props: { google, label? } (label: the words under it, "engineering teams" by
// default). times: [best, engineering teams, world]
export const NatGoogle: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const pal = usePalette();
  const [best, teams, world] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const x = 540, y = 400;
  const orbit = k(t, world, 0.5);
  return (
    <Stage width={width} height={height}>
      <image href={logo(props, "google")} x={x - 120} y={y - 120 + (1 - k(t, shot.start, 0.3)) * 26} width={240} height={240} opacity={Math.min(1, 1.6 * k(t, shot.start, 0.3))} />
      <Ring x={x} y={y} r={200} p={k(t, best, 0.4)} w={4} color={C.sage} />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
        return i / 36 < orbit ? <circle key={i} cx={x + Math.cos(a) * 236} cy={y + Math.sin(a) * 236} r={4} fill={tone(pal, C.white)} opacity={0.7} /> : null;
      })}
      <Label x={x} y={720} size={60} opacity={k(t, teams, 0.2)}>{str(props.label ?? "engineering teams")}</Label>
    </Stage>
  );
};

// "Comment EGM below, and I'll send it across": the end card, drawn on a paper card, in the house type. The two marks
// land, then "comment", then "egm" types on large over a field line, then his last words. It holds to
// the end, so it can be read. On "across" the two marks slide together into EGM's one mark, as on its
// README. The card carries the words, so the caption stays off (props.caption false).
// props: { logo: { elephant, goldfish } }. times: [comment, EGM, send it, across]
export const NatEnd: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [comment, egm, send, across] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const join = move(t, across, 0.5);
  const rise = (a: number) => ({ opacity: k(t, a, 0.25), transform: `translateY(${(1 - move(t, a, 0.45)) * 30}px)` });
  return (
    <div style={{ position: "absolute", inset: 0, width, height }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, display: "flex", justifyContent: "center", gap: lerp(40, 6, join) }}>
        <Img src={logo(props, "elephant")} style={{ height: 170, ...rise(shot.start) }} />
        <Img src={logo(props, "goldfish")} style={{ height: 170, ...rise(shot.start + 0.12) }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, textAlign: "center", ...display(84), color: GREEN, ...blurIn(t, comment) }}>comment</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 900, textAlign: "center", ...display(300), color: GREEN }}>
        <Typed s="egm" t={t} at={egm} per={0.07} />
      </div>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <Line a={[310, 1250]} b={[770, 1250]} p={k(t, egm + 0.2, 0.4)} w={5} color={GREEN} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1310, textAlign: "center", ...display(64), textTransform: "none", color: GREEN, ...blurIn(t, send) }}>and I'll send it across</div>
    </div>
  );
};
