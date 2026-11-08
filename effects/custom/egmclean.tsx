// The EGM reel's diagrams in the clean style (projects/egm-clean, 2026-11-06). Thin white lines that
// draw on as their words are said, sage on the one thing that matters, file and skill names from the
// plugin itself (~/.claude/plugins/cache/egm/egm/0.1.0/skills).
// Split diagrams draw in the top panel (1080 x 960) and stay above y 830, where the seam caption
// sits; a chip takes y 120 to 190. The overlay draws in the glass (960 x 880); the full-screen
// diagram in the whole frame.
import React from "react";
import { at, C, Doc, Dots, k, Label, lerp, Line, Rect, Ring, Stage } from "../clean/kit";
import { MONO } from "../clean/text";
import type { CustomProps } from "./index";

const CX = 540;
const P = 470;

// "coding agents like Claude Code or Codex": two terminal windows. times: [Claude Code, Codex]
export const EgmAgents: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => (
  <Stage width={width} height={height}>
    {(["Claude Code", "Codex"] as const).map((name, n) => {
      const x = CX + (n ? 225 : -225), a = at(times, n, shot.start);
      return (
        <g key={name} opacity={k(t, a, 0.2)}>
          <Rect x={x - 190} y={P - 130} w={380} h={260} p={k(t, a, 0.35)} sw={3} r={22} />
          {[0, 1, 2].map((i) => <circle key={i} cx={x - 160 + i * 26} cy={P - 100} r={7} fill={C.white} opacity={0.5} />)}
          <line x1={x - 190} y1={P - 72} x2={x + 190} y2={P - 72} stroke={C.white} strokeWidth={2} opacity={0.3} />
          <Label x={x} y={P + 10} size={44} weight={700}>{name}</Label>
          <Label x={x - 150} y={P + 80} size={30} anchor="start" opacity={0.6}>{"> _"}</Label>
        </g>
      );
    })}
  </Stage>
);

// "one agent that knows your whole project. You talk through what you want to build and it writes a
// detailed plan": you, into one big circle full of the project, out to a plan.
// times: [one agent, whole project, talk, writes, detailed plan]
export const EgmOneAgent: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [one, whole, talk, writes, plan] = [0, 1, 2, 3, 4].map((i) => at(times, i, shot.start));
  const y = 430;
  return (
    <Stage width={width} height={height}>
      <Ring x={480} y={y} r={220} p={k(t, one, 0.7)} w={3} />
      <Dots x={480} y={y} r={220} p={k(t, whole, 1)} n={110} />
      <g opacity={k(t, talk)}>
        <Ring x={110} y={y} r={34} p={k(t, talk, 0.3)} w={3} />
        <Label x={110} y={y + 72} size={32}>you</Label>
        <Line a={[150, y]} b={[248, y]} p={k(t, talk + 0.15, 0.3)} w={3} head />
      </g>
      <Line a={[712, y]} b={[790, y]} p={k(t, writes, 0.3)} w={3} head />
      <Doc x={810} y={y - 110} w={170} h={220} p={k(t, writes + 0.15, 0.35)} lines={k(t, plan, 0.8) * 6} />
      <Label x={895} y={y + 160} size={32} opacity={k(t, plan + 0.3)}>the plan</Label>
    </Stage>
  );
};

// "That plan then gets handed to a group of subagents": the plan goes out to six empty circles.
// times: [handed, subagents]
const ring6 = (i: number, cx: number, cy: number) => {
  const a = (i * 60 * Math.PI) / 180;
  return [cx + Math.cos(a) * 330, cy + Math.sin(a) * 300] as const;
};
export const EgmHandoff: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [handed, sub] = [0, 1].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Doc x={CX - 100} y={P - 135} w={200} h={270} p={1} lines={6} />
      {Array.from({ length: 6 }, (_, i) => {
        const [fx, fy] = ring6(i, CX, P);
        return (
          <g key={i}>
            <Line a={[lerp(CX, fx, 0.42), lerp(P, fy, 0.42)]} b={[lerp(CX, fx, 0.8), lerp(P, fy, 0.8)]} p={k(t, handed + 0.3 + i * 0.05, 0.3)} w={3} head opacity={0.85} />
            <Ring x={fx} y={fy} r={44} p={k(t, sub + i * 0.07, 0.3)} w={3} />
          </g>
        );
      })}
    </Stage>
  );
};

// "They review it with fresh eyes so they catch the gaps and assumptions the first agent missed": in
// the glass, the six circles look in, and the gaps in the plan light up.
// times: [fresh eyes, the gaps, assumptions]
export const EgmGaps: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [fresh, gaps, assum] = [0, 1, 2].map((i) => at(times, i, shot.start));
  const cx = width / 2, cy = height / 2;
  return (
    <Stage width={width} height={height}>
      <Doc x={cx - 100} y={cy - 135} w={200} h={270} p={1} lines={6} marks={t < assum ? [1, 3] : [1, 3, 4]} mark={k(t, gaps, 0.25)} />
      {Array.from({ length: 6 }, (_, i) => {
        const [fx, fy] = ring6(i, cx, cy);
        return (
          <g key={i}>
            <Ring x={fx} y={fy} r={44} p={1} w={3} />
            <Line a={[lerp(fx, cx, 0.2), lerp(fy, cy, 0.2)]} b={[lerp(fx, cx, 0.52), lerp(fy, cy, 0.52)]} p={k(t, fresh + i * 0.05, 0.3)} w={3} head opacity={0.85} />
          </g>
        );
      })}
    </Stage>
  );
};

// "You describe your idea, the agent talks through the trade-offs with you and it saves what you
// agreed in a short brief" (egm-brainstorm saves concepts_brief.md). times: [idea, trade-offs, saves, brief]
export const EgmBrainstorm: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [idea, trade, saves, brief] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <circle cx={CX} cy={250} r={18 * k(t, idea, 0.2)} fill={C.white} />
      <Label x={CX + 40} y={250} size={34} anchor="start" opacity={k(t, idea + 0.1)}>your idea</Label>
      <Line a={[CX, 270]} b={[320, 450]} p={k(t, trade, 0.3)} w={3} />
      <Line a={[CX, 270]} b={[760, 450]} p={k(t, trade, 0.3)} w={3} />
      <Ring x={320} y={476} r={26} p={k(t, trade + 0.25, 0.3)} w={3} />
      <Ring x={760} y={476} r={26} p={k(t, trade + 0.25, 0.3)} w={3} />
      <Label x={CX} y={476} size={34} opacity={k(t, trade + 0.25)}>trade-offs</Label>
      <Line a={[320, 502]} b={[CX - 75, 600]} p={k(t, saves, 0.3)} w={3} />
      <Line a={[760, 502]} b={[CX + 75, 600]} p={k(t, saves, 0.3)} w={3} />
      <Doc x={CX - 75} y={600} w={150} h={190} p={k(t, saves + 0.2, 0.3)} lines={k(t, brief, 0.4) * 4} n={4} color={C.sage} />
      <text x={CX + 105} y={700} fill={C.sage} fontFamily={MONO} fontSize={28} opacity={k(t, brief, 0.2)}>concepts_brief.md</text>
    </Stage>
  );
};

// "This turns that brief into a full design doc and it stops after each section so you can give
// feedback" (egm-draft writes design_draft.md and waits for approval after each section).
// times: [turns, full design doc, stops, each section, feedback]
export const EgmDraft: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [turns, full, stops, section, feedback] = [0, 1, 2, 3, 4].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Doc x={110} y={P - 85} w={130} h={170} p={1} lines={4} n={4} color={C.sage} />
      <Line a={[260, P]} b={[370, P]} p={k(t, turns, 0.3)} w={3} head />
      <Rect x={400} y={220} w={340} h={590} p={k(t, turns + 0.2, 0.4)} sw={3} r={16} />
      <text x={570} y={264} textAnchor="middle" fill={C.white} fontFamily={MONO} fontSize={26} opacity={k(t, full, 0.2) * 0.8}>design_draft.md</text>
      {[full, stops, section, feedback].map((a, i) => {
        const y0 = 292 + i * 124;
        return (
          <g key={i}>
            {[0, 1, 2].map((j) => (
              <line key={j} x1={440} y1={y0 + 20 + j * 32} x2={440 + (j === 0 ? 150 : j === 2 ? 190 : 260) * k(t, a + j * 0.1, 0.2)} y2={y0 + 20 + j * 32} stroke={C.white} strokeWidth={j === 0 ? 11 : 8} strokeLinecap="round" opacity={k(t, a) * (j === 0 ? 1 : 0.55)} />
            ))}
            <Ring x={810} y={y0 + 52} r={26} p={k(t, a + 0.45, 0.25)} color={C.sage} w={3} />
          </g>
        );
      })}
    </Stage>
  );
};

// "This sends the design to the fresh reviewers": the doc, out to three reviewers.
// times: [sends, reviewers]
export const EgmReviewers: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [sends, reviewers] = [0, 1].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Doc x={CX - 95} y={240} w={190} h={250} p={k(t, sends, 0.3)} lines={6} />
      {[0, 1, 2].map((i) => {
        const x = 230 + i * 310;
        return (
          <g key={i}>
            <Line a={[CX, 510]} b={[x, 630]} p={k(t, reviewers + i * 0.08, 0.3)} w={3} opacity={0.6} />
            <Ring x={x} y={690} r={54} p={k(t, reviewers + 0.15 + i * 0.08, 0.3)} w={3} />
          </g>
        );
      })}
    </Stage>
  );
};

// "You pick which findings to fix and then you ask your agent to build it": three findings, the two
// you pick go sage, the other dims, then they go to the build. times: [pick, build]
export const EgmPick: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [pick, build] = [0, 1].map((i) => at(times, i, shot.start));
  const picked = [true, false, true];
  return (
    <Stage width={width} height={height}>
      {picked.map((on, i) => {
        const y = 200 + i * 130, p = k(t, pick + 0.25 + i * 0.12, 0.2);
        return (
          <g key={i} opacity={k(t, shot.start + i * 0.12) * (on ? 1 : 1 - 0.6 * p)}>
            <line x1={200} y1={y} x2={200 + (i === 1 ? 420 : 520)} y2={y} stroke={on && p > 0.5 ? C.sage : C.white} strokeWidth={12} strokeLinecap="round" />
            <Ring x={830} y={y} r={30} p={1} w={3} color={on && p > 0.5 ? C.sage : C.white} fill={on ? `rgba(183,205,191,${0.9 * p})` : "none"} />
          </g>
        );
      })}
      <Line a={[CX, 520]} b={[CX, 610]} p={k(t, build, 0.3)} w={3} head color={C.sage} />
      <Label x={CX} y={690} size={64} weight={700} color={C.sage} opacity={k(t, build + 0.25)}>{"</>"}</Label>
    </Stage>
  );
};

// "a drift report which compares your docs with your code so you can see when they've gone out of
// date": docs and code side by side, joined row by row; one join breaks. times: [docs, code, out of date]
export const EgmDrift: React.FC<CustomProps> = ({ time: t, times, width, height, shot }) => {
  const [docs, code, out] = [0, 1, 2].map((i) => at(times, i, shot.start));
  return (
    <Stage width={width} height={height}>
      <Label x={300} y={760} size={40} weight={700} opacity={k(t, docs)}>Docs</Label>
      <Label x={780} y={760} size={40} weight={700} opacity={k(t, code)}>Code</Label>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 860 + i * 110, bad = i === 3 && t > out;
        return (
          <g key={i} opacity={bad ? 1 : t > out ? 0.45 : 1}>
            <Line a={[170, y]} b={[170 + (i % 2 ? 210 : 260), y]} p={k(t, docs + i * 0.05, 0.2)} w={10} />
            <Line a={[660, y]} b={[660 + (i % 2 ? 190 : 250), y]} p={k(t, code + i * 0.05, 0.2)} w={10} />
            <Line a={[450, y]} b={[630, y]} p={k(t, code + 0.35 + i * 0.05, 0.25)} w={3} dash={bad} opacity={0.7} color={bad ? C.sage : C.white} />
          </g>
        );
      })}
    </Stage>
  );
};
