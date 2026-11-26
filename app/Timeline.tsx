import { Thumbnail } from "@remotion/player";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { compositionFor } from "../effects/canvas";
import { settledTime, shotPlan } from "../effects/preview";
import { type Beat, beatAt } from "../engine/beats";
import { atTime, cutLength, insertSegment, type Levels, moveSegment, placed, slotAt, snapEdge, splitAt, trimEdge } from "../engine/cut";
import { partFile } from "../engine/parts";
import type { CutPlan, Resolved, ResolvedShot, Word } from "../engine/schema";
import { lastKept } from "../engine/resolve";
import { type BinClip, clock, type Suggestion } from "./api";
import { ask } from "./dialog";
import { levelValue, type Strip, stripTiles, wavePath } from "./film";
import { component } from "./Gallery";
import { playhead, usePlayhead } from "./playhead";

export type Range = { start: number; end: number; label?: string };

// The drag type for a clip from the library panel.
export const CLIP = "application/x-studio-clip";
// The drag type for a clip from the project's bin, cut in on the A-roll track.
export const SOURCE = "application/x-studio-source";

// A drag on the timeline: a segment being moved, a clip from the bin going in, or a b-roll clip's edge.
type Drag =
  | { kind: "move"; id: string; slot: number }
  | { kind: "insert"; t: number }
  | { kind: "shot"; from: number; edge: "in" | "out"; t: number };

type Track = { id: string; label: string; height: number; render: (pps: number) => React.ReactNode };

// The edit as tracks, like an editor: graphics, text, b-roll, the A-roll (the cut), what is said,
// captions, music and sound. Click empty space to move the playhead, drag to select a section, click
// a clip to select it. The selection is what Claude gets as "this".
// The A-roll track edits the cut: drop a clip from the bin where it should go in, drag a segment to reorder it, drag its
// edges to trim (snapping to word edges and the pause beside them; hold Alt for frame-accurate). B-roll clips trim the same way.
// Each change goes to the server as a new cut.json, so it is a version that undo and redo step through.
export const Timeline: React.FC<{
  r: Resolved;
  words: Word[];
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
  // The graphic open in the inspector, by its id.
  picked?: string | null;
  onPick?: (id: string | null) => void;
  // A reel's beats (engine/beats.ts): a strip of markers, the current one lit; a click steps to it.
  beats?: Beat[];
  onBeat?: (i: number) => void;
  // The review's open notes, each where its words are now.
  notes?: { id: string; t: number; text: string; status: string }[];
  // The video's parts: finished renders by file name, a render running, and the edits and renders.
  previews?: Record<string, { file: string; at: number }>;
  rendering?: boolean;
  onParts?: (change: { add?: { name: string; at: number }; rename?: { name: string; to: string }; remove?: string }) => void;
  onRender?: (ask: { part?: string; from?: number; to?: number }) => void;
  // The film itself: a filmstrip per clip (media/strip.ts).
  strips?: Record<string, Strip>;
  // Skimming (S): the viewer follows the pointer over the lanes (null when it leaves).
  skim?: boolean;
  onSkim?: (t: number | null) => void;
}> = ({ r, words, selection, camera, music, onSeek, onSelect, onDropClip, drafts = [], cut, bin, clipWords, levels, segment, onSegment, onCut, onShotStart, picked = null, onPick, beats = [], onBeat, notes = [], previews = {}, rendering = false, onParts, onRender, strips = {}, skim = false, onSkim }) => {
  // The timeline is redrawn when the playhead crosses into another beat, not on every frame; the
  // playhead line, the clock and the sentence being said redraw on their own.
  const beat = usePlayhead((t) => beatAt(beats, t));
  const [ghost, setGhost] = useState<{ at: number; length: number } | null>(null);
  // A cut being trimmed shows live while the drag lasts, and until the server sends the new one back.
  const [live, setLive] = useState<CutPlan | null>(null);
  useEffect(() => setLive(null), [cut]);
  const shown = live ?? cut;
  const [drag, setDrag] = useState<Drag | null>(null);
  const names = useMemo(() => new Map(bin.map((c) => [c.id, c])), [bin]);
  const box = useRef<HTMLDivElement>(null);
  const skimLine = useRef<HTMLDivElement>(null);
  // Turning skimming off puts the viewer back on the playhead.
  useEffect(() => {
    if (!skim && skimLine.current) skimLine.current.style.display = "none";
  }, [skim]);
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

  // Follows the pointer until it is released, cancelled, or the timeline unmounts.
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanup.current?.(), []);
  const follow = (move: (m: PointerEvent) => void, up: (m: PointerEvent) => void, cancel?: () => void) => {
    dragCleanup.current?.();
    const detach = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (dragCleanup.current === detach) dragCleanup.current = null;
    };
    const onUp = (m: PointerEvent) => {
      detach();
      up(m);
    };
    const onCancel = () => {
      detach();
      cancel?.();
    };
    dragCleanup.current = detach;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  // Trim a segment's edge. The edge snaps to the nearest word edge in its clip, or to a frame with Alt.
  const trim = (e: React.PointerEvent, id: string, edge: "in" | "out") => {
    if (e.button !== 0) return;
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
      () => setLive(null),
    );
  };

  // Where a clip from the bin goes in when dropped at the pointer: on the edge between two segments
  // when the pointer is near one, else inside the segment under it, split on the pause between words
  // nearest the pointer. `split` is the timeline time to split at, when there is one.
  const insertAt = (clientX: number): { t: number; slot: number; split?: number } => {
    const t = at(clientX);
    const segs = placed(cut);
    const edges = [0, ...segs.map((s) => s.end)];
    const k = edges.reduce((best, e, i) => (Math.abs(e - t) < Math.abs(edges[best] - t) ? i : best), 0);
    const hit = atTime(cut, t);
    if (!hit || Math.abs(edges[k] - t) * pps <= 12) return { t: edges[k], slot: k };
    const local = snapEdge(clipWords[hit.seg.src] ?? [], hit.local, "out", levels[hit.seg.src]);
    if (local - hit.seg.in < 0.2 || hit.seg.out - local < 0.2) return { t: edges[k], slot: k };
    const split = hit.seg.start + local - hit.seg.in;
    return { t: split, slot: hit.index + 1, split };
  };

  // Press on a segment: a click selects it, a drag moves it to another place in the cut.
  const grab = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
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
      () => setDrag(null),
    );
  };

  // Trim a b-roll clip's edge: it lands on the word nearest the pointer.
  const trimShot = (e: React.PointerEvent, from: number, edge: "in" | "out") => {
    if (e.button !== 0) return;
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
      () => setDrag(null),
    );
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".clip")) return;
    onSegment(null);
    onPick?.(null);
    const start = at(e.clientX);
    let moved = false;
    follow(
      (m) => {
        const t = at(m.clientX);
        if (Math.abs(t - start) * pps > 4) moved = true;
        if (moved) onSelect({ start: Math.min(start, t), end: Math.max(start, t) });
      },
      () => {
        if (!moved) {
          onSelect(null);
          onSeek(start);
        }
      },
    );
  };

  // A visual and the keep shots after it are one clip.
  const clips = useMemo(() => {
    const out: { shot: ResolvedShot; end: number; index: number; hash: string }[] = [];
    r.shots.forEach((s, i) => {
      if (s.keep) return;
      const last = lastKept(r.shots, i);
      out.push({ shot: s, end: r.shots[last].end, index: i, hash: JSON.stringify(s) });
    });
    return out;
  }, [r.shots]);
  const isBroll = (s: ResolvedShot) => s.layout === "cutaway" || s.visual?.kind === "video";
  const isText = (s: ResolvedShot) => s.layout === "over";
  const clip = (c: { shot: ResolvedShot; end: number; index: number; hash: string }, pps: number, cls: string, label: string, edges = false, thumb = false) => {
    // A b-roll edge being dragged shows where it will land.
    const d = drag?.kind === "shot" && (drag.edge === "in" ? drag.from === c.shot.start : drag.from === c.end) ? drag : null;
    const a = d?.edge === "in" ? d.t : c.shot.start;
    const b = d?.edge === "out" ? d.t : c.end;
    return (
    <div
      key={`${c.shot.start}`}
      className={`clip ${cls} ${(picked !== null ? picked === c.shot.id : selection && Math.abs(selection.start - c.shot.start) < 0.01 && Math.abs(selection.end - c.end) < 0.01) ? "on" : ""}`}
      style={{ left: a * pps, width: Math.max(3, (b - a) * pps - 2) }}
      title={`${clock(c.shot.start)} ${label} · "${c.shot.anchor}"`}
      onClick={() => {
        onSelect({ start: c.shot.start, end: c.end, label: `${label} "${c.shot.anchor}"` });
        onPick?.(c.shot.id ?? null);
        // Land where the graphic has settled, so the inspector's changes show as they are typed.
        onSeek(Math.min(c.end - 0.1, c.shot.start + 1.5));
      }}
    >
      {edges && <i className="edge in" title="Drag to trim the start" onPointerDown={(e) => trimShot(e, c.shot.start, "in")} onClick={(e) => e.stopPropagation()} />}
      {thumb && (b - a) * pps > 64 && <ShotThumb r={r} index={c.index} hash={c.hash} root={box} />}
      <div className="words">
        <b>{label}</b>
        <span>{gist(c.shot.visual) || c.shot.anchor}</span>
      </div>
      {edges && <i className="edge out" title="Drag to trim the end" onPointerDown={(e) => trimShot(e, c.end, "out")} onClick={(e) => e.stopPropagation()} />}
    </div>
    );
  };

  const parts = r.parts ?? [];
  const part = selection ? parts.find((x) => Math.abs(x.start - selection.start) < 0.01 && Math.abs(x.end - selection.end) < 0.01) : undefined;
  const preview = part ? previews[partFile(part.name)] : undefined;
  const addPart = async () => {
    // Where the playhead is now, not when the name has been typed: it may still be playing.
    const at = playhead.get();
    const name = await ask({ title: "Name this part", body: `It starts on the next word after ${clock(at)} and runs to the next part.`, value: parts.length ? `part ${parts.length}` : "intro", ok: "Add part" });
    if (name) onParts?.({ add: { name, at } });
  };

  const tracks: Track[] = [
    ...(parts.length
      ? [{
          id: "parts",
          label: "Parts",
          height: 24,
          render: (pps: number) =>
            parts.map((x) => (
              <div
                key={x.name}
                className={`clip part ${part?.name === x.name ? "on" : ""}`}
                style={{ left: x.start * pps, width: Math.max(3, (x.end - x.start) * pps - 2) }}
                title={`${x.name}, ${clock(x.start)} to ${clock(x.end)} · "${x.anchor}"`}
                onClick={() => {
                  onSelect({ start: x.start, end: x.end, label: `part "${x.name}"` });
                  onSeek(x.start);
                }}
              >
                <b>{x.name}</b>
                <span>{clock(x.end - x.start)}</span>
              </div>
            )),
        }]
      : []),
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
      height: 50,
      render: (pps) => (
        <>
          {clips.filter((c) => c.shot.visual && !isBroll(c.shot) && !isText(c.shot)).map((c) => clip(c, pps, `graphic ${kindGroup(c.shot.visual!.kind)}`, c.shot.visual!.kind, false, true))}
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
      height: 52,
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
                  <Film strip={strips[s.src]} levels={levels[s.src]} inSec={s.in} outSec={s.out} width={Math.max(3, (s.end - s.start) * pps - 2)} pps={pps} />
                  <i className="edge in" onPointerDown={(e) => trim(e, s.id, "in")} />
                  <b>{clip?.name.replace(/\.\w+$/, "") ?? s.src}</b>
                  <i className="edge out" onPointerDown={(e) => trim(e, s.id, "out")} />
                </div>
              );
            })}
            {slot >= 0 && <div className="slot" style={{ left: (segs[slot]?.start ?? cutLength(shown)) * pps - 1 }} />}
            {drag?.kind === "insert" && <div className="slot insert" style={{ left: drag.t * pps - 1 }} />}
            {clips.filter((c) => c.shot.layout === "punch").map((c) => <div key={c.shot.start} className="tbar punch" style={{ left: c.shot.start * pps, width: (c.end - c.shot.start) * pps }} title="Punch-in" />)}
          </>
        );
      },
    },
    {
      id: "said",
      label: "Said",
      height: 40,
      render: (pps) => <Said sentences={sentences} pps={pps} />,
    },
    ...(notes.length
      ? [{
          id: "notes",
          label: "Notes",
          height: 22,
          render: (pps: number) =>
            notes.map((n) => (
              <div key={n.id} className={`note-pin ${n.status}`} style={{ left: n.t * pps }} title={`${clock(n.t)} ${n.text}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => onSeek(n.t)}>
                {n.text}
              </div>
            )),
        }]
      : []),
    ...(music ? [{ id: "music", label: "Music", height: 22, render: (pps: number) => <div className="tbar music" style={{ left: 0, width: r.duration * pps }} title="Music" /> }] : []),
    ...(r.sfx.length ? [{ id: "sfx", label: "Sound", height: 24, render: (pps: number) => r.sfx.map((s, i) => <div key={i} className="sfx" style={{ left: s.t * pps }} title={`${s.kind} at ${clock(s.t)}`} />) }] : []),
  ];

  const step = pps < 1 ? 120 : pps < 3 ? 60 : pps < 12 ? 30 : pps < 30 ? 15 : pps < 70 ? 5 : 1;
  const ticks = Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => i * step);

  return (
    <div className="timeline">
      <div className="tl-bar">
        {selection && (
          <span className="muted small">
            Selected {clock(selection.start)} to {clock(selection.end)}
          </span>
        )}
        {part ? (
          <>
            <button className="small" disabled={rendering} onClick={() => onRender?.({ part: part.name })} title={`Render this part to renders/${partFile(part.name)}, with its graphics and the finished mix`}>
              Render {part.name}
            </button>
            {preview && !rendering && (
              <a className="button small" href={`/${preview.file}?t=${preview.at}`} target="_blank" rel="noreferrer">
                Play render
              </a>
            )}
            <button className="quiet small" onClick={async () => {
              const to = await ask({ title: "Rename this part", value: part.name, ok: "Rename" });
              if (to && to !== part.name) onParts?.({ rename: { name: part.name, to } });
            }}>
              Rename
            </button>
            <button className="quiet small" onClick={() => onParts?.({ remove: part.name })}>
              Remove
            </button>
          </>
        ) : (
          selection && selection.end - selection.start > 0.04 && (
            <button className="small" disabled={rendering} onClick={() => onRender?.({ from: +selection.start.toFixed(3), to: +selection.end.toFixed(3) })} title="Render this stretch, with its graphics and the finished mix">
              Render selection
            </button>
          )
        )}
        <span className="spacer" />
        <button className="quiet small" onClick={addPart} title="Start a new part on the next word after the playhead">
          Add part
        </button>
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
              <TrackIcon id={t.id} />
              {t.label}
            </div>
          ))}
        </div>
        <div
          className="lanes-scroll"
          ref={box}
          onPointerDown={down}
          onPointerMove={(e) => {
            if (!skim || e.buttons || dragCleanup.current) return;
            const t = at(e.clientX);
            onSkim?.(t);
            const line = skimLine.current;
            if (line) (line.style.left = `${t * pps}px`), (line.style.display = "block");
          }}
          onPointerLeave={() => {
            if (skimLine.current) skimLine.current.style.display = "none";
            onSkim?.(null);
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(SOURCE)) {
              // A clip from the bin goes in where the line shows.
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              const t = insertAt(e.clientX).t;
              setDrag((d) => (d?.kind === "insert" && d.t === t ? d : { kind: "insert", t }));
              return;
            }
            if (!e.dataTransfer.types.includes(CLIP)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setGhost((g) => ({ at: at(e.clientX), length: g?.length ?? 3 }));
          }}
          // Only when the pointer leaves the timeline, not when it crosses from one track to another.
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && (setGhost(null), setDrag(null))}
          onDrop={(e) => {
            const source = e.dataTransfer.getData(SOURCE);
            if (source) {
              e.preventDefault();
              setDrag(null);
              const { src, length } = JSON.parse(source) as { src: string; length: number };
              const spot = insertAt(e.clientX);
              const next = insertSegment(spot.split === undefined ? cut : splitAt(cut, spot.split), src, 0, length, spot.slot);
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
              <div key={t.id} className={`track ${t.id} ${t.id === "aroll" && drag?.kind === "insert" ? "dropping" : ""}`} style={{ height: t.height }}>
                {t.render(pps)}
              </div>
            ))}
            {selection && <div className="selection" style={{ left: selection.start * pps, width: (selection.end - selection.start) * pps }} />}
            <Playhead pps={pps} />
            <div className="skimmer" ref={skimLine} />
            {ghost && <div className="ghost" style={{ left: ghost.at * pps, width: Math.max(6, ghost.length * pps) }} />}
          </div>
        </div>
      </div>
    </div>
  );
};

// The playhead line, moved on its own as the video plays.
const Playhead: React.FC<{ pps: number }> = ({ pps }) => <div className="playhead" style={{ left: usePlayhead() * pps }} />;

// What is said, with the sentence under the playhead lit. Redrawn when the playhead moves to another
// sentence, and when the zoom changes.
const Said: React.FC<{ sentences: { start: number; end: number; text: string }[]; pps: number }> = React.memo(({ sentences, pps }) => {
  const now = usePlayhead((t) => sentences.findIndex((x) => t >= x.start && t < x.end));
  return (
    <>
      {sentences.map((x, i) => (
        <div key={i} className={`sentence ${i === now ? "now" : ""} ${(x.end - x.start) * pps < 44 ? "mark" : ""}`} style={{ left: x.start * pps, width: Math.max(3, (x.end - x.start) * pps - 3) }} title={`${clock(x.start)} ${x.text}`}>
          {(x.end - x.start) * pps < 44 ? null : x.text}
        </div>
      ))}
    </>
  );
});

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

// Which colour a graphic takes on the timeline: the real app windows, real pages, cards of words,
// diagrams, and code.
export function kindGroup(kind: string): "app" | "page" | "card" | "diagram" | "code" {
  if (["cli", "claudeapp", "grokbot", "windows"].includes(kind)) return "app";
  if (["image", "gallery", "float", "video", "logos", "logowall"].includes(kind)) return "page";
  if (["flow", "doc", "chart", "prompt", "map", "pipeline", "journey", "funnel", "matrix", "timeline", "compare", "beforeafter", "grid", "bento", "kpi", "ring", "meter", "waffle", "levels"].includes(kind)) return "diagram";
  if (kind === "code") return "code";
  return "card";
}

// Renders its children only once it is near the visible part of the timeline.
const Near: React.FC<{ root: React.RefObject<HTMLDivElement | null>; className: string; children: React.ReactNode }> = ({ root, className, children }) => {
  const el = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!el.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { root: root.current, rootMargin: "0px 300px" });
    io.observe(el.current);
    return () => io.disconnect();
  }, [root]);
  return <div ref={el} className={className}>{near && children}</div>;
};

// A graphic's settled frame, alone (no footage), small, at the left of its clip. A reel's split
// shows its top half, where the graphic is; anything else its middle. Drawn again only when the
// shot itself changes.
const ShotThumb: React.FC<{ r: Resolved; index: number; hash: string; root: React.RefObject<HTMLDivElement | null> }> = React.memo(
  ({ r, index, root }) => {
    const shot = r.shots[index];
    const plan = useMemo(() => shotPlan(r, index, false), [r, index]);
    const comp = compositionFor(r.canvas);
    const reel = r.canvas !== "youtube";
    // Drawn a little wider than its box and cropped, so the graphic itself fills it. A reel's split
    // is centred on its top panel (the top 45% of the frame); anything else on the frame's middle.
    const w = reel ? 76 : 72;
    const h = (w * comp.height) / comp.width;
    const top = -Math.max(0, h * (reel && shot.layout === "split" ? 0.225 : 0.5) - 21);
    const frames = Math.max(1, Math.round(r.duration * r.fps));
    return (
      <Near root={root} className="thumb">
        <div style={{ width: w, height: h, marginTop: top }}>
          <Thumbnail component={component(plan)} inputProps={plan} durationInFrames={frames} fps={r.fps} compositionWidth={comp.width} compositionHeight={comp.height}
            style={{ width: w, height: h }} frameToDisplay={Math.min(frames - 1, Math.round(settledTime(shot) * r.fps))} />
        </div>
      </Near>
    );
  },
  (a, b) => a.hash === b.hash && a.index === b.index && a.r.canvas === b.r.canvas && a.r.duration === b.r.duration,
);

// A segment's frames and its voice, drawn under its name.
const Film: React.FC<{ strip?: Strip; levels?: Levels; inSec: number; outSec: number; width: number; pps: number }> = React.memo(({ strip, levels, inSec, outSec, width, pps }) => {
  const height = 52 - 8;
  const tiles = strip ? stripTiles(strip, inSec, width, pps, height) : null;
  const wave = levels ? wavePath(levelValue(levels.db, levels.quiet), levels.db.length, levels.rate, inSec, outSec, width, 18) : "";
  return (
    <div className="film" aria-hidden>
      {tiles?.tiles.map((t, i) => (
        <i key={i} style={{ left: t.x, width: tiles.tile, backgroundImage: `url(/${strip!.file})`, backgroundSize: `${strip!.count * tiles.tile}px ${height}px`, backgroundPosition: `${t.pos}px 0` }} />
      ))}
      {wave && (
        <svg className="wave" width={width} height={18} viewBox={`0 0 ${width} 18`} preserveAspectRatio="none">
          <path d={wave} />
        </svg>
      )}
    </div>
  );
});

const TrackIcon: React.FC<{ id: string }> = ({ id }) => {
  const path: Record<string, React.ReactNode> = {
    parts: <path d="M3 3.5h10M3 8h10M3 12.5h6" />,
    beats: <path d="M3 4v8M6.5 4v8M10 4v8M13.5 4v8" />,
    graphics: <><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><path d="M2.5 10l3-3 3 3 2-2 3 3" /></>,
    text: <path d="M3.5 4h9M8 4v8.5" />,
    broll: <><rect x="2.5" y="4" width="8" height="8" rx="1.5" /><path d="M10.5 7l3-1.5v5L10.5 9" /></>,
    aroll: <><rect x="2.5" y="4" width="8" height="8" rx="1.5" /><path d="M10.5 7l3-1.5v5L10.5 9" /></>,
    said: <path d="M3 5h10M3 8h7M3 11h9" />,
    notes: <path d="M4 2.5v11M4 3h8l-2 2.5 2 2.5H4" />,
    music: <><path d="M6 11.5V4l7-1.5V10" /><circle cx="4.5" cy="11.5" r="1.5" /><circle cx="11.5" cy="10" r="1.5" /></>,
    sfx: <path d="M3 6.5v3h2.5L9 12.5v-9L5.5 6.5zM11 6a2.5 2.5 0 010 4" />,
  };
  return (
    <svg className="ticon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path[id] ?? null}
    </svg>
  );
};
