import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../app/api.ts";
import { groupChat, took } from "../app/runs.ts";

const m = (role: ChatMessage["role"], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ role, text, at: "2026-11-26T10:00:00.000Z", ...extra });

describe("the chat as runs", () => {
  it("puts each note's steps, answer and run together", () => {
    const run = { ms: 4000, from: 3, to: 4, changes: [{ type: "plan" as const, field: "hook" }] };
    const g = groupChat([m("user", "shorter hook"), m("tool", "Read edit.json"), m("tool", "Edited edit.json"), m("claude", "Done.", { run }), m("user", "again")], false);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ note: { text: "shorter hook" }, run, live: false });
    expect(g[0].steps.map((s) => s.text)).toEqual(["Read edit.json", "Edited edit.json"]);
    expect(g[0].answers.map((s) => s.text)).toEqual(["Done."]);
    expect(g[1]).toMatchObject({ note: { text: "again" }, steps: [], answers: [] });
  });
  it("marks the last run live only while Claude works on it", () => {
    const msgs = [m("user", "a"), m("tool", "Read x")];
    expect(groupChat(msgs, true).at(-1)!.live).toBe(true);
    expect(groupChat(msgs, false).at(-1)!.live).toBe(false);
    expect(groupChat([...msgs, m("claude", "ok")], true).at(-1)!.live).toBe(false);
  });
  it("keeps an old chat with no runs, and steps before any note", () => {
    const g = groupChat([m("tool", "Read x"), m("claude", "Hi"), m("tool", "stray"), m("user", "b"), m("claude", "Stopped."), m("claude", "Failed.")], false);
    expect(g.map((x) => [x.note?.text, x.steps.length, x.answers.length])).toEqual([[undefined, 1, 1], [undefined, 1, 0], ["b", 0, 2]]);
  });
  it("says how long a run took", () => {
    expect(took(400)).toBe("0 s");
    expect(took(48_200)).toBe("48 s");
    expect(took(120_000)).toBe("2 min");
    expect(took(125_000)).toBe("2 min 5 s");
  });
});
