// Studio's local server. Serves the editor (Vite), the project files (with byte ranges so video
// seeks) and a small JSON API. It watches every project's edit.json: whenever the plan changes,
// from the editor, from Claude in the chat panel or from Claude Code in a terminal, it saves a
// version, re-resolves the plan and tells the open editors to reload.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, createReadStream, createWriteStream, existsSync, type FSWatcher, mkdirSync, openSync, readdirSync, readFileSync, statSync, watch } from "node:fs";
import { createServer as createHttp, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { createServer as createVite } from "vite";
import { resolveProject } from "../media/project.ts";
import { liveStatus, slugFor } from "../media/ingest.ts";
import { readJson, ROOT, safePath, writeJson } from "../media/tools.ts";
import { ask, isRunning, loadChat, runningNotes, stop, stopAll } from "./agent.ts";
import { redo, redoable, snapshot, undo, versions } from "./history.ts";
import { type ActionData, type ActionName, Actions, isAction } from "../engine/api.ts";
import { finishSend, loadReview, saveNote, setItem, startSend } from "./review.ts";
import { qcState } from "../media/qc.ts";
import { mixState } from "../media/previewmix.ts";
import { planIndex } from "../engine/insert.ts";
import { trashProject } from "./trash.ts";
import { approval, approve, approvedFolder, folderLabel, loadRecord, unapprove } from "../media/approve.ts";
import { changeParts, dropBroll, editShot, moveShotEnd, moveShotStart, placeCard } from "./insert.ts";
import { decide, loadSuggestions, SUGGEST } from "./suggest.ts";
import { listAssets, saveAsset } from "./assets.ts";
import { clearVariants, loadVariants, resolveVariants, saveVariants, VARIANTS } from "./variants.ts";
import { brollFolder, clipsFolder, loadLibrary } from "../media/broll.ts";
import { cameraOnTimeline, clipDir, clipLevels, clipPath, clips, timeline } from "../media/bin.ts";
import { makeStrip, stripInfo } from "../media/strip.ts";
import { effectList } from "../effects/preview.ts";
import { readCardLibrary, saveInLibrary } from "../media/cardlibrary.ts";
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
    const ct = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (ct !== "application/json") {
      req.resume();
      return fail(Object.assign(new Error("Content-Type must be application/json"), { code: 415 }));
    }
    let s = "";
    req.on("error", fail);
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      try {
        const parsed: unknown = s ? JSON.parse(s) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return fail(Object.assign(new Error("expected a JSON object"), { code: 400 }));
        }
        ok(parsed as Record<string, unknown>);
      } catch (e) {
        fail(Object.assign(new Error(`invalid JSON: ${String((e as Error).message ?? e)}`), { code: 400 }));
      }
    });
  });

export function serveFile(root: string, req: IncomingMessage, res: ServerResponse, prefix = ""): boolean {
  let path: string;
  try {
    path = decodeURIComponent((req.url ?? "").split(/[?#]/)[0]);
  } catch {
    res.writeHead(400, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end("Bad Request");
    return true;
  }
  if (path.includes("\0")) {
    res.writeHead(400, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end("Bad Request");
    return true;
  }
  if (!path.startsWith(prefix + "/")) return false;
  const base = resolve(root);
  const file = normalize(join(base, path.slice(prefix.length)));
  if (!file.startsWith(base + sep)) return false;
  let st;
  try {
    st = statSync(file);
  } catch {
    return false;
  }
  if (!st.isFile()) return false;
  const size = st.size;
  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  const pipeStream = (opts?: { start: number; end: number }) => {
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = opts ? createReadStream(file, opts) : createReadStream(file);
    stream.on("error", () => {
      if (!res.headersSent) res.writeHead(500);
      if (!res.writableEnded) res.end();
    });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  };
  if (req.headers.range !== undefined) {
    const range = /^bytes=(\d*)-(\d*)$/i.exec(req.headers.range.trim());
    let start = NaN;
    let end = NaN;
    if (range && size > 0 && (range[1] || range[2])) {
      if (!range[1]) {
        const suffix = Number(range[2]);
        if (Number.isSafeInteger(suffix) && suffix > 0) {
          start = Math.max(0, size - suffix);
          end = size - 1;
        }
      } else {
        const rawStart = Number(range[1]);
        const rawEnd = range[2] ? Number(range[2]) : size - 1;
        if (Number.isSafeInteger(rawStart) && Number.isSafeInteger(rawEnd) && rawStart >= 0 && rawStart < size && rawEnd >= rawStart) {
          start = rawStart;
          end = Math.min(rawEnd, size - 1);
        }
      }
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || end >= size) {
      res.writeHead(416, { "content-range": `bytes */${size}`, "accept-ranges": "bytes", "cache-control": "no-cache" });
      res.end();
      return true;
    }
    res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "cache-control": "no-cache" });
    pipeStream({ start, end });
  } else {
    res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "cache-control": "no-cache" });
    pipeStream();
  }
  return true;
}

export async function startServer(port = 4747, opts: { projects?: string } = {}) {
  const projects = opts.projects ?? join(ROOT, "projects");
  mkdirSync(projects, { recursive: true });
  let bound = port;
  const dirOf = (slug: string) => {
    const dir = join(projects, slug);
    if (!/^[\w.-]+$/.test(slug) || slug.startsWith(".") || !existsSync(join(dir, "project.json"))) throw Object.assign(new Error(`no project ${slug}`), { code: 404 });
    return dir;
  };
  const ready = (slug: string) => existsSync(join(projects, slug, "edit.json")) && existsSync(join(projects, slug, "transcript.json"));

  // Editors listening for changes. Each server process gets a boot ID so tabs reload only on a real restart.
  const boot = randomUUID();
  const clients = new Set<ServerResponse>();
  const broadcast = (event: Record<string, unknown>) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of [...clients]) {
      if (c.writableEnded || c.destroyed) {
        clients.delete(c);
        continue;
      }
      try {
        c.write(payload);
      } catch {
        clients.delete(c);
      }
    }
  };

  // A plan change: save a version, re-resolve, tell the editors. Debounced, since editors write in bursts.
  const timers = new Map<string, NodeJS.Timeout>();
  const planChanged = (slug: string) => {
    clearTimeout(timers.get(slug));
    timers.set(slug, setTimeout(() => {
      if (!ready(slug)) return;
      // While Claude works on a note it saves several times; the note becomes one version when it finishes.
      if (!isRunning(slug)) {
        try {
          snapshot(join(projects, slug), "edit");
        } catch {
          // Ignore transient filesystem errors during debounced editor saves.
        }
      }
      try {
        resolveProject(projects, slug);
      } catch {
        // Shown on the next load; a half-written plan is normal while someone types.
      }
      broadcast({ type: "plan", slug });
    }, 150));
  };
  let libraryBusy = false;
  // The library folder (STUDIO_BROLL) as it was when the server started.
  const BROLL = brollFolder();
  mkdirSync(BROLL, { recursive: true });
  const watchers: FSWatcher[] = [];
  try {
    const bw = watch(BROLL, (_e, file) => String(file) === "index.json" && broadcast({ type: "library" }));
    bw.on("error", () => {});
    watchers.push(bw);
  } catch {}
  try {
    const pw = watch(projects, { recursive: true }, (_e, file) => {
      const parts = String(file ?? "").split(/[/\\]/);
      // An added clip's import reports in clips/<id>/status.json.
      if (parts.length === 4 && parts[1] === "clips" && parts[3] === "status.json") return broadcast({ type: "status", slug: parts[0] });
      if (parts.length !== 2) return;
      if (parts[1] === "edit.json" || parts[1] === "cut.json") planChanged(parts[0]);
      // status.json: a job's progress. approved.json: a reel approved or unapproved, from here or the CLI.
      if (parts[1] === "status.json" || parts[1] === "approved.json") broadcast({ type: "status", slug: parts[0] });
      if (parts[1] === "suggestions.json" || parts[1] === "variants.json") broadcast({ type: "plan", slug: parts[0] });
    });
    pw.on("error", () => {});
    watchers.push(pw);
  } catch {}

  // Long jobs (ingest, render) run as CLI processes so the server stays responsive. They report
  // through the project's status.json.
  // Detached, so restarting the server never kills an import or a render halfway (2026-10-24).
  const job = (slug: string, args: string[]) => {
    mkdirSync(join(projects, slug), { recursive: true });
    const log = openSync(join(projects, slug, "job.log"), "a");
    try {
      const p = spawn("npx", ["tsx", "cli.ts", ...args], { cwd: ROOT, stdio: ["ignore", log, log], detached: true });
      p.on("error", () => {});
      p.unref();
    } finally {
      closeSync(log);
    }
  };

  const api = async (req: IncomingMessage, res: ServerResponse) => {
    const host = req.headers.host?.toLowerCase();
    if (host !== `localhost:${bound}` && host !== `127.0.0.1:${bound}`) {
      return send(res, 403, { error: "forbidden host" });
    }
    const mutating = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
    if (mutating) {
      const origin = req.headers.origin;
      if (origin !== undefined) {
        const lower = origin.toLowerCase();
        if (lower !== `http://localhost:${bound}` && lower !== `http://127.0.0.1:${bound}`) {
          return send(res, 403, { error: "forbidden origin" });
        }
      }
      const fetchSite = req.headers["sec-fetch-site"];
      if (typeof fetchSite === "string" && fetchSite !== "same-origin" && fetchSite !== "none") {
        return send(res, 403, { error: "cross-site request blocked" });
      }
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    let parts: string[];
    try {
      parts = url.pathname.split("/").filter(Boolean).slice(1).map(decodeURIComponent);
    } catch {
      return send(res, 400, { error: "malformed URL" });
    }

    if (parts[0] === "events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(`: hi\n\ndata: ${JSON.stringify({ type: "hello", boot })}\n\n`);
      clients.add(res);
      const drop = () => clients.delete(res);
      req.on("close", drop);
      res.on("close", drop);
      res.on("error", drop);
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
      const rawExt = extname(basename(name.replace(/\\/g, "/")));
      const ext = /^\.[a-z0-9]{1,8}$/i.test(rawExt) ? rawExt.toLowerCase() : ".mp4";
      const file = join(projects, ".uploads", `${slug}${ext}`);
      await new Promise<void>((ok, fail) => {
        const out = createWriteStream(file);
        req.on("error", fail);
        out.on("finish", ok).on("error", fail);
        req.pipe(out);
      });
      mkdirSync(join(projects, slug), { recursive: true });
      job(slug, ["ingest", file, "--slug", slug, ...(canvas ? ["--canvas", canvas] : []), ...(title ? ["--title", title] : [])]);
      return send(res, 200, { slug });
    }

    // The shared b-roll library. Adding a clip splits it into shots and has Claude describe them,
    // in a detached job; editors hear "library" when the index changes.
    if (parts[0] === "library") {
      if (req.method === "POST") {
        const raw = url.searchParams.get("name") ?? "clip.mp4";
        if (!raw || raw.startsWith(".") || raw.includes("..") || raw.includes("/") || raw.includes("\\")) return send(res, 400, { error: "invalid clip filename" });
        const clean = basename(raw).replace(/[^\w.-]+/g, "-").replace(/^\.+/, "");
        if (!/^[a-z0-9][\w.-]*\.(mp4|mov|m4v|mkv|webm)$/i.test(clean)) return send(res, 400, { error: "only video clips go in the b-roll library" });
        mkdirSync(BROLL, { recursive: true });
        let file = safePath(BROLL, clean);
        if (!file) return send(res, 400, { error: "invalid clip filename" });
        for (let i = 2; existsSync(file); i++) file = join(BROLL, clean.replace(/(\.\w+)$/, `-${i}$1`));
        await new Promise<void>((ok, fail) => {
          const out = createWriteStream(file);
          req.on("error", fail);
          out.on("finish", ok).on("error", fail);
          req.pipe(out);
        });
        const log = openSync(join(BROLL, "job.log"), "a");
        libraryBusy = true;
        broadcast({ type: "library" });
        try {
          const p = spawn("npx", ["tsx", "cli.ts", "broll", "index"], { cwd: ROOT, stdio: ["ignore", log, log], detached: true });
          const done = () => {
            libraryBusy = false;
            broadcast({ type: "library" });
          };
          p.on("error", done);
          p.on("exit", done);
          p.unref();
        } finally {
          closeSync(log);
        }
        return send(res, 200, { ok: true });
      }
      return send(res, 200, { busy: libraryBusy, clips: loadLibrary().map((c) => ({ ...c, thumb: `library/${c.id}-thumb.jpg` })) });
    }

    if (parts[0] === "effects") {
      // The library's cards, or with `removed=1` the ones taken out of it (to add back).
      const list = effectList(url.searchParams.get("canvas") === "reel" ? "reel" : "youtube", readCardLibrary());
      return send(res, 200, url.searchParams.get("removed") === "1" ? list.filter((e) => e.removed) : list.filter((e) => e.approved));
    }

    // Take a card out of the library, or add it back: { id, inLibrary }. Every open editor reloads it.
    if (parts[0] === "cards" && req.method === "POST") {
      const { id, inLibrary } = await body(req);
      if (typeof id !== "string" || typeof inLibrary !== "boolean") return send(res, 400, { error: "needs { id, inLibrary }" });
      const lib = saveInLibrary(id, inLibrary);
      broadcast({ type: "cards" });
      return send(res, 200, lib);
    }

    // The gallery: every project's graphics, from the plan as last resolved, without captions.
    if (parts[0] === "gallery") {
      const list = readdirSync(projects, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith(".") && existsSync(join(projects, d.name, "build/edit.resolved.json")))
        .flatMap((d) => {
          try {
            const file = join(projects, d.name, "build/edit.resolved.json");
            const resolved = readJson<Resolved>(file);
            return [{ slug: d.name, modified: statSync(file).mtimeMs, resolved: { ...resolved, chunks: [] } }];
          } catch {
            return [];
          }
        })
        .filter((p) => p.resolved.shots?.some((s) => s.visual))
        .sort((a, b) => b.modified - a.modified);
      return send(res, 200, list);
    }

    if (parts[0] === "projects" && !parts[1]) {
      const list = readdirSync(projects, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .flatMap((d) => {
          const dir = join(projects, d.name);
          try {
            const dirMtime = statSync(dir).mtimeMs;
            const issues: string[] = [];
            const status = liveStatus(dir);
            let meta: { duration: number; size: [number, number] } | null = null;
            if (existsSync(join(dir, "project.json"))) {
              try {
                meta = readJson<{ duration: number; size: [number, number] }>(join(dir, "project.json"));
              } catch (e) {
                issues.push(`project.json: ${String((e as Error).message ?? e)}`);
              }
            }
            let plan: { title?: string; canvas?: string } | null = null;
            if (existsSync(join(dir, "edit.json"))) {
              try {
                plan = readJson<{ title?: string; canvas?: string }>(join(dir, "edit.json"));
              } catch (e) {
                issues.push(`edit.json: ${String((e as Error).message ?? e)}`);
              }
            }
            // What the projects page shows on each card: a frame of the footage, whether it has been
            // exported, and how far the review has got (read from the file as it is, without merging).
            const reviewFile = join(dir, "review.json");
            let decided: { status: string }[] = [];
            if (existsSync(reviewFile)) {
              try {
                decided = Object.values(readJson<{ items?: Record<string, { status: string }> }>(reviewFile).items ?? {});
              } catch (e) {
                issues.push(`review.json: ${String((e as Error).message ?? e)}`);
              }
            }
            const edited = existsSync(join(dir, "edit.json")) ? statSync(join(dir, "edit.json")).mtimeMs : dirMtime;
            let approvalSummary: { state: ReturnType<typeof approval>["state"]; at: string | null } | null = null;
            if (plan && plan.canvas !== "youtube") {
              try {
                const a = approval(dir);
                approvalSummary = { state: a.state, at: a.record?.at ?? null };
              } catch (e) {
                issues.push(`approval: ${String((e as Error).message ?? e)}`);
              }
            }
            const effectiveStatus = status?.error
              ? status
              : issues.length
                ? { stage: "Error", done: true, error: issues.join("; "), at: new Date().toISOString() }
                : status;
            return [{
              slug: d.name,
              title: plan?.title ?? d.name,
              canvas: plan?.canvas ?? "reel",
              duration: meta?.duration,
              status: effectiveStatus,
              modified: Math.max(edited, dirMtime),
              thumb: existsSync(join(dir, "checks/frame.jpg")) ? `${d.name}/checks/frame.jpg` : null,
              exported: existsSync(join(dir, "renders/final.mp4")),
              review: decided.length ? { approved: decided.filter((x) => x.status === "approved").length, total: decided.length } : null,
              // A reel's approval (media/approve.ts): its state, and when it was approved.
              approval: approvalSummary,
            }];
          } catch (e) {
            if (!existsSync(dir)) return [];
            return [{
              slug: d.name,
              title: d.name,
              canvas: "reel",
              duration: undefined,
              status: { stage: "Error", done: true, error: String((e as Error).message ?? e), at: new Date().toISOString() },
              modified: 0,
              thumb: null,
              exported: false,
              review: null,
              approval: null,
            }];
          }
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
      let line: ReturnType<typeof timeline>;
      try {
        line = timeline(dir);
      } catch {
        line = { cut: { segments: [] }, explicit: false, error: undefined, words: [], byClip: { main: [] }, duration: 0 };
      }
      // Each clip's levels (build/level.json), which the editor reads to snap trims to pauses.
      for (const c of clips(dir)) if (c.ready) clipLevels(dir, c.id);
      const bin = clips(dir);
      // The timeline's filmstrips, drawn in the background; a status event brings the editor back
      // for them when they are ready (media/strip.ts).
      for (const c of bin) if (c.ready) makeStrip(dir, c.id).then((made) => made && broadcast({ type: "status", slug }));
      // The words only change with the cut or a transcript. An editor that already holds them says
      // so (`have`), and a reload after a plan change comes back without them.
      const transcripts = bin.filter((c) => c.ready).map((c) => join(clipDir(dir, c.id), "transcript.json"));
      const wordsKey = createHash("md5").update(JSON.stringify(line.cut)).update(transcripts.map((f) => `${f}:${statSync(f).mtimeMs}`).join("|")).digest("hex");
      const qc = resolved ? qcState(dir, resolved) : null;
      const checkFile = join(dir, "checks/export-check.json");
      let exportCheck: unknown = null;
      if (existsSync(checkFile)) {
        try {
          exportCheck = readJson(checkFile);
        } catch {
          exportCheck = null;
        }
      }
      let approvalInfo: unknown = null;
      try {
        approvalInfo = readJson<{ canvas?: string }>(join(dir, "edit.json")).canvas === "youtube" ? null : { ...approval(dir), folder: folderLabel(), reveal: process.platform === "darwin" };
      } catch {
        approvalInfo = null;
      }
      let variantsInfo: ReturnType<typeof resolveVariants> = null;
      try {
        variantsInfo = resolveVariants(dir);
      } catch {
        variantsInfo = null;
      }
      let cameraInfo: [number, number][] | undefined;
      try {
        cameraInfo = cameraOnTimeline(dir, line.cut);
      } catch {
        cameraInfo = undefined;
      }
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
              clipWords: Object.fromEntries(
                bin
                  .filter((c) => c.ready)
                  .map((c, k) => {
                    try {
                      return [c.id, readJson(transcripts[k])];
                    } catch {
                      return [c.id, []];
                    }
                  }),
              ),
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
        exportCheck,
        // A reel's approval: draft, exported (ready), approved or stale, and where its files went.
        approval: approvalInfo,
        // The sound as the export will mix it, when it has been mixed for the editor.
        mix: resolved ? mixState(dir, slug) : null,
        plan: readFileSync(join(dir, "edit.json"), "utf8"),
        versions: versions(dir),
        redo: redoable(dir),
        chat: loadChat(dir).messages,
        working: isRunning(slug),
        assets: listAssets(dir, slug),
        suggestions: loadSuggestions(dir),
        variants: variantsInfo,
        // The scan is in the main clip's time; with a cut it is shown where those stretches play.
        camera: cameraInfo,
        render: existsSync(join(dir, "renders/final.mp4")) ? { file: `${slug}/renders/final.mp4`, at: statSync(join(dir, "renders/final.mp4")).mtimeMs } : null,
        // The timeline's filmstrip per clip, once drawn.
        strips: Object.fromEntries(bin.filter((c) => c.ready).flatMap((c) => { const st = stripInfo(dir, c.id, clipPath(slug, c.id)); return st ? [[c.id, st]] : []; })),
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
      const ext = extname(basename(name.replace(/\\/g, "/"))).toLowerCase();
      const file = join(projects, ".uploads", `${slug}-${id}${/^\.(mp4|mov|m4v|mkv|webm)$/.test(ext) ? ext : ".mp4"}`);
      await new Promise<void>((ok, fail) => {
        const out = createWriteStream(file);
        req.on("error", fail);
        out.on("finish", ok).on("error", fail);
        req.pipe(out);
      });
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
        if (part !== undefined && (part.startsWith("-") || !part.trim())) {
          throw Object.assign(new Error("invalid part name"), { code: 400 });
        }
        if ((from !== undefined || to !== undefined) && (from === undefined || to === undefined || !Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from)) {
          throw Object.assign(new Error("invalid render range"), { code: 400 });
        }
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
        if (video && existsSync(video)) {
          const p = spawn("open", ["-R", video], { stdio: "ignore", detached: true });
          p.on("error", () => {});
          p.unref();
        } else if (existsSync(folder)) {
          const p = spawn("open", [folder], { stdio: "ignore", detached: true });
          p.on("error", () => {});
          p.unref();
        } else throw Object.assign(new Error(`${folder} does not exist yet`), { code: 404 });
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
      return void api(req, res).catch((e) => {
        if (res.headersSent) {
          if (!res.writableEnded) res.end();
          return;
        }
        send(res, typeof e.code === "number" ? e.code : 500, { error: String(e.message ?? e) });
      });
    if (serveFile(clipsFolder(), req, res, "/library")) return;
    if (serveFile(projects, req, res)) return;
    vite.middlewares(req, res);
  });
  const listen = (p: number): Promise<number> =>
    new Promise((ok, fail) => {
      server.once("error", (e: NodeJS.ErrnoException) => (e.code === "EADDRINUSE" && p < port + 20 ? ok(listen(p + 1)) : fail(e)));
      server.listen(p, "127.0.0.1", () => ok((server.address() as AddressInfo | null)?.port ?? p));
    });
  bound = await listen(port);
  return {
    url: `http://localhost:${bound}`,
    close: async () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      for (const w of watchers) {
        try {
          w.close();
        } catch {}
      }
      watchers.length = 0;
      for (const c of clients) {
        try {
          c.end();
        } catch {}
      }
      clients.clear();
      stopAll();
      await Promise.all([
        new Promise<void>((ok) => {
          server.close(() => ok());
          server.closeIdleConnections?.();
        }),
        vite.close(),
      ]);
    },
  };
}
