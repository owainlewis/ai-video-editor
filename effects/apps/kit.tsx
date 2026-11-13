// Parts shared by the app mock-ups: the box a mock-up is drawn in, the window and its entrance, the
// camera (the type size that fills the window, and a pan that follows the newest part), text
// measuring, typing, the caret, the shimmer a working line sweeps with, and inline `code` and **bold**.
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { easeInOut, lerp, prog } from "../motion";
import { t as type } from "../theme";

export const SANS = type.sans;
export const SERIF = type.serif;
// Terminals draw in a monospace, as the real ones do (JetBrains Mono is installed on this machine).
export const MONO = '"JetBrains Mono", "SF Mono", Menlo, monospace';

// The box a mock-up is drawn in: the whole frame, or a split's panel (then no stage of its own).
export const BoxCtx = React.createContext<{ width: number; height: number; panel: boolean } | null>(null);
export const useBox = () => {
  const cfg = useVideoConfig();
  return React.useContext(BoxCtx) ?? { width: cfg.width, height: cfg.height, panel: false };
};
type Box = { width: number; height: number; panel: boolean };
type Backdrop = "none" | "dots";

// Full frame, the window sits on a flat graphite stage; in a panel it is the panel. With `dots`, it
// sits on light paper with a fine dot grid (a card of its own inside a panel).
export const Stage: React.FC<{ children: React.ReactNode; backdrop?: Backdrop }> = ({ children, backdrop = "none" }) => {
  const { panel } = useBox();
  const dots = backdrop === "dots";
  return (
    <AbsoluteFill
      style={{
        background: dots ? "radial-gradient(circle, rgba(31,31,29,0.16) 1.6px, transparent 1.8px) 0 0 / 30px 30px, #F2F0EB" : panel ? undefined : "#141413",
        borderRadius: dots && panel ? 28 : 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// The window's size in its box. In a split's panel the window is the panel, edge to edge, as a
// camera crops a screen recording to the app; on the dots it sits inside a narrow paper margin; full
// frame it floats on the stage at 90% x 84% (under 85%, so QC reads text against the window).
export const windowSize = (box: Box, backdrop: Backdrop = "none", maxW = 1760) => {
  if (box.panel && backdrop !== "dots") return { winW: box.width, winH: box.height };
  if (box.panel) {
    const m = Math.round(Math.min(36, box.width * 0.04, box.height * 0.05));
    return { winW: box.width - 2 * m, winH: box.height - 2 * m };
  }
  return { winW: Math.min(box.width * 0.9, maxW), winH: box.height * 0.84 };
};

// Body type, in frame pixels: never under 30, so an app's words read on a phone; at most a size that
// still reads as the app, zoomed in as a camera would, and not as a poster. A tall window keeps its
// type at 36 or more and lets a long script scroll, as a camera stays close on the newest lines. A
// YouTube frame is seen larger, so its app stays nearer its own size.
// `scrolls` is how readily the view scrolls rather than shrink: a terminal's history scrolls (its
// newest lines are what matter), a chat a little, and a page (a list of bots, a bot's page) is shown
// whole whenever it fits at 30 px.
export const BODY_MIN = 30;
export const bodyRange = (box: Box, win: { winW: number; winH: number }, scrolls: "terminal" | "chat" | "page" = "page"): [number, number] => {
  const wide = !box.panel && box.width > box.height;
  const close = { terminal: 36, chat: 33, page: BODY_MIN }[scrolls];
  const lo = wide ? BODY_MIN : Math.min(close, Math.max(BODY_MIN, win.winH / 20));
  const hi = wide ? Math.min(38, win.winH / 21) : Math.min(46, win.winW / 21, win.winH / 12);
  return [lo, Math.max(lo, hi)];
};

// A pan that lands on a row: the smallest of `tops` at or past `y`, so the frame's top edge sits on
// a row's top and never shows half of one.
export const snap = (y: number, tops: number[]) => (y <= 0 ? 0 : (tops.filter((t) => t >= y - 0.5).sort((a, b) => a - b)[0] ?? y));

// The largest value in [lo, hi] for which `ok` holds (ok is true for small values, false past some
// point). If even `lo` fails, `lo`: the content then scrolls.
export const fit = (lo: number, hi: number, ok: (v: number) => boolean) => {
  if (ok(hi)) return hi;
  if (!ok(lo)) return lo;
  let [a, b] = [lo, hi];
  for (let k = 0; k < 12; k++) {
    const m = (a + b) / 2;
    if (ok(m)) a = m;
    else b = m;
  }
  return a;
};

// A camera pan: at each event's time it eases to that event's offset, from wherever it was.
export const pan = (time: number, events: { t: number; y: number }[], dur = 0.5) => {
  let y = 0;
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    if (time < e.t) break;
    y = lerp(y, e.y, easeInOut(Math.min(1, (time - e.t) / dur)));
  }
  return y;
};

// The window: rounded, with a fine edge and a soft shadow that sits well on the light stage and the
// dark one. It lands, then pushes in a little across the shot, never past its box.
export const Window: React.FC<{ w: number; h: number; r: number; bg: string; edge: string; time: number; start: number; end: number; children: React.ReactNode; column?: boolean }> = ({ w, h, r, bg, edge, time, start, end, children, column = true }) => (
  <div style={{ width: w, height: h, borderRadius: r, overflow: "hidden", background: bg, boxShadow: `0 0 0 1px ${edge}, 0 2px 6px rgba(0,0,0,0.14), 0 22px 60px rgba(0,0,0,0.26)`, display: "flex", flexDirection: column ? "column" : "row", position: "relative", ...enter(time, start, end) }}>
    {children}
  </div>
);

// The window lands: up from a little below, out of a soft blur, then a slow push across the shot
// that ends at full size, so a window that fills its panel never spills past it.
export const enter = (time: number, start: number, end: number): React.CSSProperties => {
  const k = prog(time, start, 0.45, easeInOut);
  const push = Math.min(1, Math.max(0, (time - start) / Math.max(1, end - start)));
  return { opacity: k, translate: `0 ${(1 - k) * 40}px`, scale: String(lerp(0.95, 0.985, k) + push * 0.015), filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined };
};

// The traffic lights, at a window's top left.
export const Lights: React.FC<{ s: number }> = ({ s }) => (
  <div style={{ display: "flex", gap: s * 0.75, flex: "0 0 auto" }}>
    {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
      <div key={c} style={{ width: s, height: s, borderRadius: s, background: c, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)" }} />
    ))}
  </div>
);

// Characters of `text` typed by `time`, starting at `at`, at `cps` characters a second.
export const typed = (text: string, time: number, at: number, cps: number) => text.slice(0, Math.max(0, Math.floor((time - at) * cps)));

// A block caret that blinks while idle and holds solid while typing.
export const Caret: React.FC<{ time: number; color: string; busy?: boolean; w?: string; h?: string; bar?: boolean }> = ({ time, color, busy, w = "0.6em", h = "1.2em", bar }) => (
  <span style={{ display: "inline-block", width: bar ? "0.09em" : w, minWidth: bar ? 3 : undefined, height: h, marginLeft: bar ? 2 : 0, verticalAlign: bar ? "-0.2em" : "-0.22em", background: color, opacity: busy || Math.floor(time * 1.9) % 2 === 0 ? 1 : 0 }} />
);

// A shimmer: a lighter band sweeping left to right through the letters, as a working line does. One
// inline run, so a flex row around it never spaces its letters apart.
export const Shimmer: React.FC<{ text: string; time: number; base: string; hi: string; speed?: number }> = ({ text, time, base, hi, speed = 14 }) => {
  const span = text.length + 8;
  const head = ((time * speed) % span) - 4;
  return (
    <span style={{ whiteSpace: "pre", color: base }}>
      {[...text].map((ch, i) => {
        const k = Math.max(0, 1 - Math.abs(i - head) / 3);
        return k > 0.05 ? <span key={i} style={{ color: mix(base, hi, k) }}>{ch}</span> : ch;
      })}
    </span>
  );
};

const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, k: number) => {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`;
};

// Text with `code` and **bold** spans, as segments.
export type Seg = { s: string; code?: boolean; bold?: boolean };
export const segs = (text: string): Seg[] => {
  const out: Seg[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > i) out.push({ s: text.slice(i, m.index) });
    out.push(m[1] !== undefined ? { s: m[1], code: true } : { s: m[2], bold: true });
    i = m.index + m[0].length;
  }
  if (i < text.length) out.push({ s: text.slice(i) });
  return out;
};
export const plain = (text: string) => segs(text).map((x) => x.s).join("");

// A label's size: never under 26 px, so QC never finds it small at 1080p.
export const px = (v: number) => Math.max(26, v);

// ---- measuring text, as the browser will set it ----
let ctx: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
// A run's width at 100 px in `family`, from the browser's own metrics (a rough guess outside one).
const width100 = (s: string, family: string, weight: number) => {
  const key = `${family}|${weight}|${s}`;
  let w = widths.get(key);
  if (w !== undefined) return w;
  if (ctx === undefined) ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (ctx) {
    ctx.font = `${weight} 100px ${family}`;
    w = ctx.measureText(s).width;
  } else w = s.length * (family === MONO ? 60 : 52);
  widths.set(key, w);
  return w;
};

// How many lines `text` wraps to at `size` px in `width` px: greedy on spaces, as the browser wraps,
// with `code` spans in the monospace at `codeScale` of the size. A little slack for `text-wrap: pretty`.
export const wrapLines = (text: string, width: number, size: number, family = SANS, codeScale = 0.92) => {
  const room = width * 0.97;
  let lines = 1;
  let x = 0;
  for (const g of segs(text)) {
    const fam = g.code ? MONO : family;
    const k = (g.code ? size * codeScale : size) / 100;
    const weight = g.bold ? 700 : 400;
    for (const word of g.s.split(/(?<= )/)) {
      if (!word) continue;
      const w = width100(word.trimEnd(), fam, weight) * k;
      const sp = word.endsWith(" ") ? width100(" ", fam, weight) * k : 0;
      if (x > 0 && x + w > room) {
        lines++;
        x = 0;
      }
      // A word wider than the line breaks across lines.
      if (w > room) {
        lines += Math.floor(w / room);
        x = w % room;
      } else x += w;
      x += sp;
    }
  }
  return lines;
};
// A single run's width at `size` px.
export const textWidth = (text: string, size: number, family = SANS, weight = 400) => (width100(text, family, weight) * size) / 100;

// The end of `text` that fits one line `width` px wide: what a one-line input shows as it scrolls
// along with the caret, so no letter is ever cut at its edge.
export const tail = (text: string, width: number, size: number, family = SANS) => {
  let s = text;
  while (s && textWidth(s, size, family) > width * 0.97) s = s.slice(Math.max(1, s.indexOf(" ", 1) > 0 && s.indexOf(" ", 1) < 12 ? s.indexOf(" ", 1) : 1));
  return s.replace(/^ /, "");
};
// The start of `text` that fits one line `width` px wide, with an ellipsis when cut.
export const clip = (text: string, width: number, size: number, family = SANS) => {
  if (textWidth(text, size, family) <= width * 0.97) return text;
  let s = text;
  while (s.length > 1 && textWidth(s + "…", size, family) > width * 0.97) s = s.slice(0, -1);
  return s.trimEnd() + "…";
};

// How visible a row is, from where it sits against the window's edges: a row the scroll has taken
// past the top edge, or not yet into view at the bottom, fades, so no line is ever seen cut.
export const inView = (top: number, h: number, scroll: number, room: number, u: number) =>
  Math.min(1, Math.max(0, 1 + (top - scroll) / (u * 0.5)), Math.max(0, 1 + (scroll + room - (top + h)) / (u * 0.5)));
