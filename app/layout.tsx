import React, { useCallback, useEffect, useRef, useState } from "react";

// The editor's workspace: the library on the left, the viewer in the middle, the inspector and
// Claude on the right, the timeline across the bottom. Each panel can be dragged to a new size
// or hidden, as in Final Cut, so the viewer gets the room when Owain is watching. Sizes are kept
// per kind of video (a reel wants height, a YouTube video wants width), in this browser only.

export type Panels = {
  left: number; inspector: number; right: number; bottom: number;
  showLeft: boolean; showInspector: boolean; showRight: boolean; showBottom: boolean;
};
export type Side = "left" | "inspector" | "right" | "bottom";
export type Show = "showLeft" | "showInspector" | "showRight" | "showBottom";
export type Kind = "reel" | "youtube";

export const DEFAULTS: Record<Kind, Panels> = {
  reel: { left: 280, inspector: 280, right: 340, bottom: 300, showLeft: true, showInspector: true, showRight: true, showBottom: true },
  // A 16:9 viewer needs the width: the inspector opens when a graphic is picked.
  youtube: { left: 280, inspector: 280, right: 340, bottom: 300, showLeft: true, showInspector: false, showRight: true, showBottom: true },
};
// What a drag may reach. The viewer always keeps room in the middle.
export const LIMITS = { left: [240, 480], inspector: [240, 420], right: [280, 560], bottom: [150, 560] } as const;
export const VIEWER_MIN = { width: 280, height: 220 };
// The editor's padding and the gap between panels (app/style.css .editor). A side panel's column is
// its width plus the gap beside it, so a hidden panel leaves no gap behind.
export const PAD = 6;
export const GAP = 6;

const key = (kind: Kind) => `studio-panels-${kind}`;
export const clamp = (v: number, [lo, hi]: readonly [number, number], fallback = lo) =>
  Number.isFinite(v) ? Math.round(Math.max(lo, Math.min(hi, v))) : fallback;

export const parsePanels = (raw: string | null, kind: Kind): Panels => {
  const def = DEFAULTS[kind];
  if (!raw) return def;
  try {
    const kept = JSON.parse(raw);
    if (!kept || typeof kept !== "object" || Array.isArray(kept)) return def;
    const num = (v: unknown, lim: readonly [number, number], fb: number) =>
      typeof v === "number" && Number.isFinite(v) ? clamp(v, lim, fb) : fb;
    const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
    return {
      left: num(kept.left, LIMITS.left, def.left),
      inspector: num(kept.inspector, LIMITS.inspector, def.inspector),
      right: num(kept.right, LIMITS.right, def.right),
      bottom: num(kept.bottom, LIMITS.bottom, def.bottom),
      showLeft: bool(kept.showLeft, def.showLeft),
      showInspector: bool(kept.showInspector, def.showInspector),
      showRight: bool(kept.showRight, def.showRight),
      showBottom: bool(kept.showBottom, def.showBottom),
    };
  } catch {
    return def;
  }
};

export const loadPanels = (kind: Kind): Panels => {
  try {
    return parsePanels(localStorage.getItem(key(kind)), kind);
  } catch {
    return DEFAULTS[kind];
  }
};

// The room the side columns other than `which` take.
const besides = (which: "left" | "inspector" | "right", p: Panels) =>
  (which !== "left" && p.showLeft ? p.left + GAP : 0) + (which !== "inspector" && p.showInspector ? p.inspector + GAP : 0) + (which !== "right" && p.showRight ? p.right + GAP : 0);

export const dragSize = (
  which: Side,
  client: { x: number; y: number },
  rect: { left: number; right: number; bottom: number; width: number; height: number },
  panels: Panels,
): number => {
  if (which !== "bottom") {
    const room = rect.width - 2 * PAD - GAP - besides(which, panels) - VIEWER_MIN.width;
    // The edge is the middle of the gap. The inspector sits left of Claude, so its edge is Claude's
    // column further in.
    const edge = PAD + GAP / 2;
    const want =
      which === "left" ? client.x - rect.left - edge
      : which === "right" ? rect.right - client.x - edge
      : rect.right - client.x - edge - (panels.showRight ? panels.right + GAP : 0);
    return clamp(Math.min(want, room), LIMITS[which], DEFAULTS.reel[which]);
  }
  return clamp(Math.min(rect.bottom - client.y - PAD - GAP / 2, rect.height - 2 * PAD - GAP - VIEWER_MIN.height), LIMITS.bottom, DEFAULTS.reel.bottom);
};

export function usePanels(kind: Kind | undefined) {
  const [state, setState] = useState<{ kind: Kind | undefined; panels: Panels }>(() => ({
    kind,
    panels: kind ? loadPanels(kind) : DEFAULTS.reel,
  }));
  const kindRef = useRef(kind);
  kindRef.current = kind;
  if (kind && state.kind !== kind) {
    setState({ kind, panels: loadPanels(kind) });
  }
  const update = useCallback((fn: (old: Panels, k: Kind) => Panels) => {
    setState((cur) => {
      const k = cur.kind ?? kindRef.current;
      if (!k) return cur;
      const next = fn(cur.panels, k);
      if (
        (Object.keys(next) as (keyof Panels)[]).every((k) => next[k] === cur.panels[k])
      ) {
        return cur;
      }
      try {
        localStorage.setItem(key(k), JSON.stringify(next));
      } catch {
        // A browser that keeps nothing still resizes for this visit.
      }
      return { kind: k, panels: next };
    });
  }, []);
  const set = useCallback((change: Partial<Panels>) => update((old) => ({ ...old, ...change })), [update]);
  const toggle = useCallback((which: Show) => update((old) => ({ ...old, [which]: !old[which] })), [update]);
  const reset = useCallback((which: Side) => update((old, k) => ({ ...old, [which]: DEFAULTS[k][which] })), [update]);
  return { panels: state.panels, set, toggle, reset };
}

// The grid's sizes, as CSS variables on the editor. A hidden panel takes no room.
export const panelStyle = (p: Panels): React.CSSProperties =>
  ({
    "--left": p.showLeft ? `${p.left + GAP}px` : "0px",
    "--inspector": p.showInspector ? `${p.inspector + GAP}px` : "0px",
    "--right": p.showRight ? `${p.right + GAP}px` : "0px",
    "--bottom": p.showBottom ? `${p.bottom + GAP}px` : "0px",
  }) as React.CSSProperties;

// The edges a panel is dragged by. They sit over the lines between panels; a double click
// puts that panel back to its usual size.
export const Splitters: React.FC<{ panels: Panels; set: (c: Partial<Panels>) => void; reset: (w: Side) => void }> = ({ panels, set, reset }) => {
  const box = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState<Side | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);
  const start = (which: Side) => (e: React.PointerEvent) => {
    const editor = box.current?.parentElement;
    if (!editor || e.button !== 0) return;
    e.preventDefault();
    cleanupRef.current?.();
    const rect = editor.getBoundingClientRect();
    let latest: number | null = null;
    setDragging(which);
    const move = (ev: PointerEvent) => {
      latest = dragSize(which, { x: ev.clientX, y: ev.clientY }, rect, panels);
      editor.style.setProperty(`--${which}`, `${latest + GAP}px`);
    };
    const detach = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (cleanupRef.current === detach) cleanupRef.current = null;
    };
    const up = () => {
      detach();
      setDragging(null);
      if (latest !== null) set({ [which]: latest });
    };
    const cancel = () => {
      detach();
      setDragging(null);
      editor.style.setProperty(`--${which}`, `${panels[which] + GAP}px`);
    };
    cleanupRef.current = detach;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };
  return (
    <div ref={box} className={`splitters ${dragging ? `dragging drag-${dragging}` : ""}`}>
      {panels.showLeft && <div className="split split-col split-left" onPointerDown={start("left")} onDoubleClick={() => reset("left")} title="Drag to resize the library. Double-click for its usual size." />}
      {panels.showInspector && <div className="split split-col split-inspector" onPointerDown={start("inspector")} onDoubleClick={() => reset("inspector")} title="Drag to resize the inspector. Double-click for its usual size." />}
      {panels.showRight && <div className="split split-col split-right" onPointerDown={start("right")} onDoubleClick={() => reset("right")} title="Drag to resize Claude. Double-click for its usual size." />}
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
const InspectorIcon: React.FC<{ on: boolean }> = ({ on }) => <Svg><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M9 2.5v11" /><path d="M10.8 6h1.9M10.8 8h1.9M10.8 10h1.2" strokeWidth={on ? 1.6 : 1} /></Svg>;
const BottomIcon: React.FC<{ on: boolean }> = ({ on }) => <Svg><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><rect x="1.5" y="9" width="13" height="4.5" rx="2" fill={on ? "currentColor" : "none"} /></Svg>;

const TOGGLES: { which: Show; name: string; key: string; Icon: React.FC<{ on: boolean }> }[] = [
  { which: "showLeft", name: "the library", key: "⌘1", Icon: LeftIcon },
  { which: "showBottom", name: "the timeline", key: "⌘2", Icon: BottomIcon },
  { which: "showInspector", name: "the inspector", key: "⌘4", Icon: InspectorIcon },
  { which: "showRight", name: "Claude", key: "⌘3", Icon: RightIcon },
];

// The buttons in the header that show and hide each panel, with their keys.
export const PanelToggles: React.FC<{ panels: Panels; toggle: (w: Show) => void }> = ({ panels, toggle }) => (
  <span className="panel-toggles">
    {TOGGLES.map(({ which, name, key, Icon }) => (
      <button key={which} className={`icon ${panels[which] ? "on" : ""}`} onClick={() => toggle(which)} title={`${panels[which] ? "Hide" : "Show"} ${name} (${key})`} aria-label={name} aria-pressed={panels[which]}>
        <Icon on={panels[which]} />
      </button>
    ))}
  </span>
);
