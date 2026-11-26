// The desktop app's decisions, kept apart from Electron so they can be tested: which file changes
// restart the server, where a studio:// link goes, what is worth a notification, and what the menu
// bar shows. Nothing here touches Electron, the network or the disk.
import { thisWeek, WEEKLY_TARGET } from "../engine/approve.ts";

// The server runs these folders' code; a change to one needs a restart. The editor (app/) hot
// reloads through Vite on its own, and projects/ and library/ are data the server watches itself.
const SERVER_CODE = ["engine/", "media/", "server/", "styles/", "effects/"];
export function needsRestart(file: string): boolean {
  const f = file.replace(/\\/g, "/");
  if (f === "cli.ts" || f === "package.json") return true;
  // The card library is data the server reads on each request (media/cardlibrary.ts).
  if (f === "styles/library.json") return false;
  return SERVER_CODE.some((d) => f.startsWith(d)) && /\.(ts|tsx|json)$/.test(f) && !f.includes("/node_modules/");
}

// The server prints this line once it is listening (cli.ts serve).
export const serverUrl = (line: string) => line.match(/Studio is running at (http:\/\/\S+)/)?.[1] ?? null;

// Whether `url` belongs to the local Studio server's origin.
export function isOwnUrl(url: string, base: string | null): boolean {
  if (!base) return false;
  try {
    const target = new URL(url);
    const origin = new URL(base);
    return (target.protocol === "http:" || target.protocol === "https:") && target.origin === origin.origin;
  } catch {
    return false;
  }
}

// Only http: and https: URLs may be handed to shell.openExternal.
export function isExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Only clear a pending load-failure retry when Chromium actually loaded a healthy page from our server.
export function shouldClearFailed(url: string, base: string | null, httpStatus: number | null): boolean {
  if (!isOwnUrl(url, base)) return false;
  return httpStatus === null || httpStatus < 400;
}

// Accumulates stream chunks across newline boundaries before emitting complete non-empty lines.
export function createLineReader(onLine: (line: string) => void) {
  let buf = "";
  return {
    push(chunk: Buffer | string) {
      buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) onLine(line);
      }
    },
    flush() {
      if (buf.trim()) onLine(buf);
      buf = "";
    },
  };
}

// Verify a parsed JSON payload matches Studio's GET /api/projects array shape.
export function isProjectList(data: unknown): data is Listed[] {
  return (
    Array.isArray(data) &&
    data.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Record<string, unknown>).slug === "string" &&
        typeof (p as Record<string, unknown>).title === "string",
    )
  );
}

// Fetch /api/projects and validate HTTP status + Studio JSON array shape.
export async function fetchProjects(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000,
): Promise<Listed[] | null> {
  try {
    const r = await fetchImpl(`${url}/api/projects`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const data: unknown = await r.json();
    return isProjectList(data) ? data : null;
  } catch {
    return null;
  }
}

// Refresh cached projects safely: never overwrite `prev` on HTTP errors or malformed responses.
export async function refreshState(
  url: string,
  prev: Listed[],
  tell: boolean,
  deps: { fetch?: typeof fetch; busy?: (url: string) => Promise<string[]> } = {},
): Promise<{ projects: Listed[]; notes: string[] | null; alerts: Notice[]; ok: boolean }> {
  const list = await fetchProjects(url, deps.fetch);
  if (!list) return { projects: prev, notes: null, alerts: [], ok: false };
  const alerts = tell ? notices(prev, list) : [];
  const notes = deps.busy ? await deps.busy(url) : null;
  return { projects: list, notes, alerts, ok: true };
}

export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry: (url: string, attempt: number) => void;
  onExhausted: (url: string) => void;
};

// Coordinates failed-page reload retries with exponential backoff, deduplication, a cap, and cleanup.
export class RetryScheduler {
  private failed: string | null = null;
  private count = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly onRetry: (url: string, attempt: number) => void;
  private readonly onExhausted: (url: string) => void;

  constructor(opts: RetryOptions) {
    this.maxRetries = opts.maxRetries ?? 5;
    this.baseDelayMs = opts.baseDelayMs ?? 1000;
    this.maxDelayMs = opts.maxDelayMs ?? 15_000;
    this.onRetry = opts.onRetry;
    this.onExhausted = opts.onExhausted;
  }

  get failedUrl(): string | null {
    return this.failed;
  }

  get attempts(): number {
    return this.count;
  }

  get isPending(): boolean {
    return this.timer !== null;
  }

  markFailed(url: string) {
    this.failed = url;
  }

  schedule(url: string): boolean {
    this.failed = url;
    if (this.timer !== null) return false;
    if (this.count >= this.maxRetries) {
      this.onExhausted(url);
      return false;
    }
    const delay = Math.min(this.baseDelayMs * 2 ** this.count, this.maxDelayMs);
    this.count++;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.failed) return;
      this.onRetry(this.failed, this.count);
    }, delay);
    return true;
  }

  retryNow(): string | null {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.count = 0;
    return this.failed;
  }

  clear() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.failed = null;
    this.count = 0;
  }

  dispose() {
    this.clear();
  }
}

// studio://p/<slug>, studio://p/<slug>/review and studio://gallery, as the editor's hash routes.
export function routeFor(link: string): string | null {
  const m = link.match(/^studio:\/\/\/?(.*)$/);
  if (!m) return null;
  const path = m[1].replace(/\/+$/, "");
  if (path === "" || path === "projects") return "#/";
  if (path === "gallery") return "#/gallery";
  const p = path.match(/^p\/([\w.-]+)(\/review)?$/);
  return p ? `#/p/${p[1]}${p[2] ?? ""}` : null;
}

// A project as GET /api/projects lists it, with only what the app reads.
export type Status = { stage: string; done: boolean; error?: string; at?: string };
export type Listed = { slug: string; title: string; status: Status | null; approval: { state: string; at: string | null } | null };

export type Notice = { title: string; body: string; route: string };

// What a finished job says. Only jobs Owain waits on: an import, an export, and anything that
// failed. The editor's own background work (its sound mix, its QC pass) is quiet when it works.
const FINISHED: Record<string, string> = { Ready: "Import ready", Rendered: "Export finished" };

// The notifications between two reads of the project list: each job that finished in between.
// A project that was already finished at the first read says nothing, so starting the app is quiet.
export function notices(before: Listed[], after: Listed[]): Notice[] {
  const was = new Map(before.map((p) => [p.slug, p.status]));
  const out: Notice[] = [];
  for (const p of after) {
    const s = p.status;
    if (!s?.done || !was.has(p.slug)) continue;
    const prev = was.get(p.slug);
    if (prev && prev.done && prev.stage === s.stage && prev.at === s.at) continue;
    const route = `#/p/${p.slug}`;
    if (s.error) out.push({ title: `${p.title}: ${s.stage}`, body: firstLine(s.error), route });
    else if (FINISHED[s.stage]) out.push({ title: FINISHED[s.stage], body: p.title, route });
  }
  return out;
}

const firstLine = (text: string) => {
  const line = text.trim().split("\n").find((l) => l.trim()) ?? text;
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
};

// What the menu bar lists: each job running now, and the week's approvals against the target.
export function summary(projects: Listed[], notes: string[], now: number = Date.now()) {
  const title = new Map(projects.map((p) => [p.slug, p.title]));
  const working = [
    ...projects.filter((p) => p.status && !p.status.done).map((p) => ({ slug: p.slug, label: `${p.title}: ${p.status!.stage}` })),
    ...notes.map((slug) => ({ slug, label: `${title.get(slug) ?? slug}: Claude is working` })),
  ];
  const week = thisWeek(projects.flatMap((p) => (p.approval?.at ? [p.approval.at] : [])), now);
  return { working, week: `This week: ${week} of ${WEEKLY_TARGET} approved` };
}
