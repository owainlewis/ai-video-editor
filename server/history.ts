// Every version of a project's plan, so any change (Owain's or Claude's) can be undone.
// history/ holds numbered copies of edit.json; the newest is the current plan. A change is saved
// when edit.json differs from the newest copy. Undo moves the newest copy aside and writes the
// one before it back to edit.json, which then matches the stack and is not saved again.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Version = { n: number; at: string; by: string };

const dirOf = (project: string) => join(project, "history");
const files = (project: string) =>
  existsSync(dirOf(project))
    ? readdirSync(dirOf(project)).filter((f) => /^\d{5}-.+\.json$/.test(f)).sort()
    : [];

const parse = (file: string): Version => {
  const [n, by, ...rest] = file.replace(/\.json$/, "").split("-");
  return { n: +n, by, at: rest.join("-") };
};

export const versions = (project: string): Version[] => files(project).map(parse);

// Saves the current plan if it changed. Returns true when a new version was written.
export function snapshot(project: string, by: string): boolean {
  const plan = readFileSync(join(project, "edit.json"), "utf8");
  const all = files(project);
  const last = all[all.length - 1];
  if (last && readFileSync(join(dirOf(project), last), "utf8") === plan) return false;
  mkdirSync(dirOf(project), { recursive: true });
  const n = last ? parse(last).n + 1 : 1;
  const stamp = new Date().toISOString().replace(/[:.]/g, "");
  writeFileSync(join(dirOf(project), `${String(n).padStart(5, "0")}-${by.replace(/[^a-z]/gi, "")}-${stamp}.json`), plan);
  return true;
}

// Restores the previous version. Returns false when there is nothing to undo.
export function undo(project: string): boolean {
  const all = files(project);
  if (all.length < 2) return false;
  const undone = join(dirOf(project), "undone");
  mkdirSync(undone, { recursive: true });
  renameSync(join(dirOf(project), all[all.length - 1]), join(undone, all[all.length - 1]));
  writeFileSync(join(project, "edit.json"), readFileSync(join(dirOf(project), all[all.length - 2]), "utf8"));
  return true;
}
