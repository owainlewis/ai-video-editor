// Bring a clip into a project: a 30 fps working copy, the voice, a light proxy for the editor,
// a word-level transcript and a starter plan. Each step reports progress to status.json, which
// the editor shows while it waits.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { Word } from "../engine/schema.ts";
import { ffmpeg, type Log, probeDuration, probeSize, readJson, run, speechEnd, writeJson } from "./tools.ts";

// Names Whisper otherwise mishears ("CodeCode" for Claude Code).
const VOCAB = "Claude Code, Codex, Claude, Anthropic, OpenAI, GitHub, MCP, LLM, AI agents, Cursor, Gemini.";

export type Status = { stage: string; done: boolean; error?: string; at: string };

export const setStatus = (dir: string, stage: string, extra: Partial<Status> = {}) =>
  writeJson(join(dir, "status.json"), { stage, done: false, ...extra, at: new Date().toISOString() });

export const slugFor = (file: string) =>
  basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "clip";

export function ingest(projects: string, file: string, slug: string, log: Log = () => {}) {
  const dir = join(projects, slug);
  for (const d of ["source", "build", "renders", "checks", "history"]) mkdirSync(join(dir, d), { recursive: true });
  try {
    setStatus(dir, "Preparing footage");
    const [sw, sh] = probeSize(file);
    // Keep the footage's own shape. 4K landscape stays 4K: a 9:16 reel uses a vertical slice of it.
    const size: [number, number] = sw > sh ? (sw >= 3840 ? [3840, 2160] : [1920, 1080]) : [1080, 1920];
    const vf = `scale=${size[0]}:${size[1]}:force_original_aspect_ratio=increase,crop=${size[0]}:${size[1]},fps=30,setsar=1`;
    ffmpeg(["-i", file, "-vf", vf, "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", "-an", join(dir, "source/talking.mp4")], log);
    ffmpeg(["-i", file, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le", join(dir, "source/voice.wav")], log);
    ffmpeg(["-ss", "1", "-i", join(dir, "source/talking.mp4"), "-frames:v", "1", "-q:v", "3", join(dir, "checks/frame.jpg")], log);
    const duration = probeDuration(join(dir, "source/talking.mp4"));
    writeJson(join(dir, "project.json"), { slug, original: resolve(file), size, duration });

    setStatus(dir, "Making a preview copy");
    makePreview(dir, size, log);

    setStatus(dir, "Transcribing");
    const words = transcribe(dir, log);

    if (!existsSync(join(dir, "edit.json"))) writeJson(join(dir, "edit.json"), starterPlan(slug, words, size));
    writeJson(join(dir, "status.json"), { stage: "Ready", done: true, at: new Date().toISOString() });
  } catch (e) {
    writeJson(join(dir, "status.json"), { stage: "Failed", done: true, error: String((e as Error).message ?? e), at: new Date().toISOString() });
    throw e;
  }
}

// The editor plays a light copy: at most 1920 on the long side, a keyframe every half second so
// scrubbing is quick, and AAC audio. 4K masters and 24-bit WAV do not decode well in a browser.
export function makePreview(dir: string, size: [number, number], log?: Log) {
  const scale = size[0] >= size[1] ? "scale=min(1920\\,iw):-2" : "scale=-2:min(1920\\,ih)";
  ffmpeg(["-i", join(dir, "source/talking.mp4"), "-vf", scale, "-an", "-c:v", "libx264", "-profile:v", "high", "-crf", "23", "-preset", "veryfast",
    "-g", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, "build/preview.mp4")], log);
  ffmpeg(["-i", join(dir, "source/voice.wav"), "-c:a", "aac", "-b:a", "192k", join(dir, "build/preview.m4a")], log);
}

export function transcribe(dir: string, log?: Log): Word[] {
  const tmp = join(dir, "build/whisper");
  mkdirSync(tmp, { recursive: true });
  run("uvx", ["--from", "mlx-whisper", "mlx_whisper", join(dir, "source/voice.wav"), "--model", "mlx-community/whisper-large-v3-turbo",
    "--language", "en", "--word-timestamps", "True", "--output-format", "json", "--output-dir", tmp, "--initial-prompt", VOCAB], { log });
  // Python's json writes NaN for some scores, which JSON.parse rejects; nothing here reads them.
  const data = JSON.parse(readFileSync(join(tmp, "voice.json"), "utf8").replace(/\bNaN\b/g, "null")) as { segments: { words?: { word: string; start: number; end: number }[] }[] };
  const raw: Word[] = data.segments.flatMap((s) => s.words ?? []).filter((w) => w.word.trim())
    .map((w) => ({ text: w.word.trim(), start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
  const words = cleanWords(raw, speechEnd(join(dir, "source/voice.wav")));
  writeJson(join(dir, "transcript.json"), words);
  writeFileSync(join(dir, "transcript.txt"), words.map((w, i) => `${String(i).padStart(4)}  ${w.start.toFixed(2).padStart(7)}-${w.end.toFixed(2).padEnd(7)} ${w.text}`).join("\n") + "\n");
  return words;
}

// Whisper invents words in trailing silence (often the last sentence again, at zero length) and
// splits numbers ("2" ",500"). Drop anything after the measured end of speech, cut from the first
// near-zero-length word close to it, and join split numbers back.
export function cleanWords(raw: Word[], end: number): Word[] {
  const phantom = raw.findIndex((w) => w.start >= end - 0.2 && w.end - w.start < 0.05);
  return raw
    .slice(0, phantom < 0 ? raw.length : phantom)
    .filter((w) => w.start < end + 0.05)
    .reduce<Word[]>((out, w) => {
      const prev = out[out.length - 1];
      if (prev && /^,\d/.test(w.text) && /\d$/.test(prev.text)) (prev.text += w.text), (prev.end = w.end);
      else out.push({ ...w });
      return out;
    }, []);
}

// The plan a new clip starts from: the speaker full frame, nothing added yet.
export function starterPlan(slug: string, words: Word[], size: [number, number]) {
  const opening = words.slice(0, 3).map((w) => w.text).join(" ");
  return {
    title: slug.replace(/-/g, " "),
    canvas: "reel",
    style: "ivory",
    format: "mixed",
    split: "half",
    // A first guess at where the face is; refine it from checks/frame.jpg.
    face: size[0] > size[1] ? { x: 0.5, y: 0.3, h: 0.36 } : { x: 0.5, y: 0.3, h: 0.2 },
    accents: [],
    music: false,
    shots: [{ at: opening || "start", layout: "full" }],
  };
}

export const projectMeta = (dir: string) => readJson<{ slug: string; original: string; size: [number, number]; duration: number; script?: boolean }>(join(dir, "project.json"));
