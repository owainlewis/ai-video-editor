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
import { CcrDrop, CcrFifty, CcrFlood, CcrRounds } from "./ccreview";
import { Egm } from "./egm";
import { EffAssume, EffBench, EffCost, EffTurns } from "./effort";
import { EgmAgents, EgmBrainstorm, EgmDraft, EgmDrift, EgmGaps, EgmHandoff, EgmOneAgent, EgmPick, EgmReviewers } from "./egmclean";
import { PanelLens, PanelMinds } from "./panels";
import { GbAsk, GbInbox, GbWork } from "./grokbot";
import { Migrate } from "./migrate";
import { OrgChart } from "./orgchart";
import { Points } from "./points";
import { Skills } from "./skills";
import { AutoFlood, AutoMorning } from "./automations";
import { SlowDeep, SlowEager, SlowFeedback, SlowGoldfish, SlowTradeoffs, SlowTwo } from "./egmslow";
import { NatAngles, NatCast, NatDelegate, NatEnd, NatFull, NatGoldfish, NatGoogle, NatKnows, NatReview, NatStrike, NatTwo } from "./egmnatural";
import { RmdFile, RmdLoop, RmdRepo, RmdRules } from "./reviewmd";
import { SubAlive, SubLife, SubReopen, SubSame, SubZero } from "./subtasks";
import { Drain, Drift, Gaps, Lens, Minds, Scale, Surge, Tally, Thread, Wall } from "./stage";
import { Blueprint, Commits, Swap, Three } from "./threethings";
import { Tools } from "./tools";

export type CustomProps = { shot: ResolvedShot; time: number; props: Record<string, unknown>; times: number[]; width: number; height: number; panel: boolean };
// Drawn to hold still: the frame stays put and only the parts change (measured in the study).
export const STILL = new Set(["drain", "lens", "wall", "thread", "gaps", "drift", "surge", "scale", "minds", "panelminds", "panellens", "tally"]);
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
  // Three faceless test reels in the clean style (2026-11-07).
  "ccr-flood": CcrFlood,
  "ccr-rounds": CcrRounds,
  "ccr-fifty": CcrFifty,
  "ccr-drop": CcrDrop,
  "eff-assume": EffAssume,
  "eff-bench": EffBench,
  "eff-cost": EffCost,
  "eff-turns": EffTurns,
  "sub-alive": SubAlive,
  "sub-life": SubLife,
  "sub-zero": SubZero,
  "sub-reopen": SubReopen,
  "sub-same": SubSame,
  // REVIEW.md on camera (2026-11-08).
  "rmd-file": RmdFile,
  "rmd-repo": RmdRepo,
  "rmd-rules": RmdRules,
  "rmd-loop": RmdLoop,
  // EGM, the natural take (2026-11-08).
  "nat-two": NatTwo,
  "nat-full": NatFull,
  "nat-goldfish": NatGoldfish,
  "nat-angles": NatAngles,
  "nat-review": NatReview,
  "nat-knows": NatKnows,
  // egm-reel-v3, second cut: the real marks as the cast.
  "nat-cast": NatCast,
  "nat-delegate": NatDelegate,
  "nat-strike": NatStrike,
  "nat-google": NatGoogle,
  "nat-end": NatEnd,
  "gb-inbox": GbInbox,
  "gb-ask": GbAsk,
  "gb-work": GbWork,
  // EGM, "it forces you to slow down" (2026-11-08).
  "slow-two": SlowTwo,
  "slow-deep": SlowDeep,
  "slow-goldfish": SlowGoldfish,
  "slow-feedback": SlowFeedback,
  "slow-eager": SlowEager,
  "slow-tradeoffs": SlowTradeoffs,
  // ChatGPT scheduled automations, the hybrid test (2026-11-08).
  "auto-flood": AutoFlood,
  "auto-morning": AutoMorning,
  // The stage moves, for YouTube (research/youtube/xxf6D9jynFw/NOTES.md).
  drain: Drain,
  lens: Lens,
  wall: Wall,
  thread: Thread,
  gaps: Gaps,
  drift: Drift,
  surge: Surge,
  scale: Scale,
  minds: Minds,
  panelminds: PanelMinds,
  panellens: PanelLens,
  tally: Tally,
};
