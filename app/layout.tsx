import React, { useEffect, useRef, useState } from "react";

// The editor's workspace: the library on the left, the viewer in the middle, Claude or the
// inspector on the right, the timeline across the bottom. Each panel can be dragged to a new size
// or hidden, as in Final Cut, so the viewer gets the room when Owain is watching. Sizes are kept
// per kind of video (a reel wants height, a YouTube video wants width), in this browser only.

export type Panels = { left: number; right: number; bottom: number; showLeft: boolean; showRight: boolean; showBottom: boolean };
type Kind = "reel" | "youtube";

const DEFAULTS: Record<Kind, Panels> = {
  reel: { left: 280, right: 340, bottom: 300, showLeft: true, showRight: true, showBottom: true },
  youtube: { left: 280, right: 340, bottom: 300, showLeft: true, showRight: true, showBottom: true },
};
// What a drag may reach. The viewer always keeps room in the middle.
const LIMITS = { left: [240, 480], right: [280, 560], bottom: [150, 560] } as const;
const VIEWER_MIN = { width: 280, height: 220 };

const key = (kind: Kind) => `studio-panels-${kind}`;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.round(Math.max(lo, Math.min(hi, v)));

const load = (kind: Kind): Panels => {
  try {
    const kept = JSON.parse(localStorage.getItem(key(kind)) ?? "null");
    if (!kept) return DEFAULTS[kind];
    const p = { ...DEFAULTS[kind], ...kept };
    return { ...p, left: clamp(p.left, LIMITS.left), right: clamp(p.right, LIMITS.right), bottom: clamp(p.bottom, LIMITS.bottom) };
  } catch {
    return DEFAULTS[kind];
  }
};

export function usePanels(kind: Kind) {
  const [panels, setPanels] = useState<Panels>(() => load(kind));
  useEffect(() => setPanels(load(kind)), [kind]);
  const set = (change: Partial<Panels>) =>
    setPanels((old) => {
      const next = { ...old, ...change };
      try {
        localStorage.setItem(key(kind), JSON.stringify(next));
      } catch {
        // A browser that keeps nothing still resizes for this visit.
      }
      return next;
    });
  const toggle = (which: "showLeft" | "showRight" | "showBottom") => set({ [which]: !panels[which] });
  const reset = (which: "left" | "right" | "bottom") => set({ [which]: DEFAULTS[kind][which] });
  return { panels, set, toggle, reset };
}

// The grid's sizes, as CSS variables on the editor. A hidden panel takes no room.
export const panelStyle = (p: Panels): React.CSSProperties =>
  ({
    "--left": p.showLeft ? `${p.left}px` : "0px",
    "--right": p.showRight ? `${p.right}px` : "0px",
    "--bottom": p.showBottom ? `${p.bottom}px` : "0px",
  }) as React.CSSProperties;

// The three edges a panel is dragged by. They sit over the lines between panels; a double click
// puts that panel back to its usual size.
export const Splitters: React.FC<{ panels: Panels; set: (c: Partial<Panels>) => void; reset: (w: "left" | "right" | "bottom") => void }> = ({ panels, set, reset }) => {
  const box = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"left" | "right" | "bottom" | null>(null);
  const start = (which: "left" | "right" | "bottom") => (e: React.PointerEvent) => {
    const editor = box.current?.parentElement;
    if (!editor || e.button !== 0) return;
    e.preventDefault();
    const rect = editor.getBoundingClientRect();
    setDragging(which);
    const move = (ev: PointerEvent) => {
      if (which === "left") {
        const room = rect.width - (panels.showRight ? panels.right : 0) - VIEWER_MIN.width;
        set({ left: clamp(Math.min(ev.clientX - rect.left, room), LIMITS.left) });
      } else if (which === "right") {
        const room = rect.width - (panels.showLeft ? panels.left : 0) - VIEWER_MIN.width;
        set({ right: clamp(Math.min(rect.right - ev.clientX, room), LIMITS.right) });
      } else {
        set({ bottom: clamp(Math.min(rect.bottom - ev.clientY, rect.height - VIEWER_MIN.height), LIMITS.bottom) });
      }
    };
    const up = () => {
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div ref={box} className={`splitters ${dragging ? `dragging drag-${dragging}` : ""}`}>
      {panels.showLeft && <div className="split split-col split-left" onPointerDown={start("left")} onDoubleClick={() => reset("left")} title="Drag to resize the library. Double-click for its usual size." />}
      {panels.showRight && <div className="split split-col split-right" onPointerDown={start("right")} onDoubleClick={() => reset("right")} title="Drag to resize the panel. Double-click for its usual size." />}
      {panels.showBottom && <div className="split split-row split-bottom" onPointerDown={start("bottom")} onDoubleClick={() => reset("bottom")} title="Drag to resize the timeline. Double-click for its usual size." />}
    </div>
  );
};

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const LeftIcon: React.FC<{ on: boolean }> = ({ on }) => <Svg><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><rect x="1.5" y="2.5" width="4.5" height="11" rx="2" fill={on ? "currentColor" : "none"} /></Svg>;
const RightIcon: React.FC<{ on: boolean }> = ({ on }) => <Svg><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><rect x="10" y="2.5" width="4.5" height="11" rx="2" fill={on ? "currentColor" : "none"} /></Svg>;
const BottomIcon: React.FC<{ on: boolean }> = ({ on }) => <Svg><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><rect x="1.5" y="9" width="13" height="4.5" rx="2" fill={on ? "currentColor" : "none"} /></Svg>;

// The buttons in the header that show and hide each panel, with their keys (⌘1 ⌘2 ⌘3).
export const PanelToggles: React.FC<{ panels: Panels; toggle: (w: "showLeft" | "showRight" | "showBottom") => void }> = ({ panels, toggle }) => (
  <span className="panel-toggles">
    <button className={`icon ${panels.showLeft ? "on" : ""}`} onClick={() => toggle("showLeft")} title={`${panels.showLeft ? "Hide" : "Show"} the library (⌘1)`} aria-label="Library" aria-pressed={panels.showLeft}>
      <LeftIcon on={panels.showLeft} />
    </button>
    <button className={`icon ${panels.showBottom ? "on" : ""}`} onClick={() => toggle("showBottom")} title={`${panels.showBottom ? "Hide" : "Show"} the timeline (⌘2)`} aria-label="Timeline" aria-pressed={panels.showBottom}>
      <BottomIcon on={panels.showBottom} />
    </button>
    <button className={`icon ${panels.showRight ? "on" : ""}`} onClick={() => toggle("showRight")} title={`${panels.showRight ? "Hide" : "Show"} Claude and the inspector (⌘3)`} aria-label="Claude and the inspector" aria-pressed={panels.showRight}>
      <RightIcon on={panels.showRight} />
    </button>
  </span>
);
