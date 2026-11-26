// The kit's laid-out kinds, each sized to the box it is given: Clean.tsx draws them on reels, and
// ../Visuals.tsx on YouTube (where `chart` keeps the house look and `room` lets a diagram run to the
// frame's edge).
import React from "react";
import type { ResolvedVisual } from "../../engine/schema";
import { ChartView } from "./chart";
import { CodeView } from "./code";
import { DocView } from "./doc";
import { FlowView } from "./flow";
import { FloatView, GalleryView } from "./gallery";
import { PromptView } from "./prompt";

export type LaidKind = "code" | "flow" | "chart" | "prompt" | "doc" | "gallery" | "float";
export const isLaid = (v: ResolvedVisual): v is Extract<ResolvedVisual, { kind: LaidKind }> => ["code", "flow", "chart", "prompt", "doc", "gallery", "float"].includes(v.kind);

type Props = {
  v: ResolvedVisual;
  time: number;
  start: number;
  end?: number;
  w: number;
  h: number;
  slug?: string;
  room?: { l: number; t: number; r: number; b: number };
};

export const LaidView: React.FC<Props> = ({ v, time, start, end, w, h, slug, room }) => {
  switch (v.kind) {
    case "code":
      return <CodeView v={v} time={time} start={start} w={w} h={h} />;
    case "flow":
      return <FlowView v={v} time={time} start={start} end={end} w={w} h={h} slug={slug} room={room} />;
    case "chart":
      return <ChartView v={v} time={time} start={start} w={w} h={h} />;
    case "prompt":
      return <PromptView v={v} time={time} start={start} w={w} h={h} slug={slug} />;
    case "doc":
      return <DocView v={v} time={time} start={start} w={w} h={h} slug={slug} />;
    case "gallery":
      return <GalleryView v={v} time={time} start={start} w={w} h={h} slug={slug} />;
    case "float":
      return <FloatView v={v} time={time} start={start} w={w} h={h} slug={slug} />;
    default:
      return null;
  }
};
