// A project's assets: b-roll clips and images Owain adds, plus captures and logos Claude fetches.
// They live in projects/<slug>/assets/, where a plan refers to them by path (e.g. "assets/broll/
// desk.mp4"). Thumbnails and lengths are cached in assets/.thumbs/.
import { createWriteStream, existsSync, mkdirSync, readdirSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { basename, extname, join } from "node:path";
import { ffmpeg, probeDuration, readJson, writeJson } from "../media/tools.ts";

export type Asset = { path: string; name: string; kind: "video" | "image"; thumb: string; duration?: number };

const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const IMAGE = /\.(png|jpe?g|webp|svg|gif)$/i;
const FOLDERS = ["broll", "images", "captures", "logos"];

export function listAssets(dir: string, slug: string): Asset[] {
  const thumbs = join(dir, "assets/.thumbs");
  const metaFile = join(thumbs, "meta.json");
  const meta: Record<string, number> = existsSync(metaFile) ? readJson(metaFile) : {};
  let changed = false;
  const out: Asset[] = [];
  for (const folder of FOLDERS) {
    const d = join(dir, "assets", folder);
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d).sort()) {
      const rel = `assets/${folder}/${name}`;
      if (VIDEO.test(name)) {
        const thumb = join(thumbs, `${folder}-${basename(name, extname(name))}.jpg`);
        if (!existsSync(thumb)) {
          mkdirSync(thumbs, { recursive: true });
          ffmpeg(["-ss", "0.5", "-i", join(d, name), "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "4", thumb]);
        }
        if (meta[rel] === undefined) (meta[rel] = probeDuration(join(d, name))), (changed = true);
        out.push({ path: rel, name, kind: "video", thumb: `${slug}/assets/.thumbs/${basename(thumb)}`, duration: meta[rel] });
      } else if (IMAGE.test(name)) out.push({ path: rel, name, kind: "image", thumb: `${slug}/${rel}` });
    }
  }
  if (changed) writeJson(metaFile, meta);
  return out;
}

// An upload from the editor: clips go to assets/broll/, images to assets/images/.
export async function saveAsset(dir: string, name: string, req: IncomingMessage): Promise<string> {
  const clean = basename(name).replace(/[^\w.-]+/g, "-");
  const folder = VIDEO.test(clean) ? "broll" : IMAGE.test(clean) ? "images" : "";
  if (!folder) throw Object.assign(new Error("only video clips and images can be added"), { code: 400 });
  mkdirSync(join(dir, "assets", folder), { recursive: true });
  let file = join(dir, "assets", folder, clean);
  for (let i = 2; existsSync(file); i++) file = join(dir, "assets", folder, `${basename(clean, extname(clean))}-${i}${extname(clean)}`);
  await new Promise<void>((ok, fail) => req.pipe(createWriteStream(file)).on("finish", ok).on("error", fail));
  return `assets/${folder}/${basename(file)}`;
}
