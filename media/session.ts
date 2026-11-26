// A signed-in session for pages behind a login (Machinist, a dashboard): Owain signs in once in
// his own Chrome, in a window of its own, and the session's cookies and local storage are saved to
// .sessions/<name>.json (gitignored, never in a project). capture and record put them back into
// their headless browser before the page loads. Studio never sees or types the password.
//   studio signin <name> <url>
import { type ChildProcess, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { freePort, type Log, ROOT, readJson } from "./tools.ts";

export const SESSIONS = join(ROOT, ".sessions");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 5000;

export type Cookie = { name: string; value: string; domain: string; path: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string };
export type Session = { url: string; at: string; cookies: Cookie[]; storage: Record<string, Record<string, string>> };

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((ok) => {
    if (signal?.aborted) return ok();
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      ok();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      ok();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export const sessionFile = (name: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) throw new Error(`a session name is lowercase letters, digits and dashes: "${name}"`);
  return join(SESSIONS, `${name}.json`);
};

export function validateSessionUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) throw new Error(`session URL must start with http:// or https://: "${url}"`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`invalid session URL (must be http:// or https://): "${url}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`session URL must start with http:// or https://: "${url}"`);
  }
  return url;
}

export const hasSessionData = (s: Session): boolean => s.cookies.length > 0 || Object.keys(s.storage).length > 0;

// Atomic session write with owner-only permissions (0o700 dir, 0o600 file).
export function saveSession(file: string, session: Session): void {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(session, null, 2) + "\n", { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

export function loadSession(name: string): Session {
  const file = sessionFile(name);
  if (!existsSync(file)) throw new Error(`no session "${name}": sign in first with npm run studio -- signin ${name} <url>`);
  return readJson(file) as Session;
}

// One CDP call on a target's websocket. Rejects on close, error, or timeout so closing Chrome
// mid-snapshot can never hang indefinitely.
export async function cdpCall<T>(ws: string, method: string, params: object = {}, timeoutMs = CDP_TIMEOUT_MS): Promise<T> {
  const sock = new WebSocket(ws);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((ok, no) => {
      let settled = false;
      const finish = (err: Error | null, val?: T) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (err) no(err);
        else ok(val as T);
      };
      timer = setTimeout(() => finish(new Error(`browser CDP call timed out (${method})`)), timeoutMs);
      sock.onerror = () => finish(new Error("could not reach the browser"));
      sock.onclose = () => finish(new Error("browser connection closed"));
      sock.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data as string);
          if (m.id !== 1) return;
          if (m.error) finish(new Error(m.error.message));
          else finish(null, m.result as T);
        } catch (err) {
          finish(err instanceof Error ? err : new Error(String(err)));
        }
      };
      sock.onopen = () => {
        try {
          sock.send(JSON.stringify({ id: 1, method, params }));
        } catch (err) {
          finish(err instanceof Error ? err : new Error(String(err)));
        }
      };
    });
  } finally {
    if (timer) clearTimeout(timer);
    sock.onopen = null;
    sock.onmessage = null;
    sock.onerror = null;
    sock.onclose = null;
    try {
      sock.close();
    } catch {}
  }
}

// What the window holds now: every cookie, and the local storage of each http(s) page open in it.
async function snapshot(prev: Session, port: number): Promise<Session> {
  const versionRes = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!versionRes.ok) throw new Error(`CDP /json/version returned ${versionRes.status}`);
  const version = (await versionRes.json()) as { webSocketDebuggerUrl: string };
  const { cookies } = await cdpCall<{ cookies: Cookie[] }>(version.webSocketDebuggerUrl, "Storage.getCookies");
  const storage = { ...prev.storage };
  const pagesRes = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!pagesRes.ok) throw new Error(`CDP /json returned ${pagesRes.status}`);
  const pages = ((await pagesRes.json()) as { type: string; url: string; webSocketDebuggerUrl?: string }[]).filter(
    (t) => t.type === "page" && /^https?:/.test(t.url) && t.webSocketDebuggerUrl,
  );
  for (const p of pages) {
    const r = await cdpCall<{ result: { value?: { origin: string; items: Record<string, string> } } }>(p.webSocketDebuggerUrl!, "Runtime.evaluate", {
      expression: "({ origin: location.origin, items: Object.fromEntries(Object.entries(localStorage)) })",
      returnByValue: true,
    }).catch(() => undefined);
    const v = r?.result.value;
    if (v && Object.keys(v.items).length) storage[v.origin] = v.items;
  }
  return { ...prev, at: new Date().toISOString(), cookies, storage };
}

// Opens Chrome on `url` in a fresh profile and saves the session every two seconds until the window
// is closed. Existing session files are only overwritten once cookies or storage are captured.
export async function signin(name: string, url: string, log: Log = () => {}): Promise<string> {
  const file = sessionFile(name);
  validateSessionUrl(url);
  if (!existsSync(CHROME)) throw new Error(`Google Chrome is not at ${CHROME}`);
  mkdirSync(SESSIONS, { recursive: true, mode: 0o700 });
  chmodSync(SESSIONS, 0o700);
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "studio-signin-"));
  const proc: ChildProcess = spawn(
    CHROME,
    [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--new-window", url],
    { stdio: "ignore" },
  );
  let closed = false;
  let spawnErr: Error | undefined;
  let resolveExit!: () => void;
  const exited = new Promise<void>((ok) => {
    resolveExit = ok;
  });
  const markClosed = () => {
    closed = true;
    resolveExit();
  };
  proc.on("exit", markClosed);
  proc.on("error", (err) => {
    spawnErr = err;
    markClosed();
  });

  const ac = new AbortController();
  let interrupted: NodeJS.Signals | null = null;
  const onSignal = (sig: NodeJS.Signals) => {
    interrupted = sig;
    ac.abort();
    if (!closed) {
      try {
        proc.kill("SIGTERM");
      } catch {}
    }
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  log(`Sign in to ${url} in the Chrome window that opened, then close that window.`);
  let session: Session = { url, at: "", cookies: [], storage: {} };
  let saved = false;
  let lastSavedKey = "";
  const persistIfChanged = () => {
    if (!hasSessionData(session)) return;
    const key = JSON.stringify({ cookies: session.cookies, storage: session.storage });
    if (key === lastSavedKey) return;
    saveSession(file, session);
    lastSavedKey = key;
    saved = true;
  };

  try {
    while (!closed && !interrupted) {
      await sleep(2000, ac.signal);
      if (closed || interrupted) break;
      try {
        session = await snapshot(session, port);
        persistIfChanged();
      } catch {
        // The browser is still starting, or closing.
      }
    }
    if (!interrupted) persistIfChanged();
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    if (!closed) {
      try {
        proc.kill("SIGTERM");
      } catch {}
      await Promise.race([exited, sleep(2000)]);
      if (!closed) {
        try {
          proc.kill("SIGKILL");
        } catch {}
        await Promise.race([exited, sleep(500)]);
      }
    } else {
      await Promise.race([exited, sleep(500)]);
    }
    rmSync(profile, { recursive: true, force: true });
  }
  if (spawnErr) throw new Error(`failed to launch Chrome: ${spawnErr.message}`);
  if (interrupted) throw new Error(`signin cancelled (${interrupted})`);
  if (!saved) throw new Error("the window closed before the session could be saved");
  log(`Saved ${session.cookies.length} cookies and storage for ${Object.keys(session.storage).length} site(s).`);
  return file;
}

// A script for Page.addScriptToEvaluateOnNewDocument that puts the saved local storage back, for
// the page's own origin only, before the page's code runs.
export function storageScript(s: Session): string {
  return `(() => { const all = ${JSON.stringify(s.storage)}; const mine = all[location.origin]; if (!mine) return; for (const [k, v] of Object.entries(mine)) { try { localStorage.setItem(k, v); } catch {} } })();`;
}

// Cookies as Network.setCookies takes them.
export const cookieParams = (s: Session) =>
  s.cookies.map(({ name, value, domain, path, expires, httpOnly, secure, sameSite }) => ({ name, value, domain, path, httpOnly, secure, ...(sameSite ? { sameSite } : {}), ...(expires && expires > 0 ? { expires } : {}) }));
