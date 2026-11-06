// Test reel 3 (2026-11-06): the locked style with the text kit. The base is House (split, cards,
// cinematic), plus a full-screen diagram now and then, the glass overlay, command chips naming the
// real skills, and the six text treatments from research/reels/STUDY.md ("The text kit", after Tom
// Noske): caption sized by weight, typed hit with a Signifier tag, Signifier title over a drawn
// diagram, caption inside the diagram, bracketed list, card beats with size contrast.
// Skill and file names are the plugin's own (~/.claude/plugins/cache/egm/egm/0.1.0/skills).
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, CX, Doc, k, Label, lerp, Line, move, Rect, Ring, SANS, SERIF, W, type Word } from "./kit";
import { type SampleProps, useSample } from "./Minimal";
import { blurIn, Center, Chip, chunkClean as chunk, CREAM, GREEN, MONO, Typed } from "./text";

const SEAM = 966;

// ---------- words ----------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
const wordTime = (words: Word[], w: string, after: number) => words.find((x) => x.start >= after - 0.01 && norm(x.text) === norm(w))?.start ?? after;

// ---------- parts ----------

const CLIPS: Record<string, number> = { "1-1": 1.715, "1-2": 1.178, "1-3": 1.512, "1-4": 1.679, "1-5": 2.012, "1-6": 1.637 };
const Broll: React.FC<{ slug: string; id: string; top: number; height: number; filter?: string }> = ({ slug, id, top, height, filter }) => {
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 0, top, width: W, height, overflow: "hidden" }}>
      <Loop durationInFrames={Math.floor((CLIPS[id] / 0.5) * fps) - 1}>
        <OffthreadVideo src={staticFile(`${slug}/assets/broll/${id}.mp4`)} muted playbackRate={0.5} style={{ width: "100%", height: "100%", objectFit: "cover", filter }} />
      </Loop>
    </div>
  );
};

const Dots: React.FC<{ x: number; y: number; r: number; p: number; inner?: number }> = ({ x, y, r, p, inner = 0 }) => {
  const pts = useMemo(() => {
    let s = 11;
    const q = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: 140 }, () => {
      const a = q() * Math.PI * 2, d = inner + Math.sqrt(q()) * (0.9 - inner);
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, o: q() };
    });
  }, [inner]);
  return <g>{pts.map((d, i) => (d.o < p ? <circle key={i} cx={x + d.dx * r} cy={y + d.dy * r} r={4} fill={C.white} opacity={0.3 + d.o * 0.5} /> : null))}</g>;
};

// ---------- the reel ----------

type Bg = "ink" | "paper" | "green";
type Layout = "card" | "split" | "cine" | "over" | "diagram";
type Shot = { at: number; layout: Layout; bg?: Bg; clip?: string; box?: [number, number]; panel?: (t: number) => React.ReactNode; inside?: number };
type Hit = { at: number; until: number; text: string; tag?: string };
type Beat = { at: number; until: number; text: string; size: "huge" | "mid" | "small"; typed?: boolean };

export const Hybrid: React.FC<SampleProps> = ({ slug, words, voice, music, musicGain = 0.09 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const A = useSample(words);
  const W_ = (w: string, after: number) => wordTime(words, w, after);
  const chunks = useMemo(() => chunk(words), [words]);
  const P = 470;

  const glass = (box: [number, number]) => {
    const pad = 80, height = box[1] - box[0] + pad * 2, top = 820 - height / 2;
    return { left: 60, top, width: W - 120, height, svg: top + pad - box[0] };
  };

  const shots: Shot[] = [
    { at: 0, layout: "cine", clip: "1-5" },
    {
      at: A.coding - 0.25, layout: "split", clip: "1-4",
      panel: (t) => (
        <>
          {[["Claude Code", A.claude, CX - 225], ["Codex", A.codex, CX + 225]].map(([name, at, x]) => (
            <g key={name as string} opacity={k(t, at as number, 0.2)}>
              <Rect x={(x as number) - 190} y={P - 130} w={380} h={260} p={k(t, at as number, 0.35)} sw={3} r={22} />
              {[0, 1, 2].map((i) => <circle key={i} cx={(x as number) - 160 + i * 26} cy={P - 100} r={7} fill={C.white} opacity={0.5} />)}
              <line x1={(x as number) - 190} y1={P - 72} x2={(x as number) + 190} y2={P - 72} stroke={C.white} strokeWidth={2} opacity={0.3} />
              <Label x={x as number} y={P + 10} size={44} weight={700}>{name as string}</Label>
              <Label x={(x as number) - 150} y={P + 80} size={30} anchor="start" opacity={0.6}>{"> _"}</Label>
            </g>
          ))}
        </>
      ),
    },
    { at: A.egm - 0.2, layout: "card", bg: "ink" },
    { at: A.plan - 0.15, layout: "card", bg: "paper" },
    {
      at: A.way - 0.2, layout: "diagram", inside: 960,
      panel: (t) => (
        <>
          <Ring x={CX} y={960} r={300} p={k(t, A.one, 0.7)} w={3} />
          <Dots x={CX} y={960} r={300} p={k(t, A.whole, 1)} inner={0.55} />
          <g opacity={k(t, A.talk)}>
            <Ring x={130} y={960} r={34} p={k(t, A.talk, 0.3)} w={3} />
            <Label x={130} y={1030} size={32} serif weight={400}>you</Label>
            <Line a={[168, 960]} b={[232, 960]} p={k(t, A.talk + 0.15, 0.3)} w={3} />
          </g>
          <Line a={[CX, 1268]} b={[CX, 1350]} p={k(t, A.writes, 0.3)} w={3} head />
          <Doc x={CX - 80} y={1370} w={160} h={210} p={k(t, A.writes + 0.15, 0.35)} lines={k(t, A.detailed, 0.8) * 6} />
        </>
      ),
    },
    {
      at: A.handed - 0.2, layout: "over", clip: "1-5", box: [120, 820],
      panel: (t) => (
        <>
          <Doc x={CX - 100} y={P - 135} w={200} h={270} p={1} lines={6} marks={[1, 3, 4]} mark={k(t, A.gaps, 0.25)} />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i * 60 * Math.PI) / 180, fx = CX + Math.cos(a) * 330, fy = P + Math.sin(a) * 300;
            return (
              <g key={i}>
                <Ring x={fx} y={fy} r={44} p={k(t, A.sub + i * 0.07, 0.3)} w={3} />
                <Line a={[lerp(fx, CX, 0.2), lerp(fy, P, 0.2)]} b={[lerp(fx, CX, 0.52), lerp(fy, P, 0.52)]} p={k(t, A.fresh + i * 0.05, 0.3)} w={3} head opacity={0.85} />
              </g>
            );
          })}
        </>
      ),
    },
    { at: A.decide - 0.2, layout: "cine", clip: "1-1" },
    { at: A.skills - 0.2, layout: "card", bg: "ink" },
    {
      at: A.one1 - 0.2, layout: "split", clip: "1-3",
      panel: (t) => (
        <>
          <circle cx={CX} cy={250} r={18 * k(t, A.idea, 0.2)} fill={C.white} />
          <Label x={CX + 40} y={250} size={34} serif weight={400} anchor="start" opacity={k(t, A.idea + 0.1)}>your idea</Label>
          <Line a={[CX, 270]} b={[320, 450]} p={k(t, A.trade, 0.3)} w={3} />
          <Line a={[CX, 270]} b={[760, 450]} p={k(t, A.trade, 0.3)} w={3} />
          <Ring x={320} y={476} r={26} p={k(t, A.trade + 0.25, 0.3)} w={3} />
          <Ring x={760} y={476} r={26} p={k(t, A.trade + 0.25, 0.3)} w={3} />
          <Label x={CX} y={476} size={34} serif weight={400} opacity={k(t, A.trade + 0.25)}>trade-offs</Label>
          <Line a={[320, 502]} b={[CX - 75, 610]} p={k(t, A.saves, 0.3)} w={3} />
          <Line a={[760, 502]} b={[CX + 75, 610]} p={k(t, A.saves, 0.3)} w={3} />
          <Doc x={CX - 75} y={610} w={150} h={190} p={k(t, A.saves + 0.2, 0.3)} lines={k(t, A.brief, 0.4) * 4} n={4} color={C.sage} />
          <text x={CX + 105} y={710} fill={C.sage} fontFamily={MONO} fontSize={28} opacity={k(t, A.brief, 0.2)}>concepts_brief.md</text>
        </>
      ),
    },
    {
      at: A.two - 0.2, layout: "over", clip: "1-3", box: [30, 850],
      panel: (t) => (
        <>
          <Doc x={110} y={P - 85} w={130} h={170} p={1} lines={4} n={4} color={C.sage} />
          <Line a={[260, P]} b={[370, P]} p={k(t, A.turns, 0.3)} w={3} head />
          <Rect x={400} y={140} w={340} h={640} p={k(t, A.turns + 0.2, 0.4)} sw={3} r={16} />
          {[A.full, A.stops, A.section, A.section + 0.8].map((at, i) => {
            const y0 = 180 + i * 150;
            return (
              <g key={i}>
                {[0, 1, 2].map((j) => (
                  <line key={j} x1={440} y1={y0 + 24 + j * 34} x2={440 + (j === 0 ? 150 : j === 2 ? 190 : 260) * k(t, at + j * 0.1, 0.2)} y2={y0 + 24 + j * 34} stroke={C.white} strokeWidth={j === 0 ? 11 : 8} strokeLinecap="round" opacity={k(t, at) * (j === 0 ? 1 : 0.55)} />
                ))}
                <Ring x={820} y={y0 + 58} r={26} p={k(t, at + 0.45, 0.25)} color={C.sage} w={3} />
              </g>
            );
          })}
          <text x={570} y={830} textAnchor="middle" fill={C.white} fontFamily={MONO} fontSize={28} opacity={k(t, A.full, 0.2) * 0.8}>design_draft.md</text>
        </>
      ),
    },
    {
      at: A.three3 - 0.2, layout: "split", clip: "1-6",
      panel: (t) => (
        <>
          <Doc x={CX - 95} y={200} w={190} h={250} p={k(t, A.sends, 0.3)} lines={6} />
          {[0, 1, 2].map((i) => {
            const x = 230 + i * 310;
            return (
              <g key={i}>
                <Line a={[CX, 470]} b={[x, 600]} p={k(t, A.reviewers + i * 0.08, 0.3)} w={3} opacity={0.6} />
                <Ring x={x} y={660} r={54} p={k(t, A.reviewers + 0.15 + i * 0.08, 0.3)} w={3} />
              </g>
            );
          })}
        </>
      ),
    },
    { at: W_("They", A.reviewers) - 0.2, layout: "card", bg: "ink" },
    { at: A.pick - 0.2, layout: "cine", clip: "1-2" },
    {
      at: A.drift - 0.2, layout: "diagram",
      panel: (t) => (
        <>
          <Label x={300} y={760} size={40} weight={700} opacity={k(t, A.docs)}>Docs</Label>
          <Label x={780} y={760} size={40} weight={700} opacity={k(t, A.codeD)}>Code</Label>
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 860 + i * 110, bad = i === 3 && t > A.out;
            return (
              <g key={i} opacity={bad ? 1 : t > A.out ? 0.45 : 1}>
                <line x1={170} y1={y} x2={170 + (i % 2 ? 210 : 260) * k(t, A.docs + i * 0.05, 0.2)} y2={y} stroke={C.white} strokeWidth={10} strokeLinecap="round" />
                <line x1={660} y1={y} x2={660 + (i % 2 ? 190 : 250) * k(t, A.codeD + i * 0.05, 0.2)} y2={y} stroke={C.white} strokeWidth={10} strokeLinecap="round" />
                <Line a={[450, y]} b={[630, y]} p={k(t, A.codeD + 0.35 + i * 0.05, 0.25)} w={3} dash={bad} opacity={0.7} />
              </g>
            );
          })}
        </>
      ),
    },
    { at: A.cta - 0.2, layout: "card", bg: "paper" },
  ];

  const egm = W_("EGM", A.egm), plan = W_("plan", A.plan), code = W_("code", A.code), skills = W_("skills", A.skills), three = W_("three", A.three);
  const cta = W_("EGM", A.comment);
  const hits: Hit[] = [
    { at: 0, until: W_("a", 0.5), text: "GOOGLE", tag: "just released" },
    { at: A.fresh, until: A.gaps, text: "FRESH EYES" },
    { at: A.decide + 0.3, until: A.skills - 0.2, text: "YOU DECIDE" },
    { at: A.pick + 0.3, until: A.ask, text: "YOU PICK", tag: "which findings to fix" },
    { at: A.out, until: A.cta - 0.2, text: "OUT OF DATE" },
  ];
  const beats: Beat[] = [
    { at: egm, until: W_("and", egm), text: "EGM", size: "huge", typed: true },
    { at: plan, until: W_("before", plan) - 0.05, text: "PLAN", size: "huge", typed: true },
    { at: W_("before", plan), until: code, text: "before", size: "small" },
    { at: code, until: A.way - 0.2, text: "CODE", size: "huge", typed: true },
    { at: skills, until: three - 0.1, text: "SKILLS", size: "huge" },
    { at: three, until: A.one1 - 0.2, text: "THREE", size: "huge" },
    { at: W_("comment", A.cta), until: cta, text: "comment", size: "small" },
    { at: cta, until: 999, text: "EGM", size: "huge", typed: true },
  ];
  const titles: { at: number; until: number; lines: [string, string] }[] = [
    { at: A.one, until: A.handed, lines: ["one agent,", "your whole project"] },
    { at: W_("drift", A.drift), until: A.cta, lines: ["drift", "report"] },
  ];
  const list = { at: W_("They", A.reviewers), until: A.pick - 0.2, header: "[REVIEW]", items: [[A.clear, "clear?"], [A.fits, "fits your code?"], [A.ready, "ready to build?"]] as [number, string][] };
  const chips: [number, string, number][] = [
    [A.one1 + 0.5, "egm-brainstorm", 70],
    [A.two + 0.5, "egm-draft", 0],
    [A.three3 + 0.4, "egm-review", 70],
  ];
  const sfx: [number, string, number][] = [
    ...chips.map(([at]) => [at + 0.25, "typing", 0.32] as [number, string, number]),
    [A.way - 1.2, "riser-tail", 0.3],
    [A.drift - 1.2, "riser-tail", 0.3],
    [A.gaps, "blip", 0.4],
    ...list.items.map(([at]) => [at, "pop", 0.35] as [number, string, number]),
    [W_("They", A.reviewers), "pop", 0.3],
  ];

  let si = 0;
  for (let i = 0; i < shots.length; i++) if (t >= shots[i].at) si = i;
  const shot = shots[si];
  const start = Math.round(shot.at * fps);
  const bgOf = (s: Shot) => (s.layout === "diagram" ? GREEN : s.layout === "card" ? (s.bg === "paper" ? C.paper : s.bg === "green" ? GREEN : C.ink) : C.ink);
  const paper = shot.layout === "card" && shot.bg === "paper";
  const ink = paper ? GREEN : CREAM;
  const push = si === 0 ? lerp(1.3, 1, move(t, 0, 0.7)) : 1;

  const hit = hits.find((h) => t >= h.at && t < h.until);
  const beat = beats.find((b) => t >= b.at && t < b.until);
  const title = titles.find((x) => t >= x.at && t < x.until);
  const listOn = t >= list.at && t < list.until;
  const g = shot.box ? glass(shot.box) : null;

  // The caption: one chunk, sized by weight, placed by the layout.
  const ch = [...chunks].reverse().find((c) => c.start <= t + 0.02);
  const next = ch ? chunks[chunks.indexOf(ch) + 1] : undefined;
  const capOn = ch && t < Math.min(next?.start ?? Infinity, ch.end + 0.5) && !hit && !beat && !listOn;
  const capPlace = (): { y: number; size: number } => {
    switch (shot.layout) {
      case "split": return { y: SEAM - 104, size: 110 };
      case "over": return { y: (g ? g.top + g.height : 1300) + 120, size: 92 };
      case "diagram": return shot.inside ? { y: shot.inside - 52, size: 76 } : { y: 1520, size: 84 };
      case "card": return { y: 900, size: 120 };
      default: return { y: 1150, size: 92 };
    }
  };
  const cp = capPlace();

  return (
    <AbsoluteFill style={{ background: bgOf(shot) }}>
      <Audio src={staticFile(voice)} />
      {music && <Audio src={staticFile(music)} volume={musicGain} loop />}
      {sfx.map(([at, name, vol], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} layout="none">
          <Audio src={staticFile(`${slug}/assets/sfx/${name}.${name === "typing" ? "mp3" : "wav"}`)} volume={vol} />
        </Sequence>
      ))}

      <Sequence key={si} from={start} layout="none">
        <AbsoluteFill style={{ transform: `scale(${push})` }}>
          {shot.layout === "cine" && shot.clip && <Broll slug={slug} id={shot.clip} top={0} height={1920} filter="brightness(0.62)" />}
          {shot.layout === "over" && shot.clip && <Broll slug={slug} id={shot.clip} top={0} height={1920} filter="brightness(0.85)" />}
        </AbsoluteFill>
        {shot.layout === "split" && shot.clip && <Broll slug={slug} id={shot.clip} top={SEAM} height={1920 - SEAM} />}
      </Sequence>

      {g && <div style={{ position: "absolute", left: g.left, top: g.top, width: g.width, height: g.height, borderRadius: 32, background: "rgba(12,18,15,0.66)", backdropFilter: "blur(28px) saturate(1.1)", border: "1.5px solid rgba(245,245,242,0.14)" }} />}
      {shot.panel && (
        <svg width={W} height={1920} style={{ position: "absolute", left: 0, top: shot.layout === "over" && g ? g.svg : 0, overflow: "visible" }}>
          {shot.panel(t)}
        </svg>
      )}

      {/* Chips: the real skill each step runs. */}
      {chips.map(([at, name, y], i) => {
        const end = chips[i + 1]?.[0] ?? A.drift;
        const inShot = t >= at && t < Math.min(end, shots.find((s) => s.at > at)?.at ?? Infinity);
        if (!inShot) return null;
        const top = shot.layout === "over" && g ? g.top + 36 : y;
        return <Chip key={name} t={t} at={at} name={name} y={top} />;
      })}

      {/* Title: Signifier italic, two lines, the second tucked in to the right. */}
      {title && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 104, lineHeight: 0.86, color: CREAM, letterSpacing: -1 }}>
          <div style={{ textAlign: "center", transform: "translateX(-70px)" }}><Typed s={title.lines[0]} t={t} at={title.at} per={0.05} /></div>
          <div style={{ textAlign: "center", transform: "translateX(70px)" }}><Typed s={title.lines[1]} t={t} at={title.at + title.lines[0].length * 0.05 + 0.1} per={0.045} /></div>
        </div>
      )}

      {/* List: a bracketed header, items stacking on their words. */}
      {listOn && (
        <>
          <Center y={640} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 96, letterSpacing: -3, color: CREAM, ...blurIn(t, list.at) }}>{list.header}</Center>
          {list.items.map(([at, s], i) => (
            <Center key={s} y={800 + i * 150} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 110, letterSpacing: -4, color: CREAM, ...blurIn(t, at) }}>{s}</Center>
          ))}
        </>
      )}

      {/* Card beat: one word on a flat card, with size contrast. */}
      {beat && (() => {
        const size = beat.size === "huge" ? 250 : beat.size === "mid" ? 150 : 76;
        return (
          <Center y={960 - size * 0.62} style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.045, color: ink }}>
            {beat.typed ? <Typed s={beat.text} t={t} at={beat.at} per={0.05} /> : beat.text}
          </Center>
        );
      })()}
      {beat && beat.at === cta && (
        <Center y={1150} style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 64, color: GREEN, ...blurIn(t, A.link - 0.8) }}>and I'll send you the link</Center>
      )}

      {/* Hit: bold caps typed on, with a Signifier tag typed in under it, offset right. */}
      {hit && (() => {
        const y = shot.layout === "over" && g ? g.top + g.height + 90 : shot.layout === "diagram" ? 1560 : 1080;
        const done = hit.at + hit.text.length * 0.045 + 0.05;
        return (
          <>
            <Center y={y} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 150, lineHeight: 1, letterSpacing: -6, color: CREAM }}>
              <Typed s={hit.text} t={t} at={hit.at} per={0.045} />
            </Center>
            {hit.tag && (
              <Center y={y + 150} style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 84, lineHeight: 1, color: CREAM, paddingLeft: 260 }}>
                <Typed s={hit.tag} t={t} at={done} per={0.04} />
              </Center>
            )}
          </>
        );
      })()}

      {/* Caption. */}
      {capOn && ch && (
        <Center y={cp.y} style={{ fontFamily: SANS, fontWeight: 700, fontSize: ch.small ? cp.size * 0.6 : cp.size, lineHeight: 1.1, letterSpacing: -(ch.small ? cp.size * 0.6 : cp.size) * 0.035, color: ink, marginTop: ch.small ? cp.size * 0.25 : 0 }}>
          {ch.text.toLowerCase()}
        </Center>
      )}
    </AbsoluteFill>
  );
};
