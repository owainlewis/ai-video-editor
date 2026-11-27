// The chat as the panel shows it: one run per note, with Claude's steps folded under it, its answer,
// and what it changed. Pure, so it is tested apart from the panel (tests/runs.test.ts).
import type { Run } from "../engine/changes";
import type { ChatMessage } from "./api";

export type ChatRun = {
  note?: ChatMessage;
  steps: ChatMessage[];
  answers: ChatMessage[];
  run?: Run;
  // Claude is on this one now.
  live: boolean;
};

// The messages in order, a run starting at each of Owain's notes. Steps from before any note (an
// old chat) make a run of their own.
export function groupChat(messages: ChatMessage[], working: boolean): ChatRun[] {
  const out: ChatRun[] = [];
  const open = () => {
    const r: ChatRun = { steps: [], answers: [], live: false };
    out.push(r);
    return r;
  };
  let cur: ChatRun | undefined;
  for (const m of messages) {
    if (m.role === "user") {
      cur = open();
      cur.note = m;
      continue;
    }
    // Steps after an answer start a run of their own: they are not part of that note any more.
    if (!cur || (m.role === "tool" && cur.answers.length)) cur = open();
    if (m.role === "tool") cur.steps.push(m);
    else {
      cur.answers.push(m);
      if (m.run) cur.run = m.run;
    }
  }
  const last = out.at(-1);
  if (working && last && !last.answers.length) last.live = true;
  return out;
}

// A plan field's name as the panel says it.
const FIELDS: Record<string, string> = {
  hook: "Hook",
  cta: "Call to action",
  cover: "Cover",
  music: "Music",
  cut: "The cut",
  remove: "Removed sections",
  style: "Style",
  palette: "Palette",
  theme: "Theme",
  title: "Title",
  parts: "Parts",
  header: "Header",
};
export const fieldName = (f: string) => FIELDS[f] ?? f;

// "48 s", "2 min 5 s".
export function took(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
}
