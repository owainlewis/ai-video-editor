// Approving finished reels (Owain, 2026-11-13): about ten ideas a week are recorded and edited,
// about seven end up approved, and the approved ones are copied to one folder for him to upload to
// his content system. The rules here are pure; media/approve.ts does the files.

export const WEEKLY_TARGET = 7;

// Where a reel has got to.
//   draft:    no export, or the export is older than the plan, or its check failed
//   exported: the final export is the current edit and its check passed; it can be approved
//   approved: copied to the approved folder, and nothing has changed since
//   stale:    approved, but the plan changed (or it was exported again) after
export type ApprovalState = "draft" | "exported" | "approved" | "stale";

// What `approved.json` holds. `video` and `cover` are absolute paths in the approved folder.
export type ApprovalRecord = { at: string; video: string; cover: string; title: string };

// The facts the state is read from, as file times in ms.
export type ApprovalFacts = {
  video?: number;
  plan: number;
  check?: { at: number; errors: number };
  exporting?: boolean;
  record?: ApprovalRecord | null;
};

// Whether the final export is the current edit and passed its check, and if not, why not.
export function exportReady(f: ApprovalFacts): { ok: boolean; reason: string } {
  if (f.exporting) return { ok: false, reason: "an export is running; wait for it to finish" };
  if (f.video === undefined) return { ok: false, reason: "there is no export yet (renders/final.mp4); export the reel first" };
  if (f.video <= f.plan) return { ok: false, reason: "the plan changed after the last export; export again" };
  // The check is written just after the video it checks; one from before it is an older export's.
  if (!f.check || f.check.at < f.video) return { ok: false, reason: "the last export has no export check (checks/export-check.json); export again" };
  if (f.check.errors) return { ok: false, reason: `the export check found ${f.check.errors} error${f.check.errors === 1 ? "" : "s"} (checks/export-check.json); fix them and export again` };
  return { ok: true, reason: "the export is current and its check passed" };
}

export function approvalState(f: ApprovalFacts): { state: ApprovalState; ready: boolean; reason: string } {
  const ready = exportReady(f);
  if (f.record) {
    const at = Date.parse(f.record.at);
    if (f.plan > at) return { state: "stale", ready: ready.ok, reason: "the plan changed after it was approved" };
    if (f.video !== undefined && f.video > at) return { state: "stale", ready: ready.ok, reason: "it was exported again after it was approved" };
    return { state: "approved", ready: ready.ok, reason: "approved, and nothing has changed since" };
  }
  return { state: ready.ok ? "exported" : "draft", ready: ready.ok, reason: ready.reason };
}

// Midnight on the Monday of the week `now` falls in, local time. Weeks run Monday to Sunday.
export function weekStart(now: Date | number = Date.now()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// How many of these approval times fall in this week.
export function thisWeek(times: (string | undefined | null)[], now: Date | number = Date.now()): number {
  const from = weekStart(now).getTime();
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return times.filter((t) => {
    const ms = t ? Date.parse(t) : NaN;
    return ms >= from && ms < to.getTime();
  }).length;
}

// The date as YYYY-MM-DD, local time.
export const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// A title made safe for a file name on macOS, Windows and in a content system's upload: no path
// separators, reserved or control characters, one space between words, no leading or trailing dots,
// at most 80 characters, cut at a word. Falls back to `fallback`, then "Reel", when nothing is left.
const tidy = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "");

export function fileTitle(title: string, fallback = "Reel"): string {
  const clean = tidy(title) || tidy(fallback) || "Reel";
  if (clean.length <= 80) return clean;
  const cut = clean.slice(0, 80);
  const space = cut.lastIndexOf(" ");
  return (space > 40 ? cut.slice(0, space) : cut).replace(/[\s.]+$/, "");
}
