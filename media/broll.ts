// The b-roll library, shared by every project: library/broll/. Owain drops clips in (from the
// editor or by hand); `index` splits each into its shots in library/broll/.clips/ with an entry in
// library/broll/index.json, and `describe` has Claude write each shot's description and tags from
// its frames. Plans use a shot as "broll:<id>"; it is copied into the project when the plan is
// resolved. Ported from ai-reel-editor's tools/broll.ts.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { ffmpeg, type Log, readJson, ROOT, run, writeJson } from "./tools.ts";

export type Clip = {
  id: string;
  source: string;
  start: number;
  end: number;
  duration: number;
  crop: string;
  brightness: number;
  description: string;
  tags: string[];
};

export const BROLL = join(ROOT, "library", "broll");
const CLIPS = join(BROLL, ".clips");
const INDEX = join(BROLL, "index.json");
const VIDEO = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm"]);

const ff = (args: string[]) => spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
const probe = (file: string) => {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file], { encoding: "utf8" }));
  return { w: j.streams[0].width as number, h: j.streams[0].height as number, duration: parseFloat(j.format.duration) };
};

// The picture area inside any letterbox or pillarbox. Small dark edges inside the picture are kept.
const detectCrop = (file: string, w: number, h: number) => {
  const r = ff(["-i", file, "-t", "6", "-vf", "cropdetect=limit=24:round=2:reset=0", "-an", "-f", "null", "-"]);
  const all = [...r.stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].map((m) => m.slice(1).map(Number));
  if (!all.length) return { cw: w, ch: h, cx: 0, cy: 0 };
  const [cw, ch, cx, cy] = all[all.length - 1];
  return cw > w * 0.85 ? { cw: w, ch, cx: 0, cy } : { cw, ch, cx, cy };
};

// Shot boundaries from frame differences; cuts closer than `minGap` are dropped.
const detectCuts = (file: string, duration: number, minGap = 0.8) => {
  const r = ff(["-i", file, "-vf", "scale=320:-2,select='gt(scene,0.03)',showinfo", "-an", "-f", "null", "-"]);
  const times = [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const cuts: number[] = [];
  for (const t of times) if (t - (cuts[cuts.length - 1] ?? 0) >= minGap && duration - t >= minGap) cuts.push(t);
  return [0, ...cuts, duration];
};

const brightnessOf = (file: string) => {
  const r = ff(["-i", file, "-vf", "fps=2,scale=160:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-an", "-f", "null", "-"]);
  const v = [...r.stderr.matchAll(/YAVG=([\d.]+)/g)].map((m) => parseFloat(m[1]));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
};

export const loadLibrary = (): Clip[] => (existsSync(INDEX) ? readJson<Clip[]>(INDEX) : []);

export function indexLibrary(log: Log = () => {}): Clip[] {
  mkdirSync(CLIPS, { recursive: true });
  let index = loadLibrary();
  const known = new Set(index.map((c) => c.source));
  for (const f of readdirSync(BROLL).filter((f) => VIDEO.has(extname(f).toLowerCase()))) {
    const file = join(BROLL, f);
    const stamp = `${f}@${statSync(file).mtimeMs | 0}`;
    if (known.has(stamp)) continue;
    // A changed or re-copied file replaces its old shots.
    index = index.filter((c) => !c.source.startsWith(`${f}@`));
    const { w, h, duration } = probe(file);
    const { cw, ch, cx, cy } = detectCrop(file, w, h);
    const bounds = detectCuts(file, duration);
    log(`${f}: ${bounds.length - 1} shots`);
    const base = basename(f, extname(f)).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    for (let i = 0; i < bounds.length - 1; i++) {
      // Stay a few frames inside each boundary to skip dissolves and flash frames.
      const start = +(bounds[i] + (i ? 0.12 : 0)).toFixed(3);
      const end = +(bounds[i + 1] - 0.12).toFixed(3);
      const id = `${base}-${i + 1}`;
      const out = join(CLIPS, `${id}.mp4`);
      // Landscape keeps its shape at 1920 wide; portrait at 1080x1920.
      const scale = cw >= ch ? "scale=1920:-2" : "scale=1080:-2";
      ffmpeg(["-ss", String(start), "-to", String(end), "-i", file, "-vf", `crop=${cw}:${ch}:${cx}:${cy},${scale},fps=30,setsar=1`, "-an", "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p", out]);
      // Three frames (start, middle, end) for describing it; one for the editor's thumbnail.
      const n = Math.floor((end - start) * 30);
      ffmpeg(["-i", out, "-vf", `select='eq(n\\,0)+eq(n\\,${Math.floor(n / 2)})+eq(n\\,${Math.max(0, n - 2)})',scale=360:-2,tile=3x1:padding=4`, "-frames:v", "1", "-fps_mode", "vfr", join(CLIPS, `${id}.jpg`)]);
      index.push({ id, source: stamp, start, end, duration: +(end - start).toFixed(3), crop: `crop=${cw}:${ch}:${cx}:${cy}`, brightness: brightnessOf(out), description: "", tags: [] });
    }
  }
  for (const c of index) {
    const thumb = join(CLIPS, `${c.id}-thumb.jpg`);
    if (!existsSync(thumb) && existsSync(join(CLIPS, `${c.id}.mp4`))) ffmpeg(["-ss", String(Math.min(0.5, c.duration / 2)), "-i", join(CLIPS, `${c.id}.mp4`), "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "4", thumb]);
  }
  index.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  writeJson(INDEX, index);
  return index;
}

// Claude looks at each new shot's frames and writes what is visible, not what it means.
export function describeLibrary(log?: Log) {
  const blank = loadLibrary().filter((c) => !c.description);
  if (!blank.length) return 0;
  const prompt = `Describe these b-roll shots in library/broll/index.json: ${blank.map((c) => c.id).join(", ")}.
For each, look at library/broll/.clips/<id>.jpg (start, middle and end frames) and set "description" to one plain sentence of what is visible (no interpretation), and "tags" to 4 to 8 lowercase words. Change nothing else in the file.`;
  run("claude", ["-p", prompt, "--permission-mode", "acceptEdits", "--allowedTools", "Read", "Edit"], { log });
  return blank.length;
}

export function searchLibrary(query: string): Clip[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const score = (c: Clip) => words.filter((w) => `${c.id} ${c.description} ${c.tags.join(" ")}`.toLowerCase().includes(w)).length;
  return loadLibrary().map((c) => ({ c, s: score(c) })).filter((r) => !words.length || r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.c);
}

// Copy a library shot into a project so the renderer can serve it.
export function useClip(projectDir: string, id: string): string | null {
  const src = join(CLIPS, `${id}.mp4`);
  if (!existsSync(src)) return null;
  const rel = `assets/broll/${id}.mp4`;
  const dest = join(projectDir, rel);
  mkdirSync(join(projectDir, "assets/broll"), { recursive: true });
  if (!existsSync(dest) || statSync(dest).mtimeMs < statSync(src).mtimeMs) copyFileSync(src, dest);
  return rel;
}
