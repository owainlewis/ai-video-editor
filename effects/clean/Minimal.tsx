// Sample reel 1: minimal and faceless (2026-11-06). The voice over one diagram on black, after the
// faceless reference gufijccw0vuv (research/reels/gufijccw0vuv/NOTES.md): a bold header at the top,
// thin white line diagrams that build on their words, one Signifier word at a time as the caption,
// and a faint field of dots. Sage marks the one thing that matters in a beat.
// Script: projects/egm-clean/script.txt. Facts checked against the plugin code
// (~/.claude/plugins/cache/egm/egm/0.1.0/skills: brainstorm, draft, review, drift-report).
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { anchors, C, clean, CX, Doc, H, k, Label, lerp, Line, live, move, rand, Rect, Ring, SANS, SERIF, W, wordAt, type Word } from "./kit";

export type SampleProps = { slug: string; duration: number; words: Word[]; voice: string; music?: string; musicGain?: number };

const PHRASES = {
  google: "Google just", coding: "coding agents", claude: "Claude Code", codex: "Codex", egm: "It's called EGM", plan: "plan your work", before: "before the agent", code: "any code",
  way: "The way it", one: "one agent", whole: "whole project", talk: "You talk through", writes: "writes a detailed", detailed: "detailed plan",
  handed: "That plan then", sub: "subagents", seen: "haven't seen", fresh: "fresh eyes", gaps: "the gaps", assum: "assumptions", decide: "Then you decide",
  skills: "The plugin comes", three: "three you'll",
  one1: "One", idea: "describe your idea", trade: "trade-offs", saves: "saves what", brief: "short brief",
  two: "Two", turns: "turns that brief", full: "full design doc", stops: "stops after", section: "each section", feedback: "give feedback",
  three3: "Three", sends: "sends the design", reviewers: "fresh reviewers", clear: "it's clear", fits: "fits your code", ready: "ready to build", pick: "You pick", fix: "to fix", ask: "you ask your agent", build: "build it",
  drift: "There's also", compares: "compares your docs", docs: "docs with", codeD: "your code so", out: "out of date",
  cta: "If you want", comment: "comment EGM", link: "the link",
};

export const useSample = (words: Word[]) => useMemo(() => anchors(words, PHRASES), [words]);

const Stars: React.FC<{ t: number }> = ({ t }) => {
  const dots = useMemo(() => {
    const r = rand(7);
    return Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 2.2, a: 0.05 + r() * 0.16, v: 4 + r() * 10 }));
  }, []);
  return (
    <g>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={(d.y - t * d.v + H) % H} r={d.s} fill={C.white} opacity={d.a} />
      ))}
    </g>
  );
};

// The project inside the big circle: dots that fill in.
const Field: React.FC<{ x: number; y: number; r: number; p: number; n?: number; seed?: number }> = ({ x, y, r, p, n = 150, seed = 3 }) => {
  const pts = useMemo(() => {
    const q = rand(seed);
    return Array.from({ length: n }, () => {
      const a = q() * Math.PI * 2, d = Math.sqrt(q()) * 0.88;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, s: 0.6 + q() * 0.8, o: q() };
    });
  }, [n, seed]);
  return (
    <g>
      {pts.map((d, i) => (d.o < p ? <circle key={i} cx={x + d.dx * r} cy={y + d.dy * r} r={d.s * Math.max(2.2, r * 0.016)} fill={C.white} opacity={0.35 + d.o * 0.5} /> : null))}
    </g>
  );
};

const Tick: React.FC<{ x: number; y: number; s: number; p: number; color?: string }> = ({ x, y, s, p, color = C.white }) =>
  p <= 0 ? null : <path d={`M ${x - s * 0.5} ${y} L ${x - s * 0.12} ${y + s * 0.38} L ${x + s * 0.55} ${y - s * 0.42}`} fill="none" stroke={color} strokeWidth={s * 0.16} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${s * 2 * p} ${s * 2}`} />;

export const Minimal: React.FC<SampleProps> = ({ words, voice, music, musicGain = 0.09 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const A = useSample(words);

  // The headers, one per beat, swapped with a short crossfade.
  const heads: [number, string][] = [
    [A.google, "A new plugin from Google"], [A.egm, "EGM"], [A.way, "One agent knows it all"], [A.handed, "Fresh eyes review the plan"], [A.decide, "You decide"],
    [A.skills, "Three skills you'll use"], [A.one1, "1  Brainstorm"], [A.two, "2  Draft"], [A.three3, "3  Review"], [A.drift, "Drift report"], [A.cta, "Try it"],
  ];
  const word = wordAt(words, t);

  // Beat windows.
  const s1 = live(t, A.google, A.way), s2 = live(t, A.way, A.handed + 0.3), s3 = live(t, A.handed, A.skills), s4 = live(t, A.skills, A.one1);
  const s5 = live(t, A.one1, A.two), s6 = live(t, A.two, A.three3), s7 = live(t, A.three3, A.drift), s8 = live(t, A.drift, A.cta), s9 = live(t, A.cta);

  // Beat 2 into 3: the agent steps back and the plan moves to the middle.
  const mB = move(t, A.writes), mC = move(t, A.handed);
  const eX = lerp(lerp(CX, 330, mB), 130, mC), eY = lerp(880, 560, mC), eR = lerp(lerp(260, 190, mB), 54, mC);
  const dX = lerp(720, CX - 110, mC), dY = lerp(780, 755, mC);
  const fish = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 * Math.PI) / 180;
    return { x: CX + Math.cos(a) * 340, y: 900 + Math.sin(a) * 340 };
  });

  // Beat 4: seven skill squares; three grow into the rows.
  const grow = move(t, A.three + 0.2);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Audio src={staticFile(voice)} />
      {music && <Audio src={staticFile(music)} volume={musicGain} loop />}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <Stars t={t} />

        {/* 1. Coding agents, then plan before code. */}
        <g opacity={s1}>
          {(() => {
            const up = move(t, A.egm);
            const y = lerp(820, 600, up), sc = lerp(1, 0.8, up);
            return (
              <>
                <Rect x={CX - 380 * sc} y={y - 60 * sc} w={340 * sc} h={120 * sc} p={k(t, A.claude, 0.4)} />
                <Label x={CX - 210 * sc} y={y} size={38 * sc} opacity={k(t, A.claude + 0.1)}>Claude Code</Label>
                <Rect x={CX + 40 * sc} y={y - 60 * sc} w={340 * sc} h={120 * sc} p={k(t, A.codex, 0.4)} />
                <Label x={CX + 210 * sc} y={y} size={38 * sc} opacity={k(t, A.codex + 0.1)}>Codex</Label>
                <Label x={CX} y={y - 110 * sc} size={30} color={C.dim} opacity={k(t, A.coding, 0.3)}>Coding agents</Label>
              </>
            );
          })()}
          <Doc x={CX - 90} y={760} w={180} h={230} p={k(t, A.plan, 0.4)} lines={k(t, A.plan + 0.2, 0.8) * 6} />
          <Label x={CX + 150} y={875} size={36} opacity={k(t, A.plan + 0.2)} anchor="start">Plan</Label>
          <Line a={[CX, 1010]} b={[CX, 1150]} p={k(t, A.before, 0.5)} head />
          <Rect x={CX - 150} y={1170} w={300} h={110} p={k(t, A.code, 0.4)} opacity={0.45} />
          <Label x={CX} y={1225} size={38} opacity={k(t, A.code + 0.1) * 0.6}>Code</Label>
          <Label x={CX} y={1330} size={30} color={C.dim} opacity={k(t, A.code + 0.3)}>Only after the plan</Label>
        </g>

        {/* 2 and 3. One agent that knows the project writes the plan; fresh sub-agents review it. */}
        <g opacity={Math.max(s2, s3)}>
          <Ring x={eX} y={eY} r={eR} p={k(t, A.one, 0.6)} opacity={lerp(1, 0.4, mC)} />
          <g opacity={lerp(1, 0.4, mC)}>
            <Field x={eX} y={eY} r={eR} p={k(t, A.whole, 1.0)} />
          </g>
          <Label x={eX} y={eY - eR - 44} size={34} opacity={k(t, A.one + 0.2) * (1 - mB)}>One agent</Label>
          <Label x={eX} y={eY + eR + 44} size={34} opacity={k(t, A.whole + 0.2) * (1 - mB)}>Your whole project</Label>
          {/* You */}
          <g opacity={(1 - mC) * k(t, A.talk)}>
            <Ring x={eX} y={1300} r={34} p={k(t, A.talk, 0.4)} />
            <Label x={eX + 60} y={1300} size={34} anchor="start">You</Label>
            <Line a={[eX, 1264]} b={[eX, eY + eR + 10]} p={k(t, A.talk + 0.2, 0.4)} w={2.5} opacity={0.7} />
          </g>
          {/* The plan */}
          <Line a={[eX + eR + 14, eY]} b={[dX - 16, eY]} p={k(t, A.writes, 0.4) * (1 - mC)} head />
          <Doc x={dX} y={dY} w={220} h={290} p={k(t, A.writes + 0.2, 0.4)} lines={k(t, A.detailed, 1) * 6} marks={[1, 3, 4]} mark={k(t, A.gaps, 0.3)} />
          <Label x={dX + 110} y={dY + 340} size={34} opacity={k(t, A.detailed) * (1 - mC)}>A detailed plan</Label>
          {/* Sub-agents with no memory: empty circles. */}
          {fish.map((f, i) => {
            const on = k(t, A.sub + i * 0.08, 0.3) * live(t, A.handed, A.decide + 0.4) + (t > A.decide ? 0.3 * live(t, A.handed, A.skills) : 0);
            return (
              <g key={i} opacity={on}>
                <Ring x={f.x} y={f.y} r={46} p={k(t, A.sub + i * 0.08, 0.4)} />
                <Line a={[lerp(f.x, CX, 0.18), lerp(f.y, 900, 0.18)]} b={[lerp(f.x, CX, 0.5), lerp(f.y, 900, 0.5)]} p={k(t, A.fresh + i * 0.06, 0.4)} w={2.5} head opacity={0.8} />
              </g>
            );
          })}
          <Label x={CX} y={1330} size={32} color={C.dim} opacity={k(t, A.seen, 0.3) * live(t, A.seen, A.gaps)}>They never saw your chat</Label>
          <Label x={CX} y={1330} size={32} color={C.sage} opacity={k(t, A.gaps, 0.3) * live(t, A.gaps, A.decide)}>Gaps and assumptions</Label>
          <g opacity={k(t, A.decide + 0.1)}>
            <Ring x={CX} y={1330} r={34} p={k(t, A.decide + 0.1, 0.4)} />
            <Label x={CX + 60} y={1330} size={34} anchor="start">You</Label>
          </g>
        </g>

        {/* 4. A set of skills; three you'll use most. */}
        <g opacity={s4}>
          {Array.from({ length: 7 }, (_, i) => {
            const pick = i < 3;
            const sx = CX + (i - 3) * 122 - 40, sy = 860;
            const x = pick ? lerp(sx, CX - 260, grow) : sx, y = pick ? lerp(sy, 720 + i * 150, grow) : sy;
            const w = pick ? lerp(80, 520, grow) : 80, h = pick ? lerp(80, 110, grow) : 80;
            return <Rect key={i} x={x} y={y} w={w} h={h} p={k(t, A.skills + 0.6 + i * 0.07, 0.3)} opacity={pick ? 1 : 1 - grow} />;
          })}
          {["Brainstorm", "Draft", "Review"].map((s, i) => (
            <Label key={s} x={CX} y={775 + i * 150} size={42} weight={700} opacity={k(t, A.three + 0.6 + i * 0.12, 0.2)}>{s}</Label>
          ))}
        </g>

        {/* 5. Brainstorm: an idea, the trade-offs, a short brief. */}
        <g opacity={s5}>
          <circle cx={CX} cy={640} r={18 * k(t, A.idea, 0.3)} fill={C.white} />
          <Label x={CX + 44} y={640} size={34} anchor="start" opacity={k(t, A.idea + 0.1)}>Your idea</Label>
          <Line a={[CX, 660]} b={[330, 900]} p={k(t, A.trade, 0.4)} />
          <Line a={[CX, 660]} b={[750, 900]} p={k(t, A.trade, 0.4)} />
          <Ring x={330} y={930} r={30} p={k(t, A.trade + 0.3, 0.3)} />
          <Ring x={750} y={930} r={30} p={k(t, A.trade + 0.3, 0.3)} />
          <Label x={CX} y={930} size={34} opacity={k(t, A.trade + 0.3)}>Trade-offs</Label>
          <Line a={[330, 960]} b={[CX - 70, 1110]} p={k(t, A.saves, 0.4)} />
          <Line a={[750, 960]} b={[CX + 70, 1110]} p={k(t, A.saves, 0.4)} />
          <Doc x={CX - 75} y={1110} w={150} h={190} p={k(t, A.saves + 0.3, 0.4)} lines={k(t, A.brief, 0.5) * 4} n={4} color={C.sage} />
          <Label x={CX} y={1350} size={34} color={C.sage} opacity={k(t, A.brief)}>A short brief</Label>
        </g>

        {/* 6. Draft: the brief becomes a design doc, one section at a time, with a stop after each. */}
        <g opacity={s6}>
          <Doc x={150} y={790} w={130} h={170} p={k(t, A.two + 0.3, 0.4)} lines={4} n={4} color={C.sage} />
          <Line a={[300, 875]} b={[440, 875]} p={k(t, A.turns, 0.4)} head />
          <Rect x={470} y={600} w={330} h={560} p={k(t, A.turns + 0.3, 0.5)} sw={4} r={14} />
          {[A.full, A.stops, A.section, A.section + 0.8].map((at, i) => {
            const y0 = 640 + i * 130;
            return (
              <g key={i}>
                {[0, 1, 2].map((j) => (
                  <line key={j} x1={510} y1={y0 + 20 + j * 30} x2={510 + (j === 0 ? 150 : j === 2 ? 180 : 250) * k(t, at + j * 0.12, 0.25)} y2={y0 + 20 + j * 30} stroke={C.white} strokeWidth={j === 0 ? 10 : 7} strokeLinecap="round" opacity={k(t, at) * (j === 0 ? 1 : 0.55)} />
                ))}
                <Ring x={870} y={y0 + 50} r={26} p={k(t, at + 0.5, 0.3)} color={C.sage} />
                <Tick x={870} y={y0 + 50} s={26} p={k(t, at + 0.65, 0.2)} color={C.sage} />
              </g>
            );
          })}
          <Label x={635} y={1220} size={34} opacity={k(t, A.full, 0.3)}>Design doc</Label>
          <Label x={CX} y={1330} size={32} color={C.sage} opacity={k(t, A.feedback, 0.3)}>Your feedback after each section</Label>
        </g>

        {/* 7. Review: three fresh reviewers check it; you pick the fixes; then it's built. */}
        <g opacity={s7}>
          {(() => {
            const out = move(t, A.pick), build = move(t, A.ask);
            const checks: [number, string][] = [[A.clear, "Clear?"], [A.fits, "Fits your code?"], [A.ready, "Ready to build?"]];
            return (
              <>
                <g opacity={1 - build}>
                  <Doc x={CX - 110} y={lerp(610, 640, out)} w={220} h={290} p={k(t, A.sends, 0.4)} lines={6} marks={[2, 4]} mark={k(t, A.fix, 0.3)} />
                </g>
                <g opacity={1 - out}>
                  {checks.map(([at, s], i) => {
                    const x = 220 + i * 320, lit = k(t, at, 0.15), next = i < 2 ? k(t, checks[i + 1][0], 0.15) : 0;
                    return (
                      <g key={s}>
                        <Line a={[CX, 920]} b={[x, 1040]} p={k(t, A.reviewers + i * 0.1, 0.35)} w={2.5} opacity={0.6} />
                        <Ring x={x} y={1100} r={52} p={k(t, A.reviewers + 0.2 + i * 0.1, 0.4)} color={lit > 0 && next < 1 ? C.sage : C.white} />
                        <Label x={x} y={1200} size={32} color={next < 1 ? (lit > 0 ? C.sage : C.white) : C.white} opacity={lit * (1 - 0.5 * next)}>{s}</Label>
                      </g>
                    );
                  })}
                </g>
                <g opacity={out * (1 - build)}>
                  {[0, 1, 2, 3].map((i) => {
                    const y = 1000 + i * 80, on = i === 0 || i === 2;
                    return (
                      <g key={i} opacity={k(t, A.pick + 0.3 + i * 0.08)}>
                        <Rect x={CX - 230} y={y - 22} w={44} h={44} p={1} r={8} sw={3} color={on && t > A.fix ? C.sage : C.white} fill={on && t > A.fix ? C.sage : "none"} />
                        <line x1={CX - 160} y1={y} x2={CX + (i % 2 ? 140 : 230)} y2={y} stroke={C.white} strokeWidth={8} strokeLinecap="round" opacity={0.5} />
                      </g>
                    );
                  })}
                  <Label x={CX} y={1350} size={32} color={C.dim} opacity={k(t, A.pick + 0.3)}>You pick the fixes</Label>
                </g>
                <g opacity={build}>
                  <Doc x={CX - 90} y={600} w={180} h={230} p={1} lines={6} />
                  <Line a={[CX, 850]} b={[CX, 1000]} p={k(t, A.build - 0.2, 0.4)} head />
                  <Rect x={CX - 150} y={1020} w={300} h={110} p={k(t, A.build, 0.4)} sw={4} />
                  <Label x={CX} y={1075} size={40} weight={700} opacity={k(t, A.build + 0.1)}>Code</Label>
                </g>
              </>
            );
          })()}
        </g>

        {/* 8. Drift report: docs beside code; one row has gone out of date. */}
        <g opacity={s8}>
          <Label x={300} y={660} size={38} weight={700} opacity={k(t, A.docs)}>Docs</Label>
          <Label x={780} y={660} size={38} weight={700} opacity={k(t, A.codeD)}>Code</Label>
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 760 + i * 110, bad = i === 3, b = bad ? k(t, A.out, 0.2) : 0;
            return (
              <g key={i}>
                <line x1={180} y1={y} x2={180 + (i % 2 ? 200 : 240) * k(t, A.docs + i * 0.06, 0.25)} y2={y} stroke={bad && b ? C.sage : C.white} strokeWidth={9} strokeLinecap="round" opacity={0.8} />
                <line x1={660} y1={y} x2={660 + (i % 2 ? 180 : 240) * k(t, A.codeD + i * 0.06, 0.25)} y2={y} stroke={C.white} strokeWidth={9} strokeLinecap="round" opacity={0.8} />
                <Line a={[440, y]} b={[640, y]} p={k(t, A.codeD + 0.4 + i * 0.06, 0.3)} w={2.5} dash={bad && b > 0} color={bad && b ? C.sage : C.white} opacity={0.6} />
              </g>
            );
          })}
          <Label x={CX} y={1330} size={34} color={C.sage} opacity={k(t, A.out, 0.2)}>Out of date</Label>
        </g>

        {/* 9. The ask. */}
        <g opacity={s9}>
          <Label x={CX} y={720} size={44} opacity={k(t, A.comment, 0.2)}>Comment</Label>
          <Rect x={CX - 280} y={790} w={560} h={250} p={k(t, A.comment, 0.4)} r={28} sw={4} />
          <Label x={CX} y={918} size={170} weight={700} opacity={k(t, A.comment + 0.4, 0.15)}>EGM</Label>
          <Label x={CX} y={1120} size={40} opacity={k(t, A.link - 0.6, 0.3)}>and I'll send you the link</Label>
        </g>
      </svg>

      {heads.map(([at, text], i) => {
        const end = heads[i + 1]?.[0] ?? Infinity;
        const o = live(t, at, end, 0.2);
        return o > 0.01 ? (
          <div key={i} style={{ position: "absolute", left: 72, right: 72, top: 330, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 66, letterSpacing: -1.5, color: C.white, opacity: o, whiteSpace: "pre" }}>
            {text}
          </div>
        ) : null;
      })}

      {word && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1420, textAlign: "center", fontFamily: SERIF, fontWeight: 500, fontSize: 56, color: C.white }}>
          {clean(word.text)}
        </div>
      )}
    </AbsoluteFill>
  );
};
