// What a change to the plan did, graphic by graphic, for the chat panel's list under each note.
// Pure: it reads two edit.json files as plain JSON, so a half-written or invalid plan still compares.
import { shotIds } from "./resolve.ts";

export type Change =
  | { type: "added" | "changed" | "removed"; id: string; kind: string; anchor: string }
  // A field of the plan itself, such as the hook or the music.
  | { type: "plan"; field: string };

// What one note to Claude did, kept on its last chat message: how long it took, the plan's version
// before it (`from`) and after it (`to`, absent when nothing changed), and what changed.
// `reverted`: the version that put the plan back to `from`, when the note was reverted.
export type Run = { ms: number; from?: number; to?: number; changes?: Change[]; reverted?: number };

type RawShot = { id?: string; at?: unknown; keep?: unknown; layout?: unknown; visual?: { kind?: unknown } };
type RawPlan = { shots?: unknown } & Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const shotsOf = (plan: RawPlan): RawShot[] => (Array.isArray(plan.shots) ? plan.shots.filter((s): s is RawShot => !!s && typeof s === "object") : []);

// What a shot shows, in one word: its visual's kind, else "keep" or its layout.
const kindOf = (s: RawShot) =>
  typeof s.visual?.kind === "string" ? s.visual.kind : s.keep ? "keep" : typeof s.layout === "string" ? s.layout : "shot";

// Each shot by its id, as the resolver names them (engine/resolve.ts, shotIds), so a moved shot or
// one whose look changed is still the same shot.
const byId = (plan: RawPlan) => {
  const shots = shotsOf(plan);
  const ids = shotIds(shots.map((s) => ({ id: typeof s.id === "string" ? s.id : undefined, anchor: typeof s.at === "string" ? s.at : "" })));
  return new Map(ids.map((id, k) => [id, shots[k]]));
};

// The changes from `before` to `after`: plan fields first, then shots in the order they play.
export function planChanges(before: RawPlan, after: RawPlan): Change[] {
  const out: Change[] = [];
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => f !== "shots");
  for (const field of fields) if (!same(before[field], after[field])) out.push({ type: "plan", field });

  const was = byId(before);
  const now = byId(after);
  for (const [id, s] of now) {
    const old = was.get(id);
    const anchor = typeof s.at === "string" ? s.at : "";
    if (!old) out.push({ type: "added", id, kind: kindOf(s), anchor });
    // The id is written into a shot when its anchor moves; that alone is not a change.
    else if (!same({ ...old, id: undefined }, { ...s, id: undefined })) out.push({ type: "changed", id, kind: kindOf(s), anchor });
  }
  for (const [id, s] of was) if (!now.has(id)) out.push({ type: "removed", id, kind: kindOf(s), anchor: typeof s.at === "string" ? s.at : "" });
  return out;
}
