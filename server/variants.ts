// Variants: Claude draws several bold takes on one graphic, and Owain compares them side by side in
// the inspector, each playing live, before picking one. Nothing is rendered and the plan is not
// touched until he picks. The takes live in projects/<slug>/variants.json, for the graphic that
// starts at `start` on the timeline; each is resolved against the real words here, so its parts
// land exactly where they would in the video.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { planIndex } from "../engine/insert.ts";
import { resolveShots } from "../engine/resolve.ts";
import { Edit, Shot, type ResolvedShot } from "../engine/schema.ts";
import { timeline } from "../media/bin.ts";
import { FPS, readJson, writeJson } from "../media/tools.ts";

export type Variant = { id: string; label: string; reason?: string; shot: { at: string; layout: string; [k: string]: unknown } };
export type Variants = { start: number; note?: string; items: Variant[] };
export type ResolvedVariant = Variant & { resolved?: ResolvedShot; problems: string[] };

const file = (dir: string) => join(dir, "variants.json");
export const loadVariants = (dir: string): Variants | null => {
  if (!existsSync(file(dir))) return null;
  try {
    return readJson<Variants>(file(dir));
  } catch {
    return null;
  }
};
export const saveVariants = (dir: string, v: Variants) => writeJson(file(dir), v);
export const clearVariants = (dir: string) => rmSync(file(dir), { force: true });

// Each take resolved in place of the graphic, with the problems it would add to the plan.
export function resolveVariants(dir: string): { start: number; note?: string; items: ResolvedVariant[] } | null {
  const v = loadVariants(dir);
  if (!v) return null;
  let rawEdit: unknown;
  try {
    rawEdit = readJson(join(dir, "edit.json"));
  } catch {
    return { ...v, items: v.items.map((it) => ({ ...it, problems: ["the plan has errors; fix them first"] })) };
  }
  const parsed = Edit.safeParse(rawEdit);
  if (!parsed.success) return { ...v, items: v.items.map((it) => ({ ...it, problems: ["the plan has errors; fix them first"] })) };
  const plan = parsed.data;
  const line = timeline(dir);
  const base = resolveShots(plan, line.words, line.duration, FPS, line.explicit);
  // The shot that starts nearest `start` (a few frames either way, as the editor rounds times).
  const k = base.shots.reduce((best, s, i) => (Math.abs(s.start - v.start) < 0.3 && (best < 0 || Math.abs(s.start - v.start) < Math.abs(base.shots[best].start - v.start)) ? i : best), -1);
  const target = planIndex(plan.shots, base.shots, k);
  const before = new Set(base.issues.filter((i) => i.level === "error").map((i) => i.message));
  const items = v.items.map((it): ResolvedVariant => {
    const shot = Shot.safeParse(it.shot);
    if (!shot.success) return { ...it, problems: shot.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
    if (target < 0) return { ...it, problems: ["the graphic this take replaces is no longer in the plan"] };
    const shots = plan.shots.map((s, i) => (i === target ? shot.data : s));
    const r = resolveShots({ ...plan, shots }, line.words, line.duration, FPS, line.explicit);
    const resolved = r.shots.find((s) => s.anchor === shot.data.at && Math.abs(s.start - v.start) < 3);
    if (resolved && (plan.theme === "dark" || plan.theme === "black")) resolved.tone ??= "dark";
    const problems = r.issues.filter((i) => i.level === "error" && !before.has(i.message)).map((i) => i.message);
    return { ...it, resolved, problems: resolved ? problems : [...problems, `"${shot.data.at}" is not found where the graphic starts`] };
  });
  return { ...v, items };
}

// What Claude is told when Owain asks for takes on a graphic.
export const VARIANTS = (slug: string, start: number, current: unknown, said: string, note?: string) => `Owain wants variants of one graphic in projects/${slug}, to compare side by side in the editor.

The graphic starts at ${start.toFixed(2)}s on the timeline. Said while it is up: "${said}"
Its shot in edit.json now: ${JSON.stringify(current)}
${note ? `His note: ${note}\n` : ""}
Read CLAUDE.md, docs/RULES.md, docs/STYLE.md and engine/schema.ts (the visual kinds). Then write projects/${slug}/variants.json:
{"start": ${start}, "items": [{"id": "v1", "label": "<two to four words>", "reason": "<one plain sentence: what this take does better>", "shot": {<a complete shot for edit.json>}}, ...]}

Make three or four takes that are genuinely different pictures of the same point, not the same card restyled:
- Start with the house graphics (words, focus, map in engine/schema.ts): big type, no boxes, every part on its word.
- Vary the kind and the layout. On YouTube: "over" (words beside Owain), "media" (full frame), "side". Reels: "split", "scene", "media".
- Keep "at" exactly as it is in the shot now, so the take starts at the same moment. Give inner parts their own "at" (a few exact words said inside the section).
- Use only what is said. Never invent numbers, names or claims.

Do not edit edit.json. Run \`npm run studio -- variants ${slug}\` and fix every problem it reports. Reply with one line per take.`;
