import { FocusVisual, MapVisual, ShiftVisual, WordsVisual } from "./house";
import React from "react";
import { Video } from "@remotion/media";
import { UiVisual } from "./ui";
import { Img, interpolate, useVideoConfig } from "remotion";
import { cameraProgress, frameRect, rectOf } from "./camera";
import { zoomAt } from "../engine/resolve";
import { clamp, ease, t } from "./theme";
import { style } from "./style";
import { markColor } from "./motion";
import { FunnelVisual, GridVisual, pal, prog, SoftAccented, type SoftTheme, src, TypeVisual, type Tone, usePal, useSoftTheme } from "./soft";
import { ChartVisual, ConstraintVisual, PipelineVisual } from "./elements";
import { look } from "./style";
import { BrowserChrome, chromeHeight, WindowsVisual } from "./browser";
import { PageActions } from "./pageactions";
import { AgendaCard, BeforeAfterCard, BentoCard, ChecklistCard, KpiCard, LevelsCard, LogowallCard, MatrixCard, MeterCard, QuoteCard, RingCard, TimelineCard, WaffleCard } from "./cards";
import type { ResolvedShot, ResolvedVisual } from "../engine/schema";
import { LaidView } from "./clean/laid";
import { type Palette, PALETTES, PaletteContext } from "./clean/kit";

// `room`: how far a visual may draw past its box on each side (in its own units), up to the frame's
// edge; a travelling flow camera uses it so cards run off the frame, not off an inner box.
type Room = { l: number; t: number; r: number; b: number };
type Props = { slug: string; shot: ResolvedShot; time: number; w: number; h: number; filter?: string; bleed?: boolean; room?: Room };
type V<K extends ResolvedVisual["kind"]> = Extract<ResolvedVisual, { kind: K }> & { times?: number[]; size?: [number, number] };


// Colours for a designed graphic in the shot's tone. On paper the hairline and shadow are the split
// canvas's own (as they always were); on graphite everything comes from the dark tone.
const useSurface = (tone?: "light" | "dark") => {
  const c = usePal(tone);
  return { ...c, canvas: c.bg, line: tone === "dark" ? c.line : t.line, shadow: tone === "dark" ? c.shadow : t.shadow };
};

// Text with *one accent* set in Signifier italic. `lift` sets the accent larger than the line around
// it: Signifier italic beside bold Helvetica reads small and light at the same size.
export const Accented: React.FC<{ text: string; color?: string; lift?: number }> = ({ text, color, lift = 1 }) => (
  <>
    {text.split(/(\*[^*]+\*)/).map((part, i) =>
      part.startsWith("*") ? (
        <span key={i} style={style.type.accent === "colour" ? { color } : { fontFamily: t.serif, fontStyle: "italic", fontWeight: 400, letterSpacing: -0.5, fontSize: `${lift}em` }}>
          {part.slice(1, -1)}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

// A real capture, framed as a card or a browser window, with a camera that moves
// from one region to another and a marker that sweeps across what is being said.
const ImageVisual: React.FC<Props & { v: V<"image"> }> = (props) => {
  const { w, h, v, shot } = props;
  const vFrom = rectOf(v.from), vTo = rectOf(v.to);
  // On a scene or split the card is only as tall as the region being shown, so the words under discussion
  // are large and nothing unrelated from the page sits around them.
  // Split panels too (Owain, 2026-10-25: "the text positioning is really off"): a paragraph card
  // shows that paragraph, not half-lines of the page cut off above and below it.
  if ((shot.layout === "scene" || shot.layout === "split") && vFrom && (v.mat || v.label || v.lift)) return <MattedImage {...props} />;
  if ((shot.layout === "scene" || shot.layout === "split") && vFrom) {
    const [iw, ih] = v.size ?? [1600, 1000];
    const tall = (r: number[]) => (w * r[3] * ih) / (r[2] * iw);
    // A browser keeps a window's shape (at least 62% of the panel) with its bar on top; the page
    // around the region fills the rest, so it reads as the site, not a strip cut from it.
    const region = Math.max(tall(vFrom), tall(vTo ?? vFrom));
    // "none" is the site full bleed: it fills the whole panel (Owain, 2026-11-25: "the website could be
    // full in the top window split rather than in a small browser").
    const cardH = v.frame === "none" ? h : v.frame === "browser" ? Math.min(h, Math.max(h * 0.62, region + chromeHeight(w))) : Math.min(h, Math.max(260, region));
    return (
      <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ImageCard {...props} h={cardH} />
      </div>
    );
  }
  return <ImageCard {...props} />;
};

// A capture on a coloured mat, the source's real logo and name above it, and optionally one real
// element lifted out of the capture and shown large (after the creator reels Owain sent, 2026-10-26).
const MattedImage: React.FC<Props & { v: V<"image"> }> = (props) => {
  const { slug, w, h, v, time, shot } = props;
  const [iw, ih] = v.size ?? [1600, 1000];
  const pad = Math.round(w * 0.045);
  const labelH = v.label ? Math.round(w * 0.11) : 0;
  const cw = w - pad * 2;
  const tall = (r: number[]) => (cw * r[3] * ih) / (r[2] * iw);
  const vFrom = rectOf(v.from)!, vTo = rectOf(v.to);
  const cardH = Math.min(h - pad * 2 - labelH, Math.max(240, tall(vFrom), tall(vTo ?? vFrom)));
  const fs = Math.round(w * 0.042);
  // The lift: the element grows out of its place on the card to fill the mat's width.
  const liftAt = v.lift ? (v.times?.[v.highlight.length] ?? shot.start + 0.6) : Infinity;
  const k = v.lift ? prog(time, liftAt, 0.46) : 0;
  const lw = cw * 0.92, lh = v.lift ? (lw * v.lift.rect[3] * ih) / (v.lift.rect[2] * iw) : 0;
  return (
    <div style={{ width: w, height: h, borderRadius: 34, background: v.mat ?? "transparent", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: v.label ? fs * 0.7 : 0 }}>
      {v.label && (
        <div style={{ display: "flex", alignItems: "center", gap: fs * 0.45, fontFamily: t.sans, fontWeight: 700, fontSize: fs, color: "#1F1F1D", letterSpacing: -0.3, opacity: 1 - 0.6 * k }}>
          {v.label.logo && <Img src={src(slug, v.label.logo)} style={{ height: fs * 1.25, width: "auto" }} />}
          {v.label.text}
        </div>
      )}
      <div style={{ opacity: 1 - 0.65 * k, scale: String(1 - 0.04 * k), filter: `blur(${4 * k}px)` }}>
        <ImageCard {...props} w={cw} h={cardH} />
      </div>
      {v.lift && k > 0 && (
        <div style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", width: lw, height: lh, borderRadius: 18, overflow: "hidden", background: t.card, boxShadow: "0 30px 70px rgba(0,0,0,0.28)", opacity: Math.min(1, k * 2), scale: String(0.7 + 0.3 * k) }}>
          <Img src={src(slug, v.src)} style={{ position: "absolute", width: lw / v.lift.rect[2], height: (lw / v.lift.rect[2]) * (ih / iw), left: -(lw / v.lift.rect[2]) * v.lift.rect[0], top: -(lw / v.lift.rect[2]) * (ih / iw) * v.lift.rect[1] }} />
        </div>
      )}
    </div>
  );
};

const ImageCard: React.FC<Props & { v: V<"image"> }> = ({ slug, shot, time, w, h, v }) => {
  const [iw, ih] = v.size ?? [1600, 1000];
  const chrome = v.frame === "browser" ? chromeHeight(w) : 0;
  const vw = w;
  const vh = h - chrome;
  // Default camera: the top of the image at full width, easing slightly closer.
  const topRect: [number, number, number, number] = [0, 0, 1, Math.min(1, (vh / vw) * (iw / ih))];
  const from = rectOf(v.from) ?? topRect;
  const to = rectOf(v.to) ?? [from[0] + from[2] * 0.03, from[1] + from[3] * 0.03, from[2] * 0.94, from[3] * 0.94];
  // One camera move: the rect eases from `from` to `to` on the shared camera curve. The card itself
  // never moves.
  const p = cameraProgress(shot.start, shot.end, time);
  const rect = from.map((a, i) => a + (to[i] - a) * p) as [number, number, number, number];
  // The rect must stay visible; the camera fills the rest of the panel with the page around it.
  const { k, left, top } = frameRect(rect, iw, ih, vw, vh);
  const scene = shot.layout === "scene";
  const c = usePal(shot.tone);

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: v.frame === "none" ? 0 : 26,
        overflow: "hidden",
        background: t.card,
        boxShadow: v.frame === "none" ? "none" : scene ? c.shadow : t.shadow,
        border: v.frame === "none" ? "none" : `1px solid ${t.line}`,
      }}
    >
      {v.frame === "browser" && <BrowserChrome slug={slug} w={w} tone={shot.tone} url={v.url} title={v.title} icon={v.icon} />}
      <div style={{ position: "relative", width: vw, height: vh, overflow: "hidden" }}>
        <div style={{ position: "absolute", left, top, width: iw * k, height: ih * k }}>
          <Img src={src(slug, v.src)} style={{ width: "100%", height: "100%", display: "block" }} />
          {v.highlight.map((hl, i) => {
            if (!hl.rect) return null;
            const at = v.times?.[i] ?? shot.start + 0.3;
            const sweep = prog(time, at, 0.35);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${hl.rect[0] * 100}%`,
                  top: `${hl.rect[1] * 100}%`,
                  width: `${hl.rect[2] * 100}%`,
                  height: `${hl.rect[3] * 100}%`,
                  // On scenes the marker is a flat accent outline, so it reads on light and dark pages alike.
                  background: v.dark ? "rgba(183,205,191,0.22)" : scene ? "transparent" : t.highlight,
                  outline: v.dark ? "3px solid rgba(183,205,191,0.9)" : scene ? `4px solid ${c.accent}` : "none",
                  outlineOffset: v.dark ? 0 : 8,
                  borderRadius: 8,
                  scale: `${sweep} 1`,
                  transformOrigin: "left center",
                  mixBlendMode: scene || v.dark ? "normal" : "multiply",
                }}
              />
            );
          })}
          <PageActions slug={slug} v={v} time={time} start={shot.start} k={k} cursor={Math.round(Math.min(48, Math.max(30, w * 0.04)))} />
          {/* Callouts: a label above the highlighted region, joined by a short line. */}
          {v.highlight.map((hl, i) => {
            if (!hl.label || !hl.rect) return null;
            const at = (v.times?.[i] ?? shot.start + 0.3) + 0.15;
            const p = prog(time, at, 0.35);
            return (
              <div
                key={`c${i}`}
                style={{
                  position: "absolute",
                  left: `${hl.rect[0] * 100}%`,
                  top: `${hl.rect[1] * 100}%`,
                  translate: "0 -100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  opacity: p,
                  scale: String(0.9 + 0.1 * p),
                  transformOrigin: "left bottom",
                }}
              >
                <div style={{ padding: "8px 18px", borderRadius: 12, background: t.ink, color: "#fff", fontFamily: t.sans, fontWeight: 700, fontSize: 30, letterSpacing: -0.5, whiteSpace: "nowrap", boxShadow: t.shadow }}>
                  {hl.label}
                </div>
                <div style={{ width: 2, height: 22, marginLeft: 22, background: t.ink }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// B-roll. In a panel it sits in a rounded card; as a cutaway it fills the frame edge to edge.
// Either way it gets a slow push-in on top of its own motion, and the speaker's colour grade.
const VideoVisual: React.FC<Props & { v: V<"video"> }> = ({ slug, shot, time, w, h, v, filter, bleed }) => {
  const { fps } = useVideoConfig();
  const c = usePal(shot.tone);
  // A synced screen recording: locked, so the page stays sharp and still. It fits the width and hangs
  // from the top, so the page's header always shows and any extra height runs off the bottom.
  if (v.sync) {
    const [vw0, vh0] = v.size ?? [w, h];
    const full = Math.max(h, (w * vh0) / vw0);
    const z = zoomAt(v.zooms ?? [], time, h / full);
    return (
      <div style={{ width: w, height: h, overflow: "hidden" }}>
        <div style={{ width: w, height: full, transformOrigin: "0 0", transform: `translate(${z.tx * w}px, ${z.ty * full}px) scale(${z.s})` }}>
          <Video src={src(slug, v.src)} muted trimBefore={Math.round(shot.start * fps)} objectFit="cover" style={{ width: w, height: full }} />
        </div>
      </div>
    );
  }
  // On a scene the clip sits in a card at its own shape with a locked camera; the clip is the motion.
  if (shot.layout === "scene") {
    const [vw0, vh0] = v.size ?? [16, 9];
    const cw = Math.min(w, (h * vw0) / vh0);
    const ch = (cw * vh0) / vw0;
    return (
      <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: cw, height: ch, overflow: "hidden", borderRadius: 22, boxShadow: c.shadow, background: c.card }}>
          <Video src={src(slug, v.src)} muted loop={v.loop} playbackRate={v.rate} trimBefore={Math.round(v.start * fps)} objectFit="cover" style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    );
  }
  // Elsewhere: one slow push-in on the shared camera curve.
  const p = cameraProgress(shot.start, shot.end, time);
  return (
    <div style={{ width: w, height: h, overflow: "hidden", borderRadius: bleed ? 0 : 26, boxShadow: bleed ? "none" : t.shadow }}>
      <Video
        src={src(slug, v.src)}
        muted
        loop={v.loop}
        playbackRate={v.rate}
        trimBefore={Math.round(v.start * fps)}
        objectFit="cover"
        style={{ width: "100%", height: "100%", scale: String(1.02 + 0.05 * p), filter }}
      />
    </div>
  );
};

// Official logos on white tiles. Each one lands on its spoken word.
const LogosVisual: React.FC<Props & { v: V<"logos"> }> = ({ slug, shot, time, w, h, v }) => {
  const c = useSurface(shot.tone);
  const n = v.items.length;
  // Tiles grow with the panel so logos never float small in empty space.
  const tile = n === 1 ? Math.min(460, h * 0.55) : n === 2 ? Math.min(400, h * 0.42, (w - 48) / 2) : n === 3 ? Math.min(290, (w - 96) / 3) : 210;
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 46 }}>
      <div style={{ display: "flex", gap: n > 3 ? 30 : 48, flexWrap: "wrap", justifyContent: "center", maxWidth: w }}>
        {v.items.map((it, i) => {
          const at = v.times?.[i] ?? shot.start + i * 0.12;
          const p = prog(time, at, 0.5);
          const settle = interpolate(time, [at, at + 0.5], [1.12, 1], { ...clamp, easing: ease });
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, opacity: p, translate: `0 ${(1 - p) * 40}px` }}>
              <div style={{ width: tile, height: tile, borderRadius: tile * 0.22, background: t.card, boxShadow: c.shadow, border: `1px solid ${c.line}`, display: "flex", alignItems: "center", justifyContent: "center", scale: String(settle) }}>
                <Img src={src(slug, it.src)} style={{ width: tile * 0.58, height: tile * 0.58, objectFit: "contain" }} />
              </div>
              {it.name && <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: Math.max(40, tile * 0.15), letterSpacing: -1, color: c.ink }}>{it.name}</div>}
            </div>
          );
        })}
      </div>
      {v.caption && (
        <div style={{ fontFamily: t.serif, fontStyle: "italic", fontSize: 52, color: c.muted, opacity: prog(time, shot.start + 0.3) }}>{v.caption}</div>
      )}
    </div>
  );
};

// A headline that builds word by word, with a rule drawing under it.
// Which words of a "*marked phrase*" line are marked, and each one's place in its phrase.
const markedAt = (words: string[], i: number) => {
  let on = false;
  for (let k = 0; k <= i; k++) {
    if (words[k].startsWith("*")) on = true;
    if (k === i) return on;
    if (words[k].replace(/[.!?,]$/, "").endsWith("*")) on = false;
  }
  return false;
};
const markIndex = (words: string[], i: number) => {
  let start = i;
  while (start > 0 && !words[start].startsWith("*")) start--;
  let end = i;
  while (end < words.length - 1 && !words[end].replace(/[.!?,]$/, "").endsWith("*")) end++;
  return { n: i - start, of: end - start + 1 };
};

// A cinematic quote title: Signifier on black, small and centred, each word fading up out of a soft
// blur as it is said (Owain, 2026-10-30, after Alex M H Smith's titles). `//` breaks the line.
const CineTitle: React.FC<Props & { v: V<"title"> }> = ({ shot, time, w, h, v }) => {
  const words = v.text.split(/\s+/);
  const lines = v.text.replace(/\*/g, "").split("//").map((l) => l.trim().length);
  const size = Math.min(62, Math.floor((w - 80) / (Math.max(1, ...lines) * 0.47)));
  const c = usePal(shot.tone);
  let k = 0;
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${size * 0.18}px ${size * 0.26}px`, maxWidth: w - 80 }}>
        {words.map((word, i) => {
          if (word === "//") return <span key={i} style={{ flexBasis: "100%", height: 0 }} />;
          const accent = word.startsWith("*");
          const idx = k++;
          const at = v.words?.[i];
          const p = at !== undefined ? prog(time, at - 0.05, 0.55) : prog(time, shot.start + 0.3 + 0.09 * idx, 0.7);
          return (
            <span key={i} style={{ display: "inline-block", fontFamily: t.serif, fontStyle: accent ? "italic" : "normal", fontWeight: 400, fontSize: size, lineHeight: 1.15, letterSpacing: -size * 0.005, color: c.ink, opacity: p, filter: `blur(${(1 - p) * 8}px)`, translate: `0 ${(1 - p) * size * 0.12}px` }}>
              {word.replace(/\*/g, "")}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const TitleVisual: React.FC<Props & { v: V<"title"> }> = ({ shot, time, w, h, v }) => {
  const theme = useSoftTheme();
  const c = pal(shot.tone, theme);
  if (v.cine) return <CineTitle shot={shot} time={time} w={w} h={h} v={v} slug="" />;
  const words = v.text.split(/\s+/);
  const len = v.text.replace(/\*/g, "").length;
  // "//" in the text is a line break the plan chose; the type is then sized to the longest line.
  const lines = v.text.replace(/\*/g, "").split("//").map((l) => l.trim().length);
  const size = lines.length > 1 ? Math.min(132, Math.floor((w - 40) / (Math.max(1, ...lines) * 0.56))) : len > 40 ? 78 : len > 34 ? 92 : len > 20 ? 112 : 132;
  let k = 0;
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36 }}>
      {v.kicker && (
        <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: c.muted, opacity: prog(time, shot.start) }}>{v.kicker}</div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.26}px`, maxWidth: w - 40 }}>
        {words.map((word, i) => {
          if (word === "//") return <span key={i} style={{ flexBasis: "100%", height: 0 }} />;
          // Kinetic type is all Helvetica: no serif accent (Owain, 2026-10-25: "keep it all sans serif").
          // Its *marked* words get the highlighter instead, sweeping word by word after the line lands.
          // On black there is no highlighter: marked words take the Signifier italic accent instead.
          const accent = word.startsWith("*") && (!v.words || theme.black);
          const marked = !!v.words && !theme.black && markedAt(words, i);
          const m = marked ? markIndex(words, i) : { n: 0, of: 1 };
          const idx = k++;
          const at = v.words?.[i];
          const wordAt = at ?? shot.start + 0.06 * idx;
          // Each marked word is swept as it is said, so the beat lands even when the card cuts away
          // right after the line.
          const sweep = marked && v.words ? prog(time, wordAt + 0.1, 0.3) : 0;
          // Synced: each word lands as it is said (kinetic type, after the product promos Owain sent).
          const p = at !== undefined ? prog(time, at, 0.3) : prog(time, wordAt, 0.4);
          const bare = word.replace(/\*/g, "");
          const stop = v.words && /[.!?]$/.test(bare);
          return (
            <span key={i} style={{ position: "relative", display: "inline-block", overflowX: "visible", overflowY: "clip", paddingBottom: size * 0.12 }}>
              {marked && (
                <span
                  style={{
                    position: "absolute",
                    left: m.n === 0 ? -size * 0.08 : -size * 0.14,
                    right: m.n === m.of - 1 ? -size * 0.08 : -size * 0.14,
                    top: size * 0.1,
                    height: size * 0.92,
                    background: markColor(c.accent),
                    borderRadius: 4,
                    transformOrigin: "left",
                    scale: `${sweep} 1`,
                  }}
                />
              )}
              <span
                style={{
                  position: "relative",
                  display: "inline-block",
                  translate: `0 ${(1 - p) * size * 0.5}px`,
                  opacity: p,
                  filter: `blur(${(1 - p) * 12}px)`,
                  // The style's accent: Ivory sets the accent word in Signifier italic; a colour-only
                  // style keeps one face and recolours it.
                  ...(accent && style.type.accent === "italic"
                    ? { fontFamily: t.serif, fontStyle: "italic" as const, fontWeight: 400, fontSize: size * 1.08, letterSpacing: -size * 0.01 }
                    : { fontFamily: t.display, fontWeight: style.type.display.weight, fontSize: size, letterSpacing: size * style.type.display.tracking }),
                  lineHeight: 1,
                  color: accent ? c.accentText : c.ink,
                }}
              >
                {stop ? bare.slice(0, -1) : bare}
                {/* A synced line ends on a full stop in the accent colour. */}
                {stop && <span style={{ color: c.accent, fontFamily: t.display, fontStyle: "normal", fontWeight: style.type.display.weight }}>{bare.slice(-1)}</span>}
              </span>
            </span>
          );
        })}
      </div>
      {!v.words && <div style={{ width: 200, height: 3, background: c.ink, scale: `${prog(time, shot.start + 0.25, 0.6)} 1`, transformOrigin: "left" }} />}
    </div>
  );
};

// Rows that arrive as each item is spoken; the newest is active, earlier ones step back.
const ListVisual: React.FC<Props & { v: V<"list"> }> = ({ shot, time, w, h, v }) => {
  const c = useSurface(shot.tone);
  const n = v.items.length;
  const times = v.times ?? v.items.map((_, i) => shot.start + i * 0.12);
  const current = v.active ?? Math.max(0, times.filter((x) => time >= x).length - 1);
  const rowH = Math.min(n <= 3 ? 210 : 160, (h - (v.title ? 120 : 0)) / n - 22);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
      {v.title && (
        <div style={{ fontFamily: t.display, fontWeight: style.type.display.weight, fontSize: 64, letterSpacing: 64 * style.type.display.tracking, color: c.ink, marginBottom: 12, opacity: prog(time, shot.start) }}>
          <Accented text={v.title} />
        </div>
      )}
      {v.items.map((it, i) => {
        const arrived = prog(time, times[i], 0.45);
        // With preview, every item is visible from the start, dimmed and soft, and sharpens as it is reached.
        const p = v.preview ? 1 : arrived;
        const on = i === current && time >= times[i] - 0.05;
        return (
          <div
            key={i}
            style={{
              height: rowH,
              display: "flex",
              alignItems: "center",
              gap: 34,
              padding: "0 40px",
              borderRadius: 24,
              background: c.card,
              border: `1.5px solid ${on ? c.ink : c.line}`,
              boxShadow: on ? c.shadow : "none",
              opacity: v.preview ? 0.3 + 0.7 * (on ? 1 : arrived * 0.6) : p * (on ? 1 : 0.55),
              filter: v.preview ? `blur(${(1 - arrived) * 4}px)` : undefined,
              translate: `${(1 - p) * 80}px 0`,
            }}
          >
            <div style={{ fontFamily: t.serif, fontStyle: "italic", fontSize: rowH * 0.5, color: on ? c.accent : c.muted, width: rowH * 0.4 }}>{i + 1}</div>
            <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: Math.min(68, rowH * 0.36), letterSpacing: -1.5, color: c.ink }}>
              <Accented text={it.text} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// A process: nodes join by a line that draws as each step is spoken.
const StepsVisual: React.FC<Props & { v: V<"steps"> }> = ({ shot, time, w, h, v }) => {
  const c = useSurface(shot.tone);
  const n = v.items.length;
  const times = v.times ?? v.items.map((_, i) => shot.start + i * 0.3);
  const gap = Math.min(250, (h - (v.title ? 140 : 0)) / Math.max(1, n));
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 30 }}>
      {v.title && (
        <div style={{ fontFamily: t.display, fontWeight: style.type.display.weight, fontSize: 84, letterSpacing: 84 * style.type.display.tracking, color: c.ink, marginBottom: 60, opacity: prog(time, shot.start) }}>
          <Accented text={v.title} />
        </div>
      )}
      <div style={{ position: "relative", height: gap * n }}>
        {v.items.map((it, i) => {
          const t0 = times[i] ?? shot.start + i * 0.3;
          const p = prog(time, t0, 0.45);
          const t1 = times[i + 1] ?? t0 + 0.6;
          const lineFrom = t0 + 0.1;
          const line = i < n - 1 ? (t1 > lineFrom ? interpolate(time, [lineFrom, t1], [0, 1], { ...clamp, easing: ease }) : time >= t1 ? 1 : 0) : 0;
          const dot = 72;
          return (
            <React.Fragment key={i}>
              {i < n - 1 && (
                <div style={{ position: "absolute", left: dot / 2 - 1.5, top: i * gap + dot, width: 3, height: gap - dot, background: c.ink, scale: `1 ${line}`, transformOrigin: "top" }} />
              )}
              <div style={{ position: "absolute", top: i * gap, left: 0, display: "flex", alignItems: "center", gap: 36, opacity: 0.25 + 0.75 * p }}>
                <div style={{ width: dot, height: dot, borderRadius: dot, border: `3px solid ${c.ink}`, background: p > 0.5 ? c.ink : c.canvas, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.serif, fontStyle: "italic", fontSize: 38, color: p > 0.5 ? c.canvas : c.ink }}>
                  {i + 1}
                </div>
                <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: 70, letterSpacing: -2, color: c.ink, translate: `${(1 - p) * 40}px 0` }}>
                  <Accented text={it.text} />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// Old way against new way. When the new way lands, the old one is struck through. With `even`, two
// sides of one idea, neither wrong (documentation vs database; humans vs AI): both set alike in
// Helvetica, no strike (Owain, 2026-10-25).
const CompareVisual: React.FC<Props & { v: V<"compare"> }> = ({ shot, time, w, h, v }) => {
  const c = useSurface(shot.tone);
  const rightAt = v.times?.[0] ?? shot.start + 0.6;
  const pl = prog(time, shot.start, 0.45);
  const pr = prog(time, rightAt, 0.5);
  const card = (label: string, text: string, p: number, right: boolean) => (
    <div style={{ flex: 1, height: h * 0.8, borderRadius: 28, padding: 44, background: c.card, border: `1.5px solid ${right ? c.ink : c.line}`, boxShadow: right ? c.shadow : "none", display: "flex", flexDirection: "column", justifyContent: "space-between", opacity: p, translate: `0 ${(1 - p) * 50}px` }}>
      <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: 28, letterSpacing: 5, textTransform: "uppercase", color: c.muted }}>{label}</div>
      <div style={{ position: "relative", fontFamily: right && !v.even ? t.serif : t.sans, fontStyle: right && !v.even ? "italic" : "normal", fontWeight: right && !v.even ? 400 : 700, fontSize: right && !v.even ? 84 : v.even ? 58 : 68, lineHeight: 1.04, letterSpacing: right && !v.even ? -1 : -1.5, color: right || v.even ? c.ink : c.muted, textWrap: "balance" }}>
        {text}
        {!right && !v.even && <div style={{ position: "absolute", left: -6, right: -6, top: "52%", height: 5, background: c.ink, scale: `${pr} 1`, transformOrigin: "left" }} />}
      </div>
    </div>
  );
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", gap: 28 }}>
      {card(v.left.label, v.left.text, pl, false)}
      {card(v.right.label, v.right.text, pr, true)}
    </div>
  );
};

const StatVisual: React.FC<Props & { v: V<"stat"> }> = ({ shot, time, w, h, v }) => {
  const c = useSurface(shot.tone);
  const m = v.value.match(/^([^\d]*)([\d,.]+)(.*)$/);
  const p = prog(time, shot.start, 0.9);
  let shown = v.value;
  if (m && !v.hit) {
    const target = parseFloat(m[2].replace(/,/g, ""));
    const decimals = (m[2].split(".")[1] || "").length;
    shown = m[1] + (target * p).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + m[3];
  }
  // As before, 300 px (220 past six characters), but never wider than the panel once the count
  // has its thousands commas (a six-digit value used to run off a split's edges).
  const final = m ? m[1] + parseFloat(m[2].replace(/,/g, "")).toLocaleString("en-US", { maximumFractionDigits: 6 }) + m[3] : v.value;
  const unit = (shown.match(/[^\d,.]+$/) ?? [""])[0];
  const size = Math.min(v.value.length > 6 ? 220 : 300, Math.floor((w * 0.95) / (final.length * 0.52)));
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: Math.min(size, (w * 0.95) / (v.value.length * 0.6)), whiteSpace: "nowrap", lineHeight: 0.9, letterSpacing: "-0.035em", color: c.ink, fontVariantNumeric: "tabular-nums" }}>
        {/* A trailing unit ("12x", "40%") gets its own breathing room: tight tracking jammed the x into the 2 (Owain, 2026-10-25). */}
        {unit ? (
          <>
            {shown.slice(0, -unit.length)}
            <span style={{ marginLeft: "0.06em", letterSpacing: 0 }}>{unit}</span>
          </>
        ) : (
          shown
        )}
      </div>
      <div data-qc="mark" style={{ width: 160, height: 3, background: c.ink, scale: `${v.hit ? 1 : prog(time, shot.start + 0.3, 0.6)} 1`, transformOrigin: "left" }} />
      <div style={{ fontFamily: t.serif, fontStyle: "italic", fontWeight: 400, fontSize: 56, letterSpacing: -0.5, color: c.muted, opacity: v.hit ? 1 : prog(time, shot.start + 0.2) }}>
        <Accented text={v.label} />
      </div>
    </div>
  );
};

// The end card: what to comment, what they get, and the resource itself when there is one.
const CtaVisual: React.FC<Props & { v: V<"cta"> }> = ({ slug, shot, time, w, h, v }) => {
  const c = useSurface(shot.tone);
  const a = prog(time, shot.start, 0.4);
  const b = prog(time, shot.start + 0.15, 0.5);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
      <div style={{ fontFamily: t.display, fontWeight: style.type.display.weight, fontSize: v.src ? 96 : 128, letterSpacing: (v.src ? 96 : 128) * style.type.display.tracking, color: c.ink, textAlign: "center", lineHeight: 1.05, opacity: a, translate: `0 ${(1 - a) * 30}px` }}>
        Comment <span style={{ color: c.accentText }}>“{v.keyword}”</span>
      </div>
      <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: v.src ? 46 : 60, color: c.muted, textAlign: "center", opacity: a }}>{v.text}</div>
      {v.src && (
        <div style={{ width: w * 0.86, height: h * 0.5, borderRadius: 26, overflow: "hidden", background: c.card, boxShadow: c.shadow, border: `1px solid ${c.line}`, opacity: b, translate: `0 ${(1 - b) * 40}px` }}>
          <Img src={src(slug, v.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </div>
      )}
    </div>
  );
};

// A chapter card: the number lands out of a blur over a soft glow, its name tracked out below.
const ChapterVisual: React.FC<Props & { v: V<"chapter"> }> = (p) =>
  p.v.hit ? <ChapterHit {...p} /> : look.chapter === "stack" ? <ChapterStack {...p} /> : <ChapterGlow {...p} />;

// A full-frame chapter card set like the hero stat, complete on the cut. With `of`, a row of marks
// under it shows where this section sits: done ones half ink, this one long in the accent, the rest faint.
const ChapterHit: React.FC<Props & { v: V<"chapter"> }> = (p) => {
  const { shot, time, w, h, v } = p;
  const here = parseInt(v.number, 10);
  const row = v.of && here >= 1 ? 150 : 0;
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, bottom: row }}>
        <StatVisual {...p} h={h - row} v={{ kind: "stat", value: v.number, label: v.label, hit: true }} />
      </div>
      {row > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, display: "flex", justifyContent: "center" }}>
          <Journey tone={shot.tone} n={v.of!} here={here} time={time} start={shot.start} width={Math.min(760, w - 80)} />
        </div>
      )}
    </div>
  );
};

// The journey through a video's sections: stops on one track, numbered. Done stops are filled, the
// current one is the accent, the rest are hollow. On a chapter card a marker travels along the track
// from the last stop to this one as the card lands (Owain, 2026-10-25: "show the journey as a
// timeline ... moving on a journey from 1 to 6"). With `here` 0 (the intro), the stops pop in one
// after another from `start`, as the whole route is named.
export const Journey: React.FC<{ tone?: Tone; n: number; here: number; time: number; start: number; width: number }> = ({ tone, n, here, time, start, width }) => {
  const c = usePal(tone);
  if (n <= 1) return null;
  const gap = width / (n - 1);
  const x = (i: number) => i * gap;
  const intro = here === 0;
  // Chapter card: travel from the previous stop to this one. Intro: the track draws across.
  const travel = intro ? prog(time, start, 0.12 * n + 0.3) : prog(time, start + 0.1, 0.7);
  const head = intro ? travel * x(n - 1) : x(Math.max(0, here - 2)) + (x(here - 1) - x(Math.max(0, here - 2))) * travel;
  return (
    <div style={{ position: "relative", width, height: 96 }}>
      <div data-qc="mark" style={{ position: "absolute", left: 0, top: 26, width, height: 3, borderRadius: 2, background: c.ink, opacity: 0.14 }} />
      <div style={{ position: "absolute", left: 0, top: 26, width: head, height: 3, borderRadius: 2, background: intro ? c.ink : c.accent, opacity: intro ? 0.5 : 0.9 }} />
      {Array.from({ length: n }, (_, i) => {
        const stop = i + 1;
        const appear = intro ? prog(time, start + 0.12 * i, 0.3) : 1;
        const done = !intro && stop < here;
        const now = !intro && stop === here;
        const arrived = now ? prog(time, start + 0.6, 0.3) : 1;
        const r = now ? 13 + 4 * arrived : 10;
        return (
          <React.Fragment key={i}>
            <div
              data-qc="mark"
              style={{
                position: "absolute",
                left: x(i) - r,
                top: 27.5 - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                boxSizing: "border-box",
                background: now ? c.accent : done ? c.ink : c.bg,
                border: now ? "none" : `3px solid ${c.ink}`,
                opacity: (done ? 0.75 : now ? 1 : intro ? 0.9 : 0.3) * appear,
                scale: String(0.6 + 0.4 * appear),
              }}
            />
            <div style={{ position: "absolute", left: x(i) - 40, width: 80, top: 56, textAlign: "center", fontFamily: t.sans, fontWeight: now ? 700 : 500, fontSize: 24, letterSpacing: 1, color: c.ink, opacity: (now ? 1 : done ? 0.6 : intro ? 0.7 : 0.3) * appear }}>
              {String(stop).padStart(2, "0")}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// The route of a video at its promise ("the six levels of ..."): a title over the journey track,
// whose stops pop in one after another on the anchor word.
const JourneyVisual: React.FC<Props & { v: V<"journey"> }> = ({ shot, time, w, h, v }) => {
  const c = usePal(shot.tone);
  const at = v.times?.[0] ?? shot.start;
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 70 }}>
      <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: 84, letterSpacing: "-0.03em", lineHeight: 1.05, color: c.ink, textAlign: "center", maxWidth: w - 40, textWrap: "balance" }}>{v.title}</div>
      <div style={{ scale: "1.25", transformOrigin: "center top" }}>
        <Journey tone={shot.tone} n={v.of} here={0} time={time} start={at} width={Math.min(620, w - 160)} />
      </div>
    </div>
  );
};

// Focus stack (Ivory): a huge numeral held soft and blurred behind one sharp word, both drifting
// slowly at different speeds, so the frame has depth without any light effects.
const ChapterStack: React.FC<Props & { v: V<"chapter"> }> = ({ shot, time, w, h, v }) => {
  const c = usePal(shot.tone);
  const back = prog(time, shot.start, 1.1);
  const word = prog(time, shot.start + 0.25, 0.7);
  const rule = prog(time, shot.start + 0.15, 0.6);
  const drift = interpolate(time, [shot.start, shot.end], [0, 1], clamp);
  const label = v.label.toLowerCase();
  const pad = style.space.panelX;
  const size = Math.min(150, (w - pad * 2) / Math.max(4, label.length * style.font.sansWidth));
  const big = Math.min(h * 0.95, w * 1.05);
  // Off-centre, unlike Noske's centred stack: the blurred numeral sits high and right, bleeding off
  // the frame (not clipped at the panel, which would leave a hard edge), and the word is set left on
  // the margin under a short sage rule.
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <div
        data-qc="ambient"
        style={{
          position: "absolute",
          right: -w * 0.12,
          top: h * 0.06,
          fontFamily: t.serif,
          fontStyle: "italic",
          fontSize: big,
          lineHeight: 1,
          color: c.ink,
          opacity: 0.42 * back,
          filter: `blur(${20 + (1 - back) * 20}px)`,
          scale: String(1.08 - 0.08 * back + 0.05 * drift),
          translate: `0 ${-drift * 18}px`,
        }}
      >
        {v.number.replace(/^0/, "")}
      </div>
      <div style={{ position: "absolute", left: pad, top: h * 0.54 }}>
        <div style={{ width: 72 * rule, height: 4, background: c.accent, marginBottom: 34 }} />
        <div
          style={{
            fontFamily: t.sans,
            fontWeight: 800,
            fontSize: size,
            letterSpacing: -size * 0.045,
            lineHeight: 1,
            color: c.ink,
            whiteSpace: "nowrap",
            opacity: word,
            filter: `blur(${(1 - word) * style.motion.blur}px)`,
            translate: `0 ${(1 - word) * 20 - drift * 6}px`,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

const ChapterGlow: React.FC<Props & { v: V<"chapter"> }> = ({ shot, time, w, h, v }) => {
  const glow = prog(time, shot.start, 0.9);
  const num = prog(time, shot.start + 0.05, 0.55);
  const label = prog(time, shot.start + 0.3, 0.5);
  const c = usePal(shot.tone);
  const d = Math.min(w * 1.05, h * 0.95);
  return (
    <div style={{ position: "relative", width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div
        style={{
          position: "absolute",
          left: (w - d) / 2,
          top: (h - d) / 2,
          width: d,
          height: d,
          borderRadius: d,
          // Flat: no glow behind the number, in either tone.
          background: "transparent",
          opacity: glow,
          scale: String(0.7 + 0.3 * glow + 0.04 * interpolate(time, [shot.start, shot.end], [0, 1], clamp)),
        }}
      />
      <div
        style={{
          position: "relative",
          fontFamily: t.display,
          fontWeight: 400,
          fontSize: 340,
          lineHeight: 0.9,
          letterSpacing: 340 * style.type.display.tracking,
          color: c.ink,
          fontVariantNumeric: "tabular-nums",
          opacity: num,
          filter: `blur(${(1 - num) * 18}px)`,
          scale: String(1.12 - 0.12 * num),
        }}
      >
        {v.number}
      </div>
      <div style={{ position: "relative", fontFamily: t.sans, fontWeight: 500, fontSize: 36, letterSpacing: 16, paddingLeft: 16, textTransform: "uppercase", color: c.muted, opacity: label, translate: `0 ${(1 - label) * 16}px` }}>
        {v.label}
      </div>
    </div>
  );
};

// The kit's laid-out kinds (effects/clean/code.tsx, flow.tsx) draw in the reel palette's colours; off
// a clean reel they take the shot's tone: the light palette, or on dark the video's own dark. On
// YouTube that is Graphite or Black, never the reels' forest green (Owain: YouTube is "never dark green").
const laidPalette = (tone: Tone | undefined, theme: SoftTheme): Palette => {
  if (tone !== "dark") return PALETTES.light;
  if (!theme.graphite) return PALETTES.forest;
  const c = pal("dark", theme);
  return { name: "forest", stage: c.bg, diagram: c.card, card: c.bg, text: c.ink, line: c.ink, accent: c.accent, dim: c.muted, faint: c.faint, node: { fill: c.card, sub: c.muted, accentFill: c.chip } };
};
const Laid: React.FC<Props & { v: V<"code"> | V<"flow"> | V<"prompt"> | V<"doc"> | V<"gallery"> | V<"float"> }> = ({ slug, shot, time, w, h, v, room }) => {
  const theme = useSoftTheme();
  return (
    <PaletteContext.Provider value={laidPalette(shot.tone, theme)}>
      <div style={{ position: "relative", width: w, height: h }}>
        <LaidView v={v} time={time} start={shot.start} end={shot.end} w={w} h={h} slug={slug} room={room} />
      </div>
    </PaletteContext.Provider>
  );
};

export const VisualView: React.FC<Props & { v: ResolvedVisual }> = (p) => {
  const v = p.v;
  switch (v.kind) {
    case "image": return <ImageVisual {...p} v={v} />;
    case "custom":
    case "cli":
    case "claudeapp":
    case "grokbot":
      return <div style={{ position: "relative", width: p.w, height: p.h, overflow: "hidden" }}><UiVisual shot={p.shot} time={p.time} box={{ width: p.w, height: p.h }} /></div>;
    case "video": return <VideoVisual {...p} v={v} />;
    case "logos": return <LogosVisual {...p} v={v} />;
    case "title": return <TitleVisual {...p} v={v} />;
    case "list": return <ListVisual {...p} v={v} />;
    case "steps": return <StepsVisual {...p} v={v} />;
    case "compare": return <CompareVisual {...p} v={v} />;
    case "stat": return <StatVisual {...p} v={v} />;
    case "journey": return <JourneyVisual {...p} v={v} />;
    case "cta": return <CtaVisual {...p} v={v} />;
    case "chapter": return <ChapterVisual {...p} v={v} />;
    case "flow":
    case "code":
    case "prompt":
    case "doc":
    case "gallery":
    case "float":
      return <Laid {...p} v={v} />;
    case "grid": return <GridVisual {...p} v={v} />;
    case "funnel": return <FunnelVisual {...p} v={v} />;
    case "type": return <TypeVisual {...p} v={v} />;
    case "words": return <WordsVisual {...p} v={v} />;
    case "focus": return <FocusVisual {...p} v={v} />;
    case "map": return <MapVisual {...p} v={v} />;
    case "shift": return <ShiftVisual {...p} v={v} />;
    // Drawn over the speaker's picture by the 16:9 composition (src/Wide.tsx), not in a panel.
    case "lower": return null;
    case "chart": return <ChartVisual {...p} v={v} />;
    case "pipeline": return <PipelineVisual {...p} v={v} />;
    case "constraint": return <ConstraintVisual {...p} v={v} />;
    case "agenda": return <AgendaCard {...p} v={v} />;
    case "beforeafter": return <BeforeAfterCard {...p} v={v} />;
    case "kpi": return <KpiCard {...p} v={v} />;
    case "matrix": return <MatrixCard {...p} v={v} />;
    case "timeline": return <TimelineCard {...p} v={v} />;
    case "levels": return <LevelsCard {...p} v={v} />;
    case "checklist": return <ChecklistCard {...p} v={v} />;
    case "quote": return <QuoteCard {...p} v={v} />;
    case "logowall": return <LogowallCard {...p} v={v} />;
    case "bento": return <BentoCard {...p} v={v} />;
    case "windows": return <WindowsVisual {...p} v={v} />;
    case "ring": return <RingCard {...p} v={v} />;
    case "meter": return <MeterCard {...p} v={v} />;
    case "waffle": return <WaffleCard {...p} v={v} />;
  }
};
