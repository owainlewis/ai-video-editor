// Audio mix, stills and the final render. Rendering happens once, at the end: while editing, the
// player draws the plan live from the preview copy, so nothing here runs on each change.
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compositionFor } from "../effects/canvas.ts";
import { frameWindow, type Preview, type Range } from "../engine/parts.ts";
import { resolveProject } from "./project.ts";
import { type FlatCut, hasCut, renderCut } from "./cutrender.ts";
import { FPS, type Log, ROOT, run } from "./tools.ts";

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
  return new Promise((ok, fail) => {
    const p = spawn("npx", ["remotion", "render", "effects/index.ts", compositionFor(resolved.canvas).id, out, `--props=${join(projects, slug, flat ? "build/edit.export.json" : "build/edit.resolved.json")}`, ...(win ? [`--frames=${win.a}-${win.b - 1}`] : [])], { cwd: ROOT });
    let tail = "";
    const read = (chunk: Buffer) => {
      const s = chunk.toString();
      tail = (tail + s).slice(-4000);
      const m = [...s.matchAll(/Rendered (\d+)\/(\d+)/g)].pop();
      if (m) onProgress(+m[1], +m[2]);
    };
    p.stdout.on("data", read);
    p.stderr.on("data", read);
    p.on("close", (code) => (code === 0 ? ok(out) : fail(new Error(`render failed:\n${tail}`))));
  });
}
