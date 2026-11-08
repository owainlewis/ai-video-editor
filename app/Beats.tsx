import React from "react";
import type { Beat } from "../engine/beats";
import type { ResolvedShot } from "../engine/schema";
import { clock } from "./api";
import { gist } from "./Timeline";

// The beat view under a reel's player: step through the reel a beat at a time (the buttons, or the
// left and right arrow keys) and the player lands on each beat's settled frame, so every graphic can
// be checked before an export. Each beat shows its time, what changes, the shot and what is said.
export const BeatBar: React.FC<{ beats: Beat[]; current: number; shots: ResolvedShot[]; onStep: (i: number) => void }> = ({ beats, current, shots, onStep }) => {
  const b = beats[current];
  if (!b) return null;
  const s = shots[b.shot];
  const v = s?.visual;
  const held = b.changes[0] === "held";
  return (
    <div className="beatbar">
      <button className="small" onClick={() => onStep(current - 1)} disabled={current === 0} title="Previous beat (←)">
        ←
      </button>
      <span className="count">
        Beat {current + 1} <span className="muted">/ {beats.length}</span>
      </span>
      <button className="small" onClick={() => onStep(current + 1)} disabled={current === beats.length - 1} title="Next beat (→)">
        →
      </button>
      <div className="about">
        <div className="line">
          <span className="when">
            {clock(b.start)} to {clock(b.end)}
          </span>
          <span className="shot">
            {s?.layout}
            {v ? ` · ${v.kind}` : ""}
            {v && gist(v) ? `: ${gist(v)}` : ""}
          </span>
          <span className={held ? "warn" : "change"}>{held ? "nothing new" : b.changes.join(", ")}</span>
        </div>
        <div className="said">{b.said ? `"${b.said}"` : <span className="muted">No words</span>}</div>
      </div>
    </div>
  );
};
