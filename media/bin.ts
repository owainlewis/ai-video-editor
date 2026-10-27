// A project's media bin and its cut. The clip a project was made from is "main", with its files at
// the project's root as always; clips added later each get the same import (working copy, preview,
// voice, word transcript) in clips/<id>/. cut.json says which stretches of them play, in order.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cutLength, cutWords, wholeCut } from "../engine/cut.ts";
import { Cut, type CutPlan, MAIN, type Word } from "../engine/schema.ts";
import { liveStatus, type Status } from "./ingest.ts";
import { readJson } from "./tools.ts";

export type Clip = { id: string; name: string; duration: number; original: string; status: Status | null; ready: boolean };

export const clipDir = (dir: string, id: string) => (id === MAIN ? dir : join(dir, "clips", id));
// A clip's folder as a path under projects/, for the files the editor plays.
export const clipPath = (slug: string, id: string) => (id === MAIN ? slug : `${slug}/clips/${id}`);

const readClip = (dir: string, id: string): Clip | null => {
  const at = clipDir(dir, id);
  const file = join(at, id === MAIN ? "project.json" : "clip.json");
  const meta = existsSync(file) ? readJson<{ name?: string; original?: string; duration?: number }>(file) : null;
  const status = id === MAIN ? null : liveStatus(at);
  if (!meta && !status) return null;
  const original = meta?.original ?? "";
  return {
    id,
    name: meta?.name ?? (original.split("/").pop() || id),
    duration: meta?.duration ?? 0,
    original,
    status,
    ready: !!meta?.duration && existsSync(join(at, "transcript.json")),
  };
};

export function clips(dir: string): Clip[] {
  const added = existsSync(join(dir, "clips"))
    ? readdirSync(join(dir, "clips"), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort()
    : [];
  return [MAIN, ...added].map((id) => readClip(dir, id)).filter((c): c is Clip => !!c);
}

// The project's cut: cut.json, or the main clip whole when there is none (`explicit` false).
export function loadCut(dir: string): { cut: CutPlan; explicit: boolean; error?: string } {
  const whole = () => wholeCut(readJson<{ duration: number }>(join(dir, "project.json")).duration);
  const file = join(dir, "cut.json");
  if (!existsSync(file)) return { cut: whole(), explicit: false };
  const parsed = Cut.safeParse(readJson(file));
  if (!parsed.success) return { cut: whole(), explicit: false, error: `cut.json ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
  return { cut: parsed.data, explicit: true };
}

// Each clip's own words, by clip id.
export function clipWords(dir: string, ids: string[]): Record<string, Word[]> {
  const out: Record<string, Word[]> = {};
  for (const id of new Set(ids)) {
    const file = join(clipDir(dir, id), "transcript.json");
    out[id] = existsSync(file) ? readJson<Word[]>(file) : [];
  }
  return out;
}

// What plays, on the timeline: the cut, its length, and the words as they fall in it. With no
// cut.json this is the main clip and its transcript exactly as before.
export function timeline(dir: string) {
  const { cut, explicit, error } = loadCut(dir);
  if (!explicit) {
    const words = readJson<Word[]>(join(dir, "transcript.json"));
    return { cut, explicit, error, words, byClip: { [MAIN]: words }, duration: readJson<{ duration: number }>(join(dir, "project.json")).duration };
  }
  const byClip = clipWords(dir, cut.segments.map((s) => s.src));
  return { cut, explicit, error, words: cutWords(cut, byClip), byClip, duration: cutLength(cut) };
}
