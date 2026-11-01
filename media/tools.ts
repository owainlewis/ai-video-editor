// Small wrappers around ffmpeg, ffprobe and JSON files, shared by ingest, project resolution and render.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const FPS = 30;

export type Log = (line: string) => void;

export const run = (bin: string, argv: string[], opts: { cwd?: string; env?: Record<string, string>; log?: Log } = {}) => {
  opts.log?.(`$ ${bin} ${argv.join(" ")}`.slice(0, 200));
  const r = spawnSync(bin, argv, { cwd: opts.cwd ?? ROOT, encoding: "utf8", env: { ...process.env, ...opts.env }, maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${bin} failed:\n${(r.stderr || r.stdout || "").slice(-2000)}`);
  return r;
};

export const ffmpeg = (argv: string[], log?: Log) => run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argv], { log });

// ffmpeg with progress: calls onProgress with 0..1 as it works through `duration` seconds of input.
export const ffmpegProgress = (argv: string[], duration: number, onProgress: (f: number) => void, log?: Log) =>
  new Promise<void>((ok, fail) => {
    log?.(`$ ffmpeg ${argv.join(" ")}`.slice(0, 200));
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-progress", "pipe:1", "-nostats", ...argv], { cwd: ROOT });
    let err = "";
    p.stdout.on("data", (c: Buffer) => {
      const m = [...c.toString().matchAll(/out_time_us=(\d+)/g)].pop();
      if (m && duration > 0) onProgress(Math.min(1, +m[1] / 1e6 / duration));
    });
    p.stderr.on("data", (c: Buffer) => (err = (err + c.toString()).slice(-2000)));
    p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg failed:\n${err}`))));
  });

// Whether this Mac's hardware H.264 encoder works; it is several times faster than libx264.
let hardware: boolean | undefined;
export const hasHardwareH264 = () =>
  (hardware ??= spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=320x240:d=0.2", "-c:v", "h264_videotoolbox", "-f", "null", "-"]).status === 0);

export const probeDuration = (file: string) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));

export const probeSize = (file: string): [number, number] => {
  const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" })
    .trim()
    .split(",")
    .map(Number);
  return [w, h];
};

export const probeRate = (file: string): [number, number] => {
  const [num, den] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", file], { encoding: "utf8" })
    .trim()
    .split("/")
    .map(Number);
  return [num, den || 1];
};

export const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8"));

export const writeJson = (file: string, data: unknown) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};

// Where speech ends in a voice track: the start of the silence that runs to the end of the file,
// counting back-to-back silences as one. The full duration when it ends mid-word.
export function speechEnd(file: string): number {
  const total = probeDuration(file);
  const log = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=noise=-38dB:d=0.3", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  let k = starts.length - 1;
  if (k < 0 || (ends.length === starts.length && ends[k] < total - 0.05)) return total;
  while (k > 0 && starts[k] - ends[k - 1] < 0.05) k--;
  return starts[k];
}

// Pixel size of a PNG or JPEG, so the renderer can frame captures exactly.
export const imageSize = (file: string): [number, number] | undefined => {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return undefined;
};

// The level (mean dB) of up to `n` pauses between words, spread across the take, for telling
// whether the cut already carries music under the voice. Each pause is measured inside its edges.
export function pauseLevels(file: string, words: { start: number; end: number }[], n = 16): number[] {
  const gaps = words.slice(1).map((w, i) => [words[i].end + 0.08, w.start - 0.08] as const).filter(([a, b]) => b - a >= 0.3);
  const pick = gaps.length <= n ? gaps : Array.from({ length: n }, (_, k) => gaps[Math.floor((k * gaps.length) / n)]);
  return pick.flatMap(([a, b]) => {
    const log = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-ss", a.toFixed(2), "-t", Math.min(0.6, b - a).toFixed(2), "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
    const m = /mean_volume: (-?[\d.]+) dB/.exec(log);
    return m ? [parseFloat(m[1])] : [];
  });
}
