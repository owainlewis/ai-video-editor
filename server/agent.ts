// The chat panel's bridge to Claude Code. A note from the editor becomes a headless `claude -p`
// run in this repo, with the selected moment and its words as context. Claude edits
// projects/<slug>/edit.json like it would from the terminal; the server's watcher picks the change
// up, so the editor updates the same way whoever made the edit. Each project keeps one Claude
// session, so later notes can say "smaller" without repeating themselves.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Run } from "../engine/changes.ts";
import type { Word } from "../engine/schema.ts";
import { readJson, ROOT, writeJson } from "../media/tools.ts";
import { timeline } from "../media/bin.ts";
import { latest } from "./history.ts";

// Claude's last message on a note carries `run`: its time, and what it changed (engine/changes.ts).
export type ChatMessage = { role: "user" | "claude" | "tool"; text: string; at: string; run?: Run };
export type Selection = { start: number; end: number } | undefined;
type ChatState = { session?: string; messages: ChatMessage[] };

const chatFile = (project: string) => join(project, "chat.json");
export const loadChat = (project: string): ChatState => {
  if (!existsSync(chatFile(project))) return { messages: [] };
  try {
    const data = readJson<Partial<ChatState>>(chatFile(project));
    return { ...(data?.session ? { session: data.session } : {}), messages: Array.isArray(data?.messages) ? data.messages : [] };
  } catch {
    return { messages: [] };
  }
};
const saveChat = (project: string, state: ChatState) => writeJson(chatFile(project), state);

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

// What Claude needs to act on "add a graphic here": the project, the moment, and what is said in it.
export function promptFor(slug: string, note: string, selection: Selection, playhead: number, words: Word[]): string {
  const lines = [`Project: projects/${slug} (plan: projects/${slug}/edit.json). Owain is in the editor.`];
  if (selection) {
    const said = words.filter((w) => w.start >= selection.start - 0.05 && w.start < selection.end).map((w) => w.text).join(" ");
    lines.push(`Selected: ${fmt(selection.start)} to ${fmt(selection.end)} (${selection.start.toFixed(2)}s to ${selection.end.toFixed(2)}s). Said there: "${said}"`);
  } else {
    const near = words.filter((w) => Math.abs(w.start - playhead) < 3).map((w) => w.text).join(" ");
    lines.push(`Playhead: ${fmt(playhead)} (${playhead.toFixed(2)}s). Said around it: "${near}"`);
  }
  lines.push(`Note: ${note}`);
  return lines.join("\n");
}

const SYSTEM = `You are the editor inside Studio, Owain's video editor. Follow CLAUDE.md and docs/RULES.md.
Make the change by editing the project's edit.json, then run \`npm run studio -- check <slug>\` and fix every error it reports.
Use \`npm run studio -- stills <slug> --at <seconds>\` and look at the image when a change is visual.
Do not render the video. Do not touch files outside the project unless the note asks for a change to the editor itself.
End with one or two plain sentences saying what you changed, for the chat panel.`;

const running = new Map<string, ReturnType<typeof spawn>>();
export const isRunning = (slug: string) => running.has(slug);
// Every project Claude is working on now. A note runs as a child of the server, so the desktop app
// waits for this to be empty before it restarts the server (electron/server.ts).
export const runningNotes = () => [...running.keys()];

// `prompt` replaces the usual note context, for requests the editor makes itself (suggestions).
// `onDone` runs when Claude stops, before its last message is written; given the plan's version
// when the note started, it may return what the note changed, which goes on that message.
export function ask(projects: string, slug: string, note: string, selection: Selection, playhead: number, emit: (m: ChatMessage | { role: "status"; text: string }) => void, onDone: (ok: boolean, from: number) => Omit<Run, "ms" | "from"> | void = () => {}, prompt?: string) {
  if (running.has(slug)) throw new Error("Claude is still working on the last note");
  const project = join(projects, slug);
  const state = loadChat(project);
  // Times in the note are on the timeline, so the words are the cut's.
  const words = timeline(project).words;
  const request = prompt ?? promptFor(slug, note, selection, playhead, words);
  const now = () => new Date().toISOString();
  const add = (m: ChatMessage) => {
    state.messages.push(m);
    saveChat(project, state);
    emit(m);
  };
  add({ role: "user", text: note, at: now() });
  const started = Date.now();
  const from = latest(project);

  const args = ["-p", request, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--allowedTools", "Read", "Edit", "Write", "Glob", "Grep", "Bash(npm run studio:*)", "Bash(npm run studio -- *)", "Bash(npm run typecheck)", "Bash(npm test)", "Bash(npx vitest:*)",
    "--append-system-prompt", SYSTEM, ...(state.session ? ["--resume", state.session] : [])];
  const p = spawn("claude", args, { cwd: ROOT, env: process.env });
  running.set(slug, p);
  emit({ role: "status", text: "working" });

  let buffer = "";
  let result: string | undefined;
  p.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev: { type?: string; session_id?: string; message?: { content?: { type: string; text?: string; name?: string; input?: Record<string, unknown> }[] }; result?: string; is_error?: boolean };
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.session_id) state.session = ev.session_id;
      if (ev.type === "assistant")
        for (const c of ev.message?.content ?? []) {
          if (c.type === "tool_use") add({ role: "tool", text: describeTool(c.name ?? "", c.input ?? {}), at: now() });
        }
      // Held until Claude stops, so the note's changes go on the same message.
      if (ev.type === "result") result = ev.result?.trim() || (ev.is_error ? "Something went wrong." : "Done.");
    }
  });
  let err = "";
  p.stderr.on("data", (c: Buffer) => (err = (err + c.toString()).slice(-2000)));
  let finished = false;
  const finish = (ok: boolean, failureMessage?: string) => {
    if (finished) return;
    finished = true;
    running.delete(slug);
    let done: Omit<Run, "ms" | "from"> = {};
    try {
      done = onDone(ok, from) ?? {};
    } catch {
      // Never block returning the UI to idle if post-run hooks fail.
    }
    const run: Run = { ms: Date.now() - started, ...(from ? { from } : {}), ...done };
    const last: string[] = [...(result ? [result] : []), ...(!ok ? [failureMessage || "Claude Code failed."] : [])];
    if (!last.length) last.push("Done.");
    try {
      last.forEach((text, k) => add({ role: "claude", text, at: now(), ...(k === last.length - 1 ? { run } : {}) }));
    } catch {
      try {
        saveChat(project, state);
      } catch {}
    }
    emit({ role: "status", text: "idle" });
  };
  p.on("error", (e) => {
    finish(false, `Claude Code failed: ${e.message}`);
  });
  p.on("close", (code) => {
    const ok = code === 0;
    const msg = !state.messages.length
      ? `Claude Code failed: ${err.trim() || `exit ${code}`}`
      : `Stopped (${err.trim().split("\n").pop() || `exit ${code}`}).`;
    finish(ok, msg);
  });
}

// Notes the revert on every run that started on version `from`, so the panel says so.
export function markReverted(project: string, from: number, version: number) {
  const state = loadChat(project);
  let hit = false;
  for (const m of state.messages) if (m.run?.from === from && m.run.to) (m.run.reverted = version), (hit = true);
  if (hit) saveChat(project, state);
}

export function stop(slug: string) {
  running.get(slug)?.kill("SIGINT");
}

export function stopAll() {
  for (const p of running.values()) {
    try {
      p.kill("SIGINT");
    } catch {}
  }
  running.clear();
}

// A short line per tool call, so the panel shows what Claude is doing without the noise.
function describeTool(name: string, input: Record<string, unknown>): string {
  const file = String(input.file_path ?? input.path ?? "").replace(ROOT + "/", "");
  if (name === "Edit" || name === "Write") return `Edited ${file}`;
  if (name === "Read") return /\.(jpe?g|png)$/.test(file) ? `Looked at ${file}` : `Read ${file}`;
  if (name === "Bash") {
    const line = String(input.command ?? "").replace(/^npm run studio -- /, "").split("\n")[0];
    return `Ran ${line.length > 70 ? line.slice(0, 70) + "…" : line}`;
  }
  const short = (s: unknown) => (String(s ?? "").length > 50 ? String(s).slice(0, 50) + "…" : String(s ?? ""));
  if (name === "Grep") return `Searched for "${short(input.pattern)}"`;
  if (name === "Glob") return `Looked for ${short(input.pattern)}`;
  return name;
}

