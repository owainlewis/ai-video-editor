// A signed-in session for pages behind a login (Machinist, a dashboard): Owain signs in once in
// his own Chrome, in a window of its own, and the session's cookies and local storage are saved to
// .sessions/<name>.json (gitignored, never in a project). capture and record put them back into
// their headless browser before the page loads. Studio never sees or types the password.
//   studio signin <name> <url>
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Log, ROOT, readJson, writeJson } from "./tools.ts";

export const SESSIONS = join(ROOT, ".sessions");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9378;

export type Cookie = { name: string; value: string; domain: string; path: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string };
export type Session = { url: string; at: string; cookies: Cookie[]; storage: Record<string, Record<string, string>> };

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export const sessionFile = (name: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) throw new Error(`a session name is lowercase letters, digits and dashes: "${name}"`);
  return join(SESSIONS, `${name}.json`);
};

export function loadSession(name: string): Session {
  const file = sessionFile(name);
  if (!existsSync(file)) throw new Error(`no session "${name}": sign in first with npm run studio -- signin ${name} <url>`);
  return readJson(file) as Session;
}

// One CDP call on a target's websocket.
async function call<T>(ws: string, method: string, params: object = {}): Promise<T> {
  const sock = new WebSocket(ws);
  try {
    await new Promise((ok, no) => ((sock.onopen = ok), (sock.onerror = () => no(new Error("could not reach the browser")))));
    return await new Promise<T>((ok, no) => {
      sock.onmessage = (e) => {
        const m = JSON.parse(e.data as string);
        if (m.id !== 1) return;
        if (m.error) no(new Error(m.error.message));
        else ok(m.result as T);
      };
      sock.send(JSON.stringify({ id: 1, method, params }));
    });
  } finally {
    sock.close();
  }
}

// What the window holds now: every cookie, and the local storage of each http(s) page open in it.
async function snapshot(prev: Session): Promise<Session> {
  const version = (await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json())) as { webSocketDebuggerUrl: string };
  const { cookies } = await call<{ cookies: Cookie[] }>(version.webSocketDebuggerUrl, "Storage.getCookies");
  const storage = { ...prev.storage };
  const pages = ((await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json())) as { type: string; url: string; webSocketDebuggerUrl?: string }[]).filter((t) => t.type === "page" && /^https?:/.test(t.url) && t.webSocketDebuggerUrl);
  for (const p of pages) {
    const r = await call<{ result: { value?: { origin: string; items: Record<string, string> } } }>(p.webSocketDebuggerUrl!, "Runtime.evaluate", {
      expression: "({ origin: location.origin, items: Object.fromEntries(Object.entries(localStorage)) })",
      returnByValue: true,
    }).catch(() => undefined);
    const v = r?.result.value;
    if (v && Object.keys(v.items).length) storage[v.origin] = v.items;
  }
  return { ...prev, at: new Date().toISOString(), cookies, storage };
}

// Opens Chrome on `url` in a fresh profile and saves the session every two seconds until the window
// is closed. The last save before it closes is the one kept.
export async function signin(name: string, url: string, log: Log = () => {}): Promise<string> {
  const file = sessionFile(name);
  if (!existsSync(CHROME)) throw new Error(`Google Chrome is not at ${CHROME}`);
  mkdirSync(SESSIONS, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "studio-signin-"));
  const proc: ChildProcess = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--new-window", url], { stdio: "ignore" });
  let closed = false;
  proc.on("exit", () => (closed = true));
  log(`Sign in to ${url} in the Chrome window that opened, then close that window.`);
  let session: Session = { url, at: "", cookies: [], storage: {} };
  let saved = false;
  try {
    while (!closed) {
      await sleep(2000);
      if (closed) break;
      try {
        session = await snapshot(session);
        writeJson(file, session);
        saved = true;
      } catch {
        // The browser is still starting, or closing.
      }
    }
  } finally {
    if (!closed) proc.kill();
    rmSync(profile, { recursive: true, force: true });
  }
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
