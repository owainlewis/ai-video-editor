import React, { useRef } from "react";
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
  onSeek: (t: number) => void;
  onSelect: (r: Range | null) => void;
}> = ({ r, words, time, selection, onSeek, onSelect }) => {
  const box = useRef<HTMLDivElement>(null);
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
        <div className="lane words">
          {words.map((w, i) => (
            <span key={i} className={time >= w.start && time < w.end ? "now" : ""} style={{ left: w.start * pps }}>
              {w.text}
            </span>
          ))}
        </div>
        {selection && <div className="selection" style={{ left: selection.start * pps, width: (selection.end - selection.start) * pps }} />}
        <div className="playhead" style={{ left: time * pps }} />
      </div>
    </div>
  );
};
