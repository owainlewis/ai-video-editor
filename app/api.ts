// The editor's view of the server API (server/index.ts).
import type { CutPlan, Resolved, Word } from "../engine/schema";

export type Issue = { level: "error" | "warn"; message: string };
export type ChatMessage = { role: "user" | "claude" | "tool"; text: string; at: string };
export type Status = { stage: string; done: boolean; error?: string } | null;
export type Asset = { path: string; name: string; kind: "video" | "image"; thumb: string; duration?: number };
export type LibraryClip = { id: string; duration: number; description: string; tags: string[]; thumb: string };
export type Suggestion = { id: string; start: number; end: number; layout: string; visual: { kind: string }; reason: string; status: "pending" | "accepted" | "rejected"; note?: string };
export type Effect = { id: string; kind: string; purpose: string; summary: string; thumb: string };
export type Version = { n: number; at: string; by: string };
// A clip in the project's bin. "main" is the one the project was made from.
export type BinClip = { id: string; name: string; duration: number; status: Status; ready: boolean };
export type ProjectSummary = { slug: string; title: string; canvas: string; duration?: number; status: Status };
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
  render?: { file: string; at: number } | null;
  redo?: number;
  bin?: BinClip[];
  cut?: CutPlan;
  clipWords?: Record<string, Word[]>;
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
  effects: (canvas: string) => fetch(`/api/effects?canvas=${canvas}`).then((r) => json<Effect[]>(r)),
  project: (slug: string) => fetch(`/api/projects/${slug}`).then((r) => json<Project>(r)),
  upload: (file: File, onProgress: (f: number) => void, to = "/api/upload", params: Record<string, string> = {}) =>
    new Promise<{ slug?: string; path?: string }>((ok, fail) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${to}?${new URLSearchParams({ name: file.name, ...params })}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? ok(JSON.parse(xhr.responseText)) : fail(new Error(xhr.responseText)));
      xhr.onerror = () => fail(new Error("upload failed"));
      xhr.send(file);
    }),
  post: (slug: string, action: string, payload: unknown = {}) =>
    fetch(`/api/projects/${slug}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).then((r) => json<{ ok?: boolean }>(r)),
  // Moves the project to projects/.trash/ after the person confirms. Returns false if they cancel.
  remove: async (slug: string, title: string) => {
    if (!confirm(`Delete "${title}"?\n\nIt moves to projects/.trash, so it can be recovered from there.`)) return false;
    const r = await fetch(`/api/projects/${slug}/delete`, { method: "POST" });
    await json(r);
    return true;
  },
  events: (on: (e: Event) => void) => {
    const es = new EventSource("/api/events");
    es.onmessage = (m) => on(JSON.parse(m.data));
    return () => es.close();
  },
};

export const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
