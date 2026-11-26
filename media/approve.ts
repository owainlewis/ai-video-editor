// Approving a finished reel: its final export and its cover are copied, together in one folder per
// reel, to the approved folder (STUDIO_APPROVED; on Owain's Mac, My Drive/Content/Reels/Approved in Google Drive), where Owain picks them up for his content system (2026-11-13). The rules on
// when a reel can be approved are in engine/approve.ts; this file reads the project and moves files.
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { type ApprovalFacts, type ApprovalRecord, type ApprovalState, approvalState, day, exportReady, fileTitle, thisWeek, WEEKLY_TARGET } from "../engine/approve.ts";
import type { Issue } from "../engine/resolve.ts";
import { uploadCover } from "./coverkit.ts";
import { isExportLocked } from "./lock.ts";
import { NO_CTA } from "./nocta.ts";
import { handCover } from "./project.ts";
import { coverStill } from "./render.ts";
import { envValue, expandHome, type Log, readJson, writeJson } from "./tools.ts";

export { handCover };

export { WEEKLY_TARGET, thisWeek, fileTitle };
export type { ApprovalRecord, ApprovalState };

const home = expandHome;

// Where approved reels go: STUDIO_APPROVED (environment or .env), else ~/Reels/Approved.
export const approvedFolder = () => home(envValue("STUDIO_APPROVED") ?? "~/Reels/Approved");
// The approved folder as the editor and the CLI show it: Google Drive's synced folder as
// "Google Drive/...", the home folder as "~".
export const folderLabel = (folder = approvedFolder()) => {
  const drive = folder.replace(/^.*\/Library\/CloudStorage\/GoogleDrive-[^/]+\/My Drive(?=\/|$)/, "Google Drive");
  if (drive !== folder) return drive;
  const h = homedir().replace(/\/+$/, "");
  if (h && (folder === h || folder.startsWith(`${h}/`))) return `~${folder.slice(h.length)}`;
  return folder;
};
// Where unapproved files go: the macOS Trash. STUDIO_TRASH points it elsewhere, for tests.
export const trashFolder = () => home(envValue("STUDIO_TRASH") ?? "~/.Trash");

export type Options = {
  folder?: string;
  trash?: string;
  now?: Date;
  log?: Log;
  // Draws the plain cover card into `file` when the reel has no cover.png; tests pass their own.
  cover?: (projects: string, slug: string, file: string) => Promise<void>;
  // Approve with the plain card when there is no cover.png. Off by default: a reel went out with its
  // first frame as the cover (Owain, 2026-11-23: "didn't have a correct cover").
  plainCover?: boolean;
};

const fail = (message: string, code = 409) => Object.assign(new Error(message), { code });
const mtime = (file: string) => (existsSync(file) ? statSync(file).mtimeMs : undefined);

export const recordFile = (dir: string) => join(dir, "approved.json");
export const loadRecord = (dir: string): ApprovalRecord | null => (existsSync(recordFile(dir)) ? readJson<ApprovalRecord>(recordFile(dir)) : null);

// Whether an export holds build/export.lock now (cli.ts render).
const exporting = (dir: string): boolean => isExportLocked(dir);

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
    cta: !!readJson<{ cta?: string }>(join(dir, "edit.json")).cta,
    noCta: mtime(join(dir, NO_CTA)),
    plan: Math.max(mtime(join(dir, "edit.json")) ?? 0, mtime(join(dir, "cut.json")) ?? 0),
    check,
    exporting: exporting(dir),
    record: loadRecord(dir),
  };
}

// A reel's approval as the editor and the CLI show it.
export function approval(dir: string) {
  const record = loadRecord(dir);
  // Where this reel's files are, which is not the approved folder when that has moved since.
  const where = record ? folderLabel(record.folder ?? dirname(record.video)) : null;
  return { ...approvalState(approvalFacts(dir)), record, where };
}

const isReel = (dir: string) => readJson<{ canvas?: string }>(join(dir, "edit.json")).canvas !== "youtube";

// Copy a reel's current final export and its cover into its own folder in the approved folder:
// "<YYYY-MM-DD> <title>/reel.mp4" (for Instagram), "reel-no-cta.mp4" (without the call to action,
// for TikTok and LinkedIn, when the plan names one), "image.jpg" and, when the project has one, "caption.txt"
// (Owain, 2026-11-13: "reel-name/ caption.txt, reel.mp4, image.jpg"). A folder name taken by anything else gets " (2)", " (3)" and so on; this reel's own
// earlier folder is reused, or moved to the Trash once the new one is in place, so a failure never
// leaves it with neither.
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
  // The Instagram caption, kept beside the plan (not in it, so writing it never makes the export
  // out of date).
  const caption = existsSync(join(dir, "caption.txt")) ? readFileSync(join(dir, "caption.txt"), "utf8").trim() : "";
  const prev = facts.record;
  const stem = `${day(now)} ${fileTitle(title, slug)}`;
  let name = stem;
  const free = (n: string) => !existsSync(join(folder, n)) || join(folder, n) === prev?.folder;
  for (let n = 2; !free(name); n++) name = `${stem} (${n})`;
  const into = join(folder, name);
  const video = join(into, "reel.mp4");
  const noCta = join(into, "reel-no-cta.mp4");
  const cover = join(into, "image.jpg");

  // The cover is made in the project first, then each file is copied in under a hidden name and
  // renamed, so the folder never shows half a file. A cover Owain made (Higgsfield, 2026-11-13: "Use
  // Higgsfield") and dropped in as projects/<slug>/cover.png or .jpg wins; else the plain card is drawn.
  const drawn = join(dir, "build/cover.jpg");
  mkdirSync(join(dir, "build"), { recursive: true });
  rmSync(drawn, { force: true });
  const made = handCover(dir);
  if (!made && !opts.plainCover) throw fail(`cannot approve ${slug}: no cover yet. Run \`cover ${slug} --prompt\`, make it in Higgsfield and save it as projects/${slug}/cover.png`);
  if (made) {
    opts.log?.(`Using the cover ${basename(made)}`);
    uploadCover(made, drawn, opts.log);
  } else {
    opts.log?.("Drawing the plain cover card (no cover.png)");
    await (opts.cover ?? ((p, s, f) => coverStill(p, s, f, opts.log)))(projects, slug, drawn);
  }
  if (!existsSync(drawn)) throw fail("the cover was not drawn", 500);
  // The export must still be the one that was checked: a render may have started meanwhile.
  if (mtime(join(dir, "renders/final.mp4")) !== facts.video || mtime(join(dir, NO_CTA)) !== facts.noCta) throw fail("the export changed while approving; try again");
  mkdirSync(into, { recursive: true });
  const place = (from: string, to: string) => {
    const part = join(into, `.${basename(to)}.partial`);
    copyFileSync(from, part);
    renameSync(part, to);
  };
  place(join(dir, "renders/final.mp4"), video);
  // The reel without its call to action, for TikTok and LinkedIn, when the plan names one.
  const withoutCta = facts.cta && existsSync(join(dir, NO_CTA));
  if (withoutCta) place(join(dir, NO_CTA), noCta);
  else rmSync(noCta, { force: true });
  place(drawn, cover);
  // The caption to post with it, when the project has one.
  const text = join(into, "caption.txt");
  if (caption) {
    writeFileSync(join(into, ".caption.txt.partial"), `${caption}\n`);
    renameSync(join(into, ".caption.txt.partial"), text);
  } else rmSync(text, { force: true });
  // The earlier approval, when it was somewhere else: its folder (or, from before folders, its two
  // loose files) to the Trash.
  if (prev?.folder) {
    if (prev.folder !== into && existsSync(prev.folder)) moveToTrash(prev.folder, opts.trash);
  } else if (prev) for (const f of [prev.video, prev.cover]) if (existsSync(f)) moveToTrash(f, opts.trash);

  const record: ApprovalRecord = { at: now.toISOString(), folder: into, video, ...(withoutCta ? { noCta } : {}), cover, title };
  writeJson(recordFile(dir), record);
  return record;
}

// Take a reel out of the approved folder: its files go to the Trash and the record goes.
export function unapprove(projects: string, slug: string, opts: Pick<Options, "trash"> = {}): ApprovalRecord {
  const dir = join(projects, slug);
  const record = loadRecord(dir);
  if (!record) throw fail(`${slug} is not approved`, 404);
  if (record.folder) {
    if (existsSync(record.folder)) moveToTrash(record.folder, opts.trash);
  } else for (const f of [record.video, record.cover]) if (existsSync(f)) moveToTrash(f, opts.trash);
  rmSync(recordFile(dir));
  return record;
}

// Move a file or a folder to the Trash. A name already there gets the time added, as Finder does.
export function moveToTrash(file: string, trash = trashFolder()): string {
  mkdirSync(trash, { recursive: true });
  const isDir = lstatSync(file).isDirectory();
  const ext = isDir ? "" : extname(file);
  const name = isDir ? basename(file) : basename(file, ext);
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
    cpSync(file, dest, { recursive: true });
    rmSync(file, { recursive: true, force: true });
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
