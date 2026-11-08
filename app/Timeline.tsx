import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Beat } from "../engine/beats";
import { cutLength, insertSegment, type Levels, moveSegment, placed, slotAt, snapEdge, trimEdge } from "../engine/cut";
import type { CutPlan, Resolved, ResolvedShot, Word } from "../engine/schema";
import { type BinClip, clock, type Suggestion } from "./api";

export type Range = { start: number; end: number; label?: string };

// The drag type for a clip from the library panel.
export const CLIP = "application/x-studio-clip";
// The drag type for a clip from the project's bin, cut in on the A-roll track.
export const SOURCE = "application/x-studio-source";

// A drag on the timeline: a segment being moved, a segment edge, or a b-roll clip's edge.
type Drag =
  | { kind: "move"; id: string; slot: number }
  | { kind: "shot"; from: number; edge: "in" | "out"; t: number };

type Track = { id: string; label: string; height: number; render: (pps: number) => React.ReactNode };

// The edit as tracks, like an editor: graphics, text, b-roll, the A-roll (the cut), what is said,
// captions, music and sound. Click empty space to move the playhead, drag to select a section, click
// a clip to select it. The selection is what Claude gets as "this".
// The A-roll track edits the cut: drop a clip from the bin, drag a segment to reorder it, drag its
// edges to trim (snapping to word edges and the pause beside them; hold Alt for frame-accurate). B-roll clips trim the same way.
// Each change goes to the server as a new cut.json, so it is a version that undo and redo step through.
export const Timeline: React.FC<{
  r: Resolved;
  words: Word[];
  time: number;
  selection: Range | null;
  camera?: [number, number][];
  music: boolean;
  onSeek: (t: number) => void;
  onSelect: (r: Range | null) => void;
  onDropClip: (ref: string, at: number, length: number) => void;
  drafts?: Suggestion[];
  cut: CutPlan;
  bin: BinClip[];
  clipWords: Record<string, Word[]>;
  levels: Record<string, Levels>;
  segment: string | null;
  onSegment: (id: string | null) => void;
  onCut: (cut: CutPlan) => Promise<unknown>;
  onShotStart: (from: number, to: number) => Promise<unknown>;
  picked?: number | null;
  onPick?: (start: number | null) => void;
  // A reel's beats (engine/beats.ts): a strip of markers, the current one lit; a click steps to it.
  beats?: Beat[];
  beat?: number;
  onBeat?: (i: number) => void;
}> = ({ r, words, time, selection, camera, music, onSeek, onSelect, onDropClip, drafts = [], cut, bin, clipWords, levels, segment, onSegment, onCut, onShotStart, picked = null, onPick, beats = [], beat = -1, onBeat }) => {
  const [ghost, setGhost] = useState<{ at: number; length: number } | null>(null);
  // A cut being trimmed shows live while the drag lasts, and until the server sends the new one back.
  const [live, setLive] = useState<CutPlan | null>(null);
  useEffect(() => setLive(null), [cut]);
  const shown = live ?? cut;
  const [drag, setDrag] = useState<Drag | null>(null);
  const names = useMemo(() => new Map(bin.map((c) => [c.id, c])), [bin]);
  const box = useRef<HTMLDivElement>(null);
  const sentences = useMemo(() => toSentences(words), [words]);
  // Fit shows the whole video in the visible width; zoom in from there.
  const [view, setView] = useState(1100);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = Math.max(0.3, Math.min(140, (view - 16) / Math.max(1, r.duration)));
  const [zoom, setZoom] = useState<number | null>(null);
  const pps = zoom ?? fit;
  const length = Math.max(r.duration, cutLength(shown));
  const width = length * pps;
  const at = (clientX: number) => {
    const el = box.current!;
    return Math.max(0, Math.min(length, (clientX - el.getBoundingClientRect().left + el.scrollLeft) / pps));
  };

  // Follows the pointer until it is released.
  const follow = (move: (m: PointerEvent) => void, up: (m: PointerEvent) => void) => {
    const end = (m: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      up(m);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  // Trim a segment's edge. The edge snaps to the nearest word edge in its clip, or to a frame with Alt.
  const trim = (e: React.PointerEvent, id: string, edge: "in" | "out") => {
    e.stopPropagation();
    const seg = cut.segments.find((s) => s.id === id)!;
    const x0 = e.clientX;
    let next: CutPlan | null = null;
    follow(
      (m) => {
        const raw = seg[edge] + (m.clientX - x0) / pps;
        const t = m.altKey ? Math.round(raw * 30) / 30 : snapEdge(clipWords[seg.src] ?? [], raw, edge, levels[seg.src]);
        next = trimEdge(cut, id, edge, t, names.get(seg.src)?.duration ?? Infinity);
        setLive(next);
      },
      () => {
        if (next && JSON.stringify(next) !== JSON.stringify(cut)) onCut(next).catch(() => setLive(null));
        else setLive(null);
      },
    );
  };

  // Press on a segment: a click selects it, a drag moves it to another place in the cut.
  const grab = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const x0 = e.clientX;
    let slot = -1;
    follow(
      (m) => {
        if (slot < 0 && Math.abs(m.clientX - x0) < 5) return;
        slot = slotAt(cut, at(m.clientX));
        setDrag({ kind: "move", id, slot });
      },
      () => {
        setDrag(null);
        const from = cut.segments.findIndex((s) => s.id === id);
        if (slot < 0) {
          const s = placed(cut)[from];
          onSegment(id);
          onSelect({ start: s.start, end: s.end, label: names.get(s.src)?.name ?? s.src });
          return;
        }
        const to = slot > from ? slot - 1 : slot;
        if (to !== from) {
          const next = moveSegment(cut, id, to);
          setLive(next);
          onCut(next).catch(() => setLive(null));
        }
      },
    );
  };

  // Trim a b-roll clip's edge: it lands on the word nearest the pointer.
  const trimShot = (e: React.PointerEvent, from: number, edge: "in" | "out") => {
    e.stopPropagation();
    let t = from;
    follow(
      (m) => {
        const raw = at(m.clientX);
        const w = words.reduce((best, x) => (Math.abs(x.start - raw) < Math.abs(best.start - raw) ? x : best), words[0]);
        t = w ? w.start - 0.05 : raw;
        setDrag({ kind: "shot", from, edge, t });
      },
      () => {
        if (Math.abs(t - from) > 0.02) onShotStart(from, t + 0.05).finally(() => setDrag(null));
        else setDrag(null);
      },
    );
  };

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".clip")) return;
    onSegment(null);
    onPick?.(null);
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

  // A visual and the keep shots after it are one clip.
  const clips = useMemo(() => {
    const out: { shot: ResolvedShot; end: number }[] = [];
    r.shots.forEach((s, i) => {
      if (s.keep) return;
      let last = i;
      while (r.shots[last + 1]?.keep) last++;
      out.push({ shot: s, end: r.shots[last].end });
    });
    return out;
  }, [r.shots]);
  const isBroll = (s: ResolvedShot) => s.layout === "cutaway" || s.visual?.kind === "video";
  const isText = (s: ResolvedShot) => s.layout === "over";
  const clip = (c: { shot: ResolvedShot; end: number }, pps: number, cls: string, label: string, edges = false) => {
    // A b-roll edge being dragged shows where it will land.
    const d = drag?.kind === "shot" && (drag.edge === "in" ? drag.from === c.shot.start : drag.from === c.end) ? drag : null;
    const a = d?.edge === "in" ? d.t : c.shot.start;
    const b = d?.edge === "out" ? d.t : c.end;
    return (
    <div
      key={`${c.shot.start}`}
      className={`clip ${cls} ${(picked !== null ? Math.abs(picked - c.shot.start) < 0.01 : selection && Math.abs(selection.start - c.shot.start) < 0.01 && Math.abs(selection.end - c.end) < 0.01) ? "on" : ""}`}
      style={{ left: a * pps, width: Math.max(3, (b - a) * pps - 2) }}
      title={`${clock(c.shot.start)} ${label} · "${c.shot.anchor}"`}
      onClick={() => {
        onSelect({ start: c.shot.start, end: c.end, label: `${label} "${c.shot.anchor}"` });
        onPick?.(c.shot.start);
        // Land where the graphic has settled, so the inspector's changes show as they are typed.
        onSeek(Math.min(c.end - 0.1, c.shot.start + 1.5));
      }}
    >
      {edges && <i className="edge in" title="Drag to trim the start" onPointerDown={(e) => trimShot(e, c.shot.start, "in")} onClick={(e) => e.stopPropagation()} />}
      <b>{label}</b>
      <span>{gist(c.shot.visual) || c.shot.anchor}</span>
      {edges && <i className="edge out" title="Drag to trim the end" onPointerDown={(e) => trimShot(e, c.end, "out")} onClick={(e) => e.stopPropagation()} />}
    </div>
    );
  };

  const tracks: Track[] = [
    ...(beats.length
      ? [{
          id: "beats",
          label: "Beats",
          height: 24,
          render: (pps: number) =>
            beats.map((b, i) => (
              <div
                key={i}
                className={`clip beat ${i === beat ? "on" : ""} ${b.changes[0] === "held" ? "held" : ""}`}
                style={{ left: b.start * pps, width: Math.max(2, (b.end - b.start) * pps - 2) }}
                title={`Beat ${i + 1}, ${clock(b.start)}: ${b.changes.join(", ")}${b.said ? ` · "${b.said}"` : ""}`}
                onClick={() => onBeat?.(i)}
              >
                {(b.end - b.start) * pps > 18 && <b>{i + 1}</b>}
              </div>
            )),
        }]
      : []),
    {
      id: "graphics",
      label: "Graphics",
      height: 44,
      render: (pps) => (
        <>
          {clips.filter((c) => c.shot.visual && !isBroll(c.shot) && !isText(c.shot)).map((c) => clip(c, pps, "graphic", c.shot.visual!.kind))}
          {drafts.map((d) => (
            <div key={d.id} className="clip draft" style={{ left: d.start * pps, width: Math.max(3, (d.end - d.start) * pps - 2) }} title={`Suggested: ${d.reason}`} onClick={() => onSeek(d.start + 0.05)}>
              <b>{d.visual.kind}?</b>
              <span>{d.reason}</span>
            </div>
          ))}
        </>
      ),
    },
    ...(clips.some((c) => isText(c.shot)) ? [{ id: "text", label: "Text", height: 34, render: (pps: number) => clips.filter((c) => isText(c.shot)).map((c) => clip(c, pps, "text", c.shot.visual?.kind === "lower" ? "lower third" : c.shot.visual?.kind ?? "text")) }] : []),
    ...(clips.some((c) => isBroll(c.shot)) ? [{ id: "broll", label: "B-roll", height: 34, render: (pps: number) => clips.filter((c) => isBroll(c.shot)).map((c) => clip(c, pps, "broll", "b-roll", true)) }] : []),
    {
      id: "aroll",
      label: "A-roll",
      height: 40,
      render: (pps) => {
        const segs = placed(shown);
        const slot = drag?.kind === "move" ? drag.slot : -1;
        return (
          <>
            {camera?.map(([a, b], i) => <div key={i} className="tbar camera" style={{ left: a * pps, width: (b - a) * pps }} title="On camera: graphics go here" />)}
            {segs.map((s) => {
              const clip = names.get(s.src);
              return (
                <div
                  key={s.id}
                  className={`clip seg ${segment === s.id ? "on" : ""} ${drag?.kind === "move" && drag.id === s.id ? "moving" : ""}`}
                  style={{ left: s.start * pps, width: Math.max(3, (s.end - s.start) * pps - 2) }}
                  title={`${clip?.name ?? s.src}, ${clock(s.in)} to ${clock(s.out)}. Drag to move, drag an edge to trim (Alt: by frame), Delete to remove.`}
                  onPointerDown={(e) => grab(e, s.id)}
                >
                  <i className="edge in" onPointerDown={(e) => trim(e, s.id, "in")} />
                  <b>{clip?.name.replace(/\.\w+$/, "") ?? s.src}</b>
                  <span>{clock(s.in)}</span>
                  <i className="edge out" onPointerDown={(e) => trim(e, s.id, "out")} />
                </div>
              );
            })}
            {slot >= 0 && <div className="slot" style={{ left: (segs[slot]?.start ?? cutLength(shown)) * pps - 1 }} />}
            {clips.filter((c) => c.shot.layout === "punch").map((c) => <div key={c.shot.start} className="tbar punch" style={{ left: c.shot.start * pps, width: (c.end - c.shot.start) * pps }} title="Punch-in" />)}
          </>
        );
      },
    },
    {
      id: "said",
      label: "Said",
      height: 40,
      render: (pps) =>
        sentences.map((x, i) => (
          <div key={i} className={`sentence ${time >= x.start && time < x.end ? "now" : ""}`} style={{ left: x.start * pps, width: Math.max(4, (x.end - x.start) * pps - 3) }} title={`${clock(x.start)} ${x.text}`}>
            {x.text}
          </div>
        )),
    },
    ...(music ? [{ id: "music", label: "Music", height: 22, render: (pps: number) => <div className="tbar music" style={{ left: 0, width: r.duration * pps }} /> }] : []),
    ...(r.sfx.length ? [{ id: "sfx", label: "Sound", height: 22, render: (pps: number) => r.sfx.map((s, i) => <div key={i} className="sfx" style={{ left: s.t * pps }} title={s.kind} />) }] : []),
  ];

  const step = pps < 1 ? 120 : pps < 3 ? 60 : pps < 12 ? 30 : pps < 30 ? 15 : pps < 70 ? 5 : 1;
  const ticks = Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => i * step);

  return (
    <div className="timeline">
      <div className="tl-bar">
        <span className="time">
          {clock(time)} <span className="muted">/ {clock(r.duration)}</span>
        </span>
        {selection && (
          <span className="muted small">
            Selected {clock(selection.start)} to {clock(selection.end)}
          </span>
        )}
        <span className="spacer" />
        <label className="zoom">
          Zoom
          <input type="range" min={Math.log(0.3)} max={Math.log(200)} step={0.01} value={Math.log(pps)} onChange={(e) => setZoom(Math.exp(+e.target.value))} />
        </label>
        <button className="quiet small" onClick={() => setZoom(null)}>
          Fit
        </button>
      </div>
      <div className="tl-body">
        <div className="heads">
          <div className="head ruler-head" />
          {tracks.map((t) => (
            <div key={t.id} className="head" style={{ height: t.height }}>
              {t.label}
            </div>
          ))}
        </div>
        <div
          className="lanes-scroll"
          ref={box}
          onPointerDown={down}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(SOURCE)) {
              // A clip from the bin goes in between segments, where the line shows.
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDrag({ kind: "move", id: "", slot: slotAt(cut, at(e.clientX)) });
              return;
            }
            if (!e.dataTransfer.types.includes(CLIP)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setGhost((g) => ({ at: at(e.clientX), length: g?.length ?? 3 }));
          }}
          onDragLeave={() => (setGhost(null), setDrag(null))}
          onDrop={(e) => {
            const source = e.dataTransfer.getData(SOURCE);
            if (source) {
              e.preventDefault();
              setDrag(null);
              const { src, length } = JSON.parse(source) as { src: string; length: number };
              const next = insertSegment(cut, src, 0, length, slotAt(cut, at(e.clientX)));
              setLive(next);
              onCut(next).catch(() => setLive(null));
              return;
            }
            const raw = e.dataTransfer.getData(CLIP);
            setGhost(null);
            if (!raw) return;
            e.preventDefault();
            const { ref, length } = JSON.parse(raw) as { ref: string; length: number };
            onDropClip(ref, at(e.clientX), length);
          }}
        >
          <div className="lanes" style={{ width }}>
            <div className="ruler">
              {ticks.map((t) => (
                <span key={t} style={{ left: t * pps }}>
                  {clock(t).replace(/\.0$/, "")}
                </span>
              ))}
            </div>
            {tracks.map((t) => (
              <div key={t.id} className={`track ${t.id}`} style={{ height: t.height }}>
                {t.render(pps)}
              </div>
            ))}
            {selection && <div className="selection" style={{ left: selection.start * pps, width: (selection.end - selection.start) * pps }} />}
            <div className="playhead" style={{ left: time * pps }} />
            {ghost && <div className="ghost" style={{ left: ghost.at * pps, width: Math.max(6, ghost.length * pps) }} />}
          </div>
        </div>
      </div>
    </div>
  );
};

// The words a graphic shows, short: its title or text, else its first item. Labels clips on the
// timeline and rows in the graphics list, where the kind alone ("list") says little.
export function gist(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  for (const k of ["text", "title", "label", "value", "keyword", "name", "number"]) if (typeof o[k] === "string" && o[k]) return (o[k] as string).replace(/\*/g, "");
  for (const x of Object.values(o)) if (Array.isArray(x) && x.length) return x.map((i) => gist(i) || (typeof i === "string" ? i : "")).filter(Boolean).slice(0, 3).join(" · ");
  return "";
}

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
