// `studio record <slug>`: films the real pages a reel talks about, from projects/<slug>/record.json.
// Each scene is one page over a stretch of the cut; its actions (move, click, scroll, mark, zoom,
// type) land on spoken words, so the screen moves with the voice. Writes assets/screen.mp4, as long
// as the cut, for `{ "kind": "video", "src": "assets/screen.mp4", "sync": true }`, and
// assets/screen.json: the zooms (drawn by Remotion, so the page stays sharp), the clicks (for sound)
// and warnings about the take, which `check` reports.
// The pages are real and so are the words marked on them: a mark on text that is not there is an error.
import { cookieParams, loadSession, storageScript } from "./session.ts";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBrowser } from "@remotion/renderer";
import { z } from "zod";
import { droppedFrames, type PageLine, zoomSlivers } from "../engine/qc.ts";
import { CUT_LEAD, findPhrase, type ScreenZoom } from "../engine/resolve.ts";
import type { Word } from "../engine/schema.ts";
import { timeline } from "./bin.ts";
import { ffmpeg, freePort, type Log, readJson, writeJson } from "./tools.ts";

// The panel's shape on a split (1080 x 864, above the caption band), at a size that makes the page's
// type large.
const VIEW = { width: 800, height: 640 };

const Action = z.object({
  at: z.string(),
  after: z.number().default(0),
  act: z.enum(["move", "click", "scroll", "mark", "clear", "zoom", "reset", "type"]),
  on: z.string().optional(),
  text: z.string().optional(),
  ms: z.number().optional(),
  s: z.number().optional(),
  top: z.number().optional(),
  // A zoom's centre, 0 to 1, when the words are not at it: frame a whole column, or leave a page's header out.
  x: z.number().optional(),
  y: z.number().optional(),
});
// `dark`: load the page in its dark theme, as a viewer whose system is set to dark sees it (the
// site's own theme switch follows prefers-color-scheme on most sites). `lead`: seconds the page plays
// before filming starts, so a live diagram is already in motion on its first frame. `el`: a CSS
// selector (a figure's id) whose top edge lands at `top`, so a whole diagram is framed, never its caption.
const Scene = z.object({ from: z.string(), to: z.string(), url: z.string(), on: z.string().optional(), top: z.number().default(96), dark: z.boolean().default(false), el: z.string().optional(), lead: z.number().min(0).max(20).default(0), do: z.array(Action) });
// `session`: a saved sign-in (.sessions/<name>.json, from `studio signin`) for pages behind a login.
const Script = z.object({ session: z.string().optional(), scenes: z.array(Scene).min(1) });
type Act = z.infer<typeof Action>;

// Runs inside the page. The cursor and marks are drawn over it; everything under them is the real page.
const HELPERS = String.raw`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const ease = (t) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const cur = document.createElement('div');
  cur.id = '__rec_cur';
  cur.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:30px;height:30px';
  cur.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 3l14 9-6.5 1.2L9 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.documentElement.appendChild(cur);
  const style = document.createElement('style');
  style.textContent = '@keyframes __ring{from{transform:translate(-50%,-50%) scale(.3);opacity:.6}to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}';
  document.documentElement.appendChild(style);
  let pos = [innerWidth * .62, innerHeight * .7];
  cur.style.transform = 'translate(' + pos[0] + 'px,' + pos[1] + 'px)';
  const tween = (ms, f) => !(ms > 0) ? (f(1), Promise.resolve(true)) : new Promise((done) => { const s = performance.now(); const step = (n) => { const t = Math.min(1, (n - s) / ms); f(ease(t)); t < 1 ? requestAnimationFrame(step) : done(true); }; requestAnimationFrame(step); });
  const find = (text) => {
    const re = new RegExp(text.trim().split(/\s+/).map((w) => w.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')).join('\\s+'));
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      const m = re.exec(n.data);
      if (!m) continue;
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      if (r.getBoundingClientRect().width > 0 && getComputedStyle(n.parentElement).visibility !== 'hidden') return r;
    }
    return null;
  };
  const dark = () => { for (let e = document.body; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); if (c && (c.length < 4 || +c[3] > 0)) return (+c[0] + +c[1] + +c[2]) / 3 < 110; } return false; };
  let marks = [];
  window.__rec = {
    rect: (text) => { const r = find(text); if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, l: b.left, t: b.top }; },
    pos: () => pos,
    move: (x, y, ms) => { const [a, b] = pos; return tween(ms, (e) => { pos = [a + (x - a) * e, b + (y - b) * e]; cur.style.transform = 'translate(' + pos[0] + 'px,' + pos[1] + 'px)'; }); },
    scrollTo: (y, ms) => { const a = scrollY; return tween(ms, (e) => scrollTo(0, a + (y - a) * e)); },
    ring: () => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:' + pos[0] + 'px;top:' + pos[1] + 'px;width:48px;height:48px;border-radius:50%;background:#B7CDBF;z-index:2147483646;pointer-events:none;animation:__ring .4s ease-out forwards'; document.documentElement.appendChild(d); setTimeout(() => d.remove(), 450); },
    mark: (text, ms) => {
      const r = find(text); if (!r) return false;
      const rects = [...r.getClientRects()].filter((b) => b.width > 1);
      const onDark = dark();
      rects.forEach((b, i) => {
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;left:' + (b.left + scrollX - 3) + 'px;top:' + (b.top + scrollY - 1) + 'px;height:' + (b.height + 2) + 'px;width:0;border-radius:3px;background:#B7CDBF;z-index:2147483000;pointer-events:none;' + (onDark ? 'opacity:.35' : 'mix-blend-mode:multiply');
        document.documentElement.appendChild(d); marks.push(d);
        const w = b.width + 6, each = ms / rects.length;
        setTimeout(() => tween(each, (e) => { d.style.width = w * e + 'px'; }), i * each);
      });
      return true;
    },
    clear: () => { marks.forEach((d) => d.remove()); marks = []; },
    lines: () => {
      const out = [], r = document.createRange(), walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) {
        const text = n.data.trim();
        if (!text || getComputedStyle(n.parentElement).visibility === 'hidden') continue;
        r.selectNodeContents(n);
        for (const b of r.getClientRects()) if (b.width > 1) out.push({ text: text.slice(0, 40), left: b.left, right: b.right, top: b.top, bottom: b.bottom });
      }
      return out;
    },
  };
})()`;

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, Math.max(0, ms)));

async function resolveChrome(): Promise<string> {
  const status = await ensureBrowser({ logLevel: "error" });
  if (status.type === "local-puppeteer-browser" || status.type === "user-defined-path") return status.path;
  throw new Error(`could not resolve Chrome via @remotion/renderer (${status.type})`);
}

// Look up an action phrase strictly within the scene's word range [fromI, toI].
export function findActionPhrase(words: Word[], phrase: string, fromI: number, toI: number): [number, number] {
  const i = findPhrase(words, phrase, fromI);
  if (i < 0 || i > toI) throw new Error(`record.json: "${phrase}" is not said in this scene`);
  return [i, words[i].start];
}

export class Browser {
  private ws?: WebSocket;
  private id = 0;
  private waiting = new Map<number, [(v: any) => void, (e: Error) => void]>();
  private proc?: ChildProcess;
  private procExited = false;
  private exited?: Promise<void>;
  onFrame?: (data: string, session: number) => void;
  constructor(private profile: string) {}
  private rejectAll(err: Error) {
    for (const [, [, no]] of this.waiting) no(err);
    this.waiting.clear();
  }
  async open() {
    const chrome = await resolveChrome();
    const port = await freePort();
    let procErr: Error | undefined;
    let resolveExit!: () => void;
    this.procExited = false;
    this.exited = new Promise<void>((ok) => {
      resolveExit = ok;
    });
    this.proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${this.profile}`, "--no-sandbox", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
    this.proc.on("error", (err) => {
      procErr = err;
      this.procExited = true;
      resolveExit();
      this.rejectAll(new Error(`browser process error: ${err.message}`));
    });
    this.proc.on("exit", (code, signal) => {
      this.procExited = true;
      resolveExit();
      this.rejectAll(new Error(`browser exited (${signal ?? code ?? "unknown"})`));
    });
    let page: { type: string; webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 50 && !page && !this.procExited; i++) {
      await sleep(200);
      if (this.procExited) break;
      page = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(2000) })
        .then((r) => (r.ok ? r.json() : undefined))
        .then((l: any[] | undefined) => l?.find((t) => t.type === "page"))
        .catch(() => undefined);
    }
    if (procErr) throw new Error(`the browser failed to start: ${procErr.message}`);
    if (!page) throw new Error("the browser did not start");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    this.ws = ws;
    await new Promise<void>((ok, no) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) no(err);
        else ok();
      };
      const timer = setTimeout(() => done(new Error("timed out connecting to browser WebSocket")), 10000);
      ws.onopen = () => done();
      ws.onerror = () => done(new Error("browser WebSocket failed to connect"));
      ws.onclose = () => done(new Error("browser WebSocket closed before opening"));
    });
    ws.onclose = () => this.rejectAll(new Error("browser WebSocket closed"));
    ws.onerror = () => this.rejectAll(new Error("browser WebSocket error"));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string);
      if (m.id) {
        const pending = this.waiting.get(m.id);
        if (pending) {
          this.waiting.delete(m.id);
          if (m.error) pending[1](new Error(m.error.message));
          else pending[0](m.result);
        }
      }
      if (m.method === "Page.screencastFrame") this.onFrame?.(m.params.data, m.params.sessionId);
    };
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Emulation.setDeviceMetricsOverride", { ...VIEW, deviceScaleFactor: 2, mobile: false });
    // So a real click on a copy button works, in this throwaway profile.
    await this.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await this.send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
  }
  send(method: string, params: object = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("browser WebSocket is not open"));
    }
    return new Promise<any>((ok, no) => {
      const id = ++this.id;
      this.waiting.set(id, [ok, no]);
      try {
        this.ws!.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        this.waiting.delete(id);
        no(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  async js<T = any>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  async close() {
    this.rejectAll(new Error("browser closed"));
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = undefined;
    }
    if (this.proc) {
      const proc = this.proc;
      this.proc = undefined;
      if (!this.procExited) {
        try {
          proc.kill("SIGTERM");
        } catch {}
        if (this.exited) await Promise.race([this.exited, sleep(2000)]);
        if (!this.procExited) {
          try {
            proc.kill("SIGKILL");
          } catch {}
          if (this.exited) await Promise.race([this.exited, sleep(500)]);
        }
      }
    }
  }
}

export async function record(projects: string, slug: string, log?: Log) {
  const dir = join(projects, slug);
  const script = Script.parse(readJson(join(dir, "record.json")));
  const { words, duration } = timeline(dir);
  const when = (phrase: string, from = 0): [number, number] => {
    const i = findPhrase(words as Word[], phrase, from);
    if (i < 0) throw new Error(`record.json: "${phrase}" is not said in the cut`);
    return [i, words[i].start];
  };
  const work = mkdtempSync(join(tmpdir(), "studio-record-"));
  const browser = new Browser(join(work, "profile"));
  const zooms: ScreenZoom[] = [];
  const ticks: number[] = [];
  const warnings: string[] = [];
  const clips: { start: number; end: number; frames: { file: string; t: number }[] }[] = [];
  try {
    await browser.open();
    if (script.session) {
      const saved = loadSession(script.session);
      await browser.send("Network.setCookies", { cookies: cookieParams(saved) });
      await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: storageScript(saved) });
    }
    let n = 0;
    let cursor = 0; // Scenes run in order, so a phrase said earlier in the cut is not this scene's.
    for (const [k, scene] of script.scenes.entries()) {
      const [fromI, fromT] = when(scene.from, cursor);
      const start = fromI === 0 ? 0 : fromT - CUT_LEAD; // The first shot starts at 0, before the first word.
      const [toI, toT] = when(scene.to, fromI);
      const end = toT - CUT_LEAD;
      cursor = toI;
      log?.(`scene ${k + 1}/${script.scenes.length}: ${scene.url} (${start.toFixed(2)} to ${end.toFixed(2)})`);
      await browser.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scene.dark ? "dark" : "light" }] });
      const nav = await browser.send("Page.navigate", { url: scene.url });
      if (nav.errorText) throw new Error(`record.json: ${scene.url} did not load (${nav.errorText})`);
      await sleep(3500);
      await browser.js(HELPERS);
      // A scene where nothing is pointed at or clicked shows no cursor: an idle arrow over a diagram is noise.
      if (!scene.do.some((a) => a.act === "move" || a.act === "click" || a.act === "type")) await browser.js("document.getElementById('__rec_cur').style.display = 'none'");
      if (scene.el) {
        const t = await browser.js<number | null>(`(() => { const e = document.querySelector(${JSON.stringify(scene.el)}); return e ? e.getBoundingClientRect().top : null; })()`);
        if (t === null) throw new Error(`record.json: no ${scene.el} on ${scene.url}`);
        await browser.js(`scrollTo(0, scrollY + ${t - scene.top})`);
        await sleep(400);
      } else if (scene.on) {
        const p = await browser.js(`__rec.rect(${JSON.stringify(scene.on)})`);
        if (!p) throw new Error(`record.json: "${scene.on}" is not on ${scene.url}`);
        await browser.js(`scrollTo(0, scrollY + ${p.t - scene.top})`);
        await sleep(400);
      }
      if (scene.lead) await sleep(scene.lead * 1000);
      const frames: { file: string; t: number }[] = [];
      const write = (data: string, t: number) => {
        const file = join(work, `${String(n++).padStart(6, "0")}.jpg`);
        writeFileSync(file, Buffer.from(data, "base64"));
        frames.push({ file, t });
      };
      const first = await browser.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
      const clock = Date.now();
      write(first.data, 0);
      browser.onFrame = (data, sessionId) => {
        write(data, (Date.now() - clock) / 1000);
        browser.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      };
      await browser.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });

      const place = async (on: string) => {
        const p = await browser.js(`__rec.rect(${JSON.stringify(on)})`);
        if (!p) throw new Error(`record.json: "${on}" is not on ${scene.url}`);
        return p as { x: number; y: number; l: number; t: number };
      };
      let zoomed = false;
      const moves: [number, number][] = []; // When the page itself moves, on this clip's clock.
      const moved = (t: number, ms: number) => moves.push([t - start, t - start + ms / 1000]);
      const perform = async (a: Act, t: number) => {
        const on = a.on ?? "";
        if (a.act === "move") {
          const p = await place(on);
          const x = Math.min(p.x, p.l + 110);
          moved(t, a.ms ?? 420);
          await browser.js(`__rec.move(${x}, ${p.y + 8}, ${a.ms ?? 420})`);
          await browser.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: p.y });
        } else if (a.act === "click") {
          const [x, y] = await browser.js<number[]>("__rec.pos()");
          await browser.js("__rec.ring()");
          ticks.push(t);
          for (const type of ["mousePressed", "mouseReleased"]) await browser.send("Input.dispatchMouseEvent", { type, x, y: y - 8, button: "left", clickCount: 1 });
        } else if (a.act === "scroll") {
          const p = await place(on);
          const y = await browser.js<number>("scrollY");
          if (Math.abs(p.t - (a.top ?? scene.top)) >= 1) moved(t, a.ms ?? 650); // A scroll that goes nowhere paints nothing.
          await browser.js(`__rec.scrollTo(${y + p.t - (a.top ?? scene.top)}, ${a.ms ?? 650})`);
        } else if (a.act === "mark") {
          if (!(await browser.js(`__rec.mark(${JSON.stringify(on)}, ${a.ms ?? 300})`))) throw new Error(`record.json: "${on}" is not on ${scene.url}`);
          ticks.push(t);
        } else if (a.act === "clear") {
          await browser.js("__rec.clear()");
        } else if (a.act === "zoom") {
          const p = a.x !== undefined && a.y !== undefined ? undefined : await place(on);
          const zoom = { t, x: a.x ?? p!.x / VIEW.width, y: a.y ?? p!.y / VIEW.height, s: a.s ?? 1.5, ms: a.ms ?? 600 };
          zooms.push(zoom);
          const [cut] = zoomSlivers(await browser.js<PageLine[]>("__rec.lines()"), zoom, VIEW);
          if (cut) warnings.push(`the zoom at ${t.toFixed(2)}s leaves a sliver of "${cut.text}" at the edge of the frame; move its centre or zoom in less`);
          zoomed = true;
        } else if (a.act === "reset") {
          zooms.push({ t, x: 0.5, y: 0, s: 1, ms: a.ms ?? 500 });
          zoomed = false;
        } else if (a.act === "type") {
          for (const ch of a.text ?? "") {
            await browser.send("Input.dispatchKeyEvent", { type: "char", text: ch });
            await sleep(40 + Math.random() * 60);
          }
        }
      };
      const running: Promise<void>[] = [];
      const acts = scene.do.map((a) => ({ a, t: findActionPhrase(words as Word[], a.at, fromI, toI)[1] + a.after })).sort((x, y) => x.t - y.t);
      for (const { a, t } of acts) {
        await sleep(clock + (t - start) * 1000 - Date.now());
        const act = perform(a, t);
        act.catch(() => {}); // Reported by the Promise.all below; until then it must not kill the process.
        running.push(act);
      }
      await sleep(clock + (end - start) * 1000 - Date.now());
      await Promise.all(running);
      await browser.send("Page.stopScreencast");
      browser.onFrame = undefined;
      for (const g of droppedFrames(frames.map((f) => f.t), moves)) warnings.push(`the recording dropped ${Math.round(g.secs * 1000)} ms of frames at ${(start + g.t).toFixed(2)}s while the page moved; record it again`);
      if (zoomed) zooms.push({ t: end, x: 0.5, y: 0, s: 1, ms: 0 });
      clips.push({ start, end, frames });
    }

    // One list of frames on the timeline, black where no scene plays.
    const black = join(work, "black.jpg");
    ffmpeg(["-f", "lavfi", "-i", `color=c=black:s=${VIEW.width * 2}x${VIEW.height * 2}`, "-frames:v", "1", black]);
    const lines: string[] = [];
    const add = (file: string, secs: number) => lines.push(`file '${file}'`, `duration ${Math.max(0, secs).toFixed(4)}`);
    let at = 0;
    for (const c of clips) {
      add(black, c.start - at);
      const len = c.end - c.start;
      const fs = c.frames.filter((f) => f.t < len);
      fs.forEach((f, i) => add(f.file, (fs[i + 1]?.t ?? len) - f.t));
      at = c.end;
    }
    add(black, duration - at);
    lines.push(`file '${black}'`);
    const list = join(work, "frames.txt");
    writeFileSync(list, `${lines.join("\n")}\n`);
    mkdirSync(join(dir, "assets"), { recursive: true });
    const out = join(dir, "assets/screen.mp4");
    ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,scale=1620:-2", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-t", duration.toFixed(3), out], log);
    writeJson(join(dir, "assets/screen.json"), { zooms: zooms.sort((a, b) => a.t - b.t), ticks: ticks.sort((a, b) => a - b), warnings });
    warnings.forEach((w) => log?.(`warn: ${w}`));
    return out;
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}
