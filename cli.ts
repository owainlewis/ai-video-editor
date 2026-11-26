// Studio's command line. The editor uses it for long jobs; Claude uses it to check and preview edits.
//   npm run dev                                   start the editor at http://localhost:4747
//   npm run studio -- ingest <file> [--slug s] [--canvas reel|youtube] [--title t]   import a clip
//   npm run studio -- clip <slug> <file> [--id c] [--name n]   add a clip to a project's bin (cut it in from the editor)
//   npm run studio -- check <slug>                 resolve the plan, print the shots and every issue
//   npm run studio -- stills <slug> --at 3.2,8    render stills at those seconds to checks/stills/
//   npm run studio -- cover <slug> [--prompt]     the plain cover card (renders/cover.jpg, cover-grid.jpg), or --prompt for the Higgsfield kit
//   npm run studio -- frames <slug> [--every 15]   YouTube: contact sheets of the video with timestamps
//   npm run studio -- scan <slug> --ref 6,1215     YouTube: where the speaker is on camera (graphics only go there)
//   npm run studio -- broll [words]                search the shared b-roll library (broll index: add new clips)
//   npm run studio -- qc <slug> [--at 12,95] [--cached]   check every graphic's layout, timing and content before rendering
//   npm run studio -- qc --library [--canvas youtube|reel] [--card quote]   the same checks on every card in the style
//   npm run studio -- mix <slug>                   mix the sound as the export will, for the editor to play (build/preview-mix.m4a)
//   npm run studio -- record <slug>                film the real pages in record.json, timed to the spoken words
//   npm run studio -- capture <slug> <url> [--name n] [--from "heading"] [--to "next heading"] [--dark] [--session name] [--click "Tab"] [--scale 3] [--width 900] [--height 1400]
//   npm run studio -- signin <name> <url>                                         sign in once for pages behind a login
//                                                  a live page's section as a crisp PNG and its words' boxes, to assets/pages/
//   npm run studio -- auphonic <slug>              clean the voice with Auphonic (timing unchanged; key in .env)
//   npm run studio -- render <slug> [--force]      QC, then mix the audio and render renders/final.mp4
//   npm run studio -- render <slug> --part <name>  the same for one part only, to renders/part-<name>.mp4
//   npm run studio -- render <slug> --from <s> --to <s>   the same for a stretch of the timeline
//   npm run studio -- approve <slug>              copy a reel's export, image and caption to the approved folder (STUDIO_APPROVED)
//   npm run studio -- unapprove <slug>            move them to the Trash again
//   npm run studio -- approved                    approved reels, newest first, and this week's count
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { addClip, ingest, setStatus, slugFor } from "./media/ingest.ts";
import { cleanProject } from "./media/auphonic.ts";
import { pickPreview } from "./engine/parts.ts";
import { resolveProject } from "./media/project.ts";
import { record } from "./media/record.ts";
import { capture } from "./media/capture.ts";
import { signin } from "./media/session.ts";
import { previewMix } from "./media/previewmix.ts";
import { coverStill, renderFinal, stills } from "./media/render.ts";
import { coverKit } from "./media/coverkit.ts";
import { Edit } from "./engine/schema.ts";
import { exportOverOriginal } from "./media/export.ts";
import { LIBRARY_QC, runLibraryQc, runQc } from "./media/qc.ts";
import { existsSync as exists, readFileSync, rmSync, writeFileSync } from "node:fs";
import { brollFolder, describeLibrary, indexLibrary, searchLibrary } from "./media/broll.ts";
import { checkSuggestions } from "./server/suggest.ts";
import { frameSheets, scanCamera } from "./media/scan.ts";
import { readJson, ROOT, run, writeJson } from "./media/tools.ts";
import { approve, folderLabel, listApproved, unapprove, weekCount } from "./media/approve.ts";
import { day } from "./engine/approve.ts";
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
      const canvas = flag("canvas");
      await ingest(projects, resolve(target), slug, log, { canvas: canvas === "reel" || canvas === "youtube" ? canvas : undefined, title: flag("title") });
      console.log(`Imported projects/${slug}. Open it in the editor, or run: npm run studio -- check ${slug}`);
      return;
    }
    case "clip": {
      const file = args[2];
      if (!file || !existsSync(file)) throw new Error("clip needs a project and a video file");
      const slug = need(target);
      const id = flag("id") ?? slugFor(file);
      await addClip(projects, slug, resolve(file), id, log, flag("name"));
      console.log(`Added ${id} to projects/${slug}/clips. Drag it onto the A-roll track in the editor.`);
      return;
    }
    case "auphonic": {
      if (!target) throw new Error("auphonic needs a project");
      await cleanProject(projects, target, log);
      console.log(`Voice cleaned in projects/${target}. The original is source/voice.original.wav.`);
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
    case "qc": {
      if (target === "--library") {
        const canvas = flag("canvas") === "reel" ? "reel" : flag("canvas") === "youtube" ? "youtube" : undefined;
        const { issues, sheets } = await runLibraryQc({ canvas, card: flag("card") }, undefined, (stage) => process.stdout.write(`\r  ${stage.padEnd(60)}`));
        console.log("");
        for (const i of issues) console.log(`  ${i.level === "error" ? "ERROR" : "warn "}  ${i.message}`);
        console.log(`\n${issues.filter((i) => i.level === "error").length} errors, ${issues.filter((i) => i.level === "warn").length} warnings. ${sheets.length} overview sheets in ${LIBRARY_QC.replace(ROOT + "/", "")}/`);
        if (issues.some((i) => i.level === "error")) process.exitCode = 1;
        return;
      }
      const slug = need(target);
      const at = flag("at")?.split(",").map(Number);
      // From the editor (`--status --cached`): progress goes to status.json, and graphics that have
      // not changed since they were last measured keep their result.
      const dir = join(projects, slug);
      const status = args.includes("--status");
      if (status) setStatus(dir, "Checking graphics");
      let result: Awaited<ReturnType<typeof runQc>>;
      try {
        result = await runQc(projects, slug, undefined, (stage) => (status ? setStatus(dir, stage) : console.log(`  ${stage}`)), at, undefined, args.includes("--cached"));
      } catch (e) {
        if (status) writeJson(join(dir, "status.json"), { stage: "QC failed", done: true, error: String((e as Error).message), at: new Date().toISOString() });
        throw e;
      }
      if (status) writeJson(join(dir, "status.json"), { stage: "Checked", done: true, at: new Date().toISOString() });
      const { issues, sheets, overview } = result;
      for (const i of issues) console.log(`  ${i.level === "error" ? "ERROR" : "warn "}  ${i.message}`);
      console.log(`\n${issues.filter((i) => i.level === "error").length} errors, ${issues.filter((i) => i.level === "warn").length} warnings. ${sheets.length} contact sheets in projects/${slug}/checks/qc/${overview ? "; overview.jpg shows every graphic settled" : ""}`);
      if (issues.some((i) => i.level === "error")) process.exitCode = 1;
      return;
    }
    case "mix": {
      const slug = need(target);
      const dir = join(projects, slug);
      const status = args.includes("--status");
      try {
        const out = previewMix(projects, slug, status ? undefined : log, (stage) => (status ? setStatus(dir, stage) : console.log(`  ${stage}`)));
        if (status) writeJson(join(dir, "status.json"), { stage: "Mixed", done: true, at: new Date().toISOString() });
        console.log(`Mixed ${out}`);
      } catch (e) {
        if (status) writeJson(join(dir, "status.json"), { stage: "Mix failed", done: true, error: String((e as Error).message), at: new Date().toISOString() });
        throw e;
      }
      return;
    }
    case "record": {
      console.log(`Wrote ${await record(projects, need(target), log)}`);
      return;
    }
    case "capture": {
      const url = args[2];
      if (!url || url.startsWith("--")) throw new Error("capture needs a URL: npm run studio -- capture <slug> <url>");
      const num = (n: string) => (flag(n) ? Number(flag(n)) : undefined);
      const { png, json } = await capture(projects, need(target), url, { name: flag("name"), from: flag("from"), to: flag("to"), dark: args.includes("--dark"), session: flag("session"), click: flag("click"), scale: num("scale"), width: num("width"), height: num("height") }, log);
      console.log(`Wrote ${png}\n      ${json}`);
      return;
    }
    case "signin": {
      const url = args[2];
      if (!target || !url) throw new Error("signin needs a name and a URL: npm run studio -- signin <name> <url>");
      console.log(`Wrote ${await signin(target, url, log)}`);
      return;
    }
    case "stills": {
      const times = (flag("at") ?? "").split(",").map(Number).filter((n) => !Number.isNaN(n));
      if (!times.length) throw new Error("stills needs --at with seconds, e.g. --at 3.2,8");
      for (const f of stills(projects, need(target), times, log)) console.log(f);
      return;
    }
    case "frames": {
      for (const f of frameSheets(join(projects, need(target)), parseInt(flag("every") ?? "15"), log)) console.log(f);
      console.log("Look at the sheets, pick two or three times where the speaker is on camera, then run scan with --ref.");
      return;
    }
    case "scan": {
      const refs = (flag("ref") ?? "").split(",").map(Number).filter((n) => n >= 0 && !Number.isNaN(n));
      const ranges = scanCamera(join(projects, need(target)), refs);
      const total = ranges.reduce((t, [a, b]) => t + b - a, 0);
      console.log(`On camera ${total.toFixed(0)}s, in ${ranges.length} stretches:`);
      for (const [a, b] of ranges) console.log(`  ${a.toFixed(1)}s to ${b.toFixed(1)}s (${(b - a).toFixed(1)}s)`);
      return;
    }
    case "variants": {
      const { resolveVariants } = await import("./server/variants.ts");
      const v = resolveVariants(join(projects, need(target)));
      if (!v?.items.length) {
        console.log("  ERROR  no takes in variants.json");
        process.exitCode = 1;
        return;
      }
      for (const it of v.items) for (const p of it.problems) console.log(`  ERROR  ${it.id} (${it.label}): ${p}`);
      if (v.items.some((it) => it.problems.length)) process.exitCode = 1;
      else console.log(`${v.items.length} takes, all valid.`);
      return;
    }
    case "suggestions": {
      const problems = checkSuggestions(join(projects, need(target)));
      for (const p of problems) console.log(`  ERROR  ${p}`);
      if (problems.length) process.exitCode = 1;
      else console.log("Suggestions are valid.");
      return;
    }
    case "broll": {
      // broll index | broll describe | broll [search words]
      if (target === "index") {
        const index = indexLibrary(log);
        const n = describeLibrary(log);
        console.log(`${index.length} shots in ${brollFolder()}${n ? `; described ${n} new ones` : ""}`);
        return;
      }
      if (target === "describe") return void console.log(`Described ${describeLibrary(log)} shots`);
      for (const c of searchLibrary(args.slice(1).filter((a) => !a.startsWith("--")).join(" ")))
        console.log(`  broll:${c.id.padEnd(14)} ${c.duration.toFixed(1).padStart(5)}s  light ${String(c.brightness).padStart(3)}  ${c.description || "(not described)"}  [${c.tags.join(", ")}]`);
      return;
    }
    case "render": {
      const slug = need(target);
      const dir = join(projects, slug);
      const ask = { part: flag("part"), from: flag("from"), to: flag("to") };
      let preview: ReturnType<typeof pickPreview>;
      if (ask.part !== undefined || ask.from !== undefined || ask.to !== undefined) {
        const { resolved, issues } = resolveProject(projects, slug);
        if (!resolved) throw new Error(issues.map((i) => i.message).join("\n") || "the plan does not resolve");
        preview = pickPreview(resolved.parts ?? [], resolved.duration, ask);
      }
      // One export at a time: two at once overwrite each other's sections (2026-10-25).
      const lock = join(dir, "build/export.lock");
      if (exists(lock)) {
        const pid = parseInt(readFileSync(lock, "utf8"), 10);
        let alive = false;
        try {
          process.kill(pid, 0);
          alive = true;
        } catch {}
        if (alive) throw new Error(`an export of ${slug} is already running (pid ${pid}); wait for it or stop it first`);
      }
      writeFileSync(lock, String(process.pid));
      try {
        // QC before anything renders: errors stop the export (--force to override).
        setStatus(dir, "Checking graphics");
        const qc = await runQc(projects, slug, log, (stage) => setStatus(dir, stage), undefined, preview?.range);
        const errors = qc.issues.filter((i) => i.level === "error");
        for (const i of qc.issues) console.log(`  ${i.level === "error" ? "ERROR" : "warn "}  ${i.message}`);
        if (errors.length && !args.includes("--force")) throw new Error(`QC found ${errors.length} errors; fix them (npm run studio -- qc ${slug}) or render with --force`);
      } catch (e) {
        rmSync(lock, { force: true });
        writeJson(join(dir, "status.json"), { stage: "Render failed", done: true, error: String((e as Error).message), at: new Date().toISOString() });
        throw e;
      }
      setStatus(dir, "Rendering");
      try {
        // YouTube videos keep the original picture and only render the graphic sections; reels are
        // short and graphics-heavy, so every frame is rendered.
        const youtube = readJson<{ canvas?: string }>(join(dir, "edit.json")).canvas === "youtube";
        let last = -1;
        const out = youtube
          ? await exportOverOriginal(projects, slug, (stage) => setStatus(dir, stage), log, preview)
          : await renderFinal(projects, slug, (done, total) => {
              const pct = Math.floor((100 * done) / total);
              if (pct !== last && pct % 2 === 0) setStatus(dir, `Rendering ${pct}%`), (last = pct);
            }, log, (stage) => setStatus(dir, stage), preview);
        writeJson(join(dir, "status.json"), { stage: "Rendered", done: true, at: new Date().toISOString() });
        console.log(`Rendered ${out}`);
      } catch (e) {
        writeJson(join(dir, "status.json"), { stage: "Render failed", done: true, error: String((e as Error).message), at: new Date().toISOString() });
        throw e;
      } finally {
        rmSync(lock, { force: true });
      }
      return;
    }
    case "cover": {
      // The cover as images to upload as the reel's cover: full size, and the 3:4 crop the grid shows.
      const slug = need(target);
      // --prompt: the kit for Higgsfield (portrait, logos, prompt) instead of drawing it here.
      if (args.includes("--prompt")) {
        const plan = readJson<{ cover?: unknown }>(join(projects, slug, "edit.json"));
        const cover = Edit.shape.cover.parse(plan.cover);
        if (!cover) throw new Error(`${slug} has no cover in its plan`);
        const kit = await coverKit(join(projects, slug), cover);
        console.log(`${kit}\n\n${readFileSync(join(kit, "prompt.txt"), "utf8")}\nMake it in Higgsfield with portrait.* and the logo files attached, then save it as projects/${slug}/cover.png; approve uses it.`);
        return;
      }
      const file = join(projects, slug, "renders/cover.jpg");
      mkdirSync(join(projects, slug, "renders"), { recursive: true });
      await coverStill(projects, slug, file, log);
      const grid = join(projects, slug, "renders/cover-grid.jpg");
      run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", "crop=1080:1440:0:240", "-q:v", "2", grid], { log });
      console.log(`${file}\n${grid}`);
      return;
    }
    case "approve": {
      const slug = need(target);
      const r = await approve(projects, slug, { log });
      console.log(`Approved ${slug}:\n  ${[r.video, r.noCta, r.cover].filter(Boolean).join("\n  ")}`);
      const w = weekCount(projects);
      console.log(`This week: ${w.count} of ${w.target} approved.`);
      return;
    }
    case "unapprove": {
      const r = unapprove(projects, need(target));
      console.log(`Moved to the Trash:\n  ${r.video}\n  ${r.cover}`);
      return;
    }
    case "approved": {
      const list = listApproved(projects);
      const w = weekCount(projects);
      if (!list.length) console.log(`No approved reels yet. They go to ${folderLabel()}.`);
      for (const { slug, record, state } of list)
        console.log(`  ${day(new Date(record.at))}  ${record.title}  (${slug})${state === "stale" ? "  OUT OF DATE: changed since it was approved" : ""}\n              ${record.video}`);
      console.log(`\nThis week: ${w.count} of ${w.target} approved.`);
      return;
    }
    default:
      console.log("Commands: serve, ingest <file>, check <slug>, qc <slug>, stills <slug> --at <s>, frames <slug>, scan <slug> --ref <s>, capture <slug> <url>, signin <name> <url>, render <slug> [--part <name> | --from <s> --to <s>] [--force], approve <slug>, unapprove <slug>, approved");
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
