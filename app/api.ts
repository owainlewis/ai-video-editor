// The editor's view of the server API (server/index.ts).
import type { Resolved, Word } from "../engine/schema";

export type Issue = { level: "error" | "warn"; message: string };
export type ChatMessage = { role: "user" | "claude" | "tool"; text: string; at: string };
export type Status = { stage: string; done: boolean; error?: string } | null;
export type Version = { n: number; at: string; by: string };
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
  render?: { file: string; at: number } | null;
};
export type Event =
  | { type: "plan" | "status"; slug: string }
  | { type: "chat"; slug: string; message: ChatMessage | { role: "status"; text: string } };

const json = async <T,>(res: Response): Promise<T> => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
};

export const api = {
  projects: () => fetch("/api/projects").then((r) => json<ProjectSummary[]>(r)),
  project: (slug: string) => fetch(`/api/projects/${slug}`).then((r) => json<Project>(r)),
  upload: (file: File, onProgress: (f: number) => void) =>
    new Promise<{ slug: string }>((ok, fail) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/upload?name=${encodeURIComponent(file.name)}`);
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
