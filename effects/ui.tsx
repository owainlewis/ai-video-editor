// Full-frame and panel moments that draw themselves: the app mock-ups (./apps: `cli`, `claudeapp`,
// `grokbot`, the real products drawn to move) and `custom`, a one-off graphic from ./custom.
// Words come from the real source; the chrome is the product's own.
import React from "react";
import { AbsoluteFill } from "remotion";
import type { ResolvedShot } from "../engine/schema";
import type { V } from "./soft";
import { CUSTOM, STILL } from "./custom";
import { BoxCtx, useBox } from "./apps/kit";
import { ClaudeApp } from "./apps/claude";
import { Cli } from "./apps/cli";
import { GrokBot } from "./apps/grokbot";

type Props = { shot: ResolvedShot; time: number };

// ---------- custom: a one-off graphic for this video, from effects/custom/ ----------
const Custom: React.FC<Props & { v: V<"custom"> }> = ({ shot, time, v }) => {
  const box = useBox();
  const C = CUSTOM[v.name];
  if (!C) throw new Error(`no custom graphic "${v.name}" in effects/custom/index.ts`);
  // A slow push across the shot, so a bespoke graphic never sits still.
  const push = STILL.has(v.name) ? 1 : 1 + 0.06 * Math.min(1, Math.max(0, (time - shot.start) / Math.max(0.5, shot.end - shot.start)));
  return (
    <AbsoluteFill style={{ scale: String(push) }}>
      <C shot={shot} time={time} props={v.props} times={v.times ?? []} {...box} />
    </AbsoluteFill>
  );
};

export const UI_KINDS = new Set(["custom", "cli", "claudeapp", "grokbot"]);
// `box` draws the moment inside a split's panel instead of the whole frame.
export const UiVisual: React.FC<Props & { box?: { width: number; height: number } }> = ({ shot, time, box }) => {
  const v = shot.visual!;
  const el =
    v.kind === "custom" ? <Custom shot={shot} time={time} v={v} />
    : v.kind === "cli" ? <Cli shot={shot} time={time} v={v} />
    : v.kind === "claudeapp" ? <ClaudeApp shot={shot} time={time} v={v} />
    : v.kind === "grokbot" ? <GrokBot shot={shot} time={time} v={v} />
    : null;
  return box ? <BoxCtx.Provider value={{ ...box, panel: true }}>{el}</BoxCtx.Provider> : el;
};
