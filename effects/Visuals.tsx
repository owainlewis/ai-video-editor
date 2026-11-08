import { FocusVisual, MapVisual, ShiftVisual, WordsVisual } from "./house";
import React from "react";
import { Video } from "@remotion/media";
import { UiVisual } from "./ui";
import { Img, interpolate } from "remotion";
import { cameraProgress, frameRect, TRANSITION } from "./camera";
import { zoomAt } from "../engine/resolve";
import { clamp, ease, t } from "./theme";
import { style } from "./style";
import { markColor } from "./motion";
import { FunnelVisual, GridVisual, isBlack, pal, prog, SoftAccented, src, TypeVisual, type Tone } from "./soft";
import { ChartVisual, ConstraintVisual, PipelineVisual } from "./elements";
import { look } from "./style";
import { BrowserChrome, chromeHeight, WindowsVisual } from "./browser";
import { AgendaCard, BeforeAfterCard, BentoCard, ChecklistCard, KpiCard, LevelsCard, LogowallCard, MatrixCard, MeterCard, QuoteCard, RingCard, TimelineCard, WaffleCard } from "./cards";
import type { ResolvedShot, ResolvedVisual } from "../engine/schema";

type Props = { slug: string; shot: ResolvedShot; time: number; w: number; h: number; filter?: string; bleed?: boolean };
type V<K extends ResolvedVisual["kind"]> = Extract<ResolvedVisual, { kind: K }> & { times?: number[]; size?: [number, number] };


// Colours for a designed graphic in the shot's tone. On paper the hairline and shadow are the split
// canvas's own (as they always were); on graphite everything comes from the dark tone.
const surface = (tone?: "light" | "dark") => {
  const c = pal(tone);
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
  // On a scene or split the card is only as tall as the region being shown, so the words under discussion
  // are large and nothing unrelated from the page sits around them.
  // Split panels too (Owain, 2026-10-25: "the text positioning is really off"): a paragraph card
  // shows that paragraph, not half-lines of the page cut off above and below it.
  if ((shot.layout === "scene" || shot.layout === "split") && v.from && (v.mat || v.label || v.lift)) return <MattedImage {...props} />;
  if ((shot.layout === "scene" || shot.layout === "split") && v.from) {
    const [iw, ih] = v.size ?? [1600, 1000];
    const tall = (r: number[]) => (w * r[3] * ih) / (r[2] * iw);
    // A browser keeps a window's shape (at least 62% of the panel) with its bar on top; the page
    // around the region fills the rest, so it reads as the site, not a strip cut from it.
    const region = Math.max(tall(v.from), tall(v.to ?? v.from));
    const cardH = v.frame === "browser" ? Math.min(h, Math.max(h * 0.62, region + chromeHeight(w))) : Math.min(h, Math.max(260, region));
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
  const cardH = Math.min(h - pad * 2 - labelH, Math.max(240, tall(v.from!), tall(v.to ?? v.from!)));
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
  const pad = v.frame === "none" ? 0 : 0;
  const vw = w - pad * 2;
  const vh = h - chrome - pad * 2;
  // Default camera: the top of the image at full width, easing slightly closer.
  const topRect: [number, number, number, number] = [0, 0, 1, Math.min(1, (vh / vw) * (iw / ih))];
  const from = v.from ?? topRect;
  const to = v.to ?? [from[0] + from[2] * 0.03, from[1] + from[3] * 0.03, from[2] * 0.94, from[3] * 0.94];
  // One camera move: the rect eases from `from` to `to` on the shared camera curve, and holds
  // while a shared-element transition is landing. The card itself never moves.
  const p = cameraProgress(shot.start, shot.end, time, shot.enter ? TRANSITION : 0);
  const rect = from.map((a, i) => a + (to[i] - a) * p) as [number, number, number, number];
  // The rect must stay visible; the camera fills the rest of the panel with the page around it.
  const { k, left, top } = frameRect(rect, iw, ih, vw, vh);
  const scene = shot.layout === "scene";
  const c = pal(shot.tone);

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
          {/* Callouts: a label above the highlighted region, joined by a short line. */}
          {v.highlight.map((hl, i) => {
            if (!hl.label) return null;
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
  // A synced screen recording: locked, so the page stays sharp and still. It fits the width and hangs
  // from the top, so the page's header always shows and any extra height runs off the bottom.
  if (v.sync) {
    const [vw0, vh0] = v.size ?? [w, h];
    const full = Math.max(h, (w * vh0) / vw0);
    const z = zoomAt(v.zooms ?? [], time, h / full);
    return (
      <div style={{ width: w, height: h, overflow: "hidden" }}>
        <div style={{ width: w, height: full, transformOrigin: "0 0", transform: `translate(${z.tx * w}px, ${z.ty * full}px) scale(${z.s})` }}>
          <Video src={src(slug, v.src)} muted trimBefore={Math.round(shot.start * 30)} objectFit="cover" style={{ width: w, height: full }} />
        </div>
      </div>
    );
  }
  // On a scene the clip sits in a card at its own shape with a locked camera; the clip is the motion.
  if (shot.layout === "scene") {
    const c = pal(shot.tone);
    const [vw0, vh0] = v.size ?? [16, 9];
    const cw = Math.min(w, (h * vw0) / vh0);
    const ch = (cw * vh0) / vw0;
    return (
      <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: cw, height: ch, overflow: "hidden", borderRadius: 22, boxShadow: c.shadow, background: c.card }}>
          <Video src={src(slug, v.src)} muted loop={v.loop} playbackRate={v.rate} trimBefore={Math.round(v.start * 30)} objectFit="cover" style={{ width: "100%", height: "100%" }} />
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
        trimBefore={Math.round(v.start * 30)}
        objectFit="cover"
        style={{ width: "100%", height: "100%", scale: String(1.02 + 0.05 * p), filter }}
      />
    </div>
  );
};

// Official logos on white tiles. Each one lands on its spoken word.
const LogosVisual: React.FC<Props & { v: V<"logos"> }> = ({ slug, shot, time, w, h, v }) => {
  const c = surface(shot.tone);
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
  const size = Math.min(62, Math.floor((w - 80) / (Math.max(...lines) * 0.47)));
  const c = pal(shot.tone);
  let k = 0;
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${size * 0.18}px ${size * 0.26}px`, maxWidth: w - 80 }}>
        {words.map((word, i) => {
          if (word === "//") return <span key={i} style={{ flexBasis: "100%", height: 0 }} />;
          const accent = word.startsWith("*");
          const p = v.words ? prog(time, v.words[i] - 0.05, 0.55) : prog(time, shot.start + 0.3 + 0.09 * k++, 0.7);
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
  if (v.cine) return <CineTitle shot={shot} time={time} w={w} h={h} v={v} slug="" />;
  const words = v.text.split(/\s+/);
  const len = v.text.replace(/\*/g, "").length;
  // "//" in the text is a line break the plan chose; the type is then sized to the longest line.
  const lines = v.text.replace(/\*/g, "").split("//").map((l) => l.trim().length);
  const size = lines.length > 1 ? Math.min(132, Math.floor((w - 40) / (Math.max(...lines) * 0.56))) : len > 40 ? 78 : len > 34 ? 92 : len > 20 ? 112 : 132;
  let k = 0;
  const c = pal(shot.tone);
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
          const accent = word.startsWith("*") && (!v.words || isBlack());
          const marked = !!v.words && !isBlack() && markedAt(words, i);
          const m = marked ? markIndex(words, i) : { n: 0, of: 1 };
          // Each marked word is swept as it is said, so the beat lands even when the card cuts away
          // right after the line.
          const sweep = marked && v.words ? prog(time, v.words[i] + 0.1, 0.3) : 0;
          // Synced: each word lands as it is said (kinetic type, after the product promos Owain sent).
          const p = v.words ? prog(time, v.words[i], 0.3) : prog(time, shot.start + 0.06 * k++, 0.4);
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
  const c = surface(shot.tone);
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
  const c = surface(shot.tone);
  const n = v.items.length;
  const times = v.times ?? v.items.map((_, i) => shot.start + i * 0.3);
  const gap = Math.min(250, (h - (v.title ? 140 : 0)) / n);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 30 }}>
      {v.title && (
        <div style={{ fontFamily: t.display, fontWeight: style.type.display.weight, fontSize: 84, letterSpacing: 84 * style.type.display.tracking, color: c.ink, marginBottom: 60, opacity: prog(time, shot.start) }}>
          <Accented text={v.title} />
        </div>
      )}
      <div style={{ position: "relative", height: gap * n }}>
        {v.items.map((it, i) => {
          const p = prog(time, times[i], 0.45);
          const line = i < n - 1 ? interpolate(time, [times[i] + 0.1, times[i + 1] ?? times[i] + 0.6], [0, 1], { ...clamp, easing: ease }) : 0;
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
  const c = surface(shot.tone);
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
  const c = surface(shot.tone);
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

// A terminal that types each line on its spoken word.
const TerminalVisual: React.FC<Props & { v: V<"terminal"> }> = ({ shot, time, w, h, v }) => {
  const times = v.times ?? v.lines.map((_, i) => shot.start + 0.2 + i * 0.6);
  const enter = prog(time, shot.start, 0.35);
  // Commands never wrap: the type shrinks until the longest line (with its prompt) fits.
  const fs = Math.min(46, (w - 96) / ((Math.max(...v.lines.map((l) => l.text.length)) + 2) * 0.61));
  return (
    <div style={{ width: w, minHeight: h * 0.5, borderRadius: 26, background: t.terminal, boxShadow: t.shadow, overflow: "hidden", translate: `0 ${(1 - enter) * 30}px` }}>
      <div style={{ height: 66, display: "flex", alignItems: "center", gap: 12, padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c, opacity: 0.85 }} />
        ))}
        {v.title && <div style={{ marginLeft: 16, fontFamily: t.sans, fontSize: 24, color: "rgba(255,255,255,0.5)" }}>{v.title}</div>}
      </div>
      <div style={{ padding: "44px 48px", display: "flex", flexDirection: "column", gap: 34 }}>
        {v.lines.map((ln, i) => {
          const at = times[i];
          const typed = Math.floor(Math.max(0, (time - at) * 38));
          if (time < at) return null;
          const out = ln.text.startsWith(">");
          // A line after one ending in "\\" continues that command, so it has no prompt.
          const cont = i > 0 && v.lines[i - 1].text.trimEnd().endsWith("\\");
          const text = out ? ln.text.slice(1).trim() : ln.text;
          const shown = out ? text : text.slice(0, typed);
          const cursor = !out && typed < text.length + 8 && Math.floor(time * 2.5) % 2 === 0;
          return (
            <div key={i} style={{ fontFamily: t.mono, fontSize: fs, lineHeight: 1.28, color: out ? "rgba(255,255,255,0.55)" : "#F4F2EE", whiteSpace: "pre", marginTop: cont ? -26 : 0 }}>
              {!out && <span style={{ color: "#8FA8E8" }}>{cont ? "  " : "$ "}</span>}
              {shown}
              {cursor && <span style={{ background: "#F4F2EE", color: "transparent" }}>_</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// A chat input where a prompt types itself out, like the real app.
const PromptVisual: React.FC<Props & { v: V<"prompt"> }> = ({ shot, time, w, h, v }) => {
  const c = surface(shot.tone);
  const at = v.times?.[0] ?? shot.start + 0.2;
  const typed = Math.floor(Math.max(0, (time - at) * 32));
  const shown = v.text.slice(0, typed);
  const done = typed >= v.text.length;
  const enter = prog(time, shot.start, 0.35);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36, translate: `0 ${(1 - enter) * 30}px` }}>
      <div style={{ fontFamily: t.serif, fontSize: 64, color: c.ink, textAlign: "center" }}>{v.app}</div>
      <div style={{ borderRadius: 32, background: c.card, border: `1.5px solid ${c.line}`, boxShadow: c.shadow, padding: "36px 40px 28px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ minHeight: 120, fontFamily: t.sans, fontSize: 46, lineHeight: 1.3, color: c.ink, whiteSpace: "pre-wrap" }}>
          {shown || <span style={{ color: c.muted }}>Reply to {v.app}...</span>}
          {!done && Math.floor(time * 2.5) % 2 === 0 && <span style={{ borderLeft: `3px solid ${c.ink}`, marginLeft: 2 }} />}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: done ? c.accent : c.faint, color: done ? c.bg : c.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.sans, fontWeight: 700, fontSize: 36 }}>↑</div>
        </div>
      </div>
    </div>
  );
};

// The end card: what to comment, what they get, and the resource itself when there is one.
const CtaVisual: React.FC<Props & { v: V<"cta"> }> = ({ slug, shot, time, w, h, v }) => {
  const c = surface(shot.tone);
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
  const c = pal(tone);
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
  const c = pal(shot.tone);
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
  const c = pal(shot.tone);
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
  const c = pal(shot.tone);
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

type Pt = { x: number; y: number };
// A point on a cubic curve, so a dot and a chip can ride along an edge as it draws.
const bezier = (a: Pt, b: Pt, c: Pt, d: Pt, u: number): Pt => {
  const m = 1 - u;
  return {
    x: m * m * m * a.x + 3 * m * m * u * b.x + 3 * m * u * u * c.x + u * u * u * d.x,
    y: m * m * m * a.y + 3 * m * m * u * b.y + 3 * m * u * u * c.y + u * u * u * d.y,
  };
};

// How parts talk: cards land on their words, then the lines between them draw, a dot leading
// each line and a chip (what is passed) riding along it. The card a line reaches takes the accent.
const FlowVisual: React.FC<Props & { v: V<"flow"> }> = ({ shot, time, w, h, v }) => {
  const c = pal(shot.tone);
  const n = v.nodes.length;
  const times = v.times ?? [...v.nodes.map((_, i) => shot.start + i * 0.15), ...v.edges.map((_, i) => shot.start + 0.5 + i * 0.5)];
  const row = v.root ? v.nodes.slice(1) : v.nodes;
  const gap = 44;
  // On a full-frame scene, two or three nodes stack top to bottom, large, to use the tall frame.
  const stack = shot.layout === "scene" && !v.root && n <= 3;
  const cw = stack ? Math.min(780, w) : Math.min(v.root ? 440 : 520, (w - gap * (row.length - 1)) / row.length);
  const title = stack ? 64 : Math.max(38, Math.min(52, cw * 0.1));
  const line = stack ? 38 : Math.max(28, Math.min(34, cw * 0.07));
  const vgap = 190;
  const cardH = (nodes: typeof v.nodes) => 92 + title * 1.3 + Math.max(0, ...nodes.map((nd) => nd.lines.length)) * line * 1.9 + 36;
  const dip = 190;
  const rootW = Math.min(560, w * 0.6);
  const rootH = v.root ? cardH(v.nodes.slice(0, 1)) : 0;
  const rowH = cardH(row);
  const total = v.root ? rootH + 210 + rowH : rowH + dip;
  const top0 = Math.max(0, (h - total) / 2);
  const rowTop = v.root ? top0 + rootH + 210 : top0;
  const rowLeft = (w - (cw * row.length + gap * (row.length - 1))) / 2;
  const stackTop = Math.max(0, (h - (rowH * n + vgap * (n - 1))) / 2);
  const boxes = v.nodes.map((_, i) => {
    if (stack) return { x: (w - cw) / 2, y: stackTop + i * (rowH + vgap), w: cw, h: rowH };
    if (v.root && i === 0) return { x: (w - rootW) / 2, y: top0, w: rootW, h: rootH };
    const k = v.root ? i - 1 : i;
    return { x: rowLeft + k * (cw + gap), y: rowTop, w: cw, h: rowH };
  });
  const curve = (from: number, to: number): [Pt, Pt, Pt, Pt] => {
    const a = boxes[from];
    const b = boxes[to];
    if (v.root || stack) {
      const down = a.y < b.y;
      const p0 = { x: a.x + a.w / 2, y: down ? a.y + a.h : a.y };
      const p3 = { x: b.x + b.w / 2, y: down ? b.y : b.y + b.h };
      const s = down ? 1 : -1;
      return [p0, { x: p0.x, y: p0.y + s * 110 }, { x: p3.x, y: p3.y - s * 110 }, p3];
    }
    const p0 = { x: a.x + a.w / 2, y: a.y + a.h };
    const p3 = { x: b.x + b.w / 2, y: b.y + b.h };
    return [p0, { x: p0.x, y: p0.y + dip }, { x: p3.x, y: p3.y + dip }, p3];
  };
  const edges = v.edges.map((e, j) => {
    const at = times[n + j];
    const draw = prog(time, at, 0.7);
    return { e, at, draw, pts: curve(e.from, e.to) };
  });

  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {edges.map(({ draw, pts: [a, b, q, d] }, j) =>
          draw <= 0 ? null : (
            <path
              key={j}
              d={`M${a.x} ${a.y} C${b.x} ${b.y} ${q.x} ${q.y} ${d.x} ${d.y}`}
              pathLength={1}
              fill="none"
              stroke={c.accent}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="1 1"
              strokeDashoffset={1 - draw}
            />
          ),
        )}
      </svg>
      {v.nodes.map((nd, i) => {
        const b = boxes[i];
        const p = prog(time, times[i], 0.5);
        // A card takes the accent once a line reaches it.
        const reached = Math.max(0, ...edges.filter((x) => x.e.to === i).map((x) => prog(time, x.at + 0.6, 0.3)));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              borderRadius: 28,
              background: c.card,
              border: `${1.5 + reached * 1.5}px solid ${reached > 0.5 ? c.accent : c.line}`,
              boxShadow: c.shadow,
              padding: "22px 30px",
              boxSizing: "border-box",
              opacity: p,
              filter: `blur(${(1 - p) * 8}px)`,
              translate: `0 ${(1 - p) * 40}px`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, height: 30 }}>
              {[0, 1, 2].map((k) => (
                <div key={k} style={{ width: 11, height: 11, borderRadius: 6, background: c.faint }} />
              ))}
              {nd.kicker && <div style={{ marginLeft: 12, fontFamily: t.sans, fontWeight: 500, fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: c.muted }}>{nd.kicker}</div>}
            </div>
            <div style={{ marginTop: 22, fontFamily: t.sans, fontWeight: 700, fontSize: title, letterSpacing: -title * 0.03, lineHeight: 1.2, color: c.ink }}>
              <SoftAccented text={nd.title} c={c} />
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: line * 0.7 }}>
              {nd.lines.map((ln, k) => {
                const q = prog(time, times[i] + 0.25 + k * 0.22, 0.4);
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 16, opacity: q, translate: `${(1 - q) * 24}px 0` }}>
                    <div style={{ flex: "none", width: line * 0.9, height: line * 0.9, borderRadius: line, background: c.chip, color: c.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.sans, fontWeight: 700, fontSize: line * 0.55 }}>✓</div>
                    <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: line, letterSpacing: -0.3, lineHeight: 1.2, color: c.ink }}>{ln}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {edges.map(({ e, at, draw, pts }, j) => {
        if (draw <= 0) return null;
        // The dot leads the line as it draws, then rests where it landed.
        const head = bezier(...pts, draw);
        const ride = e.chip ? prog(time, at + 0.6, 1.2) : 0;
        const chip = bezier(...pts, 0.2 + 0.6 * ride);
        return (
          <React.Fragment key={`e${j}`}>
            {/* Once drawn, small dots keep travelling down the line: work moving between the parts. */}
            {draw >= 1 &&
              [0, 0.5].map((off) => {
                const u = (((time - at - 0.7) / 1.4 + off) % 1 + 1) % 1;
                const q = bezier(...pts, u);
                return <div key={off} style={{ position: "absolute", left: q.x - 6, top: q.y - 6, width: 12, height: 12, borderRadius: 6, background: c.accent, opacity: 0.8 * Math.sin(u * Math.PI) }} />;
              })}
            <div style={{ position: "absolute", left: head.x - 13, top: head.y - 13, width: 26, height: 26, borderRadius: 13, background: c.accent, border: `5px solid ${c.card}`, boxShadow: c.shadow }} />
            {e.chip && (
              <div
                style={{
                  position: "absolute",
                  left: chip.x,
                  top: chip.y,
                  translate: "-50% -50%",
                  padding: "12px 24px",
                  borderRadius: 16,
                  background: c.card,
                  border: `1px solid ${c.line}`,
                  boxShadow: c.shadow,
                  fontFamily: t.mono,
                  fontSize: 30,
                  color: c.ink,
                  whiteSpace: "nowrap",
                  opacity: prog(time, at + 0.5, 0.3),
                }}
              >
                {e.chip}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const VisualView: React.FC<Props & { v: ResolvedVisual }> = (p) => {
  const v = p.v;
  switch (v.kind) {
    case "image": return <ImageVisual {...p} v={v} />;
    case "custom":
    case "claudecode":
    case "search":
    case "tiers":
    case "compose":
    case "divisions":
    case "chips":
    case "runs":
      return <div style={{ position: "relative", width: p.w, height: p.h, overflow: "hidden" }}><UiVisual shot={p.shot} time={p.time} box={{ width: p.w, height: p.h }} /></div>;
    case "video": return <VideoVisual {...p} v={v} />;
    case "logos": return <LogosVisual {...p} v={v} />;
    case "title": return <TitleVisual {...p} v={v} />;
    case "list": return <ListVisual {...p} v={v} />;
    case "steps": return <StepsVisual {...p} v={v} />;
    case "compare": return <CompareVisual {...p} v={v} />;
    case "stat": return <StatVisual {...p} v={v} />;
    case "journey": return <JourneyVisual {...p} v={v} />;
    case "terminal": return <TerminalVisual {...p} v={v} />;
    case "prompt": return <PromptVisual {...p} v={v} />;
    case "cta": return <CtaVisual {...p} v={v} />;
    case "chapter": return <ChapterVisual {...p} v={v} />;
    case "flow": return <FlowVisual {...p} v={v} />;
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
