import React, { useEffect, useState } from "react";

// Small shared pieces of the interface: the icons, the sidebar and the light and dark switch.

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
export const UndoIcon = () => <Svg><path d="M5.5 3.5 2 7l3.5 3.5" /><path d="M2.5 7H10a3.5 3.5 0 0 1 0 7H7.5" /></Svg>;
export const RedoIcon = () => <Svg><path d="M10.5 3.5 14 7l-3.5 3.5" /><path d="M13.5 7H6a3.5 3.5 0 0 0 0 7h2.5" /></Svg>;
const ThemeIcon = () => <Svg><circle cx="8" cy="8" r="5.5" /><path d="M8 2.5a5.5 5.5 0 0 0 0 11z" fill="currentColor" stroke="none" /></Svg>;
const PlusIcon = () => <Svg><path d="M8 3v10M3 8h10" /></Svg>;
const ProjectsIcon = () => <Svg><rect x="2" y="3" width="12" height="10" rx="2" /><path d="m7 6 3 2-3 2z" /></Svg>;
const GalleryIcon = () => <Svg><rect x="2" y="2" width="5" height="5" rx="1.2" /><rect x="9" y="2" width="5" height="5" rx="1.2" /><rect x="2" y="9" width="5" height="5" rx="1.2" /><rect x="9" y="9" width="5" height="5" rx="1.2" /></Svg>;

// The page follows the system's light or dark setting until this is pressed; after that it keeps
// the choice (in this browser) and puts it on <html data-theme>, which the stylesheet reads.
// index.html applies a kept choice before the first paint.
export const THEME_KEY = "studio-theme";
const current = () => document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export const ThemeSwitch: React.FC<{ label?: boolean }> = ({ label }) => {
  const [theme, setTheme] = useState(current);
  const other = theme === "dark" ? "light" : "dark";
  const flip = () => {
    document.documentElement.dataset.theme = other;
    try {
      localStorage.setItem(THEME_KEY, other);
    } catch {
      // A browser that keeps nothing still switches for this visit.
    }
    setTheme(other);
  };
  return label ? (
    <button className="nav" onClick={flip} title={`Switch to the ${other} theme`}>
      <ThemeIcon />
      {other === "light" ? "Light mode" : "Dark mode"}
    </button>
  ) : (
    <button className="icon" onClick={flip} title={`Switch to the ${other} theme`} aria-label={`Switch to the ${other} theme`}>
      <ThemeIcon />
    </button>
  );
};

// The sidebar of the projects page and the gallery: the mark, New project, where to go, the theme.
export const Side: React.FC<{ on: "projects" | "gallery"; count?: number; onNew: () => void }> = ({ on, count, onNew }) => (
  <aside className="sidebar">
    <a className="brand" href="#/">Studio</a>
    <button className="nav new" onClick={onNew}>
      <PlusIcon />
      New project
    </button>
    <a className={`nav ${on === "projects" ? "on" : ""}`} href="#/">
      <ProjectsIcon />
      Projects
      {count !== undefined && <span className="count">{count}</span>}
    </a>
    <a className={`nav ${on === "gallery" ? "on" : ""}`} href="#/gallery" title="Every graphic in the library and in your projects, playing live">
      <GalleryIcon />
      Gallery
    </a>
    <span className="spacer" />
    <ThemeSwitch label />
  </aside>
);

// The keys for the page, on a sheet: the button in the header, or "?" from anywhere but a text field.
export const KeysButton: React.FC<{ keys: [string, string][] }> = ({ keys }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "?") setOpen((v) => !v);
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return (
    <>
      <button className="icon" onClick={() => setOpen(true)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
        ?
      </button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal keys" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <h2>Keys</h2>
            <dl>
              {keys.map(([k, what]) => (
                <React.Fragment key={k}>
                  <dt>
                    {k.split(" ").map((part, i) => (part === "or" || part === "then" ? <span key={i}> {part} </span> : <kbd key={i}>{part}</kbd>))}
                  </dt>
                  <dd>{what}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
};

// How long ago, in a few plain words.
export function ago(ms: number, now = Date.now()): string {
  const min = Math.round((now - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
