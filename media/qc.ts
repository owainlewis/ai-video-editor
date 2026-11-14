// `studio qc <slug>`: check every graphic before anything is rendered (Owain, 2026-10-25: "it's
// expensive to fix afterwards"). It opens each graphic's frames in a headless browser (the QC page,
// app/qc.tsx), measures where every piece of text, line and dot really lands, and runs the layout
// checks in engine/qc.ts on its settled frame. It also finds the cuts in the footage (for the plan
// checks) and makes one contact sheet per graphic: the picture before it, its first frame, each
// reveal landing, settled, and the picture after it. Nothing is rendered to video.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { C, PALETTES } from "../effects/clean/kit.tsx";
import { underHook } from "../effects/clean/hook.tsx";
import { BAND as SPLIT_BAND } from "../effects/theme.ts";
import { HOOK_BAND } from "../engine/resolve.ts";
import { GREEN } from "../effects/clean/text.tsx";
import { createServer as createHttp } from "node:http";
import { join } from "node:path";
import { openBrowser } from "@remotion/renderer";
import { createServer as createVite } from "vite";
import { compositionFor } from "../effects/canvas.ts";
import { type Canvas, cardPlan, effectList, hookPlan } from "../effects/preview.ts";
import { readCardLibrary } from "./cardlibrary.ts";
import { BAND } from "../effects/clean/cover.tsx";
import { longestStill, type Measure, qcCover, qcHook, qcLayout, STILL_LIMIT } from "../engine/qc.ts";
import type { Range } from "../engine/parts.ts";
import { type Issue, isGraphic, lastKept, shotLabel } from "../engine/resolve.ts";
import { itemHash } from "../engine/review.ts";
import type { Resolved, ResolvedShot } from "../engine/schema.ts";
import { serveFile } from "../server/index.ts";
import { GRAPHITE, BLACK, tokens } from "../styles/ivory/tokens.ts";
import { resolveProject } from "./project.ts";
import { ffmpeg, type Log, readJson, ROOT, run, writeJson } from "./tools.ts";

// Cuts in the footage, by scene detection on the light preview. Cached until the preview changes.
export function footageCuts(dir: string, log?: Log): number[] {
  const preview = join(dir, "build/preview.mp4");
  const file = join(dir, "build/cuts.json");
  if (!existsSync(preview)) return [];
  const made = statSync(preview).mtimeMs;
  if (existsSync(file)) {
    const c = readJson<{ made: number; cuts: number[] }>(file);
    if (c.made === made) return c.cuts;
  }
  const out = run("ffmpeg", ["-hide_banner", "-nostats", "-i", preview, "-an", "-vf", "scale=320:-1,select='gt(scene\\,0.2)',showinfo", "-f", "null", "-"], { log });
  const cuts = [...String(out.stderr).matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]);
  writeJson(file, { made, cuts });
  return cuts;
}

// The frames worth looking at for one graphic.
const framesFor = (s: ResolvedShot, duration: number) => {
  const reveals = (s.visual?.times ?? []).filter((t) => t > s.start && t < s.end).map((t) => Math.min(s.end - 0.05, t + 0.7));
  // Settled is before any exit: side cards fade out over the last 0.46 s as he grows back, black
  // cards dissolve over 0.4 s. At end - 0.15 a side card was already gone, so QC measured nothing.
  const settled = +Math.max(s.start + 0.05, s.end - 0.55).toFixed(3);
  const all = [s.start - 0.1, s.start + 0.04, ...reveals, settled, s.end + 0.1].filter((t) => t >= 0 && t < duration);
  // Layout is checked on every frame where something has just landed, not only the last one: a
  // graphic that changes (an odometer becoming "12x") hides its earlier states from a last-frame check.
  const checks = new Set([...reveals, settled].map((t) => +t.toFixed(3)));
  return { all: [...new Set(all.map((t) => +t.toFixed(3)))].sort((a, b) => a - b), settled, checks };
};

// The clean style's backgrounds: a split's top panel and the cards are flat ink, paper or green; the
// glass and full shots sit on footage.
// The stage a clean graphic sits on, in the reel's palette (light by default).
const cleanBg = (r: Resolved, s: ResolvedShot) => {
  const p = PALETTES[r.palette ?? "light"];
  return s.layout === "split" ? p.stage : s.layout === "card" ? { ink: p.card, paper: C.paper, green: GREEN }[s.bg ?? "ink"] : s.layout === "diagram" ? p.diagram : undefined;
};
// A clean split's panel, for balance: below the hook while it shows, down to the caption band.
// Only drawn graphics (diagrams and app windows) are judged; a capture is framed by its plan.
const panelFor = (r: Resolved, s: ResolvedShot): [number, number, number, number] | undefined => {
  if (r.style !== "clean" || s.layout !== "split" || !s.visual || s.visual.kind === "image" || s.visual.kind === "video") return undefined;
  const top = underHook(r, s) ? HOOK_BAND : 0;
  return [0, top, 1080, SPLIT_BAND.top - top];
};

// The background a graphic's text sits on, for contrast: the canvas for designed frames, nothing on footage.
const bgFor = (r: Resolved, s: ResolvedShot) =>
  r.style === "clean"
    ? cleanBg(r, s)
    : s.layout === "half"
    ? tokens.color.light.bg
    : s.layout === "side" || s.layout === "media" || s.layout === "scene" || s.layout === "split"
    ? s.tone === "dark"
      ? r.canvas === "youtube"
        ? r.theme === "dark"
          ? GRAPHITE.bg
          : BLACK.bg
        : tokens.color.dark.bg
      : tokens.color.light.bg
    : undefined;

async function qcServer(projects: string) {
  const server = createHttp();
  const vite = await createVite({
    root: join(ROOT, "app"),
    publicDir: false,
    appType: "mpa",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "remotion", "@remotion/player", "@remotion/media"] },
  });
  server.on("request", (req, res) => {
    if (serveFile(projects, req, res)) return;
    vite.middlewares(req, res);
  });
  const port: number = await new Promise((ok) => server.listen(0, "127.0.0.1", () => ok((server.address() as { port: number }).port)));
  return { url: `http://127.0.0.1:${port}`, close: () => (server.close(), vite.close()) };
}

export type QcResult = { issues: Issue[]; sheets: string[]; overview: string | null };

// One graphic's result in the report: its strip (a file in checks/qc/) and what is wrong with it.
// `cached`: it has not changed since an earlier run measured it, so that result was kept.
export type QcItem = { id: string; hash: string; index: number; start: number; kind: string; sheet: string; issues: Issue[]; cached: boolean };
// `other`: checks that belong to no one graphic (a recorded screen that holds still).
// `partial`: some graphics were left out (`--at`, or the render of one part) and have no result yet.
export type QcReport = QcResult & { at: string; items: QcItem[]; other: Issue[]; partial: boolean; stamp: string };

// What a run keeps for the next one: each graphic's result under its id, good for as long as the
// graphic's hash and the code that draws it stay the same.
type Kept = { hash: string; name: string; frames: number; settled: number; sheet: string; issues: { level: Issue["level"]; rest: string }[] };
type QcCache = { stamp: string; items: Record<string, Kept> };

// The code a graphic is drawn and measured by. A change to any of it makes every kept result stale.
export function codeStamp(): string {
  let latest = 0;
  for (const dir of ["effects", "styles"])
    for (const f of readdirSync(join(ROOT, dir), { recursive: true })) {
      const st = statSync(join(ROOT, dir, String(f)));
      if (st.isFile()) latest = Math.max(latest, st.mtimeMs);
    }
  for (const f of ["engine/qc.ts", "app/qc.tsx", "media/qc.ts"]) latest = Math.max(latest, statSync(join(ROOT, f)).mtimeMs);
  return String(Math.round(latest));
}

// A graphic as QC sees it: its look and timing from its own start (engine/review.ts), with its
// captions where the video has them.
export const qcHash = (r: Resolved, i: number) => {
  const s = r.shots[i];
  const end = r.shots[lastKept(r.shots, i)].end;
  return itemHash(r, i, r.captions ? r.chunks.flatMap((c) => c.words).filter((w) => w.start >= s.start && w.start < end).map((w) => w.text).join(" ") : "");
};

// The last report, for the editor: every graphic's result, and which graphics have changed since
// (or were never checked), so a stale result is never read as a pass.
export function qcState(dir: string, r: Resolved): (QcReport & { stale: string[] }) | null {
  const file = join(dir, "checks/qc/report.json");
  if (!existsSync(file)) return null;
  const report = readJson<Partial<QcReport>>(file);
  const items = report.items ?? [];
  const current = report.stamp === codeStamp();
  const stale = r.shots.flatMap((s, i) => (isGraphic(s) && !(current && items.find((x) => x.id === s.id)?.hash === qcHash(r, i)) ? [s.id ?? String(i + 1)] : []));
  return { at: report.at ?? "", issues: report.issues ?? [], sheets: report.sheets ?? [], overview: report.overview ?? null, items, other: report.other ?? [], partial: report.partial ?? true, stamp: report.stamp ?? "", stale };
}

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof openBrowser>>["newPage"]>>;

// The QC page in a headless browser at the composition's size, ready for a project (`slug`) or for
// plans handed to it one at a time (the library check).
async function qcPage(srv: { url: string }, size: { width: number; height: number }, query: string, log?: Log) {
  const browser = await openBrowser("chrome", { forceDeviceScaleFactor: 1, logLevel: "error" });
  const page = await browser.newPage({ context: () => null, logLevel: "error", indent: false, pageIndex: 0, onBrowserLog: (l: { type: string; text: string }) => l.type === "error" && !/vite|websocket/i.test(l.text) && log?.(`page: ${l.text}`), onLog: () => {} } as never);
  await page.setViewport({ ...size, deviceScaleFactor: 1 });
  await page.goto({ url: `${srv.url}/qc.html?${query}`, timeout: 120000 } as never);
  for (let k = 0; k < 600 && !(await page.evaluate(() => window.qcReady)); k++) await new Promise((ok) => setTimeout(ok, 100));
  return { browser, page };
}

const shoot = async (page: Page, r: Resolved, t: number, file: string) => {
  await page.evaluate((f: number) => window.qcSeek!(f), Math.round(t * r.fps));
  const shot = (await (page as unknown as { _client(): { send(m: string, p: object): Promise<{ value?: { data: string }; data?: string }> } })._client().send("Page.captureScreenshot", { format: "jpeg", quality: 82 })) as { value?: { data: string }; data?: string };
  writeFileSync(file, Buffer.from((shot.value ?? shot).data!, "base64"));
};

// One graphic: shoot its frames into `frames` (named `${name}-<k>.jpg`), measure the ones where
// something has landed, and add what is wrong to `issues`. Returns the frames and the settled one.
async function checkGraphic(page: Page, r: Resolved, s: ResolvedShot, where: string, frames: string, name: string, issues: Issue[]) {
  const comp = compositionFor(r.canvas);
  const { all, settled, checks } = framesFor(s, r.duration);
  const seen = new Set<string>();
  const files: string[] = [];
  let measured: string | null = null;
  let crashed = false;
  for (const [k, t] of all.entries()) {
    const file = join(frames, `${name}-${k}.jpg`);
    await shoot(page, r, t, file);
    files.push(file);
    // A graphic that throws is the worst failure there is: say so plainly, once, and skip measuring it.
    const crash = (await page.evaluate(() => window.qcError ?? null)) as string | null;
    // The frame just before a shot belongs to the shot before it; its crash is reported there.
    if (crash && t < s.start) continue;
    if (crash) {
      if (!crashed) issues.push({ level: "error", message: `${where}: the graphic crashed at ${t.toFixed(1)}s: ${crash}` });
      crashed = true;
      continue;
    }
    if (checks.has(t)) {
      const m = (await page.evaluate(() => window.qcMeasure!())) as Measure;
      if (t === settled) {
        measured = file;
        writeJson(join(frames, `${name}-measure.json`), m);
        if (!m.texts.length) issues.push({ level: "warn", message: `${where}: no text on screen when it should have settled (${t.toFixed(1)}s); check it is not already gone` });
      }
      // Chapter cards sit on a left margin by design (2026-10-25 motion lab); everything else full
      // frame is centred. Centring is judged once everything has landed.
      const centred = t === settled && (s.layout === "media" || s.layout === "scene") && s.visual!.kind !== "chapter";
      for (const issue of qcLayout(m, [comp.width, comp.height], `${where} at ${t.toFixed(1)}s`, bgFor(r, s), centred, t === settled ? panelFor(r, s) : undefined)) {
        const key = issue.message.replace(/ at [\d.]+s:/, ":");
        if (!seen.has(key)) seen.add(key), issues.push(issue);
      }
    }
  }
  // Every graphic must be measured; a silent skip is how a bad layout gets through.
  if (!measured && !crashed) issues.push({ level: "error", message: `${where}: QC could not measure its settled frame` });
  return { files, settled: measured, settledAt: measured ? files.indexOf(measured) : -1 };
}

// The clean style's text hook: one frame in every shot it is on screen in, each measured for the
// hook's own checks (engine/qc.ts, qcHook). On a card or panel it is read against that colour; on
// footage, against the brightest part of the picture under it, shot with the hook hidden.
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
async function checkHook(page: Page, r: Resolved, frames: string, name: string, issues: Issue[], where = "the hook") {
  const comp = compositionFor(r.canvas);
  const files: string[] = [];
  for (const s of r.shots.filter((s) => s.start < r.hook!.until)) {
    // The last moment the hook is on in the shot, when most of the panel has landed under it.
    const t = +Math.max(s.start + 0.04, Math.min(s.end, r.hook!.until) - 0.1).toFixed(3);
    const file = join(frames, `${name}-${files.length}.jpg`);
    await shoot(page, r, t, file);
    files.push(file);
    const m = (await page.evaluate(() => window.qcMeasure!())) as Measure;
    writeJson(join(frames, `${name}-${files.length - 1}-measure.json`), m);
    const designed = cleanBg(r, s);
    let bg = designed ? hex(designed) : undefined;
    const ink = m.texts.filter((x) => x.hook).map((x) => x.box);
    if (!bg && ink.length) {
      const [l, t0] = [Math.max(0, Math.min(...ink.map((b) => b[0]))), Math.max(0, Math.min(...ink.map((b) => b[1])))];
      const [w, h] = [Math.min(comp.width, Math.max(...ink.map((b) => b[0] + b[2]))) - l, Math.min(comp.height, Math.max(...ink.map((b) => b[1] + b[3]))) - t0];
      await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-qc="hook"]').forEach((e) => (e.style.visibility = "hidden")));
      const bare = join(frames, `${name}-bare.jpg`);
      await shoot(page, r, t, bare);
      await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-qc="hook"]').forEach((e) => (e.style.visibility = "")));
      // The picture under the hook in a grid of cells; the brightest cell is where white reads worst.
      const px = [...execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", bare, "-vf", `crop=${Math.round(w)}:${Math.round(h)}:${Math.round(l)}:${Math.round(t0)},scale=8:2`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])];
      const cells = Array.from({ length: px.length / 3 }, (_, k) => px.slice(k * 3, k * 3 + 3));
      bg = cells.reduce((a, b) => (a[0] + a[1] + a[2] >= b[0] + b[1] + b[2] ? a : b), [0, 0, 0]);
      rmSync(bare);
    }
    issues.push(...qcHook(m, [comp.width, comp.height], `${where} at ${t.toFixed(1)}s (${s.layout})`, bg));
  }
  return files;
}

// Settled frames, on one page.
function overviewSheet(settled: string[], file: string, log?: Log) {
  const cols = 5;
  const lay = settled.map((_, k) => `${(k % cols) * 384}_${Math.floor(k / cols) * 216}`).join("|");
  if (settled.length === 1) ffmpeg(["-i", settled[0], "-vf", "scale=384:216", file], log);
  else ffmpeg([...settled.flatMap((f) => ["-i", f]), "-filter_complex", `${settled.map((_, k) => `[${k}]scale=384:216[v${k}]`).join(";")};${settled.map((_, k) => `[v${k}]`).join("")}xstack=inputs=${settled.length}:layout=${lay}:fill=black`, "-frames:v", "1", file], log);
}

// `range`: only the graphics on screen in that stretch of the timeline (the render of one part).
// `cached`: keep the result of every graphic that has not changed since it was last measured (the
// editor's QC, which runs often). An export always measures afresh.
export async function runQc(projects: string, slug: string, log?: Log, onStage?: (s: string) => void, at?: number[], range?: Range, cached = false): Promise<QcResult> {
  const dir = join(projects, slug);
  onStage?.("Finding cuts in the footage");
  footageCuts(dir, log);
  // Resolve after the cuts exist, so the plan checks see them.
  const { resolved, issues } = resolveProject(projects, slug);
  if (!resolved) return { issues, sheets: [], overview: null };
  const r = resolved;
  const comp = compositionFor(r.canvas);
  const out = join(dir, "checks/qc");
  // The last run's files stay beside the new ones until every unchanged graphic has taken its own back.
  const prev = join(dir, "checks/qc.prev");
  rmSync(prev, { recursive: true, force: true });
  if (existsSync(out)) renameSync(out, prev);
  mkdirSync(join(out, "frames"), { recursive: true });
  const stamp = codeStamp();
  const old: QcCache = existsSync(join(prev, "cache.json")) ? readJson(join(prev, "cache.json")) : { stamp, items: {} };
  const keptFor = (id: string, hash: string) => {
    const k = old.items[id];
    return old.stamp === stamp && k?.hash === hash && existsSync(join(prev, k.sheet)) ? k : undefined;
  };

  // `at`: only the graphics on screen at these seconds (a quick look at one or two).
  const wanted = (s: ResolvedShot) => (!at || at.some((t) => t >= s.start && t < s.end)) && (!range || (s.start < range.end && s.end > range.start));
  const graphics = r.shots.map((s, i) => ({ s, i })).filter(({ s }) => isGraphic(s)).map((g) => {
    const id = g.s.id ?? String(g.i + 1);
    const hash = qcHash(r, g.i);
    const kept = keptFor(id, hash);
    return { ...g, id, hash, kept, check: wanted(g.s) && !(cached && kept) };
  });
  const todo = graphics.filter((g) => g.check).length;
  // The hook is measured on every run: a few frames, and the graphics under it move with it.
  const hook = !!r.hook && (!at || at.some((t) => t < r.hook!.until)) && (!range || range.start < r.hook.until);
  const cover = !!r.cover && !at && (!range || range.start === 0);
  const hookIssues: Issue[] = [];
  const sheets: string[] = [];
  const settledShots: string[] = [];
  const items: QcItem[] = [];
  const cache: QcCache = { stamp, items: {} };
  // The browser only opens when something has to be measured.
  const srv = todo || hook || cover ? await qcServer(projects) : null;
  const opened = srv ? await qcPage(srv, comp, `slug=${encodeURIComponent(slug)}`, log) : null;
  try {
    let n = 0;
    for (const { s, i, id, hash, kept, check } of graphics) {
      const where = shotLabel(s, i);
      const name = String(i + 1).padStart(3, "0");
      // One strip per graphic: before, first frame, reveals, settled, after.
      const sheet = `${name}-${s.visual!.kind}.jpg`;
      const frame = (k: number) => join(out, "frames", `${name}-${k}.jpg`);
      if (check) {
        onStage?.(`Checking graphic ${++n}/${todo}`);
        const found: Issue[] = [];
        const { files, settled, settledAt } = await checkGraphic(opened!.page, r, s, where, join(out, "frames"), name, found);
        ffmpeg([...files.flatMap((f) => ["-i", f]), "-filter_complex", `${files.map((_, k) => `[${k}]scale=480:-1[v${k}]`).join(";")};${files.map((_, k) => `[v${k}]`).join("")}hstack=inputs=${files.length}`, join(out, sheet)], log);
        cache.items[id] = { hash, name, frames: files.length, settled: settledAt, sheet, issues: found.map((x) => ({ level: x.level, rest: x.message.startsWith(where) ? x.message.slice(where.length) : `: ${x.message}` })) };
        issues.push(...found);
        if (settled) settledShots.push(settled);
        sheets.push(join(out, sheet));
        items.push({ id, hash, index: i, start: s.start, kind: s.visual!.kind, sheet, issues: found, cached: false });
      } else if (kept) {
        // Unchanged since it was measured: its files come across under this run's names, and its
        // issues are named for where the shot is now.
        for (let k = 0; k < kept.frames; k++) if (existsSync(join(prev, "frames", `${kept.name}-${k}.jpg`))) copyFileSync(join(prev, "frames", `${kept.name}-${k}.jpg`), frame(k));
        if (existsSync(join(prev, "frames", `${kept.name}-measure.json`))) copyFileSync(join(prev, "frames", `${kept.name}-measure.json`), join(out, "frames", `${name}-measure.json`));
        copyFileSync(join(prev, kept.sheet), join(out, sheet));
        cache.items[id] = { ...kept, name, sheet };
        const found = kept.issues.map((x) => ({ level: x.level, message: `${where}${x.rest}` }));
        items.push({ id, hash, index: i, start: s.start, kind: s.visual!.kind, sheet, issues: found, cached: true });
        if (!wanted(s)) continue;
        issues.push(...found);
        if (kept.settled >= 0 && existsSync(frame(kept.settled))) settledShots.push(frame(kept.settled));
        sheets.push(join(out, sheet));
      }
    }
    if (cover) {
      onStage?.("Checking the cover");
      const file = join(out, "000-cover.jpg");
      // The cover card is its own image, not a frame of the reel: show it alone, then the reel again.
      const load = (plan: Resolved) => opened!.page.evaluate((p: Resolved) => window.qcLoad!(p), plan as never);
      const reel = { ...r, video: r.video && r.preview?.video ? r.preview.video : r.video, audio: null };
      await load({ ...reel, asCover: true });
      await shoot(opened!.page, r, 0, file);
      const m = (await opened!.page.evaluate(() => window.qcMeasure!())) as Measure;
      hookIssues.push(...qcCover(m, [comp.width, comp.height], BAND));
      await load(reel);
      sheets.unshift(file);
      settledShots.unshift(file);
    }
    if (hook) {
      onStage?.("Checking the hook");
      const files = await checkHook(opened!.page, r, join(out, "frames"), "000-hook", hookIssues);
      if (files.length === 1) ffmpeg(["-i", files[0], "-vf", "scale=480:-1", join(out, "000-hook.jpg")], log);
      else ffmpeg([...files.flatMap((f) => ["-i", f]), "-filter_complex", `${files.map((_, k) => `[${k}]scale=480:-1[v${k}]`).join(";")};${files.map((_, k) => `[v${k}]`).join("")}hstack=inputs=${files.length}`, join(out, "000-hook.jpg")], log);
      sheets.unshift(join(out, "000-hook.jpg"));
      settledShots.unshift(files[0]);
    }
  } finally {
    await opened?.browser.close({ silent: true } as never).catch(() => {});
    srv?.close();
  }
  // A recorded screen has to keep moving: measured on the footage, zooms counted as movement.
  const other: Issue[] = [...hookIssues];
  for (const [i, s] of r.shots.entries()) {
    const v = s.visual;
    if (v?.kind !== "video" || !v.sync || !wanted(s)) continue;
    // A recording the wrong shape for the panel gets its edges cropped.
    if (v.size && s.layout === "split" && Math.abs(v.size[0] / v.size[1] - 1080 / 864) > 0.02) other.push({ level: "warn", message: `${shotLabel(s, i)}: the recording is ${v.size[0]} x ${v.size[1]}, not the panel's shape (1080 x 864), so its edges are cropped` });
    const stats = join(out, `motion-${i + 1}.txt`);
    ffmpeg(["-ss", String(s.start), "-t", String(s.end - s.start), "-i", join(dir, v.src), "-an", "-vf", `fps=30,scale=360:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${stats}`, "-f", "null", "-"], log);
    const diffs = [...readFileSync(stats, "utf8").matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
    rmSync(stats);
    const still = longestStill(diffs, 30, (t) => (v.zooms ?? []).some((z) => s.start + t >= z.t && s.start + t < z.t + z.ms / 1000));
    if (still.secs > STILL_LIMIT) other.push({ level: "error", message: `${shotLabel(s, i)}: the screen holds still for ${still.secs.toFixed(1)}s from ${(s.start + still.at).toFixed(1)}s; something should move at least every ${STILL_LIMIT}s` });
  }
  issues.push(...other);
  // Every graphic settled, on one page: the quick look before an export.
  let overview: string | null = null;
  if (settledShots.length) overviewSheet(settledShots, (overview = join(out, "overview.jpg")), log);
  writeJson(join(out, "cache.json"), cache);
  writeJson(join(out, "report.json"), { at: new Date().toISOString(), issues, sheets, overview, items, other, partial: items.length < graphics.length, stamp } satisfies QcReport);
  rmSync(prev, { recursive: true, force: true });
  return { issues, sheets, overview };
}

// `studio qc --library`: the same checks on every card in the style, from its sample and with every
// text slot at its limit, in each theme a video can use. A card that breaks here breaks in any video
// that uses it, so this runs after a change to a visual or the style (Owain, 2026-11-02: the quote
// card stacked one word a line beside him, and list numbers sat at 1.2:1, both found by eye first).
export const LIBRARY_QC = join(ROOT, "library", "qc");
// YouTube is checked in each of its themes. Every reel is a clean reel, always on ink, so reels are
// checked once.
export const libraryVariants = (canvas?: Canvas) =>
  (["youtube", "reel"] as const)
    .filter((c) => !canvas || c === canvas)
    .flatMap((c): { canvas: Canvas; theme: "light" | "dark" | "black" }[] => (c === "reel" ? [{ canvas: c, theme: "dark" }] : (["light", "dark", "black"] as const).map((theme) => ({ canvas: c, theme }))))
    .flatMap((v) => [false, true].map((longest) => ({ ...v, longest })));

// One library plan with the hook over it: loaded, then checked as a reel's opening is.
async function libraryHook(page: Page, r: Resolved, frames: string, name: string, issues: Issue[], where: string) {
  await page.evaluate((plan: Resolved) => window.qcLoad!(plan), r as never);
  return checkHook(page, r, frames, name.replace(/^blueprint\./, ""), issues, where);
}

export async function runLibraryQc(opts: { canvas?: Canvas; card?: string }, log?: Log, onStage?: (s: string) => void): Promise<QcResult> {
  const issues: Issue[] = [];
  mkdirSync(LIBRARY_QC, { recursive: true });
  for (const f of readdirSync(LIBRARY_QC)) rmSync(join(LIBRARY_QC, f), { recursive: true });
  const srv = await qcServer(join(ROOT, "projects"));
  const sheets: string[] = [];
  try {
    for (const canvas of ["youtube", "reel"] as const) {
      const variants = libraryVariants(opts.canvas).filter((v) => v.canvas === canvas);
      // Every card on YouTube, the lower third included (Owain may still ask for one); on a reel only
      // the clean kit, since a reel cannot use the rest.
      const clean = canvas === "reel";
      const cards = effectList(canvas, readCardLibrary()).filter((e) => e.approved).filter((e) => !(clean && e.off) && (!opts.card || e.id.includes(opts.card) || e.kind === opts.card));
      if (!variants.length || !cards.length) continue;
      const { browser, page } = await qcPage(srv, compositionFor(canvas), "library=1", log);
      try {
        for (const v of variants) {
          const look = clean ? "clean" : v.theme;
          const name = `${canvas}-${look}${v.longest ? "-longest" : ""}`;
          const frames = join(LIBRARY_QC, name);
          mkdirSync(frames, { recursive: true });
          const settled: string[] = [];
          const hooked: string[] = [];
          for (const [n, e] of cards.entries()) {
            onStage?.(`${name}: ${n + 1}/${cards.length} ${e.kind}`);
            const r = cardPlan(e.id, canvas, v.theme, v.longest);
            await page.evaluate((plan: Resolved) => window.qcLoad!(plan), r as never);
            const where = `${e.id} (${canvas}, ${look}${v.longest ? ", longest text" : ""})`;
            const got = await checkGraphic(page, r, r.shots[0], where, frames, e.id.replace(/^blueprint\./, ""), issues);
            if (got.settled) settled.push(got.settled);
            // A clean reel opens with the hook, so every card it could open on is checked under it.
            if (clean) hooked.push(...(await libraryHook(page, hookPlan(v.longest, r), frames, `${e.id}-hook`, issues, `the hook over ${where}`)));
          }
          if (clean) hooked.push(...(await libraryHook(page, hookPlan(v.longest), frames, "full-hook", issues, `the hook over the speaker (${canvas}, ${look}${v.longest ? ", longest text" : ""})`)));
          if (settled.length) overviewSheet(settled, join(LIBRARY_QC, `${name}.jpg`), log), sheets.push(join(LIBRARY_QC, `${name}.jpg`));
          if (hooked.length) overviewSheet(hooked, join(LIBRARY_QC, `${name}-hook.jpg`), log), sheets.push(join(LIBRARY_QC, `${name}-hook.jpg`));
        }
      } finally {
        await browser.close({ silent: true } as never).catch(() => {});
      }
    }
  } finally {
    srv.close();
  }
  writeJson(join(LIBRARY_QC, "report.json"), { at: new Date().toISOString(), issues, sheets });
  return { issues, sheets, overview: null };
}
