// Clean a clip's voice with Auphonic before anything else hears it (Owain, 2026-11-06: "It massively
// improves it and cuts breaths"). The original voice is kept as source/voice.original.wav and is what
// gets sent, so a second run starts from the same place. Timing never changes: fillers and silence
// come back as a cut list in build/auphonic/, not cut, so words and picture stay in sync.
import { copyFileSync, existsSync, mkdirSync, openAsBlob, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { envValue, ffmpeg, probeDuration, type Log } from "./tools.ts";

const API = "https://auphonic.com/api";
const DONE = 3, ERROR = 2;

// Studio Voice, not Voice AutoEQ: AutoEQ lifted 2 to 3.5 kHz by 4 dB, which Owain heard as harsh
// (2026-11-07). Studio Voice matched the reference reels' balance and he picked it by ear.
export const ALGORITHMS = {
  filtering: true, filtermethod: "studiovoice",
  denoise: true, denoisemethod: "dynamic", denoiseamount: 12, debreathamount: 24,
  leveler: true, normloudness: true, loudnesstarget: -16, maxpeak: -1,
  filler_cutter: true, silence_cutter: true, cut_mode: "export_uncut_audio",
};
export const OUTPUTS = [
  { format: "wav-24bit" },
  { format: "cut-list", ending: "ReaperRegions.csv" },
  { format: "cut-list", ending: "FinalCutProX.fcpxml" },
];

function apiKey(): string {
  const key = envValue("AUPHONIC_API_KEY");
  if (!key) throw new Error("no Auphonic key: set AUPHONIC_API_KEY in .env");
  return key;
}

async function call<T>(path: string, key: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/${path}`, { ...init, headers: { Authorization: `bearer ${key}`, ...init.headers } });
  const body = (await res.json()) as { data: T; error_message?: string };
  if (!res.ok) throw new Error(`Auphonic ${path}: ${body.error_message || res.status}`);
  return body.data;
}

type Production = { uuid: string; status: number; status_string: string; error_message?: string; output_files: { format: string; ending: string; filename: string; download_url: string }[] };

export function safeAuphonicFilename(name: string): string {
  const base = basename(name.replace(/\\/g, "/"));
  if (!base || base === "." || base === "..") throw new Error(`Auphonic returned invalid filename: ${name}`);
  return base;
}

// One clip's folder: the project itself, or clips/<id>.
export async function cleanVoice(dir: string, title: string, log: Log = () => {}) {
  const voice = join(dir, "source/voice.wav"), original = join(dir, "source/voice.original.wav");
  if (!existsSync(voice)) return;
  if (!existsSync(original)) copyFileSync(voice, original);
  const key = apiKey();
  const created = await call<Production>("productions.json", key, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata: { title }, algorithms: ALGORITHMS, output_files: OUTPUTS }),
  });
  const form = new FormData();
  form.append("input_file", await openAsBlob(original), "voice.wav");
  await call(`production/${created.uuid}/upload.json`, key, { method: "POST", body: form });
  await call(`production/${created.uuid}/start.json`, key, { method: "POST" });
  let p = created;
  for (let last = ""; ; await new Promise((ok) => setTimeout(ok, 5000))) {
    p = await call<Production>(`production/${created.uuid}.json`, key);
    if (p.status_string !== last) log(`  Auphonic: ${(last = p.status_string)}`);
    if (p.status === DONE) break;
    if (p.status === ERROR) throw new Error(`Auphonic failed: ${p.error_message}`);
  }
  const out = join(dir, "build/auphonic");
  mkdirSync(out, { recursive: true });
  for (const f of p.output_files) {
    const res = await fetch(f.download_url, { headers: { Authorization: `bearer ${key}` } });
    if (!res.ok) throw new Error(`Auphonic download ${f.filename}: ${res.status}`);
    writeFileSync(join(out, safeAuphonicFilename(f.filename)), Buffer.from(await res.arrayBuffer()));
  }
  const wav = p.output_files.find((f) => f.format === "wav-24bit");
  if (!wav) throw new Error("Auphonic returned no voice");
  const wavFile = join(out, safeAuphonicFilename(wav.filename));
  // A change in length would slide every graphic off its word, so it never replaces the voice.
  const [before, after] = [probeDuration(original), probeDuration(wavFile)];
  if (Math.abs(before - after) > 0.05) throw new Error(`Auphonic changed the length: ${before.toFixed(3)}s to ${after.toFixed(3)}s`);
  ffmpeg(["-i", wavFile, "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le", `${voice}.new.wav`], log);
  renameSync(`${voice}.new.wav`, voice);
  ffmpeg(["-i", voice, "-c:a", "aac", "-b:a", "192k", join(dir, "build/preview.m4a")], log);
}

export async function cleanProject(projects: string, slug: string, log: Log = () => {}) {
  const dir = join(projects, slug), clips = join(dir, "clips");
  await cleanVoice(dir, slug, log);
  if (existsSync(clips)) for (const id of readdirSync(clips)) await cleanVoice(join(clips, id), `${slug} ${id}`, log);
}
