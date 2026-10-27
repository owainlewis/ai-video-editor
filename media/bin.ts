// A project's media bin and its cut. The clip a project was made from is "main", with its files at
// the project's root as always; clips added later each get the same import (working copy, preview,
// voice, word transcript) in clips/<id>/. cut.json says which stretches of them play, in order.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cutLength, cutWords, type Levels, wholeCut } from "../engine/cut.ts";
import { Cut, type CutPlan, MAIN, type Word } from "../engine/schema.ts";
import { liveStatus, type Status } from "./ingest.ts";
import { readJson, writeJson } from "./tools.ts";

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

// A clip's loudness every 10 ms, from its voice, cached in build/level.json until the voice changes.
// The editor reads the same file to snap trims to the real pauses. A pause is 18 dB under the
// clip's speech (its loudest fifth), so it does not depend on how loud the take was recorded.
export function clipLevels(dir: string, id: string): Levels | null {
  const at = clipDir(dir, id);
  const voice = join(at, "source/voice.wav");
  const file = join(at, "build/level.json");
  if (!existsSync(voice)) return null;
  const made = statSync(voice).mtimeMs;
  // Wide enough to hear an "s" or "f" (mostly above 4 kHz): at a lower rate the end of a word like
  // "this" measures as silence, and a trim snapped there cuts it.
  const rate = 100, sr = 24000, n = sr / rate;
  if (existsSync(file)) {
    const cached = readJson<Levels & { made: number; sr?: number }>(file);
    if (cached.made === made && cached.sr === sr) return cached;
  }
  const pcm = spawnSync("ffmpeg", ["-v", "error", "-i", voice, "-ac", "1", "-ar", String(sr), "-f", "s16le", "-"], { maxBuffer: 1 << 30 }).stdout as Buffer;
  const samples = new Int16Array(Uint8Array.prototype.slice.call(pcm, 0, pcm.length - (pcm.length % 2)).buffer);
  const db: number[] = [];
  for (let i = 0; i + n <= samples.length; i += n) {
    let sum = 0;
    for (let j = i; j < i + n; j++) sum += (samples[j] / 32768) ** 2;
    db.push(Math.round(10 * Math.log10(sum / n + 1e-10)));
  }
  const sorted = [...db].sort((a, b) => a - b);
  const speech = sorted[Math.floor(sorted.length * 0.8)] ?? -30;
  const levels = { rate, quiet: speech - 18, db };
  writeJson(file, { made, sr, ...levels });
  return levels;
}
