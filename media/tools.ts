// Small wrappers around ffmpeg, ffprobe and JSON files, shared by ingest, project resolution and render.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const FPS = 30;

// Pick an ephemeral free localhost TCP port.
export function freePort(): Promise<number> {
  return new Promise((ok, no) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", no);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close((err) => (err ? no(err) : ok(port)));
    });
  });
}

export type Log = (line: string) => void;

export const run = (bin: string, argv: string[], opts: { cwd?: string; env?: Record<string, string>; log?: Log } = {}) => {
  opts.log?.(`$ ${bin} ${argv.join(" ")}`.slice(0, 200));
  const r = spawnSync(bin, argv, { cwd: opts.cwd ?? ROOT, encoding: "utf8", env: { ...process.env, ...opts.env }, maxBuffer: 1 << 28 });
  if (r.error || r.status !== 0) {
    const parts: string[] = [];
    if (r.stderr) {
      parts.push(r.stderr.slice(-2000));
    } else {
      if (r.error?.message) parts.push(r.error.message);
      if (r.signal) parts.push(`signal ${r.signal}`);
      if (r.stdout) parts.push(r.stdout.slice(-2000));
    }
    throw new Error(`${bin} failed:\n${parts.join("\n") || `exit ${r.status}`}`);
  }
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
    p.on("error", fail);
    p.on("close", (code, signal) => (code === 0 ? ok() : fail(new Error(`ffmpeg failed:\n${err || (signal ? `signal ${signal}` : `exit ${code}`)}`))));
  });

// Whether this Mac's hardware H.264 encoder works; it is several times faster than libx264.
let hardware: boolean | undefined;
export const hasHardwareH264 = () =>
  (hardware ??= spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=320x240:d=0.2", "-c:v", "h264_videotoolbox", "-f", "null", "-"]).status === 0);

export const probeDuration = (file: string) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));

// Integrated loudness of a file's sound, in LUFS (NaN when it has none).
export function loudness(file: string): number {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr ?? "";
  const summaryAt = log.lastIndexOf("Summary");
  if (summaryAt < 0) return NaN;
  return parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(log.slice(summaryAt))?.[1] ?? "NaN");
}

// How long a file's first sound stream runs, in seconds (NaN when it has none).
export const probeAudioDuration = (file: string) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));
export const probeVideoDuration = (file: string) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));

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

// A setting from the environment, else from the repo's .env (NAME=value lines).
export function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  return line?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;
}

// A folder setting as a full path: "~" is the home folder, a relative path is from the repo.
export const expandHome = (p: string) => resolve(ROOT, p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

export const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8"));

let tempSeq = 0;

// A sibling temporary file path keeping the target's extension (so ffmpeg/Remotion pick the right
// container) and staying in the same directory for atomic renameSync.
export const tempSibling = (file: string) => {
  const ext = extname(file);
  const base = basename(file, ext);
  return join(dirname(file), `.${base}.${process.pid}.${++tempSeq}.tmp${ext}`);
};

export const writeJson = (file: string, data: unknown) => {
  const text = JSON.stringify(data, null, 2) + "\n";
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${++tempSeq}.tmp`;
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
};

// Where speech ends in a voice track: the start of the silence that runs to the end of the file,
// counting back-to-back silences as one. The full duration when it ends mid-word.
export function speechEnd(file: string): number {
  const total = probeDuration(file);
  const log = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=noise=-38dB:d=0.3", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr ?? "";
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  let k = starts.length - 1;
  if (k < 0 || (ends.length === starts.length && ends[k] < total - 0.05)) return total;
  while (k > 0 && starts[k] - ends[k - 1] < 0.05) k--;
  return starts[k];
}

type Probed = { stamp: string; duration?: number; size?: [number, number]; speechEnd?: number };

// A project's media measurements, kept in build/probe.json until a file's time or size changes, so
// resolving a plan does not measure the same files on every save. `save` swaps the file in whole:
// the editor and an export can resolve the same project at once.
export function mediaProbe(dir: string) {
  const store = join(dir, "build/probe.json");
  let saved: Record<string, Probed> = {};
  try {
    saved = readJson(store);
  } catch {
    // None yet, or unreadable: measure again.
  }
  let changed = false;
  const entry = (file: string) => {
    const { mtimeMs, size } = statSync(file);
    const stamp = `${mtimeMs}:${size}`;
    const key = relative(dir, file);
    if (saved[key]?.stamp !== stamp) (saved[key] = { stamp }), (changed = true);
    return saved[key];
  };
  const measure = (file: string, e: Probed) => {
    const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file], { encoding: "utf8" }));
    e.duration = parseFloat(j.format.duration);
    if (j.streams[0]) e.size = [j.streams[0].width, j.streams[0].height];
    changed = true;
  };
  const filled = (file: string) => {
    const e = entry(file);
    if (e.duration === undefined) measure(file, e);
    return e;
  };
  return {
    duration: (file: string) => filled(file).duration!,
    size: (file: string) => filled(file).size!,
    speechEnd: (file: string) => {
      const e = entry(file);
      if (e.speechEnd === undefined) (e.speechEnd = speechEnd(file)), (changed = true);
      return e.speechEnd;
    },
    save: () => {
      if (!changed) return;
      writeJson(store, saved);
      changed = false;
    },
  };
}

// Pixel size of a PNG or JPEG, so the renderer can frame captures exactly.
export const imageSize = (file: string): [number, number] | undefined => {
  const b = readFileSync(file);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 1 < b.length) {
      if (b[i] !== 0xff) break;
      while (i < b.length && b[i] === 0xff) i++;
      if (i >= b.length) break;
      const marker = b[i++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (i + 2 > b.length) break;
      const len = b.readUInt16BE(i);
      if (len < 2 || i + len > b.length) break;
      if (marker >= 0xc0 && marker <= 0xc3) {
        if (len < 7 || i + 7 > b.length) break;
        return [b.readUInt16BE(i + 5), b.readUInt16BE(i + 3)];
      }
      i += len;
    }
  }
  return undefined;
};
