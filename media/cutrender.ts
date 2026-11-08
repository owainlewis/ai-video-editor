// Flatten a project's cut to one picture file and one voice file, from the original clips, before
// the export lays graphics over them. The picture is never drawn through Remotion (it shifts the
// colour, RULES.md 2026-10-24): ffmpeg trims each segment from its original to an exact number of
// frames, and the segments are joined without encoding again. The voice comes from each clip's
// lossless voice track, crossfaded over 5 ms at every join so no join clicks.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placed } from "../engine/cut.ts";
import { clipDir, clips, loadCut } from "./bin.ts";
import { ffmpeg, ffmpegProgress, hasHardwareH264, type Log, probeDuration, probeRate, probeSize, readJson } from "./tools.ts";

const SR = 48000;
// The crossfade at a join: the segment before runs on this long under the start of the next one.
export const XFADE = 0.005;

// Frame edges of each segment on the timeline, rounded on the running total so the picture's
// length always matches the timeline's to the frame, however many joins there are.
export const segmentFrames = (starts: { start: number; end: number }[], fps: number) =>
  starts.map((s) => ({ a: Math.round(s.start * fps), b: Math.round(s.end * fps) })).map(({ a, b }) => ({ a, n: b - a }));

export type FlatCut = { video: string; voice: string; picture: string };

export async function renderCut(projects: string, slug: string, onStage: (stage: string) => void, log?: Log): Promise<FlatCut> {
  const dir = join(projects, slug);
  const { cut, explicit } = loadCut(dir);
  if (!explicit) throw new Error("this project has no cut to render");
  const bin = new Map(clips(dir).map((c) => [c.id, c]));
  const work = join(dir, "build/cut");
  mkdirSync(work, { recursive: true });
  for (const f of readdirSync(work)) rmSync(join(work, f), { recursive: true });

  // The finished picture takes the main clip's original size and frame rate; other clips are fitted to it.
  // (or its working copy's, if the original has moved)
  const original = readJson<{ original: string }>(join(dir, "project.json")).original;
  const main = existsSync(original) ? original : join(dir, "source/talking.mp4");
  const [num, den] = probeRate(main);
  const fps = num / den;
  const [w, h] = probeSize(main);
  const hw = hasHardwareH264();
  // Encoded once at a high rate; the graphics pass encodes the finished file from this.
  const enc = hw ? ["-c:v", "h264_videotoolbox", "-b:v", w >= 3840 ? "90M" : "35M"] : ["-c:v", "libx264", "-crf", "12", "-preset", "fast"];

  const segs = placed(cut);
  const frames = segmentFrames(segs, fps);
  const total = frames.reduce((t, f) => t + f.n, 0) / fps;
  const pictures: string[] = [];
  const voices: string[] = [];
  for (const [k, s] of segs.entries()) {
    const { n } = frames[k];
    if (n <= 0) continue;
    onStage(`Cutting ${k + 1}/${segs.length}`);
    const clip = bin.get(s.src);
    const at = clipDir(dir, s.src);
    // The original file, or the clip's working copy if the original has moved.
    let source = clip?.original ?? "";
    if (!existsSync(source)) {
      log?.(`warn  the original of ${s.src} is missing (${source}); using its working copy`);
      source = join(at, "source/talking.mp4");
    }
    const dur = n / fps;
    // The segment starts on the frame showing at its in point. Footage from a phone or a screen
    // recorder often has a variable frame rate, and an exact seek drops the frame still on screen
    // there. So: seek up to two seconds early, turn the footage into a constant rate on a grid from
    // that point, and drop exactly the frames before the in point. The last frame is held if the
    // source runs short, and the segment is exactly n frames.
    const lead = Math.min(Math.round(2 * fps), Math.floor(s.in * fps));
    const seek = s.in - lead / fps;
    const pic = join(work, `${String(k).padStart(4, "0")}.mp4`);
    await ffmpegProgress([
      "-ss", seek.toFixed(6), "-i", source, "-t", (lead / fps + dur + 1).toFixed(6), "-an",
      "-vf", `fps=${num}/${den}:start_time=0,trim=start_frame=${lead},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,tpad=stop_mode=clone:stop=${Math.ceil(fps)},trim=end_frame=${n}`,
      ...enc, "-pix_fmt", "yuv420p", "-r", `${num}/${den}`, pic,
    ], dur, () => {}, log);
    const got = parseInt(execFileSync("ffprobe", ["-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", pic], { encoding: "utf8" }), 10);
    if (got !== n) throw new Error(`segment ${k + 1} (${s.src} ${s.in.toFixed(3)}-${s.out.toFixed(3)}s) came out ${got} frames; it should be ${n}`);
    pictures.push(pic);
    // The voice for this segment plus a short tail, faded into the next segment below.
    const voice = join(at, "source/voice.wav");
    const tail = k < segs.length - 1 ? XFADE : 0;
    const samples = Math.round((dur + tail) * SR);
    const wav = join(work, `${String(k).padStart(4, "0")}.wav`);
    if (existsSync(voice))
      ffmpeg(["-ss", s.in.toFixed(6), "-i", voice, "-t", (dur + tail + 0.1).toFixed(6), "-af", `aresample=${SR},apad,atrim=end_sample=${samples}`, "-ac", "2", "-c:a", "pcm_s24le", wav], log);
    else ffmpeg(["-f", "lavfi", "-i", `anullsrc=r=${SR}:cl=stereo`, "-af", `atrim=end_sample=${samples}`, "-c:a", "pcm_s24le", wav], log);
    voices.push(wav);
  }
  if (!pictures.length) throw new Error("the cut is empty");

  onStage("Joining the cut");
  const list = join(work, "pictures.txt");
  writeFileSync(list, pictures.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const picture = join(work, "picture.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", picture], log);

  // Each join: the segment before's 5 ms tail fades out as the next fades in, from the next
  // segment's first sample, so every segment still starts on its own frame.
  const voiceOut = join(work, "voice.wav");
  const chain = voices.length === 1 ? "[0:a]anull[v]" : voices.slice(1).map((_, k) => `${k ? `[x${k}]` : "[0:a]"}[${k + 1}:a]acrossfade=d=${XFADE}:c1=tri:c2=tri${k === voices.length - 2 ? "[v]" : `[x${k + 1}]`}`).join(";");
  ffmpeg([...voices.flatMap((v) => ["-i", v]), "-filter_complex", `${chain};[v]atrim=end_sample=${Math.round(total * SR)},apad=whole_len=${Math.round(total * SR)}[out]`, "-map", "[out]", "-c:a", "pcm_s24le", voiceOut], log);

  // The picture and the voice must both be the timeline's length, or graphics drift off their words.
  const [pl, vl] = [probeDuration(picture), probeDuration(voiceOut)];
  if (Math.abs(pl - total) > 0.5 / fps || Math.abs(vl - total) > 0.002)
    throw new Error(`the flattened cut is ${pl.toFixed(3)}s of picture and ${vl.toFixed(3)}s of voice; the timeline is ${total.toFixed(3)}s`);
  for (const f of [...pictures, ...voices, list]) rmSync(f);
  return { video: `${slug}/build/cut/picture.mp4`, voice: "build/cut/voice.wav", picture };
}

export const hasCut = (projects: string, slug: string) => loadCut(join(projects, slug)).explicit;
