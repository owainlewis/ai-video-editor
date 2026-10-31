// Every version of a project's plan and cut, so any change (Owain's or Claude's) can be undone and
// redone. history/ holds numbered copies of edit.json; the newest is the current plan. A project
// with a cut also keeps the cut.json of each version in history/cut/<n>.json (none means no cut
// then). A change is saved when either file differs from the newest version. Undo moves the newest
// version to history/redo/ and writes the one before it back; redo brings it back. Neither is then
// saved again as a change. A new change clears redo (the undone versions are kept in history/undone/).
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Version = { n: number; at: string; by: string };

const dirOf = (project: string) => join(project, "history");
const redoDir = (project: string) => join(project, "history/redo");
const isVersion = (f: string) => /^\d{5}-.+\.json$/.test(f);
const listIn = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter(isVersion).sort() : []);
const files = (project: string) => listIn(dirOf(project));

const parse = (file: string): Version => {
  const [n, by, ...rest] = file.replace(/\.json$/, "").split("-");
  return { n: +n, by, at: rest.join("-") };
};
const cutName = (file: string) => `${file.slice(0, 5)}.json`;
const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : null);

export const versions = (project: string): Version[] => files(project).map(parse);
export const redoable = (project: string) => listIn(redoDir(project)).length;

// Saves the current plan and cut if either changed. Returns true when a new version was written.
export function snapshot(project: string, by: string): boolean {
  const plan = readFileSync(join(project, "edit.json"), "utf8");
  const cut = read(join(project, "cut.json"));
  const all = files(project);
  const last = all[all.length - 1];
  if (last && readFileSync(join(dirOf(project), last), "utf8") === plan && read(join(dirOf(project), "cut", cutName(last))) === cut) return false;
  mkdirSync(dirOf(project), { recursive: true });
  const n = last ? parse(last).n + 1 : 1;
  const stamp = new Date().toISOString().replace(/[:.]/g, "");
  const name = `${String(n).padStart(5, "0")}-${by.replace(/[^a-z]/gi, "")}-${stamp}.json`;
  writeFileSync(join(dirOf(project), name), plan);
  if (cut !== null) {
    mkdirSync(join(dirOf(project), "cut"), { recursive: true });
    writeFileSync(join(dirOf(project), "cut", cutName(name)), cut);
  }
  // A new change starts a new branch of history: what was undone can no longer be redone.
  for (const f of listIn(redoDir(project))) {
    mkdirSync(join(dirOf(project), "undone/cut"), { recursive: true });
    renameSync(join(redoDir(project), f), join(dirOf(project), "undone", f));
    if (existsSync(join(redoDir(project), "cut", cutName(f)))) renameSync(join(redoDir(project), "cut", cutName(f)), join(dirOf(project), "undone/cut", cutName(f)));
  }
  return true;
}

// Writes a version back as the project's current plan and cut.
const restore = (project: string, dir: string, file: string) => {
  writeFileSync(join(project, "edit.json"), readFileSync(join(dir, file), "utf8"));
  const cut = read(join(dir, "cut", cutName(file)));
  if (cut !== null) writeFileSync(join(project, "cut.json"), cut);
  else rmSync(join(project, "cut.json"), { force: true });
};

// Moves a version file, and its cut if it has one, from one folder to another.
const move = (file: string, from: string, to: string) => {
  mkdirSync(join(to, "cut"), { recursive: true });
  renameSync(join(from, file), join(to, file));
  if (existsSync(join(from, "cut", cutName(file)))) renameSync(join(from, "cut", cutName(file)), join(to, "cut", cutName(file)));
};

// Restores the previous version. Returns false when there is nothing to undo.
export function undo(project: string): boolean {
  const all = files(project);
  if (all.length < 2) return false;
  move(all[all.length - 1], dirOf(project), redoDir(project));
  restore(project, dirOf(project), all[all.length - 2]);
  return true;
}

// Brings back the version undone last. Returns false when there is nothing to redo.
export function redo(project: string): boolean {
  const waiting = listIn(redoDir(project));
  if (!waiting.length) return false;
  const file = waiting[0];
  move(file, redoDir(project), dirOf(project));
  restore(project, dirOf(project), file);
  return true;
}
