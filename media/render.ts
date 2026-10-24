// Audio mix, stills and the final render. Rendering happens once, at the end: while editing, the
// player draws the plan live from the preview copy, so nothing here runs on each change.
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compositionFor } from "../effects/canvas.ts";
import { resolveProject } from "./project.ts";
import { FPS, type Log, ROOT, run } from "./tools.ts";

export function mixAudio(projects: string, slug: string, log?: Log) {
  run("uv", ["run", "--quiet", "--with", "numpy", "--with", "scipy", "--with", "soundfile", "python", "-m", "audio.mix", join(projects, slug)], { log });
}

const ensureResolved = (projects: string, slug: string) => {
  const { resolved, issues } = resolveProject(projects, slug);
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

// The finished video: mix the audio, then render every frame. Progress comes from Remotion's
// "Rendered n/total" lines.
export function renderFinal(projects: string, slug: string, onProgress: (done: number, total: number) => void, log?: Log): Promise<string> {
  ensureResolved(projects, slug);
  mixAudio(projects, slug, log);
  const resolved = ensureResolved(projects, slug);
  const out = join(projects, slug, "renders/final.mp4");
  mkdirSync(join(projects, slug, "renders"), { recursive: true });
  return new Promise((ok, fail) => {
    const p = spawn("npx", ["remotion", "render", "effects/index.ts", compositionFor(resolved.canvas).id, out, `--props=${join(projects, slug, "build/edit.resolved.json")}`], { cwd: ROOT });
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
