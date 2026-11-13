// The editor's view of the server API (server/index.ts).
import type { ActionInput, ActionName } from "../engine/api";
import type { Issue } from "../engine/resolve";
import type { Item, Review } from "../engine/review";
import type { CutPlan, Resolved, Word } from "../engine/schema";

export type { Issue };
export type ChatMessage = { role: "user" | "claude" | "tool"; text: string; at: string };
export type Status = { stage: string; done: boolean; error?: string } | null;
export type Asset = { path: string; name: string; kind: "video" | "image"; thumb: string; duration?: number };
export type LibraryClip = { id: string; duration: number; description: string; tags: string[]; thumb: string };
export type Suggestion = { id: string; start: number; end: number; layout: string; visual: { kind: string }; reason: string; status: "pending" | "accepted" | "rejected"; note?: string };
export type Effect = { id: string; kind: string; purpose: string; summary: string; name?: string; off?: string };
export type Version = { n: number; at: string; by: string };
// Claude's takes on one graphic (server/variants.ts), each resolved against the real words.
export type Take = { id: string; label: string; reason?: string; shot: Record<string, unknown> & { at: string; layout: string }; resolved?: import("../engine/schema").ResolvedShot; problems: string[] };
export type Variants = { start: number; note?: string; items: Take[] };
// A clip in the project's bin. "main" is the one the project was made from.
export type BinClip = { id: string; name: string; duration: number; status: Status; ready: boolean };
export type ProjectSummary = { slug: string; title: string; canvas: string; duration?: number; status: Status; modified: number; thumb: string | null; exported: boolean; review: { approved: number; total: number } | null };
// Review before render (engine/review.ts): the decisions and notes, the items they are about, and
// how many notes and changes are waiting to go to Claude.
export type ReviewState = { review: Review; items: Item[]; counts: { approved: number; change: number; waiting: number }; open: number };
// The last QC run (media/qc.ts). `stale`: ids of graphics that changed since, or were never checked.
export type QcItem = { id: string; hash: string; index: number; start: number; kind: string; sheet: string; issues: Issue[]; cached: boolean };
export type Qc = { at: string; partial: boolean; stale: string[]; other: Issue[]; overview: string | null; items: QcItem[] };
export type ExportCheck = { at: string; issues: Issue[]; lufs?: number; sections?: number; size?: string };
export type Project = {
  slug: string;
  status: Status;
  resolved?: Resolved;
  issues?: Issue[];
  words?: Word[];
  plan?: string;
  versions?: Version[];
  chat?: ChatMessage[];
  working?: boolean;
  camera?: [number, number][];
  assets?: Asset[];
  suggestions?: Suggestion[];
  variants?: Variants | null;
  render?: { file: string; at: number } | null;
  previews?: Record<string, { file: string; at: number }>;
  redo?: number;
  bin?: BinClip[];
  cut?: CutPlan;
  clipWords?: Record<string, Word[]>;
  // Changes when the words do. Sent back as `have`, the reload leaves `words` and `clipWords` out.
  wordsKey?: string;
  review?: ReviewState | null;
  qc?: Qc | null;
  exportCheck?: ExportCheck | null;
  // The sound as the export will mix it (media/previewmix.ts). `fresh`: nothing it is made from has changed since.
  mix?: { file: string; at: number; fresh: boolean } | null;
};
export type Event =
  | { type: "plan" | "status"; slug: string }
  | { type: "library"; slug?: undefined }
  | { type: "chat"; slug: string; message: ChatMessage | { role: "status"; text: string } };

const json = async <T,>(res: Response): Promise<T> => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
};

export const api = {
  projects: () => fetch("/api/projects").then((r) => json<ProjectSummary[]>(r)),
  library: () => fetch("/api/library").then((r) => json<{ busy: boolean; clips: LibraryClip[] }>(r)),
  effects: (canvas: string, style?: string) => fetch(`/api/effects?canvas=${canvas}${style ? `&style=${style}` : ""}`).then((r) => json<Effect[]>(r)),
  gallery: () => fetch("/api/gallery").then((r) => json<{ slug: string; resolved: Resolved }[]>(r)),
  project: (slug: string, have?: string) => fetch(`/api/projects/${slug}${have ? `?have=${have}` : ""}`).then((r) => json<Project>(r)),
  upload: (file: File, onProgress: (f: number) => void, to = "/api/upload", params: Record<string, string> = {}) =>
    new Promise<{ slug?: string; path?: string }>((ok, fail) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${to}?${new URLSearchParams({ name: file.name, ...params })}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? ok(JSON.parse(xhr.responseText)) : fail(new Error(xhr.responseText)));
      xhr.onerror = () => fail(new Error("upload failed"));
      xhr.send(file);
    }),
  // An action on a project. Its payload is checked against the action's schema (engine/api.ts) here
  // by the compiler and on the server as it arrives.
  post: <K extends ActionName>(slug: string, action: K, payload?: ActionInput<K>) =>
    fetch(`/api/projects/${slug}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload ?? {}) }).then((r) => json<{ ok?: boolean }>(r)),
  // Moves the project to projects/.trash/. The caller asks first (app/dialog.tsx).
  remove: (slug: string) => fetch(`/api/projects/${slug}/delete`, { method: "POST" }).then((r) => json<{ ok?: boolean }>(r)),
  events: (on: (e: Event) => void) => {
    const es = new EventSource("/api/events");
    es.onmessage = (m) => on(JSON.parse(m.data));
    return () => es.close();
  },
};

export const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
