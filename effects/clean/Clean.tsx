// The clean style in Studio (style "clean", locked 2026-11-06; research/reels/STUDY.md). Draws a
// resolved reel plan as the system Owain chose from the samples:
//   split (the main view: the visual on top, Owain or b-roll below, the caption on the seam), text
//   cards, cinematic shots, a full-screen line diagram on green now and then, and the graphic b-roll
//   overlay (the diagram in a dark glass panel over a full-frame picture).
//   Text is the six-part kit: caption sized by weight, typed hit with a Signifier tag, two-line
//   Signifier title, caption inside the diagram, bracketed list, card beats. One at a time.
// Fixed geometry: one centre line (x 540), the seam at y 960, the glass panel at 60, 380, 960 x 880,
// chips at y 120.
// Hard cuts between shots; easing only inside a graphic. Diagrams are `custom` visuals drawn per
// video in effects/custom/ with the parts in ./kit.
import React, { useMemo } from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Resolved, ResolvedShot } from "../../engine/schema";
import { CutAudio } from "../cut";
import { CUSTOM } from "../custom";
import { Speaker } from "../Speaker";
import { VisualView } from "../Visuals";
import { C, H, lerp, move, SANS, SERIF, W } from "./kit";
import { blurIn, Center, Chip, chunkClean, CREAM, GREEN, Typed } from "./text";

export const SEAM = 960;
// A chip's top on a split: below Instagram's top bar (QC's safe area starts at y 96).
export const CHIP_Y = 120;
export const GLASS = { left: 60, top: 380, width: W - 120, height: 880 };
// The box each layout draws its visual in, in frame pixels.
export const box = (layout: ResolvedShot["layout"]) =>
  layout === "split" ? { left: 0, top: 0, width: W, height: SEAM } : layout === "over" ? GLASS : { left: 0, top: 0, width: W, height: H };

const BG = { ink: C.ink, paper: C.paper, green: GREEN };
const bgOf = (s: ResolvedShot) => (s.layout === "diagram" ? GREEN : s.layout === "card" ? BG[s.bg ?? "ink"] : C.ink);

// The speaker's layout in the house Speaker: split is the bottom half, over and full the whole frame.
const speakerLayout = (s: ResolvedShot): ResolvedShot["layout"] => (s.picture ? "media" : s.layout === "split" ? "split" : s.layout === "full" || s.layout === "over" ? "full" : "media");

// A b-roll shot for this shot's picture, looped, cropped to its box.
const Picture: React.FC<{ r: Resolved; s: ResolvedShot; first: boolean; time: number }> = ({ r, s, first, time }) => {
  if (!s.picture) return null;
  const split = s.layout === "split";
  // Dimmed under big centre words; lighter under the glass, whose panel carries the contrast.
  const filter = s.layout === "full" ? "brightness(0.62)" : s.layout === "over" ? "brightness(0.85)" : undefined;
  // The opening push: the one eased move a reel gets (1.3x to 1x).
  const push = first ? lerp(1.3, 1, move(time, s.start, 0.7)) : 1;
  return (
    <div style={{ position: "absolute", left: 0, top: split ? SEAM : 0, width: W, height: split ? H - SEAM : H, overflow: "hidden" }}>
      <Video src={staticFile(`${r.slug}/${s.picture.src}`)} muted loop playbackRate={s.picture.rate} trimBefore={Math.round(s.picture.start * 30)} objectFit="cover" style={{ width: "100%", height: "100%", filter, scale: String(push) }} />
    </div>
  );
};

// The shot's visual in its layout's box: a custom diagram, or any other kind through the house view.
const Visual: React.FC<{ r: Resolved; s: ResolvedShot; time: number }> = ({ r, s, time }) => {
  const v = s.visual;
  if (!v || s.layout === "card") return null;
  // A capture sits in the panel as a window, with margins, so the page never touches the frame's edge.
  const b = v.kind === "image" ? { ...box(s.layout), left: 48, width: W - 96 } : box(s.layout);
  const Custom = v.kind === "custom" ? CUSTOM[v.name] : undefined;
  return (
    <div style={{ position: "absolute", ...b, overflow: "visible" }}>
      {Custom && v.kind === "custom" ? (
        <Custom shot={s} time={time} props={v.props ?? {}} times={v.times ?? []} width={b.width} height={b.height} panel={s.layout !== "diagram"} />
      ) : (
        <VisualView slug={r.slug} shot={s} time={time} w={b.width} h={b.height} v={v} />
      )}
    </div>
  );
};

export const Clean: React.FC<Resolved> = (r) => {
  const time = useCurrentFrame() / r.fps;
  const index = Math.max(0, r.shots.findIndex((s) => time >= s.start && time < s.end));
  const shot = r.shots[index] ?? r.shots[r.shots.length - 1];
  const words = useMemo(() => r.chunks.flatMap((c) => c.words), [r.chunks]);
  const chunks = useMemo(() => chunkClean(words), [words]);
  const faceless = !r.video && !r.cut;
  if (!shot) return <AbsoluteFill style={{ background: C.ink }} />;

  const paper = shot.layout === "card" && shot.bg === "paper";
  const ink = paper ? GREEN : CREAM;
  const glass = shot.layout === "over";
  const v = shot.visual;

  // Card beats: one word at a time, each until the next.
  const beats = shot.layout === "card" && v?.kind === "beats" ? v : undefined;
  const bt = beats?.times ?? [];
  const bi = beats ? beats.items.findIndex((_, i) => time >= (bt[i] ?? shot.start) && (i + 1 >= beats.items.length || time < (bt[i + 1] ?? Infinity))) : -1;
  const beat = beats && bi >= 0 ? { ...beats.items[bi], at: bt[bi] ?? shot.start } : undefined;
  const lineAt = beats?.line ? (bt[beats.items.length] ?? shot.start) : Infinity;
  // A bracketed list on a card: the header, then items stacking on their words.
  const list = shot.layout === "card" && v?.kind === "list" ? v : undefined;
  const hit = shot.hit && time >= shot.hit.at && time < shot.hit.until ? shot.hit : undefined;

  // The caption: one chunk, sized by weight, placed by the layout. Hidden under any other text.
  const ch = [...chunks].reverse().find((c) => c.start <= time + 0.02);
  const next = ch ? chunks[chunks.indexOf(ch) + 1] : undefined;
  const capOn = r.captions && ch && time < Math.min(next?.start ?? Infinity, ch.end + 0.5) && !hit && !beat && !list;
  const cp = (() => {
    switch (shot.layout) {
      case "split": return { y: SEAM - 98, size: 110 };
      case "over": return { y: GLASS.top + GLASS.height + 120, size: 92 };
      case "diagram": return shot.inside ? { y: 960 - 52, size: 76 } : { y: 1520, size: 84 };
      case "card": return { y: 900, size: 120 };
      // Small on Owain's chest; big at the centre over b-roll.
      default: return shot.picture || faceless ? { y: 1150, size: 92 } : { y: 1250, size: 72 };
    }
  })();
  // On a split the hit sits on the seam like the caption, and a tag stacks it upward: nothing but the
  // seam word crosses onto the speaker's panel.
  const hitY = glass ? GLASS.top + GLASS.height + 90 : shot.layout === "diagram" ? 1560 : shot.layout === "split" ? SEAM - 75 - (shot.hit?.tag ? 160 : 0) : 1080;

  return (
    <AbsoluteFill style={{ background: bgOf(shot) }}>
      {/* One continuous speaker video, never unmounted; hidden where a picture or card covers it. */}
      {!faceless && <Speaker r={{ ...r, split: "half" }} shot={{ ...shot, layout: speakerLayout(shot) }} time={time} />}
      {shot.layout === "full" && !shot.picture && !faceless && <AbsoluteFill style={{ background: "linear-gradient(transparent 50%, rgba(0,0,0,0.3) 75%, rgba(0,0,0,0.45))" }} />}

      {r.shots.map((s, i) =>
        s.picture ? (
          <Sequence key={`p${i}`} from={Math.round(s.start * r.fps)} durationInFrames={Math.max(1, Math.round((s.end - s.start) * r.fps))} premountFor={15} name={`${i + 1} picture`}>
            <Picture r={r} s={s} first={i === 0} time={time} />
          </Sequence>
        ) : null,
      )}

      {glass && <div style={{ position: "absolute", ...GLASS, borderRadius: 32, background: "rgba(12,18,15,0.66)", backdropFilter: "blur(28px) saturate(1.1)", border: "1.5px solid rgba(245,245,242,0.14)" }} />}
      {r.shots.map((s, i) => {
        if (!s.visual || s.keep || s.layout === "card") return null;
        let last = i;
        while (r.shots[last + 1]?.keep) last++;
        const from = Math.round(s.start * r.fps);
        return (
          <Sequence key={`v${i}`} from={from} durationInFrames={Math.max(1, Math.round(r.shots[last].end * r.fps) - from)} premountFor={15} name={`${i + 1} ${s.layout} ${s.visual.kind}`}>
            <Visual r={r} s={{ ...s, end: r.shots[last].end }} time={time} />
          </Sequence>
        );
      })}

      {shot.chip && <Chip t={time} at={shot.chip.at} name={shot.chip.name} y={glass ? GLASS.top + 36 : CHIP_Y} />}

      {shot.title && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 104, lineHeight: 0.86, color: CREAM, letterSpacing: -1 }}>
          <div style={{ textAlign: "center", transform: "translateX(-70px)" }}><Typed s={shot.title.lines[0]} t={time} at={shot.title.at} per={0.05} /></div>
          <div style={{ textAlign: "center", transform: "translateX(70px)" }}><Typed s={shot.title.lines[1]} t={time} at={shot.title.at + shot.title.lines[0].length * 0.05 + 0.1} per={0.045} /></div>
        </div>
      )}

      {list && (
        <>
          {list.title && <Center y={640} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 96, letterSpacing: -3, color: ink, ...blurIn(time, shot.start) }}>{list.title}</Center>}
          {list.items.map((it, i) => (
            <Center key={i} y={800 + i * 150} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 110, letterSpacing: -4, color: ink, ...blurIn(time, list.times?.[i] ?? shot.start + i * 0.12) }}>{it.text}</Center>
          ))}
        </>
      )}

      {beat && (() => {
        const size = beat.size === "huge" ? 250 : beat.size === "mid" ? 150 : 76;
        return (
          <Center y={960 - size * 0.62} style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.045, color: ink }}>
            {beat.typed ? <Typed s={beat.text} t={time} at={beat.at} per={0.05} /> : beat.text}
          </Center>
        );
      })()}
      {beats?.line && time >= lineAt && <Center y={1150} style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 64, color: ink, ...blurIn(time, lineAt) }}>{beats.line.text}</Center>}

      {hit && (
        <>
          <Center y={hitY} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 150, lineHeight: 1, letterSpacing: -6, color: ink }}>
            <Typed s={hit.text} t={time} at={hit.at} per={0.045} />
          </Center>
          {hit.tag && (
            <Center y={hitY + 150} style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 84, lineHeight: 1, color: ink, paddingLeft: 260 }}>
              <Typed s={hit.tag} t={time} at={hit.at + hit.text.length * 0.045 + 0.05} per={0.04} />
            </Center>
          )}
        </>
      )}

      {capOn && ch && (() => {
        const size = ch.small ? cp.size * 0.6 : cp.size;
        return (
          <Center y={cp.y} style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1.1, letterSpacing: -size * 0.035, color: ink, marginTop: ch.small ? cp.size * 0.25 : 0 }}>
            {ch.text.toLowerCase()}
          </Center>
        );
      })()}

      {r.audio && <Audio src={staticFile(r.audio)} />}
      {r.cut && <CutAudio r={r} />}
    </AbsoluteFill>
  );
};
