// Flatten a project's cut to one picture file and one voice file, from the original clips, before
// the export lays graphics over them. The picture is never drawn through Remotion (it shifts the
// colour, RULES.md 2026-10-24): ffmpeg trims each segment from its original to an exact number of
// frames, and the segments are joined without encoding again. The voice comes from each clip's
// lossless voice track, faded in and out over 5 ms at every join so no join clicks.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placed } from "../engine/cut.ts";
import { frameWindow, type Range, segmentInWindow } from "../engine/parts.ts";
import { clipDir, clips, loadCut } from "./bin.ts";
import { ffmpeg, ffmpegProgress, hasHardwareH264, type Log, probeDuration, probeRate, probeSize, readJson } from "./tools.ts";

const SR = 48000;
// The fade at each end of a segment's voice, so a join never clicks.
export const XFADE = 0.005;

// Frame edges of each segment on the timeline, rounded on the running total so the picture's
// length always matches the timeline's to the frame, however many joins there are.
export const segmentFrames = (starts: { start: number; end: number }[], fps: number) =>
  starts.map((s) => ({ a: Math.round(s.start * fps), b: Math.round(s.end * fps) })).map(({ a, b }) => ({ a, n: b - a }));

export type FlatCut = { video: string; voice: string; picture: string };

// `range`: flatten only that stretch of the picture, for the render of one part (the slow half on a
// long video). The voice is always the whole cut's, so the mix is the finished video's mix.
export async function renderCut(projects: string, slug: string, onStage: (stage: string) => void, log?: Log, range?: Range): Promise<FlatCut> {
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
  const win = range ? frameWindow(range, fps) : null;
  const pictureLength = win ? (win.b - win.a) / fps : total;
  const pictures: string[] = [];
  const voices: string[] = [];
  for (const [k, s] of segs.entries()) {
    const { n } = frames[k];
    if (n <= 0) continue;
    const at = clipDir(dir, s.src);
    const dur = n / fps;
    const take = win ? segmentInWindow(frames[k], win) : { skip: 0, n };
    if (take) {
      onStage(`Cutting ${k + 1}/${segs.length}`);
      const clip = bin.get(s.src);
      // The original file, or the clip's working copy if the original has moved.
      let source = clip?.original ?? "";
      if (!existsSync(source)) {
        log?.(`warn  the original of ${s.src} is missing (${source}); using its working copy`);
        source = join(at, "source/talking.mp4");
      }
      const from = s.in + take.skip / fps;
      const shown = take.n / fps;
      // The segment starts on the frame showing at its in point. Footage from a phone or a screen
      // recorder often has a variable frame rate, and an exact seek drops the frame still on screen
      // there. So: seek up to two seconds early, turn the footage into a constant rate on a grid from
      // that point, and drop exactly the frames before the in point. The last frame is held if the
      // source runs short, and the segment is exactly n frames.
      const lead = Math.min(Math.round(2 * fps), Math.floor(from * fps));
      const seek = from - lead / fps;
      const pic = join(work, `${String(k).padStart(4, "0")}.mp4`);
      await ffmpegProgress([
        "-ss", seek.toFixed(6), "-i", source, "-t", (lead / fps + shown + 1).toFixed(6), "-an",
        "-vf", `fps=${num}/${den}:start_time=0,trim=start_frame=${lead},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,tpad=stop_mode=clone:stop=${Math.ceil(fps)},trim=end_frame=${take.n}`,
        ...enc, "-pix_fmt", "yuv420p", "-r", `${num}/${den}`, pic,
      ], shown, () => {}, log);
      const got = parseInt(execFileSync("ffprobe", ["-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", pic], { encoding: "utf8" }), 10);
      if (got !== take.n) throw new Error(`segment ${k + 1} (${s.src} ${s.in.toFixed(3)}-${s.out.toFixed(3)}s) came out ${got} frames; it should be ${take.n}`);
      pictures.push(pic);
    }
    // The voice for this segment, exactly its frames long, with a short fade at each end.
    const voice = join(at, "source/voice.wav");
    const samples = Math.round(dur * SR);
    const wav = join(work, `${String(k).padStart(4, "0")}.wav`);
    if (existsSync(voice))
      ffmpeg(["-ss", s.in.toFixed(6), "-i", voice, "-t", (dur + 0.1).toFixed(6), "-af", `aresample=${SR},apad,atrim=end_sample=${samples},afade=t=in:d=${XFADE},afade=t=out:st=${(dur - XFADE).toFixed(6)}:d=${XFADE}`, "-ac", "2", "-c:a", "pcm_s24le", wav], log);
    else ffmpeg(["-f", "lavfi", "-i", `anullsrc=r=${SR}:cl=stereo`, "-af", `atrim=end_sample=${samples}`, "-c:a", "pcm_s24le", wav], log);
    voices.push(wav);
  }
  if (!pictures.length) throw new Error("the cut is empty");

  onStage("Joining the cut");
  const list = join(work, "pictures.txt");
  writeFileSync(list, pictures.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const picture = join(work, "picture.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", picture], log);

  // The segments' voices end to end, each on its own frame. Not padded, so the length check below
  // sees any voice that came out short. A chain of acrossfades did, at random, with 16 segments
  // (egm-reel-v3, 2026-11-11): the voice stopped at 25.8 s and apad filled the rest with silence.
  const voiceOut = join(work, "voice.wav");
  const chain = `${voices.map((_, k) => `[${k}:a]`).join("")}concat=n=${voices.length}:v=0:a=1[out]`;
  ffmpeg([...voices.flatMap((v) => ["-i", v]), "-filter_complex", chain, "-map", "[out]", "-c:a", "pcm_s24le", voiceOut], log);

  // The picture and the voice must both be the timeline's length, or graphics drift off their words.
  const [pl, vl] = [probeDuration(picture), probeDuration(voiceOut)];
  if (Math.abs(pl - pictureLength) > 0.5 / fps || Math.abs(vl - total) > 0.002)
    throw new Error(`the flattened cut is ${pl.toFixed(3)}s of picture and ${vl.toFixed(3)}s of voice; expected ${pictureLength.toFixed(3)}s and ${total.toFixed(3)}s`);
  for (const f of [...pictures, ...voices, list]) rmSync(f);
  return { video: `${slug}/build/cut/picture.mp4`, voice: "build/cut/voice.wav", picture };
}

export const hasCut = (projects: string, slug: string) => loadCut(join(projects, slug)).explicit;
