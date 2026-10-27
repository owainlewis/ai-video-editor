// The speaker's footage in the editor when the project has a cut: one sequence per segment, each
// playing its clip's preview from the segment's in point. Each segment mounts a second before it
// plays (premountFor), so the next one has loaded and seeked by the time the playhead reaches it.
// Exports never use this: they flatten the cut to one file first (media/cutrender.ts).
import React from "react";
import { Audio, Video } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import type { Resolved } from "../engine/schema";

// Segment edges as frames, rounded on the running total so lengths never drift from the timeline.
// Keyed by what plays, so a segment that moves keeps its loaded video instead of swapping sources.
const frames = (r: Resolved) =>
  r.cut!.map((s) => ({ ...s, key: `${s.video}@${s.in}@${s.end - s.start}`, a: Math.round(s.start * r.fps), b: Math.round(s.end * r.fps) })).filter((s) => s.b > s.a);

// `from`: timeline seconds at this component's first frame, when it sits inside a later sequence.
export const CutVideo: React.FC<{ r: Resolved; from?: number; style: React.CSSProperties }> = ({ r, from = 0, style }) => (
  <>
    {frames(r).map((s, i) => (
      <Sequence key={s.key} from={s.a - Math.round(from * r.fps)} durationInFrames={s.b - s.a} premountFor={r.fps} name={`cut ${i + 1}`}>
        <Video src={staticFile(s.video)} trimBefore={Math.round(s.in * r.fps)} muted style={{ position: "absolute", ...style }} />
      </Sequence>
    ))}
  </>
);

// What is said, segment by segment, from each clip's preview audio.
export const CutAudio: React.FC<{ r: Resolved }> = ({ r }) => (
  <>
    {frames(r).map((s, i) =>
      s.audio ? (
        <Sequence key={s.key} from={s.a} durationInFrames={s.b - s.a} premountFor={r.fps} name={`cut audio ${i + 1}`}>
          <Audio src={staticFile(s.audio)} trimBefore={Math.round(s.in * r.fps)} />
        </Sequence>
      ) : null,
    )}
  </>
);
