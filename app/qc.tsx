// The QC page: one frame of a project's composition at full size, for `studio qc` to measure and
// screenshot in a headless browser. Nothing is rendered to video. qcSeek(frame) shows a frame and
// waits for fonts and footage; qcMeasure() reports every visible text and marked line or dot.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Thumbnail } from "@remotion/player";
import { component } from "./Gallery";
import { compositionFor } from "../effects/canvas";
import type { Resolved } from "../engine/schema";

declare global {
  interface Window {
    qcReady?: boolean;
    qcSeek?: (frame: number) => Promise<void>;
    qcMeasure?: () => unknown;
    // The message of a graphic that threw while rendering the current frame (cleared on each seek).
    qcError?: string | null;
    // The library check (`studio qc --library`): show this plan instead of a project's.
    qcLoad?: (r: Resolved) => Promise<void>;
  }
}

const slug = new URLSearchParams(location.search).get("slug") ?? "";
const nextPaint = () => new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok())));

const App: React.FC<{ r: Resolved }> = ({ r }) => {
  const [frame, setFrame] = useState(0);
  // An error boundary stays tripped until it remounts; after a crash the next seek remounts it.
  const [mount, setMount] = useState(0);
  const comp = compositionFor(r.canvas);
  useEffect(() => {
    window.qcSeek = async (f: number) => {
      if (window.qcError) (window.qcError = null), setMount((m) => m + 1);
      setFrame(f);
      await nextPaint();
      await document.fonts.ready;
      // Footage: wait for the video elements to have the frame, but never long.
      const until = performance.now() + 1500;
      while (performance.now() < until && [...document.querySelectorAll("video")].some((v) => v.readyState < 2)) await new Promise((ok) => setTimeout(ok, 50));
      await nextPaint();
    };
    window.qcMeasure = measure;
    window.qcReady = true;
  }, []);
  return (
    <Thumbnail
      key={mount}
      // A graphic that throws used to leave Remotion's small error badge, which QC measured as a
      // "⚠️" too small to read (2026-10-25). Now the crash itself is reported.
      errorFallback={({ error }) => {
        window.qcError = error?.message || String(error);
        return null;
      }}
      component={component(r)}
      inputProps={r}
      compositionWidth={comp.width}
      compositionHeight={comp.height}
      frameToDisplay={frame}
      durationInFrames={Math.max(1, Math.round(r.duration * r.fps))}
      fps={r.fps}
      style={{ width: comp.width, height: comp.height }}
    />
  );
};

// Effective opacity: an element is only as visible as all its ancestors.
const opacity = (el: Element | null) => {
  let o = 1;
  for (let e = el; e && e !== document.body; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity || "1");
  return o;
};

// The colour a word is drawn in. SVG text is painted with `fill`; its CSS `color` is whatever it
// inherits (black by default), which read as invisible on black (egm reel, 2026-11-05).
const textColor = (el: Element) => (el instanceof SVGElement ? getComputedStyle(el).fill : getComputedStyle(el).color);

// The block a word belongs to: the nearest ancestor laid out as a block or flex box. Kinetic titles
// set each word in its own inline-block span, so their lines are read from the flex box around them.
const blockOf = (el: Element): Element => {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const d = getComputedStyle(e).display;
    if (d === "block" || d === "list-item" || d === "flex" || d === "grid") return e;
  }
  return el;
};

const ctx = document.createElement("canvas").getContext("2d")!;

function measure() {
  const root = document.getElementById("root")!;
  const W = root.getBoundingClientRect().width, H = root.getBoundingClientRect().height;
  // Everything drawn (cards, dots, lines, svg shapes), for balance: is the graphic as a whole centred?
  const paint: number[][] = [];
  const texts: { text: string; box: number[]; size: number; opacity: number; color: string; block: number; under: string; clipped: boolean; label: boolean }[] = [];
  const marks: { box: number[]; opacity: number }[] = [];
  const edges: { points: number[][]; opacity: number }[] = [];
  const blocks = new Map<Element, number>();
  const words: { block: number; top: number; h: number }[] = [];
  for (const el of root.querySelectorAll("*")) {
    // Ambient motion (a marquee of names drifting past the frame edges) is texture, not text to read.
    if (el.closest('[data-qc="ambient"]')) continue;
    if (el.closest('[data-qc="canvas"]')) continue;
    const o = opacity(el);
    if (o < 0.05) continue;
    {
      const cs = getComputedStyle(el);
      const bgA = parseFloat((cs.backgroundColor.match(/[\d.]+/g) ?? [])[3] ?? (cs.backgroundColor.startsWith("rgb(") ? "1" : "0"));
      const drawn = (bgA > 0.05 && cs.backgroundColor !== "rgba(0, 0, 0, 0)") || parseFloat(cs.borderTopWidth) > 0 || el instanceof SVGGraphicsElement && !(el instanceof SVGSVGElement) || el.tagName === "IMG";
      const b = el.getBoundingClientRect();
      // Skip the canvas and footage itself: anything nearly as big as the frame.
      if (drawn && b.width && b.height && !(b.width > W * 0.85 && b.height > H * 0.85) && el.tagName !== "VIDEO") paint.push([b.left, b.top, b.width, b.height]);
    }
    if (el.getAttribute("data-qc") === "mark") {
      const b = el.getBoundingClientRect();
      if (b.width || b.height) marks.push({ box: [b.left, b.top, b.width, b.height], opacity: o });
    }
    // A diagram's strokes as points along what is drawn so far: a box cannot tell a label sitting on a
    // diagonal line from one beside it, or a label inside a ring from one across its outline.
    if (el.getAttribute("data-qc") === "edge" && el instanceof SVGGeometryElement) {
      const len = el.getTotalLength(), ctm = el.getScreenCTM()!;
      const [on, off] = (el.getAttribute("stroke-dasharray") ?? "").split(" ").map(Number);
      const drawn = off >= len * 0.99 ? on : len;
      const points: number[][] = [];
      for (let d = 0; d <= drawn; d += 6) {
        const p = el.getPointAtLength(d).matrixTransform(ctm);
        points.push([p.x, p.y]);
      }
      edges.push({ points, opacity: o });
    }
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent!.trim());
    if (!nodes.length) continue;
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    const scale = (el as HTMLElement).offsetWidth ? b.width / (el as HTMLElement).offsetWidth : 1;
    // The ink of the letters, not the line box: a text range's box includes the font's full ascent
    // and descent, which for huge numbers reaches far above and below the glyphs. The canvas measures
    // the real ink above and below the baseline.
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    const text = nodes.map((n) => n.textContent).join("").trim();
    const mt = ctx.measureText(text);
    const ink = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    for (const n of nodes) {
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((q) => q.width);
      for (const q of rects) {
        const base = q.bottom - mt.fontBoundingBoxDescent * scale;
        // On one line the canvas gives the letters' real left and right ink, which can reach past
        // the layout box (tight tracking) or stop short of it (side bearings, a trailing space).
        const one = rects.length === 1 && nodes.length === 1;
        ink.l = Math.min(ink.l, one ? q.left - mt.actualBoundingBoxLeft * scale : q.left);
        ink.r = Math.max(ink.r, one ? q.left + mt.actualBoundingBoxRight * scale : q.right);
        ink.t = Math.min(ink.t, base - mt.actualBoundingBoxAscent * scale);
        ink.b = Math.max(ink.b, base + mt.actualBoundingBoxDescent * scale);
      }
    }
    if (!isFinite(ink.l)) continue;
    // Cut with an ellipsis on purpose (a long URL path in a browser bar): what shows is its own box
    // ending in "…", not the whole text running on behind it.
    const ellipsis = cs.textOverflow === "ellipsis" && cs.overflowX !== "visible";
    if (ellipsis) (ink.l = Math.max(ink.l, b.left)), (ink.r = Math.min(ink.r, b.right));
    // Clipped: an ancestor that hides overflow cuts into the letters. Text it hides completely (a
    // rolling digit strip's other digits) is simply not shown, so it is skipped.
    let clipped = false, hidden = false;
    for (let e = el.parentElement; e && e !== root; e = e.parentElement) {
      const ov = getComputedStyle(e);
      if (ov.overflowX === "visible" && ov.overflowY === "visible") continue;
      const c = e.getBoundingClientRect();
      const ix = Math.min(ink.r, c.right) - Math.max(ink.l, c.left), iy = Math.min(ink.b, c.bottom) - Math.max(ink.t, c.top);
      if (ix <= 0 || iy <= 0) { hidden = true; break; }
      const cutX = !ellipsis && ov.overflowX !== "visible" && (ink.l < c.left - 1 || ink.r > c.right + 1);
      const cutY = ov.overflowY !== "visible" && (ink.t < c.top - 1 || ink.b > c.bottom + 1);
      if (cutX || cutY) clipped = true;
    }
    if (hidden) continue;
    const block = blockOf(el);
    if (!blocks.has(block)) blocks.set(block, blocks.size);
    const id = blocks.get(block)!;
    // What the text sits on: the nearest drawn background (a filled dot, a card), else the canvas.
    // A background as big as the frame is the composition's own (Wide's near-black root), not what
    // the text sits on: the canvas drawn over it is a sibling, so `bg` from the plan stands for it.
    // Judging every word against the root made dark type on Ivory read 1.2:1 (2026-11-02).
    let under = "";
    for (let e: Element | null = el; e && !under; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      const r = e.getBoundingClientRect();
      if (r.width > W * 0.85 && r.height > H * 0.85) continue;
      if (c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)" && !e.closest('[data-qc="canvas"]')) under = c;
    }
    texts.push({ label: el.getAttribute("data-qc") === "label", text: nodes.map((n) => n.textContent).join("").trim(), box: [ink.l, ink.t, ink.r - ink.l, ink.b - ink.t], size: parseFloat(getComputedStyle(el).fontSize) * scale, opacity: o, color: textColor(el), block: id, under, clipped });
    // Each word's line, to find a last line with a single word on it.
    for (const n of nodes) {
      const s = n.textContent!;
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const r = range.getBoundingClientRect();
        if (r.width) words.push({ block: id, top: r.top, h: r.height });
      }
    }
  }
  return { texts, marks, edges, words, paint };
}

const root = createRoot(document.getElementById("root")!);
if (slug)
  fetch(`/${slug}/build/edit.resolved.json`, { cache: "no-store" })
    .then((r) => r.json())
    .then((r: Resolved) => {
      // The light preview copy, as the editor plays it.
      const playable = { ...r, video: r.video && r.preview?.video ? r.preview.video : r.video, audio: null };
      root.render(<App r={playable} />);
    });
else {
  // One plan after another, each mounted fresh; ready again once the new one has mounted.
  let n = 0;
  window.qcLoad = async (r) => {
    window.qcReady = false;
    window.qcError = null;
    root.render(<App key={++n} r={r} />);
    while (!window.qcReady) await new Promise((ok) => setTimeout(ok, 20));
  };
  window.qcReady = true;
}
