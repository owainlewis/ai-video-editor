// Bring a clip into a project: a 30 fps working copy, the voice, a light proxy for the editor,
// a word-level transcript and a starter plan. Each step reports progress to status.json, which
// the editor shows while it waits.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { Word } from "../engine/schema.ts";
import { ffmpeg, ffmpegProgress, hasHardwareH264, type Log, probeDuration, probeSize, readJson, run, speechEnd, writeJson } from "./tools.ts";

// Names Whisper otherwise mishears ("CodeCode" for Claude Code).
const VOCAB = "Claude Code, Codex, Claude, Anthropic, OpenAI, GitHub, MCP, LLM, AI agents, Cursor, Gemini.";

export type Status = { stage: string; done: boolean; error?: string; at: string; pid?: number };

// A running job records its process, so the editor can tell a live job from one that died.
export const setStatus = (dir: string, stage: string, extra: Partial<Status> = {}) =>
  writeJson(join(dir, "status.json"), { stage, done: false, pid: process.pid, ...extra, at: new Date().toISOString() });

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// The project's job status, with a job whose process is gone shown as interrupted.
export function liveStatus(dir: string): Status | null {
  if (!existsSync(join(dir, "status.json"))) return null;
  const status = readJson<Status>(join(dir, "status.json"));
  if (!status.done && status.pid && !alive(status.pid)) return { ...status, stage: "Interrupted", done: true, error: `${status.stage} stopped before it finished. Start it again.` };
  return status;
}

export const slugFor = (file: string) =>
  basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "clip";

export type Choices = { canvas?: "reel" | "youtube"; title?: string };

export async function ingest(projects: string, file: string, slug: string, log: Log = () => {}, choices: Choices = {}) {
  const dir = join(projects, slug);
  for (const d of ["source", "build", "renders", "checks", "history"]) mkdirSync(join(dir, d), { recursive: true });
  try {
    // project.json goes in before the transcript, so the editor can show the import's progress.
    const { size, words } = await prepare(dir, file, log, undefined, (size, duration) => writeJson(join(dir, "project.json"), { slug, original: resolve(file), size, duration }));
    if (!existsSync(join(dir, "edit.json"))) writeJson(join(dir, "edit.json"), starterPlan(slug, words, size, choices));
    writeJson(join(dir, "status.json"), { stage: "Ready", done: true, at: new Date().toISOString() });
  } catch (e) {
    writeJson(join(dir, "status.json"), { stage: "Failed", done: true, error: String((e as Error).message ?? e), at: new Date().toISOString() });
    throw e;
  }
}

// Another clip for a project's bin (a second take, a screen recording): the same import into
// clips/<id>/, at the project's own frame size so every clip in the cut matches.
export async function addClip(projects: string, slug: string, file: string, id: string, log: Log = () => {}, name = basename(file)) {
  const dir = join(projects, slug, "clips", id);
  mkdirSync(dir, { recursive: true });
  try {
    const { size } = projectMeta(join(projects, slug));
    const { duration } = await prepare(dir, file, log, size);
    writeJson(join(dir, "clip.json"), { name, original: resolve(file), duration });
    writeJson(join(dir, "status.json"), { stage: "Ready", done: true, at: new Date().toISOString() });
  } catch (e) {
    writeJson(join(dir, "status.json"), { stage: "Failed", done: true, error: String((e as Error).message ?? e), at: new Date().toISOString() });
    throw e;
  }
}

// The footage and words for one clip in `dir`: a 30 fps working copy, the voice, a light preview
// for the editor, a frame to look at, and a word-level transcript. Progress goes to dir/status.json.
async function prepare(dir: string, file: string, log: Log, fixed?: [number, number], onFootage?: (size: [number, number], duration: number) => void) {
  for (const d of ["source", "build", "checks"]) mkdirSync(join(dir, d), { recursive: true });
  setStatus(dir, "Preparing footage");
  const [sw, sh] = probeSize(file);
  const length = probeDuration(file);
  // Keep the footage's own shape. 4K landscape stays 4K: a 9:16 reel uses a vertical slice of it.
  const size: [number, number] = fixed ?? (sw > sh ? (sw >= 3840 ? [3840, 2160] : [1920, 1080]) : [1080, 1920]);
  // One pass over the footage writes the 30 fps working copy, the editor's preview and the voice.
  // The preview is at most 1920 on its long side with a keyframe every half second, so scrubbing
  // is quick; 4K masters and 24-bit WAV do not play well in a browser.
  const fit = `scale=${size[0]}:${size[1]}:force_original_aspect_ratio=increase,crop=${size[0]}:${size[1]},fps=30,setsar=1`;
  const small = size[0] >= size[1] ? "scale=min(1920\\,iw):-2" : "scale=-2:min(1920\\,ih)";
  const hw = hasHardwareH264();
  const enc = (mbps: number) => (hw ? ["-c:v", "h264_videotoolbox", "-b:v", `${mbps}M`] : ["-c:v", "libx264", "-crf", mbps > 20 ? "16" : "22", "-preset", "veryfast"]);
  const master = size[0] * size[1] > 1920 * 1080 ? 60 : 24;
  let last = -1;
  await ffmpegProgress([
    "-i", file, "-filter_complex", `[0:v]${fit},split=2[w][p];[p]${small}[pv]`,
    "-map", "[w]", ...enc(master), "-pix_fmt", "yuv420p", "-an", join(dir, "source/talking.mp4"),
    "-map", "[pv]", ...enc(8), "-g", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", join(dir, "build/preview.mp4"),
    "-map", "0:a:0?", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le", join(dir, "source/voice.wav"),
  ], length, (f) => {
    const pct = Math.floor(f * 100);
    if (pct !== last) setStatus(dir, `Preparing footage ${pct}%`), (last = pct);
  }, log);
  // The preview's sound encodes while Whisper works; both only read the voice.
  const previewAudio = ffmpegProgress(["-i", join(dir, "source/voice.wav"), "-c:a", "aac", "-b:a", "192k", join(dir, "build/preview.m4a")], length, () => {}, log);
  previewAudio.catch(() => {}); // A failure is thrown at the await below; this keeps it quiet if Whisper fails first.
  ffmpeg(["-ss", "1", "-i", join(dir, "source/talking.mp4"), "-frames:v", "1", "-q:v", "3", join(dir, "checks/frame.jpg")], log);
  const duration = probeDuration(join(dir, "source/talking.mp4"));
  onFootage?.(size, duration);

  setStatus(dir, "Transcribing");
  const words = transcribe(dir, log);
  await previewAudio;
  return { size, duration, words };
}

export function transcribe(dir: string, log?: Log): Word[] {
  const tmp = join(dir, "build/whisper");
  mkdirSync(tmp, { recursive: true });
  // On long recordings Whisper's default conditioning loops one phrase for minutes and drops
  // whole sections (the 1h51m course take, 2026-11-15); without it the transcript comes out clean.
  const long = probeDuration(join(dir, "source/voice.wav")) > 20 * 60 ? ["--condition-on-previous-text", "False", "--hallucination-silence-threshold", "2"] : [];
  run("uvx", ["--from", "mlx-whisper", "mlx_whisper", join(dir, "source/voice.wav"), "--model", "mlx-community/whisper-large-v3-turbo",
    "--language", "en", "--word-timestamps", "True", "--output-format", "json", "--output-dir", tmp, "--initial-prompt", VOCAB, ...long], { log });
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

// A new reel's music bed: B2B from 60 s, where it holds steady, 11 LU under the voice (Owain,
// 2026-11-13: "my favourite"). His second choice is "Alon Ohana - Call to Action.mp3".
export const REEL_MUSIC = { mood: "focus", track: "reels/ES_B2B - Rocket Jr.mp3", start: 60, under: 11 } as const;

// The plan a new clip starts from: the speaker full frame, nothing added yet. Landscape footage is
// a YouTube video (16:9, no word captions); portrait is a reel (Owain, 2026-10-24).
export function starterPlan(slug: string, words: Word[], size: [number, number], choices: Choices = {}) {
  const opening = words.slice(0, 3).map((w) => w.text).join(" ");
  const youtube = choices.canvas ? choices.canvas === "youtube" : size[0] > size[1];
  return {
    title: choices.title?.trim() || slug.replace(/-/g, " "),
    canvas: youtube ? "youtube" : "reel",
    ...(youtube ? {} : { style: "clean" }),
    split: "half",
    // A first guess at where the face is; refine it from checks/frame.jpg.
    face: size[0] > size[1] ? { x: 0.5, y: 0.3, h: 0.36 } : { x: 0.5, y: 0.3, h: 0.2 },
    accents: [],
    music: youtube ? false : REEL_MUSIC,
    shots: [{ at: opening || "start", layout: "full" }],
  };
}

export const projectMeta = (dir: string) => readJson<{ slug: string; original: string; size: [number, number]; duration: number; script?: boolean }>(join(dir, "project.json"));
