// The version of a reel without its call to action (engine/cta.ts), made from the finished export
// so its picture is exactly the approved one: the picture up to the pause before the call to action,
// its last frame held for CTA_TAIL while the music fades, and its own mix, where the voice stops
// there and the music bed fades out at the new end. Writes renders/final-no-cta.mp4.
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { CTA_TAIL, noCtaLength } from "../engine/cta.ts";
import type { Resolved } from "../engine/schema.ts";
import { verifyReel } from "./render.ts";
import { ffmpeg, type Log, readJson, run, tempSibling, writeJson } from "./tools.ts";

// Hold a video's last frame `seconds` longer, in silence: how every reel ends (END_HOLD).
export function holdEnd(from: string, out: string, length: number, seconds: number, log?: Log) {
  mkdirSync(dirname(out), { recursive: true });
  const tmp = tempSibling(out);
  try {
    ffmpeg([
      "-i", from, "-filter_complex", `[0:v]tpad=stop_mode=clone:stop_duration=${seconds}[v];[0:a]apad[a]`,
      "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "320k", "-t", (length + seconds).toFixed(4), "-movflags", "+faststart", tmp,
    ], log);
    renameSync(tmp, out);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

export const NO_CTA = "renders/final-no-cta.mp4";

type AudioConfig = { duration: number; sfx: { t: number }[]; voiceEnd?: number };

// `config`: the audio settings the full export was mixed with (build/audio.json, or
// build/audio.export.json for a cut).
export function renderNoCta(dir: string, r: Resolved, final: string, config: string, size: [number, number], log?: Log) {
  const out = join(dir, NO_CTA);
  if (!r.cta) {
    rmSync(out, { force: true });
    return undefined;
  }
  const end = r.cta.end;
  const length = noCtaLength(r.cta);
  const cfg = readJson<AudioConfig>(join(dir, config));
  // A sound that lands from the pause on belongs to the call to action's graphics.
  writeJson(join(dir, "build/audio.nocta.json"), { ...cfg, duration: length, voiceEnd: end, sfx: cfg.sfx.filter((s) => s.t < end) });
  run("uv", ["run", "--quiet", "--with", "numpy", "--with", "scipy", "--with", "soundfile", "python", "-m", "audio.mix", dir, "build/audio.nocta.json", "build/mix-nocta.wav"], { log });
  mkdirSync(join(dir, "renders"), { recursive: true });
  const tmp = tempSibling(out);
  try {
    ffmpeg([
      // Cut on the input, not with trim: tpad after trim never sees the end, so no frame was held.
      "-t", end.toFixed(4), "-i", final, "-i", join(dir, "build/mix-nocta.wav"),
      "-filter_complex", `[0:v]tpad=stop_mode=clone:stop_duration=${CTA_TAIL}[v]`,
      "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "320k", "-t", length.toFixed(4), "-movflags", "+faststart", tmp,
    ], log);
    if (!existsSync(tmp)) throw new Error("the version without the call to action was not written");
    renameSync(tmp, out);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
  return { file: out, check: verifyReel(out, length, size) };
}
