import React, { useSyncExternalStore } from "react";
import { clock } from "./api";

// The playhead's time, kept outside React state. The player moves it thirty times a second; held in
// the editor's state, every frame redrew the library, the timeline and the chat. Here a component
// reads it only when it asks to (`playhead.get()` in a handler), or subscribes to the part it shows:
// `usePlayhead()` for the time itself, `usePlayhead(select)` to redraw only when `select`'s answer
// changes (the sentence being said, the current beat).
let now = 0;
const subs = new Set<() => void>();

export const playhead = {
  get: () => now,
  set: (t: number) => {
    if (t === now) return;
    now = t;
    for (const f of subs) f();
  },
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
};

// `select` must answer with a number, string or boolean, so the same answer never redraws.
export function usePlayhead(): number;
export function usePlayhead<T extends number | string | boolean>(select: (t: number) => T): T;
export function usePlayhead<T extends number | string | boolean>(select?: (t: number) => T) {
  return useSyncExternalStore(playhead.subscribe, () => (select ? select(now) : now));
}

// The playhead's time as text, redrawn on its own.
export const Clock: React.FC = () => <>{clock(usePlayhead())}</>;
