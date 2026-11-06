// Sample reel 2: split screen, text cards and cinematic shots (2026-11-06), the system proposed in
// research/reels/STUDY.md, faceless: b-roll stands in for Owain in the bottom panel.
//   Card: flat paper or ink, the spoken word flicked at the centre. The colour flips on a turn.
//   Split: a diagram on ink above the seam (y 966), b-roll below, the word sitting on the seam.
//   Cinematic: b-roll edge to edge, the big word at the centre.
// Hard cuts on sentence starts. One eased move per reel: the opening push.
import React from "react";
import { AbsoluteFill, Audio, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clean, CX, Doc, k, Label, lerp, Line, move, Rect, Ring, SANS, SERIF, W, wordAt } from "./kit";
import { type SampleProps, useSample } from "./Minimal";

const SEAM = 966;
const ACCENT = new Set(["egm", "plan", "fresh", "brainstorm", "draft", "review", "drift"]);

type Layout = "card" | "split" | "cine" | "over";
// The overlay (Owain, 2026-11-06): b-roll edge to edge with the diagram over it, as he puts a
// terminal window over b-roll in his YouTube videos. "lines": the diagram drawn straight on the
// dimmed footage. "glass": the diagram in a dark translucent panel that blurs the footage behind it.
export type Overlay = "lines" | "glass";
// The panel fits the diagram's own extent (`box`, top and bottom in panel coordinates) with a
// margin, centred at y 860. The word sits in a fixed lane below it.
const glass = (box: [number, number] = [100, 860]) => {
  const pad = 90, height = box[1] - box[0] + pad * 2, top = 860 - height / 2;
  return { left: 60, top, width: W - 120, height, radius: 32, svg: top + pad - box[0] };
};
const OVER_WORD = 1500;

type Shot = { at: number; layout: Layout; bg?: "ink" | "paper"; clip?: string; box?: [number, number]; panel?: (t: number) => React.ReactNode };

const CLIPS: Record<string, number> = { "1-1": 1.715, "1-2": 1.178, "1-3": 1.512, "1-4": 1.679, "1-5": 2.012, "1-6": 1.637 };
const RATE = 0.5;

const Broll: React.FC<{ slug: string; id: string; top: number; height: number; filter?: string }> = ({ slug, id, top, height, filter }) => {
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 0, top, width: W, height, overflow: "hidden" }}>
      <Loop durationInFrames={Math.floor((CLIPS[id] / RATE) * fps) - 1}>
        <OffthreadVideo src={staticFile(`${slug}/assets/broll/${id}.mp4`)} muted playbackRate={RATE} style={{ width: "100%", height: "100%", objectFit: "cover", filter }} />
      </Loop>
    </div>
  );
};

// The word, set on a baseline. Accent words in Signifier italic.
const Word: React.FC<{ text: string; y: number; size: number; color: string; accent: string }> = ({ text, y, size, color, accent }) => {
  const a = ACCENT.has(text.toLowerCase());
  const s = a ? text.toLowerCase() : text.toLowerCase();
  return (
    <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
      <text x={CX} y={y} textAnchor="middle" fontFamily={a ? SERIF : SANS} fontStyle={a ? "italic" : "normal"} fontWeight={a ? 500 : 700} fontSize={a ? size * 1.12 : size} letterSpacing={a ? -1 : -size * 0.045} fill={a ? accent : color}>
        {s === "egm" ? "EGM" : s}
      </text>
    </svg>
  );
};

export const House: React.FC<SampleProps & { overlay?: Overlay }> = ({ slug, words, voice, music, musicGain = 0.09, overlay = "glass" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const A = useSample(words);
  const P = 470; // the panel's centre line

  const shots: Shot[] = [
    { at: 0, layout: "card", bg: "ink" },
    {
      at: A.coding - 0.25, layout: "split", clip: "1-4",
      panel: (t) => (
        <>
          <Label x={CX} y={300} size={34} color={C.dim} opacity={k(t, A.coding)}>Coding agents</Label>
          <Rect x={CX - 400} y={P - 80} w={370} h={160} p={k(t, A.claude, 0.3)} sw={4} r={18} />
          <Label x={CX - 215} y={P} size={46} weight={700} opacity={k(t, A.claude + 0.1)}>Claude Code</Label>
          <Rect x={CX + 30} y={P - 80} w={370} h={160} p={k(t, A.codex, 0.3)} sw={4} r={18} />
          <Label x={CX + 215} y={P} size={46} weight={700} opacity={k(t, A.codex + 0.1)}>Codex</Label>
        </>
      ),
    },
    { at: A.egm - 0.2, layout: "card", bg: "paper" },
    {
      at: A.way - 0.2, layout: "split", clip: "1-6",
      panel: (t) => {
        const m = move(t, A.writes);
        const x = lerp(CX, 360, m), r = lerp(250, 210, m);
        return (
          <>
            <Ring x={x} y={P} r={r} p={k(t, A.one, 0.5)} w={4} />
            <Dots x={x} y={P} r={r} p={k(t, A.whole, 0.9)} />
            <Label x={x} y={P - r - 50} size={36} opacity={k(t, A.one + 0.2) * (1 - m)}>One agent</Label>
            <Label x={x} y={P + r + 50} size={36} opacity={k(t, A.whole + 0.2) * (1 - m)}>Your whole project</Label>
            <Line a={[x + r + 16, P]} b={[680, P]} p={k(t, A.writes, 0.3)} w={4} head />
            <Doc x={700} y={P - 150} w={230} h={300} p={k(t, A.writes + 0.15, 0.3)} lines={k(t, A.detailed, 0.8) * 6} />
            <Label x={815} y={P + 200} size={36} opacity={k(t, A.detailed)}>A detailed plan</Label>
          </>
        );
      },
    },
    {
      at: A.handed - 0.2, layout: "split", clip: "1-5",
      panel: (t) => (
        <>
          <Doc x={CX - 100} y={P - 135} w={200} h={270} p={1} lines={6} marks={[1, 3, 4]} mark={k(t, A.gaps, 0.25)} />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i * 60 * Math.PI) / 180, fx = CX + Math.cos(a) * 330, fy = P + Math.sin(a) * 300;
            return (
              <g key={i}>
                <Ring x={fx} y={fy} r={44} p={k(t, A.sub + i * 0.07, 0.3)} w={4} />
                <Line a={[lerp(fx, CX, 0.2), lerp(fy, P, 0.2)]} b={[lerp(fx, CX, 0.52), lerp(fy, P, 0.52)]} p={k(t, A.fresh + i * 0.05, 0.3)} w={3} head opacity={0.85} />
              </g>
            );
          })}
        </>
      ),
    },
    { at: A.decide - 0.2, layout: "cine", clip: "1-1" },
    { at: A.skills - 0.2, layout: "card", bg: "ink" },
    { at: A.one1 - 0.2, layout: "card", bg: "paper" },
    {
      at: A.idea - 0.5, layout: "split", clip: "1-3",
      panel: (t) => (
        <>
          <circle cx={CX} cy={190} r={20 * k(t, A.idea, 0.2)} fill={C.white} />
          <Label x={CX + 44} y={190} size={36} anchor="start" opacity={k(t, A.idea + 0.1)}>Your idea</Label>
          <Line a={[CX, 210]} b={[300, 430]} p={k(t, A.trade, 0.3)} w={4} />
          <Line a={[CX, 210]} b={[780, 430]} p={k(t, A.trade, 0.3)} w={4} />
          <Ring x={300} y={460} r={30} p={k(t, A.trade + 0.25, 0.3)} w={4} />
          <Ring x={780} y={460} r={30} p={k(t, A.trade + 0.25, 0.3)} w={4} />
          <Label x={CX} y={460} size={36} opacity={k(t, A.trade + 0.25)}>Trade-offs</Label>
          <Line a={[300, 490]} b={[CX - 80, 620]} p={k(t, A.saves, 0.3)} w={4} />
          <Line a={[780, 490]} b={[CX + 80, 620]} p={k(t, A.saves, 0.3)} w={4} />
          <Doc x={CX - 80} y={620} w={160} h={200} p={k(t, A.saves + 0.25, 0.3)} lines={k(t, A.brief, 0.4) * 4} n={4} color={C.sage} />
        </>
      ),
    },
    { at: A.two - 0.2, layout: "card", bg: "ink" },
    {
      at: A.turns - 0.4, layout: "over", clip: "1-3", box: [150, 790],
      panel: (t) => (
        <>
          <Doc x={130} y={P - 95} w={140} h={190} p={1} lines={4} n={4} color={C.sage} />
          <Line a={[290, P]} b={[400, P]} p={k(t, A.turns, 0.3)} w={4} head />
          <Rect x={430} y={150} w={340} h={640} p={k(t, A.turns + 0.2, 0.4)} sw={4} r={16} />
          {[A.full, A.stops, A.section, A.section + 0.8].map((at, i) => {
            const y0 = 190 + i * 150;
            return (
              <g key={i}>
                {[0, 1, 2].map((j) => (
                  <line key={j} x1={470} y1={y0 + 24 + j * 34} x2={470 + (j === 0 ? 150 : j === 2 ? 190 : 260) * k(t, at + j * 0.1, 0.2)} y2={y0 + 24 + j * 34} stroke={C.white} strokeWidth={j === 0 ? 11 : 8} strokeLinecap="round" opacity={k(t, at) * (j === 0 ? 1 : 0.55)} />
                ))}
                <Ring x={850} y={y0 + 58} r={28} p={k(t, at + 0.45, 0.25)} color={C.sage} w={4} />
              </g>
            );
          })}
        </>
      ),
    },
    { at: A.three3 - 0.2, layout: "card", bg: "paper" },
    {
      at: A.sends - 0.6, layout: "over", clip: "1-5", box: [120, 700],
      panel: (t) => {
        const checks: [number, string][] = [[A.clear, "Clear?"], [A.fits, "Fits your code?"], [A.ready, "Ready to build?"]];
        return (
          <>
            <Doc x={CX - 95} y={120} w={190} h={250} p={k(t, A.sends, 0.3)} lines={6} />
            {checks.map(([at, s], i) => {
              const x = 210 + i * 330, lit = k(t, at, 0.12);
              return (
                <g key={s}>
                  <Line a={[CX, 390]} b={[x, 500]} p={k(t, A.reviewers + i * 0.08, 0.3)} w={3} opacity={0.6} />
                  <Ring x={x} y={560} r={54} p={k(t, A.reviewers + 0.15 + i * 0.08, 0.3)} w={4} color={lit ? C.sage : C.white} />
                  <Label x={x} y={680} size={36} color={C.sage} opacity={lit}>{s}</Label>
                </g>
              );
            })}
          </>
        );
      },
    },
    { at: A.pick - 0.2, layout: "cine", clip: "1-4" },
    { at: A.drift - 0.2, layout: "card", bg: "ink" },
    {
      at: A.compares - 0.6, layout: "split", clip: "1-1",
      panel: (t) => (
        <>
          <Label x={290} y={170} size={44} weight={700} opacity={k(t, A.docs)}>Docs</Label>
          <Label x={790} y={170} size={44} weight={700} opacity={k(t, A.codeD)}>Code</Label>
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 270 + i * 110, bad = i === 3 && t > A.out;
            return (
              <g key={i}>
                <line x1={160} y1={y} x2={160 + (i % 2 ? 210 : 260) * k(t, A.docs + i * 0.05, 0.2)} y2={y} stroke={bad ? C.sage : C.white} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
                <line x1={660} y1={y} x2={660 + (i % 2 ? 190 : 260) * k(t, A.codeD + i * 0.05, 0.2)} y2={y} stroke={C.white} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
                <Line a={[450, y]} b={[630, y]} p={k(t, A.codeD + 0.35 + i * 0.05, 0.25)} w={3} dash={bad} color={bad ? C.sage : C.white} opacity={0.6} />
              </g>
            );
          })}
        </>
      ),
    },
    { at: A.cta - 0.2, layout: "card", bg: "paper" },
  ];

  let si = 0;
  for (let i = 0; i < shots.length; i++) if (t >= shots[i].at) si = i;
  const shot = shots[si];
  const start = Math.round(shot.at * fps);
  const w = wordAt(words, t);
  // The ask holds its last word.
  const text = t > A.comment + 0.3 ? "EGM" : w ? clean(w.text) : "";
  const push = si === 0 ? lerp(1.44, 1, move(t, 0, 0.67)) : 1;

  const paper = shot.layout === "card" && shot.bg === "paper";
  const g = glass(shot.box);
  const bg = shot.layout === "card" ? (paper ? C.paper : C.ink) : C.ink;

  return (
    <AbsoluteFill style={{ background: bg }}>
      <Audio src={staticFile(voice)} />
      {music && <Audio src={staticFile(music)} volume={musicGain} loop />}
      <Sequence key={si} from={start} layout="none">
        {shot.layout === "cine" && shot.clip && <Broll slug={slug} id={shot.clip} top={0} height={1920} />}
        {shot.layout === "split" && shot.clip && <Broll slug={slug} id={shot.clip} top={SEAM} height={1920 - SEAM} />}
        {shot.layout === "over" && shot.clip && <Broll slug={slug} id={shot.clip} top={0} height={1920} filter={overlay === "lines" ? "brightness(0.5) blur(3px)" : "brightness(0.85)"} />}
      </Sequence>
      {shot.layout === "over" && overlay === "glass" && (
        <div style={{ position: "absolute", left: g.left, top: g.top, width: g.width, height: g.height, borderRadius: g.radius, background: "rgba(12,18,15,0.66)", backdropFilter: "blur(28px) saturate(1.1)", border: "1.5px solid rgba(245,245,242,0.14)" }} />
      )}
      {shot.layout === "over" && shot.panel && (
        <svg width={W} height={SEAM} style={{ position: "absolute", left: 0, top: g.svg, overflow: "visible" }}>
          {shot.panel(t)}
        </svg>
      )}
      {shot.layout === "cine" && <AbsoluteFill style={{ background: "rgba(0,0,0,0.28)" }} />}
      {shot.layout === "split" && shot.panel && (
        <svg width={W} height={SEAM} style={{ position: "absolute", left: 0, top: 0 }}>
          {shot.panel(t)}
        </svg>
      )}
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {text &&
          (shot.layout === "split" ? (
            <Word text={text} y={SEAM + 16} size={128} color={C.white} accent={C.sage} />
          ) : shot.layout === "over" ? (
            <Word text={text} y={OVER_WORD} size={128} color={C.white} accent={C.sage} />
          ) : (
            <Word text={text} y={1014} size={150} color={paper ? C.inkText : C.white} accent={paper ? C.inkText : C.sage} />
          ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Dots: React.FC<{ x: number; y: number; r: number; p: number }> = ({ x, y, r, p }) => {
  const pts = React.useMemo(() => {
    let s = 11;
    const q = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: 130 }, () => {
      const a = q() * Math.PI * 2, d = Math.sqrt(q()) * 0.88;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, o: q() };
    });
  }, []);
  return <g>{pts.map((d, i) => (d.o < p ? <circle key={i} cx={x + d.dx * r} cy={y + d.dy * r} r={4} fill={C.white} opacity={0.35 + d.o * 0.5} /> : null))}</g>;
};
