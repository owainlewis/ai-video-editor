// Cut-outs of the speaker for "behind" graphics: a graphic on the wall with Owain in front of it
// (2026-10-24). Apple's Vision person segmentation (media/matte.swift) mattes each frame of the
// section. Each section gets two files in build/behind/, named by its frames:
//   <key>.webm      the speaker cut out with transparency (VP9), for the editor's player
//   <key>-mask.mp4  the matte alone, which the export uses to cut Owain out of the original 4K
// Only the few seconds a graphic is up are matted, and the results are cached.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ffmpeg, FPS, type Log, ROOT } from "./tools.ts";

const BIN = join(ROOT, ".cache/bin/matte");

// Compile the Swift tool once. The newest SDK can be ahead of the installed compiler, so try each
// installed SDK, newest first, until one builds.
function matteTool(log?: Log): string {
  if (existsSync(BIN)) return BIN;
  mkdirSync(join(ROOT, ".cache/bin"), { recursive: true });
  const sdks = "/Library/Developer/CommandLineTools/SDKs";
  const candidates = [undefined, ...(existsSync(sdks) ? readdirSync(sdks).filter((s) => /^MacOSX\d[\d.]*\.sdk$/.test(s)).sort().reverse().map((s) => join(sdks, s)) : [])];
  for (const sdk of candidates) {
    try {
      execFileSync("swiftc", ["-O", ...(sdk ? ["-sdk", sdk] : []), join(ROOT, "media/matte.swift"), "-o", BIN], { stdio: "pipe", env: { ...process.env, ...(sdk ? { SDKROOT: sdk } : {}) } });
      log?.(`compiled the matte tool${sdk ? ` against ${sdk}` : ""}`);
      return BIN;
    } catch {
      // try the next SDK
    }
  }
  throw new Error("could not compile media/matte.swift; install the Xcode command line tools");
}

export const matteKey = (start: number, end: number) => `${Math.round(start * FPS)}-${Math.round(end * FPS)}`;
export const mattePaths = (dir: string, key: string) => ({ webm: join(dir, "build/behind", `${key}.webm`), mask: join(dir, "build/behind", `${key}-mask.mp4`) });
export const hasMatte = (dir: string, key: string) => {
  const p = mattePaths(dir, key);
  return existsSync(p.webm) && existsSync(p.mask);
};

// Matte one section of the working copy, from `start` to `end` seconds, at 1920 wide.
export function makeMatte(dir: string, start: number, end: number, log?: Log) {
  const key = matteKey(start, end);
  if (hasMatte(dir, key)) return key;
  const tool = matteTool(log);
  const work = join(dir, "build/behind", `.${key}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "frames"), { recursive: true });
  mkdirSync(join(work, "masks"), { recursive: true });
  const from = Math.round(start * FPS) / FPS, length = Math.round((end - start) * FPS) / FPS;
  ffmpeg(["-ss", from.toFixed(4), "-t", length.toFixed(4), "-i", join(dir, "source/talking.mp4"), "-vf", "scale=1920:-2", join(work, "frames/%05d.png")], log);
  execFileSync(tool, [join(work, "frames"), join(work, "masks")], { stdio: "pipe" });
  const p = mattePaths(dir, key);
  ffmpeg(["-framerate", String(FPS), "-i", join(work, "masks/%05d.png"), "-c:v", "libx264", "-crf", "8", "-pix_fmt", "yuv420p", p.mask], log);
  ffmpeg(["-framerate", String(FPS), "-i", join(work, "frames/%05d.png"), "-framerate", String(FPS), "-i", join(work, "masks/%05d.png"),
    "-filter_complex", "[1:v]format=gray,erosion,gblur=sigma=1[m];[0:v]format=rgba[c];[c][m]alphamerge,format=yuva420p", "-c:v", "libvpx-vp9", "-b:v", "6M", "-auto-alt-ref", "0", "-pix_fmt", "yuva420p", p.webm], log);
  rmSync(work, { recursive: true, force: true });
  return key;
}

// Delete cut-outs no behind section uses any more (a section moved or was removed).
export function pruneMattes(dir: string, keep: string[]) {
  const d = join(dir, "build/behind");
  if (!existsSync(d)) return;
  for (const f of readdirSync(d)) {
    const key = f.replace(/(-mask)?\.(webm|mp4)$/, "");
    if (/\.(webm|mp4)$/.test(f) && !keep.includes(key)) rmSync(join(d, f));
  }
}
