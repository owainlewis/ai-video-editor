// Audio mix, stills and the final render. Rendering happens once, at the end: while editing, the
// player draws the plan live from the preview copy, so nothing here runs on each change.
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compositionFor } from "../effects/canvas.ts";
import { frameWindow, type Preview, type Range } from "../engine/parts.ts";
import { resolveProject } from "./project.ts";
import { type FlatCut, hasCut, renderCut } from "./cutrender.ts";
import { holdEnd, renderNoCta } from "./nocta.ts";
import { END_HOLD } from "../engine/cta.ts";
import type { Issue } from "../engine/resolve.ts";
import { FPS, type Log, loudness, probeAudioDuration, probeDuration, probeSize, probeVideoDuration, ROOT, run, tempSibling, writeJson } from "./tools.ts";

// `flat`: mix the flattened cut's voice, with the settings its export wrote.
export function mixAudio(projects: string, slug: string, log?: Log, flat?: FlatCut) {
  run("uv", ["run", "--quiet", "--with", "numpy", "--with", "scipy", "--with", "soundfile", "python", "-m", "audio.mix", join(projects, slug), ...(flat ? ["build/audio.export.json"] : [])], { log });
}

const ensureResolved = (projects: string, slug: string, flat?: FlatCut) => {
  const { resolved, issues } = resolveProject(projects, slug, flat);
  const errors = issues.filter((i) => i.level === "error");
  if (!resolved || errors.length) throw new Error(errors.map((i) => i.message).join("\n") || "the plan does not resolve");
  return resolved;
};

// One still per moment, for checking a change without a render. Writes checks/stills/<t>.jpg.
export function stills(projects: string, slug: string, times: number[], log?: Log): string[] {
  const resolved = ensureResolved(projects, slug);
  const out = join(projects, slug, "checks/stills");
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) rmSync(join(out, f));
  const comp = compositionFor(resolved.canvas).id;
  return times.map((t) => {
    const file = join(out, `${t.toFixed(2)}.jpg`);
    run("npx", ["remotion", "still", "effects/index.ts", comp, file, `--props=${join(projects, slug, "build/edit.resolved.json")}`,
      `--frame=${Math.min(Math.round(resolved.duration * FPS) - 1, Math.round(t * FPS))}`, "--scale=0.5", "--log=error"], { log });
    return file;
  });
}

// The plain cover card as an image (a .jpg), drawn from the plan's `cover`: the stand-in when a reel
// has no cover.png from Higgsfield. It is not part of the reel. Async, so the server stays
// responsive while Remotion bundles and draws it.
export function coverStill(projects: string, slug: string, file: string, log?: Log): Promise<void> {
  const resolved = ensureResolved(projects, slug);
  const props = join(projects, slug, "build/cover.props.json");
  writeJson(props, { ...resolved, asCover: true });
  const argv = ["remotion", "still", "effects/index.ts", compositionFor(resolved.canvas).id, file, `--props=${props}`,
    "--frame=0", "--scale=1", "--image-format=jpeg", "--jpeg-quality=95", "--log=error"];
  log?.(`$ npx ${argv.join(" ")}`.slice(0, 200));
  return new Promise((ok, fail) => {
    const p = spawn("npx", argv, { cwd: ROOT });
    let tail = "";
    const read = (c: Buffer) => (tail = (tail + c.toString()).slice(-2000));
    p.stdout.on("data", read);
    p.stderr.on("data", read);
    p.on("error", fail);
    p.on("close", (code, signal) => (code === 0 ? ok() : fail(new Error(`the cover still failed:\n${tail || (signal ? `signal ${signal}` : `exit ${code}`)}`))));
  });
}

// After a reel's export: the length the plan says, the reel's size, sound that runs the whole way,
// and the loudness. Written to checks/export-check.json, which approving a reel reads (2026-11-13).
export function verifyReel(out: string, length: number, size: [number, number]) {
  const issues: Issue[] = [];
  const got = probeDuration(out);
  if (!Number.isFinite(got)) issues.push({ level: "error", message: "could not measure the export duration" });
  else if (Math.abs(got - length) > 0.15) issues.push({ level: "error", message: `the export is ${got.toFixed(2)}s; the plan is ${length.toFixed(2)}s` });
  const [w, h] = probeSize(out);
  if (w !== size[0] || h !== size[1]) issues.push({ level: "error", message: `the export is ${w}x${h}; a reel is ${size[0]}x${size[1]}` });
  // The picture can stop short of the file too: a held last frame that never came (2026-11-14).
  const picture = probeVideoDuration(out);
  if (!Number.isFinite(picture)) issues.push({ level: "error", message: "could not measure the export video duration" });
  else if (Number.isFinite(got) && Math.abs(picture - got) > 0.15) issues.push({ level: "error", message: `the picture runs ${picture.toFixed(2)}s of the ${got.toFixed(2)}s file` });
  const sound = probeAudioDuration(out);
  if (!Number.isFinite(sound)) issues.push({ level: "error", message: "the export has no sound" });
  else if (Number.isFinite(got) && Math.abs(sound - got) > 0.15) issues.push({ level: "error", message: `the sound runs ${sound.toFixed(2)}s of the ${got.toFixed(2)}s picture` });
  const lufs = loudness(out);
  if (!Number.isFinite(lufs)) issues.push({ level: "error", message: "could not measure the export loudness" });
  else if (lufs > -10 || lufs < -18) issues.push({ level: "warn", message: `loudness is ${lufs} LUFS; Instagram plays around -14` });
  return { issues, lufs, length: got, size: `${w}x${h}` };
}

// What every export does before its picture. A cut is flattened from the originals first, and the
// export draws the picture from that file. The order matters: resolving with the flat files writes
// the settings the mix reads, and resolving after the mix picks it up.
// `range`: a YouTube part flattens only that stretch of the picture. The audio is still mixed whole
// and the render takes its stretch of it, so a part sounds exactly as it will in the finished video.
export async function prepareExport(projects: string, slug: string, onStage: (stage: string) => void, log?: Log, range?: Range) {
  ensureResolved(projects, slug);
  const flat = hasCut(projects, slug) ? await renderCut(projects, slug, onStage, log, range) : undefined;
  if (flat) ensureResolved(projects, slug, flat);
  onStage("Mixing audio");
  mixAudio(projects, slug, log, flat);
  return { flat, resolved: ensureResolved(projects, slug, flat) };
}

// The finished video: mix the audio, then render every frame. Progress comes from Remotion's
// "Rendered n/total" lines. `preview`: one part only, to its own file; a reel is short, so its cut is
// flattened whole and Remotion draws just those frames, with the mix's sound at those frames.
export async function renderFinal(projects: string, slug: string, onProgress: (done: number, total: number) => void, log?: Log, onStage: (stage: string) => void = () => {}, preview?: Preview): Promise<string> {
  const { flat, resolved } = await prepareExport(projects, slug, onStage, log);
  const out = join(projects, slug, "renders", preview?.file ?? "final.mp4");
  mkdirSync(join(projects, slug, "renders"), { recursive: true });
  const win = preview && frameWindow(preview.range, resolved.fps);
  // A whole reel renders to build/ first, then gets its end hold (END_HOLD) on the way to renders/.
  // A part preview renders to a sibling temp file in renders/ and renames into place on success.
  const drawn = preview ? tempSibling(out) : join(projects, slug, "build/render.mp4");
  try {
    await new Promise<void>((ok, fail) => {
      const p = spawn("npx", ["remotion", "render", "effects/index.ts", compositionFor(resolved.canvas).id, drawn, `--props=${join(projects, slug, flat ? "build/edit.export.json" : "build/edit.resolved.json")}`, ...(win ? [`--frames=${win.a}-${win.b - 1}`] : [])], { cwd: ROOT });
      let tail = "";
      const read = (chunk: Buffer) => {
        const s = chunk.toString();
        tail = (tail + s).slice(-4000);
        const m = [...s.matchAll(/Rendered (\d+)\/(\d+)/g)].pop();
        if (m) onProgress(+m[1], +m[2]);
      };
      p.stdout.on("data", read);
      p.stderr.on("data", read);
      p.on("error", fail);
      p.on("close", (code, signal) => (code === 0 ? ok() : fail(new Error(`render failed:\n${tail || (signal ? `signal ${signal}` : `exit ${code}`)}`))));
    });
    if (preview) renameSync(drawn, out);
    else holdEnd(drawn, out, resolved.duration, END_HOLD, log);
  } catch (e) {
    if (preview) rmSync(drawn, { force: true });
    throw e;
  }
  const file = out;
  onStage("Checking the export");
  const comp = compositionFor(resolved.canvas);
  const size: [number, number] = [comp.width, comp.height];
  const check = verifyReel(file, win ? (win.b - win.a) / resolved.fps : resolved.duration + END_HOLD, size);
  // A whole export also makes the version without the call to action (engine/cta.ts), and the
  // export check covers both, so approval never copies one that failed.
  let noCta: { length: number; lufs: number } | undefined;
  if (!preview) {
    if (resolved.cta) onStage("Making the version without the call to action");
    const made = renderNoCta(join(projects, slug), resolved, file, flat ? "build/audio.export.json" : "build/audio.json", size, log);
    if (made) {
      check.issues.push(...made.check.issues.map((i) => ({ ...i, message: `without the call to action: ${i.message}` })));
      noCta = { length: made.check.length, lufs: made.check.lufs };
    }
  }
  writeJson(join(projects, slug, preview ? `checks/${preview.file.replace(/\.mp4$/, "")}-check.json` : "checks/export-check.json"), { at: new Date().toISOString(), ...check, ...(noCta ? { noCta } : {}) });
  for (const i of check.issues) log?.(`${i.level === "error" ? "ERROR" : "warn "}  ${i.message}`);
  return file;
}
