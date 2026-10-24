// First-pass graphic suggestions. Claude proposes graphics as drafts in suggestions.json, not in the
// plan; Owain accepts or rejects each. Accepting places it straight into the plan (placeOver), checked
// like any other change. What he accepted and rejected stays in the file, so the next round learns.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Visual } from "../engine/schema.ts";
import { readJson, writeJson } from "../media/tools.ts";
import { placeOver } from "./insert.ts";

export type Suggestion = {
  id: string;
  start: number;
  end: number;
  layout: string;
  visual: unknown;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  note?: string;
};

const file = (dir: string) => join(dir, "suggestions.json");
export const loadSuggestions = (dir: string): Suggestion[] => (existsSync(file(dir)) ? readJson<{ items: Suggestion[] }>(file(dir)).items ?? [] : []);
const save = (dir: string, items: Suggestion[]) => writeJson(file(dir), { items });

// Problems with a draft before Owain sees it: a visual the renderer cannot draw, or bad times.
export function checkSuggestions(dir: string): string[] {
  return loadSuggestions(dir).flatMap((s) => {
    const out: string[] = [];
    const v = Visual.safeParse(s.visual);
    if (!v.success) out.push(`${s.id}: visual does not match the schema: ${v.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    if (!(s.end > s.start)) out.push(`${s.id}: end must be after start`);
    if (!s.reason) out.push(`${s.id}: needs a reason`);
    return out;
  });
}

export function decide(projects: string, slug: string, id: string, accept: boolean, note = "") {
  const dir = join(projects, slug);
  const items = loadSuggestions(dir);
  const s = items.find((x) => x.id === id);
  if (!s) throw Object.assign(new Error(`no suggestion ${id}`), { code: 404 });
  if (accept) placeOver(projects, slug, { at: "", layout: s.layout, visual: s.visual }, s.start, s.end);
  s.status = accept ? "accepted" : "rejected";
  if (note) s.note = note;
  save(dir, items);
}

// What Claude is told when Owain asks for suggestions.
export const SUGGEST = (slug: string) => `Owain wants first-pass graphic suggestions for projects/${slug}.

Read projects/${slug}/transcript.txt, edit.json, build/camera.json (if it is a YouTube video), docs/RULES.md and the
existing projects/${slug}/suggestions.json (what Owain accepted and rejected before, with his notes: learn from them).

Then write projects/${slug}/suggestions.json as {"items": [...]}, keeping every existing item, and adding new ones:
{"id": "s<n>", "start": <seconds>, "end": <seconds>, "layout": "<layout>", "visual": {<a visual from engine/schema.ts>}, "reason": "<one plain sentence: why a graphic helps here>", "status": "pending"}

Rules for each new one:
- Only where it adds something: a number, a list, steps, a comparison, a structure. Never decoration, never a lower third.
- Only over plain picture: not over a stretch that already has a graphic or b-roll in edit.json.
- YouTube: only inside an on-camera stretch from build/camera.json; layout "side" (a visual beside Owain) or "over" with a "title". Reels: "split" or "scene".
- 4 to 12 seconds. Reveals land on their words: give list items, stages and points their own "at" (a few exact words from the transcript inside the section).
- About one per 20 to 60 seconds of on-camera time. Fewer, better ones beat many.
- Never invent numbers or facts; show only what is said.

Do not edit edit.json. Run \`npm run studio -- suggestions ${slug}\` and fix every problem it reports. Reply with how many you suggested.`;
