import React, { useMemo, useRef } from "react";
import type { Resolved, Word } from "../engine/schema";
import { clock } from "./api";

export type Range = { start: number; end: number };

// The edit laid out in time: what is on screen (shots and their graphics) above the words.
// Click to move the playhead; drag to select a range for a note. The selection is what Claude
// gets as "this section".
export const Timeline: React.FC<{
  r: Resolved;
  words: Word[];
  time: number;
  selection: Range | null;
  camera?: [number, number][];
  onSeek: (t: number) => void;
  onSelect: (r: Range | null) => void;
}> = ({ r, words, time, selection, camera, onSeek, onSelect }) => {
  const box = useRef<HTMLDivElement>(null);
  const sentences = useMemo(() => toSentences(words), [words]);
  const pps = Math.max(64, Math.min(140, 1400 / Math.max(1, r.duration)));
  const width = r.duration * pps;
  const at = (clientX: number) => {
    const el = box.current!;
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - 12;
    return Math.max(0, Math.min(r.duration, x / pps));
  };

  const down = (e: React.PointerEvent) => {
    const start = at(e.clientX);
    let moved = false;
    const move = (m: PointerEvent) => {
      const t = at(m.clientX);
      if (Math.abs(t - start) * pps > 4) moved = true;
      if (moved) onSelect({ start: Math.min(start, t), end: Math.max(start, t) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) {
        onSelect(null);
        onSeek(start);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const ticks = Array.from({ length: Math.floor(r.duration / (pps < 50 ? 5 : 1)) + 1 }, (_, i) => i * (pps < 50 ? 5 : 1));

  return (
    <div className="timeline" ref={box} onPointerDown={down}>
      <div className="lanes" style={{ width }}>
        <div className="ruler">
          {ticks.map((t) => (
            <span key={t} style={{ left: t * pps }}>
              {t % (pps < 50 ? 10 : 5) === 0 ? clock(t).replace(/\.0$/, "") : ""}
            </span>
          ))}
        </div>
        <div className="lane shots">
          {r.shots.map((s, i) => (
            <div
              key={i}
              className={`shot ${s.layout} ${s.keep ? "keep" : ""} ${s.visual ? "graphic" : ""}`}
              style={{ left: s.start * pps, width: Math.max(2, (s.end - s.start) * pps - 2) }}
              title={`${clock(s.start)} ${s.layout}${s.visual ? ` · ${s.visual.kind}` : ""} · "${s.anchor}"`}
            >
              <b>{s.keep ? "↳" : s.visual?.kind ?? s.layout}</b>
              {!s.keep && <span>{s.anchor}</span>}
            </div>
          ))}
        </div>
        {camera && (
          <div className="lane camera" title="Where you are on camera. Graphics go only here.">
            {camera.map(([a, b], i) => (
              <div key={i} style={{ left: a * pps, width: (b - a) * pps }}>
                on camera
              </div>
            ))}
          </div>
        )}
        <div className="lane said">
          {sentences.map((x, i) => (
            <div
              key={i}
              className={time >= x.start && time < x.end ? "now" : ""}
              style={{ left: x.start * pps, width: Math.max(4, (x.end - x.start) * pps - 3) }}
              title={`${clock(x.start)} ${x.text}`}
            >
              {x.text}
            </div>
          ))}
        </div>
        {selection && <div className="selection" style={{ left: selection.start * pps, width: (selection.end - selection.start) * pps }} />}
        <div className="playhead" style={{ left: time * pps }} />
      </div>
    </div>
  );
};

// What is said, one block per sentence: readable at any zoom, unlike one label per word. A
// sentence ends at . ? or !, at a pause over 0.8 s, or after 30 words.
export function toSentences(words: Word[]) {
  const out: { start: number; end: number; text: string }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) out.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((w) => w.text).join(" ") });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (/[.?!]$/.test(w.text) || !next || next.start - w.end > 0.8 || cur.length >= 30) flush();
  });
  return out;
}
