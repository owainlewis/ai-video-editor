// A project's assets: b-roll clips and images Owain adds, plus captures and logos Claude fetches.
// They live in projects/<slug>/assets/, where a plan refers to them by path (e.g. "assets/broll/
// desk.mp4"). Thumbnails and lengths are cached in assets/.thumbs/.
import { createWriteStream, existsSync, mkdirSync, readdirSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { basename, extname, join } from "node:path";
import { ffmpeg, probeDuration, readJson, safePath, writeJson } from "../media/tools.ts";

export type Asset = { path: string; name: string; kind: "video" | "image"; thumb: string; duration?: number };

const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const IMAGE = /\.(png|jpe?g|webp|svg|gif)$/i;
const FOLDERS = ["broll", "images", "captures", "logos"];

export function listAssets(dir: string, slug: string): Asset[] {
  const thumbs = join(dir, "assets/.thumbs");
  const metaFile = join(thumbs, "meta.json");
  let meta: Record<string, number> = {};
  if (existsSync(metaFile)) {
    try {
      const parsed = readJson<unknown>(metaFile);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed as Record<string, number>;
    } catch {
      // Corrupt cache: re-probe clips below.
    }
  }
  let changed = false;
  const out: Asset[] = [];
  for (const folder of FOLDERS) {
    const d = join(dir, "assets", folder);
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d).sort()) {
      const rel = `assets/${folder}/${name}`;
      if (VIDEO.test(name)) {
        const full = join(d, name);
        let duration = meta[rel];
        if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
          try {
            duration = probeDuration(full);
          } catch {
            continue;
          }
          if (!Number.isFinite(duration) || duration <= 0) continue;
          meta[rel] = duration;
          changed = true;
        }
        const thumb = join(thumbs, `${folder}-${basename(name, extname(name))}.jpg`);
        if (!existsSync(thumb)) {
          mkdirSync(thumbs, { recursive: true });
          const ss = String(Math.min(0.5, duration / 2));
          try {
            ffmpeg(["-ss", ss, "-i", full, "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "4", thumb]);
          } catch {
            continue;
          }
          if (!existsSync(thumb)) continue;
        }
        out.push({ path: rel, name, kind: "video", thumb: `${slug}/assets/.thumbs/${basename(thumb)}`, duration });
      } else if (IMAGE.test(name)) out.push({ path: rel, name, kind: "image", thumb: `${slug}/${rel}` });
    }
  }
  if (changed) writeJson(metaFile, meta);
  return out;
}

// An upload from the editor: clips go to assets/broll/, images to assets/images/.
export async function saveAsset(dir: string, name: string, req: IncomingMessage): Promise<string> {
  const clean = basename(name.replace(/\\/g, "/")).replace(/[^\w.-]+/g, "-").replace(/^\.+/, "");
  const folder = VIDEO.test(clean) ? "broll" : IMAGE.test(clean) ? "images" : "";
  const stem = basename(clean, extname(clean));
  if (!folder || !stem) throw Object.assign(new Error("only video clips and images can be added"), { code: 400 });
  const targetDir = join(dir, "assets", folder);
  mkdirSync(targetDir, { recursive: true });
  let file = safePath(targetDir, clean);
  if (!file) throw Object.assign(new Error("invalid asset filename"), { code: 400 });
  for (let i = 2; existsSync(file); i++) file = join(targetDir, `${stem}-${i}${extname(clean)}`);
  await new Promise<void>((ok, fail) => {
    const out = createWriteStream(file);
    req.on("error", fail);
    out.on("finish", ok).on("error", fail);
    req.pipe(out);
  });
  return `assets/${folder}/${basename(file)}`;
}
