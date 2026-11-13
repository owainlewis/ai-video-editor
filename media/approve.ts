// Approving a finished reel: its final export and its cover are copied to the approved folder
// (~/Reels/Approved), where Owain picks them up for his content system (2026-11-13). The rules on
// when a reel can be approved are in engine/approve.ts; this file reads the project and moves files.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { type ApprovalFacts, type ApprovalRecord, type ApprovalState, approvalState, day, exportReady, fileTitle, thisWeek, WEEKLY_TARGET } from "../engine/approve.ts";
import type { Issue } from "../engine/resolve.ts";
import { coverStill } from "./render.ts";
import { envValue, ffmpeg, type Log, readJson, writeJson } from "./tools.ts";

// A cover image Owain made himself and dropped into the project, if there is one.
export const handCover = (dir: string): string | undefined =>
  ["cover.png", "cover.jpg", "cover.jpeg", "cover.webp"].map((f) => join(dir, f)).find((f) => existsSync(f));

export { WEEKLY_TARGET, thisWeek, fileTitle };
export type { ApprovalRecord, ApprovalState };

const home = (p: string) => (p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

// Where approved reels go: STUDIO_APPROVED (environment or .env), else ~/Reels/Approved.
export const approvedFolder = () => home(envValue("STUDIO_APPROVED") ?? "~/Reels/Approved");
// Where unapproved files go: the macOS Trash. STUDIO_TRASH points it elsewhere, for tests.
export const trashFolder = () => home(envValue("STUDIO_TRASH") ?? "~/.Trash");

export type Options = {
  folder?: string;
  trash?: string;
  now?: Date;
  log?: Log;
  // Draws the cover into `file`. Remotion's still of frame 0 by default; tests pass their own.
  cover?: (projects: string, slug: string, file: string) => Promise<void>;
};

const fail = (message: string, code = 409) => Object.assign(new Error(message), { code });
const mtime = (file: string) => (existsSync(file) ? statSync(file).mtimeMs : undefined);

export const recordFile = (dir: string) => join(dir, "approved.json");
export const loadRecord = (dir: string): ApprovalRecord | null => (existsSync(recordFile(dir)) ? readJson<ApprovalRecord>(recordFile(dir)) : null);

// Whether an export holds build/export.lock now (cli.ts render).
function exporting(dir: string): boolean {
  const lock = join(dir, "build/export.lock");
  if (!existsSync(lock)) return false;
  try {
    process.kill(parseInt(readFileSync(lock, "utf8"), 10), 0);
    return true;
  } catch {
    return false;
  }
}

// The file times and the last export check, as the rules read them.
export function approvalFacts(dir: string): ApprovalFacts {
  const checkFile = join(dir, "checks/export-check.json");
  let check: ApprovalFacts["check"];
  if (existsSync(checkFile)) {
    let issues: Issue[] = [];
    try {
      issues = readJson<{ issues?: Issue[] }>(checkFile).issues ?? [];
    } catch {
      issues = [{ level: "error", message: "the export check cannot be read" }];
    }
    check = { at: statSync(checkFile).mtimeMs, errors: issues.filter((i) => i.level === "error").length };
  }
  return {
    video: mtime(join(dir, "renders/final.mp4")),
    plan: Math.max(mtime(join(dir, "edit.json")) ?? 0, mtime(join(dir, "cut.json")) ?? 0),
    check,
    exporting: exporting(dir),
    record: loadRecord(dir),
  };
}

// A reel's approval as the editor and the CLI show it.
export function approval(dir: string) {
  const record = loadRecord(dir);
  return { ...approvalState(approvalFacts(dir)), record };
}

const isReel = (dir: string) => readJson<{ canvas?: string }>(join(dir, "edit.json")).canvas !== "youtube";

// Copy a reel's current final export and its cover into the approved folder, as
// "<YYYY-MM-DD> <title>.mp4" and "<same> cover.jpg". A name that is taken by another reel's files
// gets " (2)", " (3)" and so on; this reel's own earlier files are replaced (moved to the Trash
// once the new ones are in place, so a failure never leaves it with neither).
export async function approve(projects: string, slug: string, opts: Options = {}): Promise<ApprovalRecord> {
  const dir = join(projects, slug);
  if (!existsSync(join(dir, "edit.json"))) throw fail(`no project ${slug}`, 404);
  if (!isReel(dir)) throw fail("only reels are approved; a YouTube video is uploaded from its export");
  const facts = approvalFacts(dir);
  const ready = exportReady(facts);
  if (!ready.ok) throw fail(`cannot approve ${slug}: ${ready.reason}`);

  const now = opts.now ?? new Date();
  const folder = opts.folder ?? approvedFolder();
  mkdirSync(folder, { recursive: true });
  const title = readJson<{ title?: string }>(join(dir, "edit.json")).title ?? slug;
  const prev = facts.record;
  const own = new Set([prev?.video, prev?.cover].filter(Boolean));
  const stem = `${day(now)} ${fileTitle(title, slug)}`;
  let base = stem;
  const free = (b: string) => [`${b}.mp4`, `${b} cover.jpg`].every((f) => !existsSync(join(folder, f)) || own.has(join(folder, f)));
  for (let n = 2; !free(base); n++) base = `${stem} (${n})`;
  const video = join(folder, `${base}.mp4`);
  const cover = join(folder, `${base} cover.jpg`);

  // The cover is made in the project first, then each file is copied in under a hidden name and
  // renamed, so the folder never shows half a file. A cover Owain made (Higgsfield, 2026-11-13: "Use
  // Higgsfield") and dropped in as projects/<slug>/cover.png or .jpg wins; else frame 0 is drawn.
  const drawn = join(dir, "build/cover.jpg");
  mkdirSync(join(dir, "build"), { recursive: true });
  rmSync(drawn, { force: true });
  const made = handCover(dir);
  if (made) {
    opts.log?.(`Using the cover ${basename(made)}`);
    ffmpeg(["-i", made, "-q:v", "2", drawn], opts.log);
  } else {
    opts.log?.("Drawing the cover (frame 0)");
    await (opts.cover ?? ((p, s, f) => coverStill(p, s, f, opts.log)))(projects, slug, drawn);
  }
  if (!existsSync(drawn)) throw fail("the cover was not drawn", 500);
  // The export must still be the one that was checked: a render may have started meanwhile.
  if (mtime(join(dir, "renders/final.mp4")) !== facts.video) throw fail("the export changed while approving; try again");
  const place = (from: string, to: string) => {
    const part = join(folder, `.${basename(to)}.partial`);
    copyFileSync(from, part);
    renameSync(part, to);
  };
  place(join(dir, "renders/final.mp4"), video);
  place(drawn, cover);
  if (prev) for (const f of [prev.video, prev.cover]) if (f !== video && f !== cover && existsSync(f)) moveToTrash(f, opts.trash);

  const record: ApprovalRecord = { at: now.toISOString(), video, cover, title };
  writeJson(recordFile(dir), record);
  return record;
}

// Take a reel out of the approved folder: its files go to the Trash and the record goes.
export function unapprove(projects: string, slug: string, opts: Pick<Options, "trash"> = {}): ApprovalRecord {
  const dir = join(projects, slug);
  const record = loadRecord(dir);
  if (!record) throw fail(`${slug} is not approved`, 404);
  for (const f of [record.video, record.cover]) if (existsSync(f)) moveToTrash(f, opts.trash);
  rmSync(recordFile(dir));
  return record;
}

// Move a file to the Trash. A name already there gets the time added, as Finder does.
export function moveToTrash(file: string, trash = trashFolder()): string {
  mkdirSync(trash, { recursive: true });
  const ext = extname(file);
  const name = basename(file, ext);
  let dest = join(trash, basename(file));
  if (existsSync(dest)) {
    const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, ".");
    dest = join(trash, `${name} ${stamp}${ext}`);
    for (let n = 2; existsSync(dest); n++) dest = join(trash, `${name} ${stamp} ${n}${ext}`);
  }
  try {
    renameSync(file, dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    copyFileSync(file, dest);
    unlinkSync(file);
  }
  return dest;
}

// Every approved reel, newest first, with its state now.
export function listApproved(projects: string) {
  if (!existsSync(projects)) return [];
  return readdirNames(projects)
    .flatMap((slug) => {
      const dir = join(projects, slug);
      const record = loadRecord(dir);
      return record ? [{ slug, record, state: approvalState(approvalFacts(dir)).state }] : [];
    })
    .sort((a, b) => Date.parse(b.record.at) - Date.parse(a.record.at));
}

// How many reels were approved this week (Monday to Sunday), against the target.
export const weekCount = (projects: string, now: Date | number = Date.now()) => ({
  count: thisWeek(listApproved(projects).map((x) => x.record.at), now),
  target: WEEKLY_TARGET,
});

const readdirNames = (projects: string) =>
  readdirSync(projects, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);
