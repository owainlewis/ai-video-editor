// `studio qc <slug>`: check every graphic before anything is rendered (Owain, 2026-10-25: "it's
// expensive to fix afterwards"). It opens each graphic's frames in a headless browser (the QC page,
// app/qc.tsx), measures where every piece of text, line and dot really lands, and runs the layout
// checks in engine/qc.ts on its settled frame. It also finds the cuts in the footage (for the plan
// checks) and makes one contact sheet per graphic: the picture before it, its first frame, each
// reveal landing, settled, and the picture after it. Nothing is rendered to video.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer as createHttp } from "node:http";
import { join } from "node:path";
import { openBrowser } from "@remotion/renderer";
import { createServer as createVite } from "vite";
import { compositionFor } from "../effects/canvas.ts";
import { type Measure, qcLayout } from "../engine/qc.ts";
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
  const settled = +Math.max(s.start + 0.05, s.end - 0.15).toFixed(3);
  const all = [s.start - 0.1, s.start + 0.04, ...reveals, settled, s.end + 0.1].filter((t) => t >= 0 && t < duration);
  // Layout is checked on every frame where something has just landed, not only the last one: a
  // graphic that changes (an odometer becoming "12x") hides its earlier states from a last-frame check.
  const checks = new Set([...reveals, settled].map((t) => +t.toFixed(3)));
  return { all: [...new Set(all.map((t) => +t.toFixed(3)))].sort((a, b) => a - b), settled, checks };
};

// The background a graphic's text sits on, for contrast: the canvas for designed frames, nothing on footage.
const bgFor = (r: Resolved, s: ResolvedShot) =>
  s.layout === "half"
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
  const browser = await openBrowser("chrome", { forceDeviceScaleFactor: 1, logLevel: "error" });
  const sheets: string[] = [];
  const settledShots: string[] = [];
  try {
    const page = await browser.newPage({ context: () => null, logLevel: "error", indent: false, pageIndex: 0, onBrowserLog: (l: { type: string; text: string }) => l.type === "error" && !/vite|websocket/i.test(l.text) && log?.(`page: ${l.text}`), onLog: () => {} } as never);
    await page.setViewport({ width: comp.width, height: comp.height, deviceScaleFactor: 1 });
    await page.goto({ url: `${srv.url}/qc.html?slug=${encodeURIComponent(slug)}`, timeout: 120000 } as never);
    for (let k = 0; k < 600 && !(await page.evaluate(() => window.qcReady)); k++) await new Promise((ok) => setTimeout(ok, 100));
    const shoot = async (t: number, file: string) => {
      await page.evaluate((f: number) => window.qcSeek!(f), Math.round(t * r.fps));
      const shot = (await (page as unknown as { _client(): { send(m: string, p: object): Promise<{ value?: { data: string }; data?: string }> } })._client().send("Page.captureScreenshot", { format: "jpeg", quality: 82 })) as { value?: { data: string }; data?: string };
      writeFileSync(file, Buffer.from((shot.value ?? shot).data!, "base64"));
    };
    for (const [n, { s, i }] of graphics.entries()) {
      onStage?.(`Checking graphic ${n + 1}/${graphics.length}`);
      const { all, settled, checks } = framesFor(s, r.duration);
      const seen = new Set<string>();
      const where = `shot ${i + 1} (${s.start.toFixed(2)}s "${s.anchor}")`;
      const files: string[] = [];
      let measured = false;
      let crashed = false;
      for (const [k, t] of all.entries()) {
        const file = join(out, "frames", `${String(i + 1).padStart(3, "0")}-${k}.jpg`);
        await shoot(t, file);
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
          if (t === settled) (measured = true), settledShots.push(file);
          const m = (await page.evaluate(() => window.qcMeasure!())) as Measure;
          if (t === settled) writeJson(join(out, "frames", `${String(i + 1).padStart(3, "0")}-measure.json`), m);
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
      // One strip per graphic: before, first frame, reveals, settled, after.
      const sheet = join(out, `${String(i + 1).padStart(3, "0")}-${s.visual!.kind}.jpg`);
      run("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", `${files.map((_, k) => `[${k}]scale=480:-1[v${k}]`).join(";")};${files.map((_, k) => `[v${k}]`).join("")}hstack=inputs=${files.length}`, sheet], { log });
      sheets.push(sheet);
    }
  } finally {
    await browser.close({ silent: true } as never).catch(() => {});
    srv.close();
  }
  // Every graphic settled, on one page: the quick look before an export.
  let overview: string | null = null;
  if (settledShots.length) {
    overview = join(out, "overview.jpg");
    const cols = 5;
    const lay = settledShots.map((_, k) => `${(k % cols) * 384}_${Math.floor(k / cols) * 216}`).join("|");
    if (settledShots.length === 1) run("ffmpeg", ["-v", "error", "-y", "-i", settledShots[0], "-vf", "scale=384:216", overview], { log });
    else run("ffmpeg", ["-v", "error", "-y", ...settledShots.flatMap((f) => ["-i", f]), "-filter_complex", `${settledShots.map((_, k) => `[${k}]scale=384:216[v${k}]`).join(";")};${settledShots.map((_, k) => `[v${k}]`).join("")}xstack=inputs=${settledShots.length}:layout=${lay}:fill=black`, "-frames:v", "1", overview], { log });
  }
  writeJson(join(out, "report.json"), { at: new Date().toISOString(), issues, sheets, overview });
  return { issues, sheets, overview };
}
