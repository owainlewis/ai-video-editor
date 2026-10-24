// Small wrappers around ffmpeg, ffprobe and JSON files, shared by ingest, project resolution and render.
import { execFileSync, spawnSync } from "node:child_process";
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
