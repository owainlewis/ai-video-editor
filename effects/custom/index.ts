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
import { Egm } from "./egm";
import { EgmAgents, EgmBrainstorm, EgmDraft, EgmDrift, EgmGaps, EgmHandoff, EgmOneAgent, EgmPick, EgmReviewers } from "./egmclean";
import { Migrate } from "./migrate";
import { OrgChart } from "./orgchart";
import { Points } from "./points";
import { Skills } from "./skills";
import { Drain, Drift, Gaps, Lens, Scale, Surge, Thread, Wall } from "./stage";
import { Blueprint, Commits, Swap, Three } from "./threethings";
import { Tools } from "./tools";

export type CustomProps = { shot: ResolvedShot; time: number; props: Record<string, unknown>; times: number[]; width: number; height: number; panel: boolean };
// Drawn to hold still: the frame stays put and only the parts change (measured in the study).
export const STILL = new Set(["drain", "lens", "wall", "thread", "gaps", "drift", "surge", "scale"]);
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
  three: Three,
  blueprint: Blueprint,
  swap: Swap,
  commits: Commits,
  tools: Tools,
  egm: Egm,
  // The EGM reel in the clean style (projects/egm-clean).
  "egm-agents": EgmAgents,
  "egm-one-agent": EgmOneAgent,
  "egm-handoff": EgmHandoff,
  "egm-gaps": EgmGaps,
  "egm-brainstorm": EgmBrainstorm,
  "egm-draft": EgmDraft,
  "egm-reviewers": EgmReviewers,
  "egm-pick": EgmPick,
  "egm-drift": EgmDrift,
  // The stage moves, for YouTube (research/youtube/xxf6D9jynFw/NOTES.md).
  drain: Drain,
  lens: Lens,
  wall: Wall,
  thread: Thread,
  gaps: Gaps,
  drift: Drift,
  surge: Surge,
  scale: Scale,
};
