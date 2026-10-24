// Studio's command line. The editor uses it for long jobs; Claude uses it to check and preview edits.
//   npm run dev                                   start the editor at http://localhost:4747
//   npm run studio -- ingest <file> [--slug s]     import a clip: working copy, preview, transcript, starter plan
//   npm run studio -- check <slug>                 resolve the plan, print the shots and every issue
//   npm run studio -- stills <slug> --at 3.2,8    render stills at those seconds to checks/stills/
//   npm run studio -- render <slug>                mix the audio and render renders/final.mp4
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ingest, setStatus, slugFor } from "./media/ingest.ts";
import { resolveProject } from "./media/project.ts";
import { renderFinal, stills } from "./media/render.ts";
import { ROOT, writeJson } from "./media/tools.ts";
import { startServer } from "./server/index.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const [cmd, target] = args;
const projects = join(ROOT, "projects");
const log = (line: string) => console.log(`  ${line}`);

async function main() {
  switch (cmd) {
    case "serve": {
      const { url } = await startServer(parseInt(flag("port") ?? "4747"));
      console.log(`Studio is running at ${url}`);
      return;
    }
    case "ingest": {
      if (!target || !existsSync(target)) throw new Error("ingest needs a video file");
      const slug = flag("slug") ?? slugFor(target);
      await ingest(projects, resolve(target), slug, log);
      console.log(`Imported projects/${slug}. Open it in the editor, or run: npm run studio -- check ${slug}`);
      return;
    }
    case "check": {
      const { resolved, issues } = resolveProject(projects, need(target));
      if (resolved) {
        console.log(`${resolved.canvas === "youtube" ? "youtube 16:9" : "reel 9:16"}: ${resolved.shots.length} shots, ${resolved.duration.toFixed(1)}s\n`);
        for (const s of resolved.shots)
          console.log(`  ${s.start.toFixed(2).padStart(7)} ${(s.end - s.start).toFixed(2).padStart(5)}s  ${s.layout.padEnd(7)} ${(s.visual?.kind ?? "").padEnd(10)} ${s.anchor}`);
      }
      for (const i of issues) console.log(`  ${i.level === "error" ? "ERROR" : "warn "}  ${i.message}`);
      if (issues.some((i) => i.level === "error")) process.exitCode = 1;
      else console.log(`\nOK. The editor has reloaded.`);
      return;
    }
    case "stills": {
      const times = (flag("at") ?? "").split(",").map(Number).filter((n) => !Number.isNaN(n));
      if (!times.length) throw new Error("stills needs --at with seconds, e.g. --at 3.2,8");
      for (const f of stills(projects, need(target), times, log)) console.log(f);
      return;
    }
    case "render": {
      const slug = need(target);
      const dir = join(projects, slug);
      setStatus(dir, "Rendering");
      try {
        let last = -1;
        const out = await renderFinal(projects, slug, (done, total) => {
          const pct = Math.floor((100 * done) / total);
          if (pct !== last && pct % 2 === 0) setStatus(dir, `Rendering ${pct}%`), (last = pct);
        }, log);
        writeJson(join(dir, "status.json"), { stage: "Rendered", done: true, at: new Date().toISOString() });
        console.log(`Rendered ${out}`);
      } catch (e) {
        writeJson(join(dir, "status.json"), { stage: "Render failed", done: true, error: String((e as Error).message), at: new Date().toISOString() });
        throw e;
      }
      return;
    }
    default:
      console.log("Commands: serve, ingest <file>, check <slug>, stills <slug> --at <s>, render <slug>");
  }
}

function need(slug: string | undefined): string {
  if (!slug || !existsSync(join(projects, slug, "project.json"))) throw new Error(`no project ${slug ?? ""}`);
  return slug;
}

main().catch((e) => {
  console.error(String(e.message ?? e));
  process.exit(1);
});
