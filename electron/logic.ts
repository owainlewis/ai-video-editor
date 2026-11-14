// The desktop app's decisions, kept apart from Electron so they can be tested: which file changes
// restart the server, where a studio:// link goes, what is worth a notification, and what the menu
// bar shows. Nothing here touches Electron, the network or the disk.
import { thisWeek, WEEKLY_TARGET } from "../engine/approve.ts";

// The server runs these folders' code; a change to one needs a restart. The editor (app/) hot
// reloads through Vite on its own, and projects/ and library/ are data the server watches itself.
const SERVER_CODE = ["engine/", "media/", "server/", "styles/", "effects/"];
export function needsRestart(file: string): boolean {
  const f = file.replace(/\\/g, "/");
  if (f === "cli.ts" || f === "package.json") return true;
  // The card library is data the server reads on each request (media/cardlibrary.ts).
  if (f === "styles/library.json") return false;
  return SERVER_CODE.some((d) => f.startsWith(d)) && /\.(ts|tsx|json)$/.test(f) && !f.includes("/node_modules/");
}

// The server prints this line once it is listening (cli.ts serve).
export const serverUrl = (line: string) => line.match(/Studio is running at (http:\/\/\S+)/)?.[1] ?? null;

// studio://p/<slug>, studio://p/<slug>/review and studio://gallery, as the editor's hash routes.
export function routeFor(link: string): string | null {
  const m = link.match(/^studio:\/\/\/?(.*)$/);
  if (!m) return null;
  const path = m[1].replace(/\/+$/, "");
  if (path === "" || path === "projects") return "#/";
  if (path === "gallery") return "#/gallery";
  const p = path.match(/^p\/([\w.-]+)(\/review)?$/);
  return p ? `#/p/${p[1]}${p[2] ?? ""}` : null;
}

// A project as GET /api/projects lists it, with only what the app reads.
export type Status = { stage: string; done: boolean; error?: string; at?: string };
export type Listed = { slug: string; title: string; status: Status | null; approval: { state: string; at: string | null } | null };

export type Notice = { title: string; body: string; route: string };

// What a finished job says. Only jobs Owain waits on: an import, an export, and anything that
// failed. The editor's own background work (its sound mix, its QC pass) is quiet when it works.
const FINISHED: Record<string, string> = { Ready: "Import ready", Rendered: "Export finished" };

// The notifications between two reads of the project list: each job that finished in between.
// A project that was already finished at the first read says nothing, so starting the app is quiet.
export function notices(before: Listed[], after: Listed[]): Notice[] {
  const was = new Map(before.map((p) => [p.slug, p.status]));
  const out: Notice[] = [];
  for (const p of after) {
    const s = p.status;
    if (!s?.done || !was.has(p.slug)) continue;
    const prev = was.get(p.slug);
    if (prev && prev.done && prev.stage === s.stage && prev.at === s.at) continue;
    const route = `#/p/${p.slug}`;
    if (s.error) out.push({ title: `${p.title}: ${s.stage}`, body: firstLine(s.error), route });
    else if (FINISHED[s.stage]) out.push({ title: FINISHED[s.stage], body: p.title, route });
  }
  return out;
}

const firstLine = (text: string) => {
  const line = text.trim().split("\n").find((l) => l.trim()) ?? text;
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
};

// What the menu bar lists: each job running now, and the week's approvals against the target.
export function summary(projects: Listed[], notes: string[], now: number = Date.now()) {
  const title = new Map(projects.map((p) => [p.slug, p.title]));
  const working = [
    ...projects.filter((p) => p.status && !p.status.done).map((p) => ({ slug: p.slug, label: `${p.title}: ${p.status!.stage}` })),
    ...notes.map((slug) => ({ slug, label: `${title.get(slug) ?? slug}: Claude is working` })),
  ];
  const week = thisWeek(projects.flatMap((p) => (p.approval?.at ? [p.approval.at] : [])), now);
  return { working, week: `This week: ${week} of ${WEEKLY_TARGET} approved` };
}
