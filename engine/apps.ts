// When each step of an app mock-up (`cli`, `claudeapp`, `grokbot`; drawn by effects/apps/) plays.
// Pure, so the drawing, the sound and the gallery agree on one timeline. A step with its own spoken
// words (`at`) starts on them; one without starts when the step before it is done, so a script with
// no anchors still plays as the app would: a prompt types, then the agent works, then it answers.
import type { ResolvedVisual } from "./schema.ts";

export const APP_KINDS = ["cli", "claudeapp", "grokbot"] as const;
export type AppKind = (typeof APP_KINDS)[number];
type AppVisual = Extract<ResolvedVisual, { kind: AppKind }>;
export const isApp = (v?: { kind: string }): v is AppVisual => !!v && (APP_KINDS as readonly string[]).includes(v.kind);

// Typing speed in characters a second, quick enough that a long prompt never holds a shot.
export const typeRate = (chars: number) => Math.max(30, chars / 1.6);
export const typeTime = (chars: number) => chars / typeRate(chars);

export type Beat = { t0: number; t1: number };

// How long a step takes once it starts, by kind and type.
const length = (kind: AppKind, s: { type: string; text?: string; items?: string[]; out?: string[] }): number => {
  const chars = s.text?.length ?? 0;
  switch (s.type) {
    case "prompt":
    case "user": return typeTime(chars) + 0.35;
    case "think": return 1.1;
    case "tool": return kind === "cli" ? 1.2 : 0.6;
    case "text": return kind === "cli" ? 0.5 : Math.min(1.6, 0.25 + (s.text ?? "").split(/\s+/).length * 0.035);
    case "list":
    case "todo": return 0.3 + (s.items?.length ?? 0) * 0.35;
    case "folder": return 1.3;
    case "status": return 1.3;
    case "bot": return 0.6;
    default: return 0.25;
  }
};

// The anchors of an app visual, in the order the resolver times them (engine/resolve.ts).
export const appAnchors = (v: AppVisual): (string | undefined)[] =>
  v.kind === "grokbot" ? [...v.steps.map((s) => s.at), ...v.bots.map((b) => b.at), ...v.tasks.map((t) => t.at)] : v.steps.map((s) => s.at);

// Each step's start and end. `times` are the resolver's, one per anchor; only anchored steps use theirs.
export const appBeats = (v: AppVisual, start: number, times: number[] = []): Beat[] => {
  const beats: Beat[] = [];
  let at = start + 0.4;
  v.steps.forEach((s, i) => {
    const t0 = s.at && times[i] !== undefined ? times[i] : at;
    const t1 = t0 + length(v.kind, s);
    beats.push({ t0, t1 });
    at = t1;
  });
  return beats;
};

// When each listed bot or task lands (grokbot): on its words, or there from the start.
export const appRows = (v: AppVisual, start: number, times: number[] = []) => {
  if (v.kind !== "grokbot") return { bots: [], tasks: [] };
  const n = v.steps.length;
  const one = (at: string | undefined, i: number) => (at && times[i] !== undefined ? times[i] : start - 1);
  return { bots: v.bots.map((b, i) => one(b.at, n + i)), tasks: v.tasks.map((t, i) => one(t.at, n + v.bots.length + i)) };
};

// When the script is over: its last step done, or its last row landed.
export const appEnd = (v: AppVisual, start: number, times: number[] = []) => {
  const rows = appRows(v, start, times);
  return Math.max(start + 0.4, ...appBeats(v, start, times).map((b) => b.t1), ...rows.bots, ...rows.tasks);
};
