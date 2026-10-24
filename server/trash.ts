// Deleting a project moves it, and the upload it came from, into projects/.trash/. Nothing is
// erased, so a wrong click can be undone by moving the folder back.
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { liveStatus } from "../media/ingest.ts";

export function trashProject(projects: string, slug: string, busy: boolean): string {
  const dir = join(projects, slug);
  if (!/^[\w.-]+$/.test(slug) || slug.startsWith(".") || !existsSync(dir)) throw Object.assign(new Error(`no project ${slug}`), { code: 404 });
  const status = liveStatus(dir);
  if (busy) throw Object.assign(new Error("Claude is still working on this project; stop it first"), { code: 409 });
  if (status && !status.done) throw Object.assign(new Error(`${status.stage} is still running; wait for it to finish`), { code: 409 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "");
  const dest = join(projects, ".trash", `${slug}-${stamp}`);
  mkdirSync(join(projects, ".trash"), { recursive: true });
  renameSync(dir, dest);
  const uploads = join(projects, ".uploads");
  if (existsSync(uploads))
    for (const f of readdirSync(uploads)) if (f.replace(/\.[^.]+$/, "") === slug) renameSync(join(uploads, f), join(dest, `upload-${f}`));
  return dest;
}
