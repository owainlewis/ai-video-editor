// One-off motion graphics, designed for a single reel's story (Owain, 2026-10-25). The library is a
// starting kit, not a limit: when a line deserves its own picture, draw it here and use it from the
// plan as { "kind": "custom", "name": "<key>", "props": {...}, "at": ["spoken", "beats"] }.
// A good one that recurs graduates into the schema as a kind of its own.
// Every component gets the shot, the time, its props, the spoken times of its `at` beats, and the box
// it is drawn in (`panel` true inside a split's panel, where the paper shows and the speaker stays).
import type React from "react";
import type { ResolvedShot } from "../../engine/schema";
import { IgCta, Hub, Phases, StatBadge, Stopwatch, Timeline, Verifier } from "./moves";
import { Analogy, Swarm } from "./ax";
import { Migrate } from "./migrate";
import { OrgChart } from "./orgchart";
import { Points } from "./points";
import { Skills } from "./skills";

export type CustomProps = { shot: ResolvedShot; time: number; props: Record<string, unknown>; times: number[]; width: number; height: number; panel: boolean };
export const CUSTOM: Record<string, React.FC<CustomProps>> = {
  orgchart: OrgChart,
  migrate: Migrate,
  skills: Skills,
  swarm: Swarm,
  analogy: Analogy,
  statbadge: StatBadge,
  stopwatch: Stopwatch,
  timeline: Timeline,
  hub: Hub,
  phases: Phases,
  verifier: Verifier,
  igcta: IgCta,
  points: Points,
};
