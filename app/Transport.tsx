import type { PlayerRef } from "@remotion/player";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { SAFE } from "../engine/qc";
import { clock } from "./api";
import { Clock } from "./playhead";

// The viewer's own controls, in place of the player's: play, a frame back and forward, the time,
// then the safe area, the frame's shape and full screen. The keys (Space, J K L, arrows) stay in
// the editor.

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const PlayIcon = () => <Svg><path d="M5 3.2v9.6L12.6 8z" fill="currentColor" stroke="none" /></Svg>;
const PauseIcon = () => <Svg><rect x="4" y="3.2" width="2.6" height="9.6" rx=".6" fill="currentColor" stroke="none" /><rect x="9.4" y="3.2" width="2.6" height="9.6" rx=".6" fill="currentColor" stroke="none" /></Svg>;
const BackIcon = () => <Svg><path d="M4 3.5v9" /><path d="M12 3.8v8.4L6.2 8z" fill="currentColor" stroke="none" /></Svg>;
const ForwardIcon = () => <Svg><path d="M12 3.5v9" /><path d="M4 3.8v8.4L9.8 8z" fill="currentColor" stroke="none" /></Svg>;
const SafeIcon = () => <Svg><rect x="1.8" y="2.5" width="12.4" height="11" rx="1.6" /><rect x="4.3" y="5" width="7.4" height="6" rx=".6" strokeDasharray="1.6 1.4" /></Svg>;
const FullIcon = () => <Svg><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></Svg>;

// Whether the player is playing, from its own events.
export function usePlaying(player: React.RefObject<PlayerRef | null>, key: unknown) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const pl = player.current;
    if (!pl) return;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    pl.addEventListener("play", on);
    pl.addEventListener("pause", off);
    pl.addEventListener("ended", off);
    setPlaying(pl.isPlaying());
    return () => {
      pl.removeEventListener("play", on);
      pl.removeEventListener("pause", off);
      pl.removeEventListener("ended", off);
    };
  }, [player, key]);
  return playing;
}

// The largest box of `aspect` (width / height) that fits in `el`, less its padding, so what is drawn
// over the picture (the safe area) sits on it exactly.
// `key` changes when the element may first appear.
export function useFit(el: React.RefObject<HTMLElement | null>, aspect: number, key: unknown) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const measure = () => {
      const cs = getComputedStyle(node);
      const w = node.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = node.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const width = Math.max(0, Math.floor(Math.min(w, h * aspect)));
      setBox((b) => (b.width === width ? b : { width, height: Math.floor(width / aspect) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [el, aspect, key]);
  return box;
}

// The safe area as a box over the picture, from the same numbers QC measures with.
export const SafeArea: React.FC = () => (
  <div className="safe" style={{ left: `${SAFE.x * 100}%`, right: `${SAFE.x * 100}%`, top: `${SAFE.top * 100}%`, bottom: `${SAFE.bottom * 100}%` }} />
);

export const Transport: React.FC<{
  player: React.RefObject<PlayerRef | null>;
  ready: unknown;
  duration: number;
  rate: number;
  aspect: string;
  safe: boolean;
  onSafe: () => void;
  onFrame: (dir: -1 | 1) => void;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ player, ready, duration, rate, aspect, safe, onSafe, onFrame, onToggle, children }) => {
  const playing = usePlaying(player, ready);
  return (
    <div className="transport">
      <button className="icon" onClick={() => onFrame(-1)} title="A frame back (←)" aria-label="A frame back"><BackIcon /></button>
      <button className="icon play" onClick={onToggle} title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button className="icon" onClick={() => onFrame(1)} title="A frame forward (→)" aria-label="A frame forward"><ForwardIcon /></button>
      <span className="when">
        <Clock /> <span className="muted">/ {clock(duration)}</span>
      </span>
      {rate !== 1 && <span className="rate">{rate}×</span>}
      {children}
      <span className="spacer" />
      <span className="aspect" title="The frame's shape">{aspect}</span>
      <button className={`icon ${safe ? "on" : ""}`} onClick={onSafe} title={`${safe ? "Hide" : "Show"} the safe area every graphic stays inside (G)`} aria-label="Safe area" aria-pressed={safe}><SafeIcon /></button>
      <button className="icon" onClick={() => player.current?.requestFullscreen()} title="Full screen" aria-label="Full screen"><FullIcon /></button>
    </div>
  );
};
