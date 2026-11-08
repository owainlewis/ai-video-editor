// `studio qc <slug>`: check every graphic before anything is rendered (Owain, 2026-10-25: "it's
// expensive to fix afterwards"). It opens each graphic's frames in a headless browser (the QC page,
// app/qc.tsx), measures where every piece of text, line and dot really lands, and runs the layout
// checks in engine/qc.ts on its settled frame. It also finds the cuts in the footage (for the plan
// checks) and makes one contact sheet per graphic: the picture before it, its first frame, each
// reveal landing, settled, and the picture after it. Nothing is rendered to video.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { C } from "../effects/clean/kit.tsx";
import { GREEN } from "../effects/clean/text.tsx";
import { createServer as createHttp } from "node:http";
import { join } from "node:path";
import { openBrowser } from "@remotion/renderer";
import { createServer as createVite } from "vite";
import { compositionFor } from "../effects/canvas.ts";
import { type Canvas, cardPlan, effectList } from "../effects/preview.ts";
import { longestStill, type Measure, qcLayout, STILL_LIMIT } from "../engine/qc.ts";
import type { Issue } from "../engine/resolve.ts";
import type { Resolved, ResolvedShot } from "../engine/schema.ts";
import { serveFile } from "../server/index.ts";
import { GRAPHITE, BLACK, tokens } from "../styles/ivory/tokens.ts";
import { resolveProject } from "./project.ts";
import { type Log, readJson, ROOT, run, writeJson } from "./tools.ts";

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
const CLEAN_BG = { ink: C.ink, paper: C.paper, green: GREEN };
const cleanBg = (s: ResolvedShot) => (s.layout === "split" ? C.ink : s.layout === "card" ? CLEAN_BG[s.bg ?? "ink"] : s.layout === "diagram" ? GREEN : undefined);

// The background a graphic's text sits on, for contrast: the canvas for designed frames, nothing on footage.
const bgFor = (r: Resolved, s: ResolvedShot) =>
  r.style === "clean"
    ? cleanBg(s)
    : s.layout === "half"
    ? tokens.color.light.bg
    : s.layout === "side" || s.layout === "media" || s.layout === "scene" || s.layout === "split"
    ? s.tone === "dark"
      ? r.canvas === "youtube"
        ? r.theme === "black"
          ? BLACK.bg
          : GRAPHITE.bg
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
      for (const issue of qcLayout(m, [comp.width, comp.height], `${where} at ${t.toFixed(1)}s`, bgFor(r, s), centred)) {
        const key = issue.message.replace(/ at [\d.]+s:/, ":");
        if (!seen.has(key)) seen.add(key), issues.push(issue);
      }
    }
  }
  // Every graphic must be measured; a silent skip is how a bad layout gets through.
  if (!measured && !crashed) issues.push({ level: "error", message: `${where}: QC could not measure its settled frame` });
  return { files, settled: measured };
}

// Settled frames, on one page.
function overviewSheet(settled: string[], file: string, log?: Log) {
  const cols = 5;
  const lay = settled.map((_, k) => `${(k % cols) * 384}_${Math.floor(k / cols) * 216}`).join("|");
  if (settled.length === 1) run("ffmpeg", ["-v", "error", "-y", "-i", settled[0], "-vf", "scale=384:216", file], { log });
  else run("ffmpeg", ["-v", "error", "-y", ...settled.flatMap((f) => ["-i", f]), "-filter_complex", `${settled.map((_, k) => `[${k}]scale=384:216[v${k}]`).join(";")};${settled.map((_, k) => `[v${k}]`).join("")}xstack=inputs=${settled.length}:layout=${lay}:fill=black`, "-frames:v", "1", file], { log });
}

export async function runQc(projects: string, slug: string, log?: Log, onStage?: (s: string) => void, at?: number[]): Promise<QcResult> {
  const dir = join(projects, slug);
  onStage?.("Finding cuts in the footage");
  footageCuts(dir, log);
  // Resolve after the cuts exist, so the plan checks see them.
  const { resolved, issues } = resolveProject(projects, slug);
  if (!resolved) return { issues, sheets: [], overview: null };
  const r = resolved;
  const comp = compositionFor(r.canvas);
  const out = join(dir, "checks/qc");
  mkdirSync(join(out, "frames"), { recursive: true });
  for (const f of readdirSync(out)) rmSync(join(out, f), { recursive: true });
  mkdirSync(join(out, "frames"), { recursive: true });

  // `at`: only the graphics on screen at these seconds (a quick look at one or two).
  const graphics = r.shots.map((s, i) => ({ s, i })).filter(({ s }) => s.visual && !s.keep && s.layout !== "full" && (!at || at.some((t) => t >= s.start && t < s.end)));
  const srv = await qcServer(projects);
  const { browser, page } = await qcPage(srv, comp, `slug=${encodeURIComponent(slug)}`, log);
  const sheets: string[] = [];
  const settledShots: string[] = [];
  try {
    for (const [n, { s, i }] of graphics.entries()) {
      onStage?.(`Checking graphic ${n + 1}/${graphics.length}`);
      const where = `shot ${i + 1} (${s.start.toFixed(2)}s "${s.anchor}")`;
      const { files, settled } = await checkGraphic(page, r, s, where, join(out, "frames"), String(i + 1).padStart(3, "0"), issues);
      if (settled) settledShots.push(settled);
      // One strip per graphic: before, first frame, reveals, settled, after.
      const sheet = join(out, `${String(i + 1).padStart(3, "0")}-${s.visual!.kind}.jpg`);
      run("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", `${files.map((_, k) => `[${k}]scale=480:-1[v${k}]`).join(";")};${files.map((_, k) => `[v${k}]`).join("")}hstack=inputs=${files.length}`, sheet], { log });
      sheets.push(sheet);
    }
  } finally {
    await browser.close({ silent: true } as never).catch(() => {});
    srv.close();
  }
  // A recorded screen has to keep moving: measured on the footage, zooms counted as movement.
  for (const [i, s] of r.shots.entries()) {
    const v = s.visual;
    if (v?.kind !== "video" || !v.sync || (at && !at.some((t) => t >= s.start && t < s.end))) continue;
    // A recording the wrong shape for the panel gets its edges cropped.
    if (v.size && s.layout === "split" && Math.abs(v.size[0] / v.size[1] - 1080 / 960) > 0.02) issues.push({ level: "warn", message: `shot ${i + 1} (${s.start.toFixed(2)}s "${s.anchor}"): the recording is ${v.size[0]} x ${v.size[1]}, not the panel's shape (1080 x 960), so its edges are cropped` });
    const stats = join(out, `motion-${i + 1}.txt`);
    run("ffmpeg", ["-v", "error", "-y", "-ss", String(s.start), "-t", String(s.end - s.start), "-i", join(dir, v.src), "-an", "-vf", `fps=30,scale=360:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${stats}`, "-f", "null", "-"], { log });
    const diffs = [...readFileSync(stats, "utf8").matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
    rmSync(stats);
    const still = longestStill(diffs, 30, (t) => (v.zooms ?? []).some((z) => s.start + t >= z.t && s.start + t < z.t + z.ms / 1000));
    if (still.secs > STILL_LIMIT) issues.push({ level: "error", message: `shot ${i + 1} (${s.start.toFixed(2)}s "${s.anchor}"): the screen holds still for ${still.secs.toFixed(1)}s from ${(s.start + still.at).toFixed(1)}s; something should move at least every ${STILL_LIMIT}s` });
  }
  // Every graphic settled, on one page: the quick look before an export.
  let overview: string | null = null;
  if (settledShots.length) overviewSheet(settledShots, (overview = join(out, "overview.jpg")), log);
  writeJson(join(out, "report.json"), { at: new Date().toISOString(), issues, sheets, overview });
  return { issues, sheets, overview };
}

// `studio qc --library`: the same checks on every card in the style, from its sample and with every
// text slot at its limit, in each theme a video can use. A card that breaks here breaks in any video
// that uses it, so this runs after a change to a visual or the style (Owain, 2026-11-02: the quote
// card stacked one word a line beside him, and list numbers sat at 1.2:1, both found by eye first).
export const LIBRARY_QC = join(ROOT, "library", "qc");
// Clean reels are always on ink, so they are checked once, beside the Ivory reel themes.
export const libraryVariants = (canvas?: Canvas) =>
  (["youtube", "reel"] as const)
    .filter((c) => !canvas || c === canvas)
    .flatMap((c) => [
      ...(["light", "dark", "black"] as const).map((theme) => ({ canvas: c, theme, style: "ivory" })),
      ...(c === "reel" ? [{ canvas: c, theme: "dark" as const, style: "clean" }] : []),
    ])
    .flatMap((v) => [false, true].map((longest) => ({ ...v, longest })));

export async function runLibraryQc(opts: { canvas?: Canvas; card?: string }, log?: Log, onStage?: (s: string) => void): Promise<QcResult> {
  const issues: Issue[] = [];
  mkdirSync(LIBRARY_QC, { recursive: true });
  for (const f of readdirSync(LIBRARY_QC)) rmSync(join(LIBRARY_QC, f), { recursive: true });
  const srv = await qcServer(join(ROOT, "projects"));
  const sheets: string[] = [];
  try {
    for (const canvas of ["youtube", "reel"] as const) {
      const variants = libraryVariants(opts.canvas).filter((v) => v.canvas === canvas);
      // Every card, the lower third included (Owain may still ask for one); in the clean style only
      // its kit, since the rest are checked in Ivory, the look they draw in.
      const cardsIn = (style: string) => effectList(canvas, style).filter((e) => !(style === "clean" && e.off) && (!opts.card || e.id.includes(opts.card) || e.kind === opts.card));
      if (!variants.length || !variants.some((v) => cardsIn(v.style).length)) continue;
      const { browser, page } = await qcPage(srv, compositionFor(canvas), "library=1", log);
      try {
        for (const v of variants) {
          const cards = cardsIn(v.style);
          if (!cards.length) continue;
          const look = v.style === "clean" ? "clean" : v.theme;
          const name = `${canvas}-${look}${v.longest ? "-longest" : ""}`;
          const frames = join(LIBRARY_QC, name);
          mkdirSync(frames, { recursive: true });
          const settled: string[] = [];
          for (const [n, e] of cards.entries()) {
            onStage?.(`${name}: ${n + 1}/${cards.length} ${e.kind}`);
            const r = cardPlan(e.id, canvas, v.theme, v.longest, v.style);
            await page.evaluate((plan: Resolved) => window.qcLoad!(plan), r as never);
            const where = `${e.id} (${canvas}, ${look}${v.longest ? ", longest text" : ""})`;
            const got = await checkGraphic(page, r, r.shots[0], where, frames, e.id.replace(/^blueprint\./, ""), issues);
            if (got.settled) settled.push(got.settled);
          }
          if (settled.length) overviewSheet(settled, join(LIBRARY_QC, `${name}.jpg`), log), sheets.push(join(LIBRARY_QC, `${name}.jpg`));
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
