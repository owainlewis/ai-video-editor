// The desktop app's Studio server: one `cli.ts serve` run from the repo on the system's Node, the
// same process the CLI and the tests use. It is restarted when its own code changes, but never while
// Claude is working on a note (a note runs inside the server; imports and renders are detached and
// survive). If a Studio server is already answering on the port, the app uses that one instead of
// starting a second, which would save every plan change twice.
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { type FSWatcher, watch } from "node:fs";
import { needsRestart, serverUrl } from "./logic.ts";

export type State = "starting" | "ready" | "restarting" | "failed" | "stopped";

const PORT = 4747;
const LOG_LINES = 200;

export class StudioServer extends EventEmitter {
  readonly repo: string;
  state: State = "stopped";
  url: string | null = null;
  // "own": started here, restarted on code changes. "attached": started elsewhere, used as it is.
  mode: "own" | "attached" | null = null;
  log: string[] = [];
  private child: ChildProcess | null = null;
  private env: NodeJS.ProcessEnv = process.env;
  private watcher: FSWatcher | null = null;
  private pending: NodeJS.Timeout | null = null;
  private crashes: number[] = [];

  constructor(repo: string) {
    super();
    this.repo = repo;
  }

  async start(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
    const running = `http://localhost:${PORT}`;
    if (await answers(running)) {
      this.mode = "attached";
      this.note(`Using the Studio server already running at ${running}.`);
      return this.set("ready", running);
    }
    this.mode = "own";
    this.watchCode();
    await this.spawn();
  }

  // Restart now (from the menu), or after a code change once nothing would be cut off.
  async restart(reason = "Restarting") {
    if (this.mode !== "own") return;
    await this.idle();
    this.note(`${reason}.`);
    this.set("restarting", this.url);
    await this.kill();
    await this.spawn();
  }

  async stop() {
    this.watcher?.close();
    this.watcher = null;
    if (this.pending) clearTimeout(this.pending);
    // Stopped first, so the server's exit is not taken for a crash and started again.
    this.set("stopped", null);
    if (this.mode === "own") await this.kill();
  }

  // Start (or start again) after a failure.
  async retry() {
    this.crashes = [];
    if (this.mode === "attached") return this.start(this.env);
    await this.kill();
    await this.spawn();
  }

  private spawn(): Promise<void> {
    this.set("starting", this.url);
    return new Promise((done) => {
      const child = spawn("node", ["--import", "tsx", "cli.ts", "serve", "--port", String(PORT)], {
        cwd: this.repo,
        env: { ...this.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      let ready = false;
      const read = (chunk: Buffer) => {
        for (const line of chunk.toString().split("\n")) {
          if (!line.trim()) continue;
          this.note(line);
          const url = serverUrl(line);
          if (url && !ready) {
            ready = true;
            this.set("ready", url);
            done();
          }
        }
      };
      child.stdout?.on("data", read);
      child.stderr?.on("data", read);
      // Node not found, or not runnable: no exit follows, so fail here.
      child.on("error", (e) => {
        if (this.child !== child) return;
        this.child = null;
        const missing = (e as NodeJS.ErrnoException).code === "ENOENT";
        this.note(missing ? "Node was not found on the PATH your terminal uses. Install Node, or check your shell profile sets PATH." : `Could not start the server: ${e.message}`);
        this.set("failed", null);
        done();
      });
      child.on("exit", (code, signal) => {
        if (this.child !== child) return;
        this.child = null;
        this.note(`The server stopped (${signal ?? `exit ${code}`}).`);
        if (this.state === "stopped" || this.state === "restarting") return done();
        // It died on its own: start it again, unless it keeps dying.
        const now = Date.now();
        this.crashes = [...this.crashes.filter((t) => now - t < 60_000), now];
        if (ready && this.crashes.length < 3) void this.spawn();
        else this.set("failed", null);
        done();
      });
    });
  }

  private kill(): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null) return Promise.resolve();
    return new Promise((done) => {
      const force = setTimeout(() => child.kill("SIGKILL"), 5000);
      child.once("exit", () => (clearTimeout(force), done()));
      child.kill("SIGTERM");
    });
  }

  // Watch the server's code, and restart a moment after the last change.
  private watchCode() {
    this.watcher = watch(this.repo, { recursive: true }, (_e, file) => {
      if (!file || !needsRestart(String(file))) return;
      if (this.pending) clearTimeout(this.pending);
      this.pending = setTimeout(() => {
        this.pending = null;
        void this.restart(`${file} changed; restarting`);
      }, 600);
    });
  }

  // Wait until no Claude note is running, saying once what it waits for.
  private async idle() {
    let said = false;
    for (;;) {
      if (!this.url || this.state !== "ready") return;
      const notes = await busy(this.url);
      if (!notes.length) return;
      if (!said) this.note(`Waiting for Claude to finish (${notes.join(", ")}) before restarting.`);
      said = true;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private set(state: State, url: string | null) {
    this.state = state;
    this.url = url;
    this.emit("state", state, url);
  }

  private note(line: string) {
    this.log = [...this.log, line].slice(-LOG_LINES);
    this.emit("log", line);
  }
}

// Whether a Studio server answers at `url`.
async function answers(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/projects`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

// The projects Claude is working on now. An older server without /api/busy counts as idle.
export async function busy(url: string): Promise<string[]> {
  try {
    const r = await fetch(`${url}/api/busy`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? (((await r.json()) as { notes?: string[] }).notes ?? []) : [];
  } catch {
    return [];
  }
}

// The PATH a terminal gets. An app opened from the Finder or at login gets only the system's,
// without Homebrew, nvm or ~/.local/bin, so `node`, `claude`, `ffmpeg` and `python3` would not be
// found. Asked once from the login shell; the app's own PATH is kept if that fails.
export function shellEnv(): Promise<NodeJS.ProcessEnv> {
  const shell = process.env.SHELL || "/bin/zsh";
  const mark = "__STUDIO_PATH__";
  return new Promise((done) => {
    execFile(shell, ["-ilc", `printf '${mark}%s${mark}' "$PATH"`], { timeout: 8000 }, (err, out) => {
      const path = String(out ?? "").split(mark)[1];
      done(err || !path ? process.env : { ...process.env, PATH: path });
    });
  });
}
