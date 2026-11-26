// The mix, for the editor: the voice with the music bed and every sound effect, as the export will
// mix them, in a light file the player can play. Review then covers sound, not only picture. It is
// the real mix (audio/mix.py) on the plan as it is now, written beside the export's files, never
// over them. A project with a cut gets its voice joined from the clips' voice tracks first; the
// export's own join (media/cutrender.ts) is frame-exact and crossfaded, this one is for listening.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { placed } from "../engine/cut.ts";
import { clipDir, loadCut } from "./bin.ts";
import { resolveProject } from "./project.ts";
import { ffmpeg, type Log, readJson, run, tempSibling, writeJson } from "./tools.ts";

// Each mix has its own file name, from what it was made of: the player keeps a file it has already
// loaded, so a new mix under the old name would never be heard.
const outFor = (key: string) => `build/preview-mix-${key.slice(0, 10)}.m4a`;
const STATE = "build/preview-mix.json";

// Everything the mix is made from: the plan's sound (music, effects, length), the cut, and the
// voice files. A change to any of it makes the last mix out of date.
function mixKey(dir: string): string {
  const { cut, explicit } = loadCut(dir);
  const voices = explicit ? [...new Set(cut.segments.map((s) => s.src))].map((id) => join(clipDir(dir, id), "source/voice.wav")) : [join(dir, "source/voice.wav")];
  const h = createHash("md5").update(readFileSync(join(dir, "build/audio.json")));
  if (explicit) h.update(JSON.stringify(cut));
  for (const v of voices) h.update(existsSync(v) ? `${v}:${statSync(v).mtimeMs}` : v);
  return h.digest("hex");
}

// The last preview mix, for the editor: its file, and whether the plan's sound has changed since.
// Call after the plan is resolved, which writes build/audio.json.
export function mixState(dir: string, slug: string): { file: string; at: number; fresh: boolean } | null {
  if (!existsSync(join(dir, STATE)) || !existsSync(join(dir, "build/audio.json"))) return null;
  const { key } = readJson<{ key: string }>(join(dir, STATE));
  if (!existsSync(join(dir, outFor(key)))) return null;
  return { file: `${slug}/${outFor(key)}`, at: statSync(join(dir, outFor(key))).mtimeMs, fresh: key === mixKey(dir) };
}

export function previewMix(projects: string, slug: string, log?: Log, onStage: (stage: string) => void = () => {}): string {
  const dir = join(projects, slug);
  const { resolved, issues } = resolveProject(projects, slug);
  if (!resolved) throw new Error(issues.map((i) => i.message).join("\n") || "the plan does not resolve");
  const key = mixKey(dir);
  mkdirSync(join(dir, "build/preview"), { recursive: true });
  let config = "build/audio.json";
  const { cut, explicit } = loadCut(dir);
  if (explicit) {
    // The cut's voice: each segment from its clip's voice track, end to end.
    onStage("Joining the voice");
    const segs = placed(cut).filter((s) => s.end > s.start);
    const inputs = segs.flatMap((s) => {
      const voice = join(clipDir(dir, s.src), "source/voice.wav");
      const length = (s.end - s.start).toFixed(6);
      return existsSync(voice) ? ["-ss", s.in.toFixed(6), "-t", length, "-i", voice] : ["-f", "lavfi", "-t", length, "-i", "anullsrc=r=48000:cl=stereo"];
    });
    if (!segs.length) throw new Error("the cut is empty");
    ffmpeg([...inputs, "-filter_complex", `${segs.map((_, k) => `[${k}:a]aresample=48000,aformat=channel_layouts=stereo[a${k}]`).join(";")};${segs.map((_, k) => `[a${k}]`).join("")}concat=n=${segs.length}:v=0:a=1[out]`, "-map", "[out]", "-c:a", "pcm_s24le", join(dir, "build/preview/voice.wav")], log);
    config = "build/audio.preview.json";
    writeJson(join(dir, config), { ...readJson<object>(join(dir, "build/audio.json")), voice: "build/preview/voice.wav" });
  }
  onStage("Mixing audio");
  run("uv", ["run", "--quiet", "--with", "numpy", "--with", "scipy", "--with", "soundfile", "python", "-m", "audio.mix", dir, config, "build/preview/mix.wav"], { log });
  const out = join(dir, outFor(key));
  const outName = basename(out);
  const tmp = tempSibling(out);
  try {
    ffmpeg(["-i", join(dir, "build/preview/mix.wav"), "-c:a", "aac", "-b:a", "192k", tmp], log);
    renameSync(tmp, out);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
  writeJson(join(dir, STATE), { key, at: new Date().toISOString() });
  for (const f of readdirSync(join(dir, "build"))) {
    if (/^preview-mix-.*\.m4a$/.test(f) && f !== outName) rmSync(join(dir, "build", f), { force: true });
  }
  return out;
}
