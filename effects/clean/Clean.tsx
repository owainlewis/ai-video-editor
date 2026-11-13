// The clean style in Studio (style "clean", locked 2026-11-06; research/reels/STUDY.md). Draws a
// resolved reel plan as the system Owain chose from the samples:
//   split (the main view: the visual on top, Owain or b-roll below, the caption on the seam), text
//   cards, cinematic shots, a full-screen line diagram on green now and then, and the graphic b-roll
//   overlay (the diagram in a dark glass panel over a full-frame picture).
//   Text is one style (display in text.tsx) in six parts: caption sized by weight, hit, two-line
//   title, caption inside the diagram, bracketed list, card beats. One at a time. Over the first
//   seconds, the text hook (./hook.tsx) sits at the top of the frame; frame 0 is the cover (./cover.tsx).
// Fixed geometry: one centre line (x 540), the seam at y 960, the glass panel at 60, 380, 960 x 880,
// chips at y 120.
// Hard cuts between shots; easing only inside a graphic. Diagrams are `custom` visuals drawn per
// video in effects/custom/ with the parts in ./kit.
import React, { useMemo } from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Resolved, ResolvedShot } from "../../engine/schema";
import { lastKept } from "../../engine/resolve";
import { Soundtrack } from "../cut";
import { CUSTOM } from "../custom";
import { Speaker } from "../Speaker";
import { VisualView } from "../Visuals";
import { C, H, lerp, move, type Palette, PALETTES, PaletteContext, W } from "./kit";
import { blurIn, Center, Chip, chunkClean, display, GREEN, Typed, WHITE } from "./text";
import { HOOK_BAND } from "../../engine/resolve";
import { Cover } from "./cover";
import { Hook, underHook } from "./hook";

export const SEAM = 960;
// A chip's top on a split: below Instagram's top bar (QC's safe area starts at y 96).
export const CHIP_Y = 120;
export const GLASS = { left: 60, top: 380, width: W - 120, height: 880 };
// The box each layout draws its visual in, in frame pixels.
export const box = (layout: ResolvedShot["layout"]) =>
  layout === "split" ? { left: 0, top: 0, width: W, height: SEAM } : layout === "over" ? GLASS : { left: 0, top: 0, width: W, height: H };

// A screen recording on a split runs right down to the seam, a true 50/50 with nothing between the
// halves. A page is often white, so its caption and hit sit just under the seam, on the speaker's half.
const fillsPanel = (s: ResolvedShot) => s.layout === "split" && s.visual?.kind === "video" && !!s.visual.sync;
const UNDER_SEAM = SEAM + 22;
const ON_FOOTAGE = { textShadow: "0 2px 26px rgba(0,0,0,0.6)" };

// A card's colour; on the light palette an ink card is black (Owain, 2026-11-13: "occasional black screens").
const bgOf = (s: ResolvedShot, p: Palette) => (s.layout === "diagram" ? p.diagram : s.layout === "card" ? { ink: p.card, paper: C.paper, green: GREEN }[s.bg ?? "ink"] : p.stage);
// The light stage carries a faint grid, as in the clean references Owain sent (2026-11-13).
const grid = (p: Palette, s: ResolvedShot): React.CSSProperties =>
  p.name === "light" && s.layout !== "card" ? { backgroundImage: `linear-gradient(${p.faint} 1px, transparent 1px), linear-gradient(90deg, ${p.faint} 1px, transparent 1px)`, backgroundSize: "72px 72px", backgroundPosition: "36px 36px" } : {};

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
// Under the text hook a split's panel starts below the hook's band (a recording keeps its place and
// the band covers its top).
const Visual: React.FC<{ r: Resolved; s: ResolvedShot; time: number; hooked: boolean }> = ({ r, s, time, hooked }) => {
  const v = s.visual;
  // A card draws its beats or list itself; a custom visual on a card is a designed card (egm-reel-v3's end).
  if (!v || (s.layout === "card" && v.kind !== "custom")) return null;
  // A capture sits in the panel as a window, with margins, so the page never touches the frame's edge.
  // On a split it keeps below Instagram's top bar (QC's safe area starts at y 96) and above the seam
  // caption, so a tall capture never runs under either.
  // Any other library kind (the house graphics, windows) gets the same safe panel on a split; a custom
  // diagram is drawn for the whole panel and keeps its own margins.
  // A synced screen recording fills the top half edge to edge, down to the seam.
  const top = hooked && s.layout === "split" ? HOOK_BAND : 100;
  const b = fillsPanel(s) ? box(s.layout) : v.kind === "image" ? { ...box(s.layout), left: 48, width: W - 96, ...(s.layout === "split" ? { top, height: 790 - top } : {}) } : v.kind !== "custom" && s.layout === "split" ? { left: 60, top, width: W - 120, height: 790 - top } : hooked && s.layout === "split" ? { left: 0, top, width: W, height: SEAM - top } : box(s.layout);
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
  const faceless = !r.video && !r.cut && !r.standIn;
  const pal = PALETTES[r.palette ?? "forest"];
  if (!shot) return <AbsoluteFill style={{ background: pal.stage }} />;

  const paper = shot.layout === "card" && shot.bg === "paper";
  // Type on the stage takes the palette's colour; over footage and on dark cards it stays white.
  const onStage = (shot.layout === "split" || shot.layout === "diagram") && !fillsPanel(shot);
  const ink = paper ? GREEN : onStage ? pal.text : WHITE;
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
  // A custom card that carries the words itself (props.caption false) has no caption over it.
  const quiet = v?.kind === "custom" && v.props?.caption === false;
  const capOn = r.captions && ch && time < Math.min(next?.start ?? Infinity, ch.end + 0.5) && !hit && !beat && !list && !quiet;
  const filled = fillsPanel(shot);
  const cp = (() => {
    switch (shot.layout) {
      case "split": return { y: filled ? UNDER_SEAM : SEAM - 98, size: 110 };
      case "over": return { y: GLASS.top + GLASS.height + 120, size: 92 };
      case "diagram": return shot.inside ? { y: 960 - 52, size: 76 } : { y: 1520, size: 84 };
      case "card": return { y: 900, size: 120 };
      // In the middle of the frame, where a hit lands.
      default: return { y: 880, size: 130 };
    }
  })();
  // On a split the hit sits on the seam like the caption, and a tag stacks it upward: nothing but the
  // seam word crosses onto the speaker's panel.
  const hitY = glass ? GLASS.top + GLASS.height + 90 : shot.layout === "diagram" ? 1560 : filled ? UNDER_SEAM : shot.layout === "split" ? SEAM - 75 - (shot.hit?.tag ? 160 : 0) : 870;

  return (
    <PaletteContext.Provider value={pal}>
    <AbsoluteFill style={{ background: bgOf(shot, pal), ...grid(pal, shot) }}>
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
        if (!s.visual || s.keep || (s.layout === "card" && s.visual.kind !== "custom")) return null;
        const last = lastKept(r.shots, i);
        const from = Math.round(s.start * r.fps);
        return (
          <Sequence key={`v${i}`} from={from} durationInFrames={Math.max(1, Math.round(r.shots[last].end * r.fps) - from)} premountFor={15} name={`${i + 1} ${s.layout} ${s.visual.kind}`}>
            <Visual r={r} s={{ ...s, end: r.shots[last].end }} time={time} hooked={underHook(r, s)} />
          </Sequence>
        );
      })}

      {shot.chip && <Chip t={time} at={shot.chip.at} name={shot.chip.name} y={glass ? GLASS.top + 36 : underHook(r, shot) ? HOOK_BAND : CHIP_Y} />}

      {shot.title && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, ...display(104), color: ink }}>
          <div style={{ textAlign: "center" }}><Typed s={shot.title.lines[0]} t={time} at={shot.title.at} per={0.05} /></div>
          <div style={{ textAlign: "center" }}><Typed s={shot.title.lines[1]} t={time} at={shot.title.at + shot.title.lines[0].length * 0.05 + 0.1} per={0.045} /></div>
        </div>
      )}

      {list && (
        <>
          {list.title && <Center y={640} style={{ ...display(96), color: ink, ...blurIn(time, shot.start) }}>{list.title}</Center>}
          {list.items.map((it, i) => (
            <Center key={i} y={800 + i * 150} style={{ ...display(110), color: ink, ...blurIn(time, list.times?.[i] ?? shot.start + i * 0.12) }}>{it.text}</Center>
          ))}
        </>
      )}

      {beat && (() => {
        const size = beat.size === "huge" ? 250 : beat.size === "mid" ? 150 : 76;
        return (
          <Center y={960 - size * 0.62} style={{ ...display(size), color: ink, ...(beat.cased ? { textTransform: "none" as const } : {}) }}>
            {beat.typed ? <Typed s={beat.text} t={time} at={beat.at} per={0.05} /> : beat.text}
          </Center>
        );
      })()}
      {beats?.line && time >= lineAt && <Center y={1150} style={{ ...display(64), color: ink, ...blurIn(time, lineAt) }}>{beats.line.text}</Center>}

      {hit && (
        <>
          <Center y={hitY} style={{ ...display(176), color: ink, ...(filled ? ON_FOOTAGE : {}) }}>
            <Typed s={hit.text} t={time} at={hit.at} per={0.045} />
          </Center>
          {hit.tag && (
            <Center y={hitY + 150} style={{ ...display(84), color: ink, ...(filled ? ON_FOOTAGE : {}) }}>
              <Typed s={hit.tag} t={time} at={hit.at + hit.text.length * 0.045 + 0.05} per={0.04} />
            </Center>
          )}
        </>
      )}

      <Hook r={r} shot={shot} time={time} faceless={faceless} />

      {capOn && ch && (() => {
        const size = ch.small ? cp.size * 0.6 : cp.size;
        return (
          <Center y={cp.y} style={{ ...display(size), color: ink, marginTop: ch.small ? cp.size * 0.25 : 0, ...(filled ? ON_FOOTAGE : {}) }}>
            {ch.text}
          </Center>
        );
      })()}

      {/* The cover, frame 0 only: Instagram's default cover is the first frame. */}
      {r.cover && Math.round(time * r.fps) === 0 && <Cover cover={r.cover} />}

      <Soundtrack r={r} />
    </AbsoluteFill>
    </PaletteContext.Provider>
  );
};
