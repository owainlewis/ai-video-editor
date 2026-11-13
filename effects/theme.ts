import { Easing } from "remotion";
import { style } from "./style";

// Light editorial. Helvetica for structure, Signifier italic for one accent word.
// The values come from the active style's tokens (src/style.ts); this is the split canvas's view of them.
const paper = style.color.light;
export const t = {
  sans: style.font.sans,
  serif: style.font.serif,
  // Labels and numbers (Helvetica); `mono` is only for code.
  label: style.font.label,
  display: style.type.display.family,
  mono: style.font.code,
  canvas: paper.bg,
  card: paper.card,
  ink: paper.ink,
  muted: paper.muted,
  faint: paper.faint,
  line: style.color.split.line,
  accent: style.color.light.accent,
  highlight: style.color.split.highlight,
  terminal: style.color.terminal,
  shadow: style.color.split.shadow,
};

const W_ = 1080;
export const W = W_;
export const H = 1920;

// Split layout, 45 / 10 / 45 (Owain, 2026-11-13): the visual panel on top (0 to 864), a caption band
// (864 to 1056), the speaker below (1056 to 1920), so a caption never sits on dark footage.
export const BAND = { top: 864, height: 192 };
// "half" is a clean 50/50: visual on the top half, speaker edge to edge on the bottom half,
// captions low on the speaker. "inset" gives the visual about 60% of the frame and puts the
// speaker in a rounded window with a margin, captions on the seam.
export type SplitMode = "half" | "inset";
export type Box = { left: number; top: number; width: number; height: number; radius: number };
export const splitGeom = (mode: SplitMode) =>
  mode === "inset"
    ? { panelTop: 200, panelBottom: 1090, seam: 1165, speaker: { left: 60, top: 1240, width: W_ - 120, height: 620, radius: 40 } as Box }
    : { panelTop: 200, panelBottom: 920, seam: 1790, speaker: { left: 0, top: BAND.top + BAND.height, width: W_, height: 1920 - BAND.top - BAND.height, radius: 0 } as Box };
// The persistent header sits above the panel on split and media shots. Without a header
// the panel starts 50 px higher.
export const HEADER = { top: 64, height: 120 };
// Media layout: the visual fills most of the frame, caption below it.
export const MEDIA = { panelTop: 200, panelBottom: 1260, caption: 1400 };

export const ease = Easing.bezier(...style.motion.ease);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const gradeFilter = (g: { brightness: number; contrast: number; saturate: number }, dim = 1) => `brightness(${g.brightness * dim}) contrast(${g.contrast}) saturate(${g.saturate})`;
