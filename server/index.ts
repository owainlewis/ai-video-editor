// Studio's local server. Serves the editor (Vite), the project files (with byte ranges so video
// seeks) and a small JSON API. It watches every project's edit.json: whenever the plan changes,
// from the editor, from Claude in the chat panel or from Claude Code in a terminal, it saves a
// version, re-resolves the plan and tells the open editors to reload.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, watch } from "node:fs";
import { createServer as createHttp, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { createServer as createVite } from "vite";
import { resolveProject } from "../media/project.ts";
import { liveStatus, slugFor } from "../media/ingest.ts";
import { readJson, ROOT, writeJson } from "../media/tools.ts";
import { ask, isRunning, loadChat, runningNotes, stop } from "./agent.ts";
import { redo, redoable, snapshot, undo, versions } from "./history.ts";
import { type ActionData, type ActionName, Actions, isAction } from "../engine/api.ts";
import { finishSend, loadReview, saveNote, setItem, startSend } from "./review.ts";
import { qcState } from "../media/qc.ts";
import { mixState } from "../media/previewmix.ts";
import { planIndex } from "../engine/insert.ts";
import { trashProject } from "./trash.ts";
import { approval, approve, approvedFolder, loadRecord, unapprove } from "../media/approve.ts";
import { changeParts, dropBroll, editShot, moveShotEnd, moveShotStart, placeCard } from "./insert.ts";
import { decide, loadSuggestions, SUGGEST } from "./suggest.ts";
import { listAssets, saveAsset } from "./assets.ts";
import { clearVariants, loadVariants, resolveVariants, saveVariants, VARIANTS } from "./variants.ts";
import { BROLL, loadLibrary } from "../media/broll.ts";
import { cameraOnTimeline, clipDir, clipLevels, clips, timeline } from "../media/bin.ts";
import { effectList } from "../effects/preview.ts";
import type { Resolved } from "../engine/schema.ts";
import { lastKept } from "../engine/resolve.ts";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4", ".m4a": "audio/mp4", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json",
};

const send = (res: ServerResponse, code: number, data: unknown) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};

const body = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((ok, fail) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      try {
        ok(s ? JSON.parse(s) : {});
      } catch (e) {
        fail(e);
      }
    });
  });

export function serveFile(root: string, req: IncomingMessage, res: ServerResponse, prefix = ""): boolean {
  const path = decodeURIComponent((req.url ?? "").split(/[?#]/)[0]);
  if (!path.startsWith(prefix + "/")) return false;
  const file = normalize(join(root, path.slice(prefix.length)));
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return false;
  const size = statSync(file).size;
  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] ? +range[1] : size - +range[2];
    const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "cache-control": "no-cache" });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "cache-control": "no-cache" });
    createReadStream(file).pipe(res);
  }
  return true;
}

export async function startServer(port = 4747) {
  const projects = join(ROOT, "projects");
  mkdirSync(projects, { recursive: true });
  const dirOf = (slug: string) => {
    const dir = join(projects, slug);
    if (!/^[\w.-]+$/.test(slug) || !existsSync(join(dir, "project.json"))) throw Object.assign(new Error(`no project ${slug}`), { code: 404 });
    return dir;
  };
  const ready = (slug: string) => existsSync(join(projects, slug, "edit.json")) && existsSync(join(projects, slug, "transcript.json"));

  // Editors listening for changes.
  const clients = new Set<ServerResponse>();
  const broadcast = (event: Record<string, unknown>) => {
    for (const c of clients) c.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // A plan change: save a version, re-resolve, tell the editors. Debounced, since editors write in bursts.
  const timers = new Map<string, NodeJS.Timeout>();
  const planChanged = (slug: string) => {
    clearTimeout(timers.get(slug));
    timers.set(slug, setTimeout(() => {
      if (!ready(slug)) return;
      // While Claude works on a note it saves several times; the note becomes one version when it finishes.
      if (!isRunning(slug)) snapshot(join(projects, slug), "edit");
      try {
        resolveProject(projects, slug);
      } catch {
        // Shown on the next load; a half-written plan is normal while someone types.
      }
      broadcast({ type: "plan", slug });
    }, 150));
  };
  let libraryBusy = false;
  mkdirSync(BROLL, { recursive: true });
  watch(BROLL, (_e, file) => String(file) === "index.json" && broadcast({ type: "library" }));
  watch(projects, { recursive: true }, (_e, file) => {
    const parts = String(file ?? "").split(/[/\\]/);
    // An added clip's import reports in clips/<id>/status.json.
    if (parts.length === 4 && parts[1] === "clips" && parts[3] === "status.json") return broadcast({ type: "status", slug: parts[0] });
    if (parts.length !== 2) return;
    if (parts[1] === "edit.json" || parts[1] === "cut.json") planChanged(parts[0]);
    // status.json: a job's progress. approved.json: a reel approved or unapproved, from here or the CLI.
    if (parts[1] === "status.json" || parts[1] === "approved.json") broadcast({ type: "status", slug: parts[0] });
    if (parts[1] === "suggestions.json" || parts[1] === "variants.json") broadcast({ type: "plan", slug: parts[0] });
  });

  // Long jobs (ingest, render) run as CLI processes so the server stays responsive. They report
  // through the project's status.json.
  // Detached, so restarting the server never kills an import or a render halfway (2026-10-24).
  const job = (slug: string, args: string[]) => {
    mkdirSync(join(projects, slug), { recursive: true });
    const log = openSync(join(projects, slug, "job.log"), "a");
    spawn("npx", ["tsx", "cli.ts", ...args], { cwd: ROOT, stdio: ["ignore", log, log], detached: true }).unref();
  };

  const api = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean).slice(1).map(decodeURIComponent);

    if (parts[0] === "events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(": hi\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    // What a restart would cut off: Claude notes run inside this process. Imports and renders are
    // detached and survive one.
    if (parts[0] === "busy") return send(res, 200, { notes: runningNotes() });
    // Where approved reels go (STUDIO_APPROVED), for the desktop app's menu.
    if (parts[0] === "approved-folder") return send(res, 200, { path: approvedFolder() });

    if (parts[0] === "upload" && req.method === "POST") {
      const name = url.searchParams.get("name") ?? "clip.mp4";
      const title = url.searchParams.get("title") ?? "";
      const canvas = url.searchParams.get("canvas") === "reel" ? "reel" : url.searchParams.get("canvas") === "youtube" ? "youtube" : "";
      const base = slugFor(title || name);
      let slug = base;
      for (let i = 2; existsSync(join(projects, slug)); i++) slug = `${base}-${i}`;
      mkdirSync(join(projects, ".uploads"), { recursive: true });
      const file = join(projects, ".uploads", `${slug}${extname(name) || ".mp4"}`);
      await new Promise<void>((ok, fail) => req.pipe(createWriteStream(file)).on("finish", ok).on("error", fail));
      mkdirSync(join(projects, slug), { recursive: true });
      job(slug, ["ingest", file, "--slug", slug, ...(canvas ? ["--canvas", canvas] : []), ...(title ? ["--title", title] : [])]);
      return send(res, 200, { slug });
    }

    // The shared b-roll library. Adding a clip splits it into shots and has Claude describe them,
    // in a detached job; editors hear "library" when the index changes.
    if (parts[0] === "library") {
      if (req.method === "POST") {
        const clean = (url.searchParams.get("name") ?? "clip.mp4").replace(/[^\w.-]+/g, "-");
        if (!/\.(mp4|mov|m4v|mkv|webm)$/i.test(clean)) return send(res, 400, { error: "only video clips go in the b-roll library" });
        mkdirSync(BROLL, { recursive: true });
        let file = join(BROLL, clean);
        for (let i = 2; existsSync(file); i++) file = join(BROLL, clean.replace(/(\.\w+)$/, `-${i}$1`));
        await new Promise<void>((ok, fail) => req.pipe(createWriteStream(file)).on("finish", ok).on("error", fail));
        const log = openSync(join(BROLL, "job.log"), "a");
        libraryBusy = true;
        broadcast({ type: "library" });
        const p = spawn("npx", ["tsx", "cli.ts", "broll", "index"], { cwd: ROOT, stdio: ["ignore", log, log], detached: true });
        p.on("exit", () => ((libraryBusy = false), broadcast({ type: "library" })));
        p.unref();
        return send(res, 200, { ok: true });
      }
      return send(res, 200, { busy: libraryBusy, clips: loadLibrary().map((c) => ({ ...c, thumb: `library/${c.id}-thumb.jpg` })) });
    }

    if (parts[0] === "effects") {
      // Approved cards only, unless `all=1` (the gallery's review of candidates).
      const list = effectList(url.searchParams.get("canvas") === "reel" ? "reel" : "youtube");
      return send(res, 200, url.searchParams.get("all") === "1" ? list : list.filter((e) => e.approved));
    }

    // The gallery: every project's graphics, from the plan as last resolved, without captions.
    if (parts[0] === "gallery") {
      const list = readdirSync(projects, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith(".") && existsSync(join(projects, d.name, "build/edit.resolved.json")))
        .map((d) => {
          const file = join(projects, d.name, "build/edit.resolved.json");
          const resolved = readJson<Resolved>(file);
          return { slug: d.name, modified: statSync(file).mtimeMs, resolved: { ...resolved, chunks: [] } };
        })
        .filter((p) => p.resolved.shots?.some((s) => s.visual))
        .sort((a, b) => b.modified - a.modified);
      return send(res, 200, list);
    }

    if (parts[0] === "projects" && !parts[1]) {
      const list = readdirSync(projects, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => {
          const dir = join(projects, d.name);
          const status = liveStatus(dir);
          const meta = existsSync(join(dir, "project.json")) ? readJson<{ duration: number; size: [number, number] }>(join(dir, "project.json")) : null;
          const plan = existsSync(join(dir, "edit.json")) ? readJson<{ title?: string; canvas?: string }>(join(dir, "edit.json")) : null;
          // What the projects page shows on each card: a frame of the footage, whether it has been
          // exported, and how far the review has got (read from the file as it is, without merging).
          const reviewFile = join(dir, "review.json");
          const decided = existsSync(reviewFile) ? Object.values(readJson<{ items?: Record<string, { status: string }> }>(reviewFile).items ?? {}) : [];
          const edited = existsSync(join(dir, "edit.json")) ? statSync(join(dir, "edit.json")).mtimeMs : statSync(dir).mtimeMs;
          return {
            slug: d.name,
            title: plan?.title ?? d.name,
            canvas: plan?.canvas ?? "reel",
            duration: meta?.duration,
            status,
            modified: Math.max(edited, statSync(dir).mtimeMs),
            thumb: existsSync(join(dir, "checks/frame.jpg")) ? `${d.name}/checks/frame.jpg` : null,
            exported: existsSync(join(dir, "renders/final.mp4")),
            review: decided.length ? { approved: decided.filter((x) => x.status === "approved").length, total: decided.length } : null,
            // A reel's approval (media/approve.ts): its state, and when it was approved.
            approval: plan && plan.canvas !== "youtube" ? (({ state, record }) => ({ state, at: record?.at ?? null }))(approval(dir)) : null,
          };
        })
        .sort((a, b) => b.modified - a.modified);
      return send(res, 200, list);
    }

    if (parts[0] !== "projects" || !parts[1]) return send(res, 404, { error: "not found" });
    const slug = parts[1];
    // Delete works on any project folder, even one whose import failed before project.json.
    if (parts[2] === "delete" && req.method === "POST") {
      trashProject(projects, slug, isRunning(slug));
      broadcast({ type: "status", slug });
      return send(res, 200, { ok: true });
    }
    const dir = dirOf(slug);
    const action = parts[2];

    if (!action && req.method === "GET") {
      const status = liveStatus(dir);
      if (!ready(slug)) return send(res, 200, { slug, status });
      // The first version of a project; later ones come from the watcher and from finished notes.
      if (!versions(dir).length) snapshot(dir, "edit");
      const { resolved, issues } = resolveProject(projects, slug);
      const line = timeline(dir);
      // Each clip's levels (build/level.json), which the editor reads to snap trims to pauses.
      for (const c of clips(dir)) if (c.ready) clipLevels(dir, c.id);
      const bin = clips(dir);
      // The words only change with the cut or a transcript. An editor that already holds them says
      // so (`have`), and a reload after a plan change comes back without them.
      const transcripts = bin.filter((c) => c.ready).map((c) => join(clipDir(dir, c.id), "transcript.json"));
      const wordsKey = createHash("md5").update(JSON.stringify(line.cut)).update(transcripts.map((f) => `${f}:${statSync(f).mtimeMs}`).join("|")).digest("hex");
      const qc = resolved ? qcState(dir, resolved) : null;
      const checkFile = join(dir, "checks/export-check.json");
      return send(res, 200, {
        slug,
        status,
        resolved,
        issues,
        wordsKey,
        ...(url.searchParams.get("have") === wordsKey
          ? {}
          : {
              words: line.words,
              // Each clip's own words, for trimming to word edges.
              clipWords: Object.fromEntries(bin.filter((c) => c.ready).map((c, k) => [c.id, readJson(transcripts[k])])),
            }),
        // The media bin and the cut.
        bin,
        cut: line.cut,
        // Review before render: Owain's decision on each graphic, his notes, and the last QC run.
        review: resolved ? loadReview(dir, resolved, line.words) : null,
        qc: qc && {
          at: qc.at,
          partial: qc.partial,
          stale: qc.stale,
          other: qc.other,
          overview: existsSync(join(dir, "checks/qc/overview.jpg")) ? `${slug}/checks/qc/overview.jpg` : null,
          items: qc.items.map((x) => ({ ...x, sheet: `${slug}/checks/qc/${x.sheet}` })),
        },
        exportCheck: existsSync(checkFile) ? readJson(checkFile) : null,
        // A reel's approval: draft, exported (ready), approved or stale, and where its files went.
        approval: readJson<{ canvas?: string }>(join(dir, "edit.json")).canvas === "youtube" ? null : { ...approval(dir), folder: approvedFolder(), reveal: process.platform === "darwin" },
        // The sound as the export will mix it, when it has been mixed for the editor.
        mix: resolved ? mixState(dir, slug) : null,
        plan: readFileSync(join(dir, "edit.json"), "utf8"),
        versions: versions(dir),
        redo: redoable(dir),
        chat: loadChat(dir).messages,
        working: isRunning(slug),
        assets: listAssets(dir, slug),
        suggestions: loadSuggestions(dir),
        variants: resolveVariants(dir),
        // The scan is in the main clip's time; with a cut it is shown where those stretches play.
        camera: cameraOnTimeline(dir, line.cut),
        render: existsSync(join(dir, "renders/final.mp4")) ? { file: `${slug}/renders/final.mp4`, at: statSync(join(dir, "renders/final.mp4")).mtimeMs } : null,
        // Finished renders of one part, by file name.
        previews: existsSync(join(dir, "renders")) ? Object.fromEntries(readdirSync(join(dir, "renders")).filter((f) => /^part-.*\.mp4$/.test(f)).map((f) => [f, { file: `${slug}/renders/${f}`, at: statSync(join(dir, "renders", f)).mtimeMs }])) : {},
      });
    }
    if (action === "clips" && req.method === "GET") return send(res, 200, clips(dir));
    if (req.method !== "POST") return send(res, 405, { error: "method" });
    // A clip for the bin: saved, then imported in a detached job like a new project.
    if (action === "clips") {
      const name = url.searchParams.get("name") ?? "clip.mp4";
      if (!/\.(mp4|mov|m4v|mkv|webm)$/i.test(name)) return send(res, 400, { error: "only video clips go in the bin" });
      const base = slugFor(name);
      let id = base;
      for (let i = 2; id === "main" || existsSync(join(dir, "clips", id)); i++) id = `${base}-${i}`;
      mkdirSync(join(dir, "clips", id), { recursive: true });
      mkdirSync(join(projects, ".uploads"), { recursive: true });
      const file = join(projects, ".uploads", `${slug}-${id}${extname(name)}`);
      await new Promise<void>((ok, fail) => req.pipe(createWriteStream(file)).on("finish", ok).on("error", fail));
      writeJson(join(dir, "clips", id, "status.json"), { stage: "Queued", done: false, at: new Date().toISOString() });
      job(slug, ["clip", slug, file, "--id", id, "--name", name]);
      broadcast({ type: "status", slug });
      return send(res, 200, { id });
    }
    if (action === "assets") {
      const path = await saveAsset(dir, url.searchParams.get("name") ?? "asset", req);
      broadcast({ type: "plan", slug });
      return send(res, 200, { path });
    }
    if (!action || !isAction(action)) return send(res, 404, { error: "not found" });
    const parsed = Actions[action].safeParse(await body(req));
    if (!parsed.success) return send(res, 400, { error: parsed.error.issues.map((i) => `${i.path.join(".") || action}: ${i.message}`).join("; ") });
    const emit = (m: Parameters<Parameters<typeof ask>[5]>[0]) => broadcast({ type: "chat", slug, message: m });
    const changed = () => broadcast({ type: "plan", slug });
    const idle = () => {
      if (!liveStatus(dir)?.done && existsSync(join(dir, "status.json"))) throw Object.assign(new Error("a job is already running"), { code: 409 });
    };
    // The plan as it resolves now, for the actions that work on it.
    const plan = () => {
      const { resolved } = resolveProject(projects, slug);
      if (!resolved) throw Object.assign(new Error("the plan has errors; fix them first"), { code: 409 });
      return resolved;
    };
    // Each action's work. What it returns is the response; nothing means { ok: true }.
    const handlers: { [K in ActionName]: (input: ActionData<K>) => unknown } = {
      chat: ({ note, selection, playhead }) => {
        ask(projects, slug, note, selection && selection.end > selection.start ? selection : undefined, playhead, emit, () => {
          snapshot(dir, "claude");
          changed();
        });
      },
      suggest: () => {
        ask(projects, slug, "Suggest graphics for this video", undefined, 0, emit, changed, SUGGEST(slug));
      },
      decide: ({ id, accept, note }) => {
        decide(projects, slug, id, accept, note);
        changed();
      },
      drop: ({ ref, at, length }) => dropBroll(projects, slug, ref, at, length),
      "shot-start": ({ from, to }) => moveShotStart(projects, slug, from, to),
      "shot-end": ({ id, start, to }) => moveShotEnd(projects, slug, { id, start }, to),
      shot: ({ id, start, shot, remove }) => editShot(projects, slug, { id, start }, { shot, remove: remove === true }),
      // Takes on one graphic: Claude writes them to variants.json; the editor plays them side by side.
      variants: ({ start, note: brief }) => {
        const note = brief?.trim() || undefined;
        const { resolved } = resolveProject(projects, slug);
        const k = resolved?.shots.findIndex((s) => Math.abs(s.start - start) < 0.05) ?? -1;
        if (!resolved || k < 0) throw Object.assign(new Error("no graphic starts there"), { code: 409 });
        const edit = readJson<{ shots: { at: string }[] }>(join(dir, "edit.json"));
        const current = edit.shots[planIndex(edit.shots, resolved.shots, k)];
        const end = resolved.shots[lastKept(resolved.shots, k)].end;
        const said = timeline(dir).words.filter((w) => w.start >= start - 0.05 && w.start < end).map((w) => w.text).join(" ");
        saveVariants(dir, { start, note, items: [] });
        ask(projects, slug, note ? `Variants: ${note}` : "Variants for this graphic", undefined, start, emit, changed, VARIANTS(slug, start, current, said, note));
      },
      "variant-use": ({ id }) => {
        const v = loadVariants(dir);
        const take = v?.items.find((x) => x.id === id);
        if (!v || !take) throw Object.assign(new Error("no such take"), { code: 404 });
        editShot(projects, slug, { start: v.start }, { shot: take.shot });
        clearVariants(dir);
        changed();
      },
      "variant-clear": () => {
        clearVariants(dir);
        changed();
      },
      place: ({ card, at }) => placeCard(projects, slug, card, at),
      parts: (change) => changeParts(projects, slug, change),
      stop: () => stop(slug),
      undo: () => ({ ok: undo(dir) }),
      redo: () => ({ ok: redo(dir) }),
      // The editor's cut edits (split, trim, ripple delete, move, add a clip) write the whole cut,
      // which is saved as a version like any change to the plan.
      cut: ({ cut }) => {
        const bin = new Map(clips(dir).map((c) => [c.id, c]));
        for (const seg of cut.segments) {
          const clip = bin.get(seg.src);
          if (!clip?.ready) throw Object.assign(new Error(`no clip ${seg.src} ready in the bin`), { code: 400 });
          if (seg.out > clip.duration + 0.05) throw Object.assign(new Error(`${clip.name} is ${clip.duration.toFixed(2)}s; a segment cannot run to ${seg.out.toFixed(2)}s`), { code: 400 });
        }
        writeJson(join(dir, "cut.json"), cut);
        snapshot(dir, "cut");
        planChanged(slug);
      },
      render: ({ part, from, to, force }) => {
        idle();
        const stretch = part !== undefined ? ["--part", part] : from !== undefined ? ["--from", String(from), "--to", String(to)] : [];
        job(slug, ["render", slug, ...stretch, ...(force ? ["--force"] : [])]);
      },
      // QC from the editor: a detached job like a render, keeping every graphic that has not changed.
      qc: () => {
        idle();
        job(slug, ["qc", slug, "--status", "--cached"]);
      },
      mix: () => {
        idle();
        job(slug, ["mix", slug, "--status"]);
      },
      // Approving a reel copies its export and draws its cover (a few seconds); the request waits.
      approve: async () => {
        idle();
        const record = await approve(projects, slug);
        broadcast({ type: "status", slug });
        return { ok: true, record };
      },
      unapprove: () => {
        unapprove(projects, slug);
        broadcast({ type: "status", slug });
      },
      // Show the approved video in Finder, or the folder when the file has been moved on.
      reveal: () => {
        if (process.platform !== "darwin") throw Object.assign(new Error(`showing files works on macOS only; the folder is ${approvedFolder()}`), { code: 501 });
        const video = loadRecord(dir)?.video;
        const folder = approvedFolder();
        if (video && existsSync(video)) spawn("open", ["-R", video], { stdio: "ignore", detached: true }).unref();
        else if (existsSync(folder)) spawn("open", [folder], { stdio: "ignore", detached: true }).unref();
        else throw Object.assign(new Error(`${folder} does not exist yet`), { code: 404 });
      },
      review: ({ id, hash, status, comment }) => {
        setItem(dir, plan(), timeline(dir).words, id, hash, { status, comment });
        changed();
      },
      note: (change) => {
        saveNote(dir, timeline(dir).words, change);
        changed();
      },
      // Every open note and change goes to Claude as one run; its answers come back onto them.
      "review-send": () => {
        if (isRunning(slug)) throw Object.assign(new Error("Claude is still working on the last note"), { code: 409 });
        const sent = startSend(dir, slug, plan(), timeline(dir).words);
        if (!sent) throw Object.assign(new Error("nothing to send: no open notes or changes"), { code: 400 });
        ask(projects, slug, `Review: ${sent.count} note${sent.count === 1 ? "" : "s"} to work through`, undefined, 0, emit, () => {
          finishSend(dir);
          snapshot(dir, "claude");
          changed();
        }, sent.prompt);
        changed();
      },
    };
    const run = handlers[action] as (input: unknown) => unknown;
    return send(res, 200, (await run(parsed.data)) ?? { ok: true });
  };

  // Hot reload shares this server's port, so it never clashes with another dev server.
  const server = createHttp();
  const vite = await createVite({
    root: join(ROOT, "app"),
    publicDir: false,
    appType: "spa",
    logLevel: "warn",
    server: { middlewareMode: true, hmr: { server }, watch: { ignored: ["**/projects/**", "**/library/**"] } },
    optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "remotion", "@remotion/player", "@remotion/media"] },
  });

  server.on("request", (req, res) => {
    if (req.url?.startsWith("/api/"))
      return void api(req, res).catch((e) => send(res, typeof e.code === "number" ? e.code : 500, { error: String(e.message ?? e) }));
    if (serveFile(join(BROLL, ".clips"), req, res, "/library")) return;
    if (serveFile(projects, req, res)) return;
    vite.middlewares(req, res);
  });
  const listen = (p: number): Promise<number> =>
    new Promise((ok, fail) => {
      server.once("error", (e: NodeJS.ErrnoException) => (e.code === "EADDRINUSE" && p < port + 20 ? ok(listen(p + 1)) : fail(e)));
      server.listen(p, "127.0.0.1", () => ok(p));
    });
  const bound = await listen(port);
  return { url: `http://localhost:${bound}`, close: () => (server.close(), vite.close()) };
}
