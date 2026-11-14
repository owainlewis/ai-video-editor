// When an agent's actions on a captured page land (the `image` visual's `actions`, drawn by
// effects/Visuals.tsx). Pure, so the drawing, the sound and the checks agree on one timeline.
// Each action's click lands on its own spoken words (`at`); one without them lands when the action
// before it is done and the cursor has made its trip.
import { typeTime } from "./apps.ts";

type Action = { act: "type" | "click" | "check"; text?: string; at?: string };

// The cursor's trip from one target to the next, and the pause after a click before keys start.
export const MOVE = 0.45;
export const FOCUS = 0.15;

// `t`: the click lands. `t1`: the action is done (the last key typed).
export type ActionBeat = { t: number; t1: number };

export function actionBeats(actions: Action[], start: number, times: (number | undefined)[]): ActionBeat[] {
  const out: ActionBeat[] = [];
  let prev = start + 0.15;
  actions.forEach((a, i) => {
    const said = a.at ? times[i] : undefined;
    const t = Math.max(said ?? prev + MOVE, i ? prev + 0.2 : start + 0.2);
    const t1 = a.act === "type" ? t + FOCUS + typeTime(a.text?.length ?? 0) : t + 0.25;
    out.push({ t, t1 });
    prev = t1;
  });
  return out;
}

// How many characters of a typed action show at `time`.
export const typedChars = (text: string, b: ActionBeat, time: number) => {
  if (time < b.t + FOCUS) return 0;
  return Math.min(text.length, Math.floor(((time - b.t - FOCUS) / Math.max(0.01, b.t1 - b.t - FOCUS)) * text.length + 1e-6));
};

// The anchor index where the actions' times start in an image's `times`: after its highlights and lift.
export const actionOffset = (v: { highlight: unknown[]; lift?: unknown }) => v.highlight.length + (v.lift ? 1 : 0);
