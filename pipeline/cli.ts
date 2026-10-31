// edit: the video pipeline. Raw footage in, a cut out, one step at a time. Each step writes its own
// file in projects/<slug>/ and records itself in status.json, so any step can be checked and rerun.
//
//   npm run edit -- new <slug> --camera <file> [--screen <file>] [--audio <file>] [--from s --to s]
//   npm run edit -- sync <slug>         line the screen recording and the clean audio up with the camera
//   npm run edit -- proxy <slug>        small working copies (720p) of the range we edit
//   npm run edit -- transcript <slug>   every word with its time
//   npm run edit -- sift <slug>         cut dead air and retakes, choose camera or screen: cut.json
//   npm run edit -- rough <slug>        play the cut: renders/rough.mp4
//   npm run edit -- run <slug>          every step that is not done yet
//   npm run edit -- status <slug>
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fromTakes, phrases, sift, type Levels, type Take, type Word } from "./sift.ts";
import { assign, perSecond, type Segment } from "./angles.ts";

// ROOT is Studio's root. Pipeline projects live in pipeline/projects/<slug>/ (git-ignored) until the
// pipeline writes Studio's own project and cut (phase 2 of the design).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PY = join(ROOT, "pipeline/py");
const PROJECTS = join(ROOT, "pipeline", "projects");
const CHUNK = 240; // seconds of audio Whisper hears at a time

type Project = { camera: string; screen?: string; audio?: string; from?: number; to?: number };
type Sync = Record<"screen" | "audio", { offset: number; corr: number; drift: number } | undefined>;
type Cut = { summary: ReturnType<typeof sift>["summary"]; segments: Segment[]; cuts: ReturnType<typeof sift>["cuts"] };

const STEPS = ["sync", "proxy", "transcript", "sift", "rough"] as const;
type Step = (typeof STEPS)[number];

// `npm run edit` runs from the repo root; file arguments are relative to where it was typed.
if (process.env.INIT_CWD) process.chdir(process.env.INIT_CWD);
const args = process.argv.slice(2);
const [cmd, slug] = args;
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const dir = () => join(PROJECTS, slug);
const path = (...p: string[]) => join(dir(), ...p);
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file: string, data: unknown) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};
const run = (bin: string, argv: string[]) => {
  const r = spawnSync(bin, argv, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${bin} failed:\n${(r.stderr || "").slice(-2000)}`);
  return r.stdout;
};
const ffmpeg = (argv: string[]) => run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argv]);
const py = (script: string, argv: string[]) => run("uv", ["run", "-q", join(PY, script), ...argv]);
const duration = (file: string) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));
const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, "0")}`;

const project = () => readJson<Project>(path("project.json"));
const status = (): Partial<Record<Step, { at: string; note: string }>> =>
  existsSync(path("status.json")) ? readJson(path("status.json")) : {};
const done = (step: Step, note: string) => {
  writeJson(path("status.json"), { ...status(), [step]: { at: new Date().toISOString(), note } });
  console.log(`✓ ${step}: ${note}`);
};

// The range we edit, in camera seconds.
const range = (p: Project) => {
  const from = p.from ?? 0;
  return { from, length: (p.to ?? duration(p.camera)) - from };
};

const steps: Record<Step, () => void> = {
  // Cross-correlate ten minutes of audio near the start, then again near the end to measure drift.
  sync() {
    const p = project();
    const total = duration(p.camera);
    const out: Sync = { screen: undefined, audio: undefined };
    const tmp = path("build/sync");
    mkdirSync(tmp, { recursive: true });
    const grab = (file: string, at: number, name: string) => {
      ffmpeg(["-ss", at.toFixed(3), "-t", "600", "-i", file, "-vn", "-ac", "1", "-ar", "8000", join(tmp, name)]);
      return join(tmp, name);
    };
    const others = (["screen", "audio"] as const).filter((k) => p[k]);
    const first = JSON.parse(py("offset.py", [grab(p.camera, 0, "cam0.wav"), ...others.map((k) => grab(p[k]!, 0, `${k}0.wav`))]));
    const late = Math.max(0, total - 900);
    const second = JSON.parse(
      py("offset.py", [grab(p.camera, late, "cam1.wav"), ...others.map((k, i) => grab(p[k]!, Math.max(0, late + first[i].offset), `${k}1.wav`))]),
    );
    others.forEach((k, i) => (out[k] = { offset: first[i].offset, corr: first[i].corr, drift: second[i].offset }));
    for (const k of others) {
      const s = out[k]!;
      if (s.corr < 0.2) throw new Error(`${k}: no clear match with the camera audio (corr ${s.corr})`);
      if (Math.abs(s.drift) > 0.04) throw new Error(`${k}: drifts ${s.drift}s over the recording; needs a speed fix`);
    }
    writeJson(path("sync.json"), out);
    done("sync", others.map((k) => `${k} ${out[k]!.offset >= 0 ? "+" : ""}${out[k]!.offset}s (drift ${out[k]!.drift}s)`).join(", ") || "camera only");
  },

  proxy() {
    const p = project();
    const sync = readJson<Sync>(path("sync.json"));
    const { from, length } = range(p);
    const video = (file: string, at: number, name: string) =>
      ffmpeg(["-ss", at.toFixed(3), "-t", length.toFixed(3), "-i", file, "-an", "-vf", "scale=if(gt(iw\\,ih)\\,1280\\,720):-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", path("proxy", name)]);
    mkdirSync(path("proxy"), { recursive: true });
    video(p.camera, from, "camera.mp4");
    if (p.screen) video(p.screen, from + sync.screen!.offset, "screen.mp4");
    const voice = p.audio ? { file: p.audio, at: from + sync.audio!.offset } : { file: p.camera, at: from };
    ffmpeg(["-ss", voice.at.toFixed(3), "-t", length.toFixed(3), "-i", voice.file, "-vn", "-ac", "1", "-ar", "48000", path("proxy/voice.wav")]);
    done("proxy", `${clock(length)} from ${clock(from)}${p.audio ? ", clean audio" : ", camera audio"}`);
  },

  // Whisper drops whole passages on a long file, so it hears the audio in chunks of about four
  // minutes, each split at the quietest moment near its boundary.
  transcript() {
    const tmp = path("build/whisper");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const voice = path("proxy/voice.wav");
    const { step, db } = JSON.parse(py("levels.py", [voice])) as Levels;
    const total = duration(voice);
    const edges = [0];
    for (let t = CHUNK; t < total - 30; t += CHUNK) {
      const lo = Math.floor((t - 15) / step);
      const window = db.slice(lo, Math.floor((t + 15) / step));
      edges.push((lo + window.indexOf(Math.min(...window))) * step);
    }
    edges.push(total);
    const chunks = edges.slice(0, -1).map((start, i) => {
      const file = join(tmp, `chunk${String(i).padStart(3, "0")}.wav`);
      ffmpeg(["-ss", start.toFixed(3), "-to", edges[i + 1].toFixed(3), "-i", voice, "-ac", "1", "-ar", "16000", file]);
      return { start, file };
    });
    py("transcribe.py", chunks.map((c) => c.file));
    const words: Word[] = chunks.flatMap(({ start, file }) => {
      const data = readJson<{ words: { word: string; start: number; end: number }[] }>(file.replace(/\.wav$/, ".json"));
      return data.words
        .filter((w) => w.word.trim())
        .map((w) => ({ text: w.word.trim(), start: +(start + w.start).toFixed(3), end: +(start + w.end).toFixed(3) }));
    });
    writeJson(path("transcript.json"), words);
    writeFileSync(path("transcript.txt"), words.map((w) => `${w.start.toFixed(2).padStart(7)} ${w.text}`).join("\n") + "\n");
    done("transcript", `${words.length} words`);
  },

  sift() {
    const words = readJson<Word[]>(path("transcript.json"));
    const voice = path("proxy/voice.wav");
    const levels = JSON.parse(py("levels.py", [voice])) as Levels;
    writeFileSync(path("build/phrases.txt"), phrases(words, levels).map((p, i) => `${i} [${clock(p[0].start)}] ${p.map((w) => w.text).join(" ")}`).join("\n") + "\n");
    // Scores come from the proxies, or from build/angles.json when the whole recording was scored
    // without proxies (one score per camera second).
    const angles = existsSync(path("proxy/screen.mp4")) ? perSecond(angleScores())
      : existsSync(path("build/angles.json")) ? perSecond(readJson<number[]>(path("build/angles.json"))) : [];
    const screenTime = (segments: Segment[]) => clock(segments.filter((x) => x.angle === "screen").reduce((t, x) => t + x.end - x.start, 0));
    const total = duration(voice);
    // With the editor's takes.json, play those takes; without it, the rules alone (pauses and
    // word-for-word retakes) make the first pass.
    if (existsSync(path("takes.json"))) {
      const { ranges } = fromTakes(words, levels, readJson<Take[]>(path("takes.json")));
      const segments = assign(ranges, angles);
      const after = ranges.reduce((t, r) => t + r.end - r.start, 0);
      const summary = { cuts: ranges.length, retakes: 0, before: +total.toFixed(2), after: +after.toFixed(2), percentCut: Math.round((1 - after / total) * 100) };
      writeJson(path("cut.json"), { summary, segments, cuts: [] } satisfies Cut);
      done("sift", `takes.json: ${ranges.length} pieces, ${clock(total)} to ${clock(after)}, ${summary.percentCut}% cut, ${screenTime(segments)} on screen`);
      return;
    }
    const result = sift(words, levels, total);
    const segments = assign(result.keeps, angles);
    writeJson(path("cut.json"), { summary: result.summary, segments, cuts: result.cuts } satisfies Cut);
    const s = result.summary;
    done("sift", `${s.cuts} cuts (${s.retakes} retakes), ${clock(s.before)} to ${clock(s.after)}, ${s.percentCut}% cut, ${screenTime(segments)} on screen`);
  },

  rough() {
    const { segments } = readJson<Cut>(path("cut.json"));
    if (!existsSync(path("proxy/camera.mp4"))) return roughFromOriginals(segments);
    const inputs = ["-i", path("proxy/camera.mp4"), "-i", path("proxy/screen.mp4"), "-i", path("proxy/voice.wav")];
    const hasScreen = existsSync(path("proxy/screen.mp4"));
    if (!hasScreen) inputs.splice(2, 2);
    const voiceIn = hasScreen ? 2 : 1;
    const parts = segments.map((s, i) => {
      const v = s.angle === "screen" && hasScreen ? 1 : 0;
      const len = s.end - s.start;
      const fade = Math.min(0.01, len / 4);
      return `[${v}:v]trim=${s.start.toFixed(3)}:${s.end.toFixed(3)},setpts=PTS-STARTPTS,fps=24000/1001[v${i}];` +
        `[${voiceIn}:a]atrim=${s.start.toFixed(3)}:${s.end.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${fade},afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade}[a${i}]`;
    });
    const graph = `${parts.join(";")};${segments.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${segments.length}:v=1:a=1[v][a]`;
    mkdirSync(path("build"), { recursive: true });
    writeFileSync(path("build/rough.filter"), graph);
    mkdirSync(path("renders"), { recursive: true });
    ffmpeg([...inputs, "-filter_complex_script", path("build/rough.filter"), "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-b:a", "192k", path("renders/rough.mp4")]);
    done("rough", `renders/rough.mp4, ${clock(duration(path("renders/rough.mp4")))}`);
  },
};

// Without proxies (a long recording), each piece is read straight from the original files, scaled
// to 720p, then the pieces are joined. Only the kept minutes are decoded.
function roughFromOriginals(segments: Segment[]) {
  const p = project();
  const sync = readJson<Sync>(path("sync.json"));
  const { from } = range(p);
  const tmp = path("build/pieces");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const list = segments.map((s, i) => {
    const screen = s.angle === "screen" && p.screen;
    const file = screen ? p.screen! : p.camera;
    const at = from + s.start + (screen ? sync.screen!.offset : 0);
    const len = s.end - s.start;
    const fade = Math.min(0.01, len / 4);
    const out = join(tmp, `${String(i).padStart(4, "0")}.mp4`);
    ffmpeg(["-hwaccel", "videotoolbox", "-ss", at.toFixed(3), "-t", len.toFixed(3), "-i", file, "-ss", s.start.toFixed(3), "-t", len.toFixed(3), "-i", path("proxy/voice.wav"),
      "-map", "0:v", "-map", "1:a", "-vf", "scale=1280:-2,fps=24000/1001", "-af", `afade=t=in:d=${fade},afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade}`,
      "-c:v", "h264_videotoolbox", "-b:v", "6M", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out]);
    return `file '${out}'`;
  });
  writeFileSync(join(tmp, "list.txt"), list.join("\n") + "\n");
  mkdirSync(path("renders"), { recursive: true });
  ffmpeg(["-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-c", "copy", path("renders/rough.mp4")]);
  done("rough", `renders/rough.mp4, ${clock(duration(path("renders/rough.mp4")))}, from the original files`);
}

function angleScores(): number[] {
  const gray = (name: string) => {
    const out = path("build", `${name}.gray`);
    ffmpeg(["-i", path("proxy", `${name}.mp4`), "-vf", "fps=1,scale=64:36,format=gray", "-f", "rawvideo", out]);
    return out;
  };
  const scores = JSON.parse(py("angles.py", [gray("camera"), gray("screen")])) as number[];
  writeJson(path("build/angles.json"), scores);
  return scores;
}

function printStatus() {
  const s = status();
  for (const step of STEPS) console.log(`${s[step] ? "✓" : "○"} ${step.padEnd(11)} ${s[step]?.note ?? ""}`);
}

if (!cmd || (!slug && cmd !== "help")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n"));
  process.exit(cmd ? 1 : 0);
}

if (cmd === "new") {
  const camera = flag("camera");
  if (!camera) throw new Error("--camera is required");
  const num = (n: string) => (flag(n) ? Number(flag(n)) : undefined);
  const abs = (f?: string) => (f ? resolve(f) : undefined);
  const p: Project = { camera: resolve(camera), screen: abs(flag("screen")), audio: abs(flag("audio")), from: num("from"), to: num("to") };
  writeJson(path("project.json"), p);
  console.log(`pipeline/projects/${slug}/project.json written`);
} else if (cmd === "status") {
  printStatus();
} else if (cmd === "run") {
  for (const step of STEPS) if (!status()[step]) steps[step]();
  printStatus();
} else if ((STEPS as readonly string[]).includes(cmd)) {
  steps[cmd as Step]();
} else {
  throw new Error(`unknown command: ${cmd}`);
}
