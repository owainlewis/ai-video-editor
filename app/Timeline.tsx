import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Resolved, ResolvedShot, Word } from "../engine/schema";
import { clock, type Suggestion } from "./api";

export type Range = { start: number; end: number; label?: string };

// The drag type for a clip from the library panel.
export const CLIP = "application/x-studio-clip";

type Track = { id: string; label: string; height: number; render: (pps: number) => React.ReactNode };

// The edit as tracks, like an editor: graphics, text, b-roll, the picture, what is said, captions,
// music and sound. Click empty space to move the playhead, drag to select a section, click a clip
// to select it. The selection is what Claude gets as "this".
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
}> = ({ r, words, time, selection, camera, music, onSeek, onSelect, onDropClip, drafts = [] }) => {
  const [ghost, setGhost] = useState<{ at: number; length: number } | null>(null);
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
  const width = r.duration * pps;
  const at = (clientX: number) => {
    const el = box.current!;
    return Math.max(0, Math.min(r.duration, (clientX - el.getBoundingClientRect().left + el.scrollLeft) / pps));
  };

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".clip")) return;
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
  const clip = (c: { shot: ResolvedShot; end: number }, pps: number, cls: string, label: string) => (
    <div
      key={`${c.shot.start}`}
      className={`clip ${cls} ${selection && Math.abs(selection.start - c.shot.start) < 0.01 && Math.abs(selection.end - c.end) < 0.01 ? "on" : ""}`}
      style={{ left: c.shot.start * pps, width: Math.max(3, (c.end - c.shot.start) * pps - 2) }}
      title={`${clock(c.shot.start)} ${label} · "${c.shot.anchor}"`}
      onClick={() => {
        onSelect({ start: c.shot.start, end: c.end, label: `${label} "${c.shot.anchor}"` });
        onSeek(c.shot.start + 0.05);
      }}
    >
      <b>{label}</b>
      <span>{c.shot.anchor}</span>
    </div>
  );

  const tracks: Track[] = [
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
    { id: "text", label: "Text", height: 34, render: (pps) => clips.filter((c) => isText(c.shot)).map((c) => clip(c, pps, "text", c.shot.visual?.kind === "title" ? "title" : "lower third")) },
    { id: "broll", label: "B-roll", height: 34, render: (pps) => clips.filter((c) => isBroll(c.shot)).map((c) => clip(c, pps, "broll", "b-roll")) },
    {
      id: "picture",
      label: "Picture",
      height: 34,
      render: (pps) => (
        <>
          <div className="tbar picture" style={{ left: 0, width: r.duration * pps }} />
          {camera?.map(([a, b], i) => <div key={i} className="tbar camera" style={{ left: a * pps, width: (b - a) * pps }} title="On camera: graphics go here" />)}
          {clips.filter((c) => c.shot.layout === "punch").map((c) => <div key={c.shot.start} className="tbar punch" style={{ left: c.shot.start * pps, width: (c.end - c.shot.start) * pps }} title="Punch-in" />)}
        </>
      ),
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
    ...(r.captions ? [{ id: "captions", label: "Captions", height: 22, render: (pps: number) => r.chunks.map((c, i) => <div key={i} className="tbar caption" style={{ left: c.start * pps, width: Math.max(2, (c.end - c.start) * pps - 1) }} />) }] : []),
    ...(music ? [{ id: "music", label: "Music", height: 22, render: (pps: number) => <div className="tbar music" style={{ left: 0, width: r.duration * pps }} /> }] : []),
    { id: "sfx", label: "Sound", height: 22, render: (pps) => r.sfx.map((s, i) => <div key={i} className="sfx" style={{ left: s.t * pps }} title={s.kind} />) },
  ];

  const step = pps < 1 ? 120 : pps < 3 ? 60 : pps < 12 ? 30 : pps < 30 ? 15 : pps < 70 ? 5 : 1;
  const ticks = Array.from({ length: Math.floor(r.duration / step) + 1 }, (_, i) => i * step);

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
            if (!e.dataTransfer.types.includes(CLIP)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setGhost((g) => ({ at: at(e.clientX), length: g?.length ?? 3 }));
          }}
          onDragLeave={() => setGhost(null)}
          onDrop={(e) => {
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
