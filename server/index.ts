// Studio's local server. Serves the editor (Vite), the project files (with byte ranges so video
// seeks) and a small JSON API. It watches every project's edit.json: whenever the plan changes,
// from the editor, from Claude in the chat panel or from Claude Code in a terminal, it saves a
// version, re-resolves the plan and tells the open editors to reload.
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, watch } from "node:fs";
import { createServer as createHttp, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { createServer as createVite } from "vite";
import { resolveProject } from "../media/project.ts";
import { liveStatus, slugFor } from "../media/ingest.ts";
import { readJson, ROOT } from "../media/tools.ts";
import { ask, isRunning, loadChat, stop } from "./agent.ts";
import { snapshot, undo, versions } from "./history.ts";
import { trashProject } from "./trash.ts";
import { dropBroll } from "./insert.ts";
import { listAssets, saveAsset } from "./assets.ts";
import { BROLL, loadLibrary } from "../media/broll.ts";

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

function serveFile(root: string, req: IncomingMessage, res: ServerResponse, prefix = ""): boolean {
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
    if (parts.length !== 2) return;
    if (parts[1] === "edit.json") planChanged(parts[0]);
    if (parts[1] === "status.json") broadcast({ type: "status", slug: parts[0] });
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

    if (parts[0] === "projects" && !parts[1]) {
      const list = readdirSync(projects, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => {
          const dir = join(projects, d.name);
          const status = liveStatus(dir);
          const meta = existsSync(join(dir, "project.json")) ? readJson<{ duration: number; size: [number, number] }>(join(dir, "project.json")) : null;
          const plan = existsSync(join(dir, "edit.json")) ? readJson<{ title?: string; canvas?: string }>(join(dir, "edit.json")) : null;
          return { slug: d.name, title: plan?.title ?? d.name, canvas: plan?.canvas ?? "reel", duration: meta?.duration, status, modified: statSync(dir).mtimeMs };
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
      return send(res, 200, {
        slug,
        status,
        resolved,
        issues,
        words: readJson(join(dir, "transcript.json")),
        plan: readFileSync(join(dir, "edit.json"), "utf8"),
        versions: versions(dir),
        chat: loadChat(dir).messages,
        working: isRunning(slug),
        assets: listAssets(dir, slug),
        camera: existsSync(join(dir, "build/camera.json")) ? readJson<{ ranges: [number, number][] }>(join(dir, "build/camera.json")).ranges : undefined,
        render: existsSync(join(dir, "renders/final.mp4")) ? { file: `${slug}/renders/final.mp4`, at: statSync(join(dir, "renders/final.mp4")).mtimeMs } : null,
      });
    }
    if (req.method !== "POST") return send(res, 405, { error: "method" });
    if (action === "assets") {
      const path = await saveAsset(dir, url.searchParams.get("name") ?? "asset", req);
      broadcast({ type: "plan", slug });
      return send(res, 200, { path });
    }
    const input = await body(req);
    if (action === "chat") {
      const note = String(input.note ?? "").trim();
      if (!note) return send(res, 400, { error: "empty note" });
      const sel = input.selection as { start: number; end: number } | undefined;
      ask(projects, slug, note, sel && sel.end > sel.start ? sel : undefined, Number(input.playhead ?? 0), (m) => broadcast({ type: "chat", slug, message: m }), () => {
        snapshot(dir, "claude");
        broadcast({ type: "plan", slug });
      });
      return send(res, 200, { ok: true });
    }
    if (action === "drop") {
      dropBroll(projects, slug, String(input.ref ?? ""), Number(input.at ?? 0), Number(input.length ?? 3));
      return send(res, 200, { ok: true });
    }
    if (action === "stop") return stop(slug), send(res, 200, { ok: true });
    if (action === "undo") return send(res, 200, { ok: undo(dir) });
    if (action === "render") {
      if (!liveStatus(dir)?.done && existsSync(join(dir, "status.json"))) return send(res, 409, { error: "a job is already running" });
      return job(slug, ["render", slug]), send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "not found" });
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
