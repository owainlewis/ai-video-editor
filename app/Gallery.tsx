import { Player, Thumbnail } from "@remotion/player";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { compositionFor } from "../effects/canvas";
import { cardPlan, type Canvas, settledTime, shotPlan } from "../effects/preview";
import { Reel } from "../effects/Reel";
import { Wide } from "../effects/Wide";
import type { Resolved } from "../engine/schema";
import { api, clock, type Effect } from "./api";
import { NewProject } from "./NewProject";
import { Side } from "./ui";

// The gallery: every graphic, played live in the browser with the real compositions. Library cards
// play their samples; project graphics play their own shot from the plan. Nothing is rendered, so a
// change to a visual's code shows here in a second (hot reload), and a change to a plan as soon as
// it is saved. Hover a tile to play it; click it to open it large with controls.
//
// Links: #/gallery?tab=projects&q=flow opens the projects tab filtered to "flow".

export type Item = { key: string; title: string; sub: string; plan: Resolved; footage?: Resolved; from: number; to: number; settled: number; visual: unknown; slug?: string };

const query = () => new URLSearchParams(location.hash.split("?")[1] ?? "");

export const Gallery: React.FC = () => {
  const q0 = query();
  const [tab, setTab] = useState<"library" | "projects">(q0.get("tab") === "projects" ? "projects" : "library");
  const [canvas, setCanvas] = useState<Canvas>(q0.get("canvas") === "reel" ? "reel" : "youtube");
  const [theme, setTheme] = useState<"dark" | "light">(q0.get("theme") === "light" ? "light" : "dark");
  const [search, setSearch] = useState(q0.get("q") ?? "");
  const [longest, setLongest] = useState(q0.get("text") === "longest");
  // Approved cards only, unless reviewing every candidate.
  const [all, setAll] = useState(q0.get("all") === "1");
  const [effects, setEffects] = useState<Effect[]>([]);
  const [projects, setProjects] = useState<{ slug: string; resolved: Resolved }[]>([]);
  const [open, setOpen] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ tab, canvas, theme, ...(longest ? { text: "longest" } : {}), ...(all ? { all: "1" } : {}), ...(search ? { q: search } : {}) });
    history.replaceState(null, "", `#/gallery?${params}`);
  }, [tab, canvas, theme, longest, all, search]);

  useEffect(() => {
    api.effects(canvas, all).then(setEffects).catch((e) => setError(String(e.message)));
  }, [canvas, all]);

  // Plans change while Claude works; reload the projects a moment after each save.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => api.gallery().then(setProjects).catch((e) => setError(String(e.message)));
    load();
    const stop = api.events((e) => {
      if (e.type !== "plan") return;
      clearTimeout(timer);
      timer = setTimeout(load, 600);
    });
    return () => (clearTimeout(timer), stop());
  }, []);

  const library: Item[] = useMemo(
    () =>
      // A reel shows its clean kit only, as library QC checks it.
      effects.filter((e) => canvas === "youtube" || !e.off).map((e) => {
        const plan = cardPlan(e.id, canvas, canvas === "youtube" ? theme : undefined, longest);
        return { key: e.id, title: e.kind === "custom" ? e.purpose : e.kind, sub: e.summary, plan, from: 0, to: plan.duration, settled: settledTime(plan.shots[0]), visual: plan.shots[0].visual };
      }),
    [effects, canvas, theme, longest],
  );

  const groups = useMemo(
    () =>
      projects.map((p) => ({
        slug: p.slug,
        title: p.resolved.title,
        canvas: p.resolved.canvas,
        items: p.resolved.shots.flatMap((s, i): Item[] => {
          if (!s.visual || s.keep) return [];
          const kind = s.visual.kind === "custom" ? `custom: ${(s.visual as { name?: string }).name}` : s.visual.kind;
          return [{
            key: `${p.slug}-${i}`,
            title: kind,
            sub: `${clock(s.start)} · ${s.layout}${s.header ? ` · ${s.header.replace(/\*/g, "")}` : ""} · "${s.anchor}"`,
            plan: shotPlan(p.resolved, i, false),
            footage: shotPlan(p.resolved, i, true),
            from: Math.max(0, s.start - 0.4),
            to: Math.min(p.resolved.duration, s.end + 0.4),
            settled: settledTime(s),
            visual: s.visual,
            slug: p.slug,
          }];
        }),
      })),
    [projects],
  );

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (...text: string[]) => words.every((w) => text.join(" ").toLowerCase().includes(w));

  return (
    <div className="shell gallery">
      <Side on="gallery" onNew={() => setCreating(true)} />
      <main className="main">
        <div className="page">
          <div className="page-head gallery-head">
            <h1>Gallery</h1>
            <div className="seg">
              <button className={tab === "library" ? "on" : ""} onClick={() => setTab("library")}>Library</button>
              <button className={tab === "projects" ? "on" : ""} onClick={() => setTab("projects")}>In projects</button>
            </div>
            {tab === "library" && (
              <>
                <div className="seg">
                  <button className={canvas === "youtube" ? "on" : ""} onClick={() => setCanvas("youtube")}>YouTube</button>
                  <button className={canvas === "reel" ? "on" : ""} onClick={() => setCanvas("reel")}>Reel</button>
                </div>
                {canvas === "youtube" && (
                  <div className="seg">
                    <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")}>Graphite</button>
                    <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")}>Ivory</button>
                  </div>
                )}
                <label className="small" title="Fill every text slot to its limit, to check the layout holds">
                  <input type="checkbox" checked={longest} onChange={(e) => setLongest(e.target.checked)} /> Longest text
                </label>
                <label className="small" title="Every card, approved or not, to review candidates">
                  <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show all
                </label>
              </>
            )}
            <input className="search" placeholder="Filter: kind, project, words…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {error && <p className="error">{error}</p>}
          {tab === "library" ? (
            <div className={`tiles ${canvas}`}>
              {library.filter((i) => match(i.key, i.title, i.sub, String((i.visual as { kind?: string }).kind))).map((i) => <Tile key={i.key} item={i} onOpen={() => setOpen(i)} />)}
              {!library.length && !error && <p className="muted">No approved cards yet. Tick Show all to review the candidates.</p>}
            </div>
          ) : (
            groups.map((g) => {
              const items = g.items.filter((i) => match(g.slug, g.title, i.title, i.sub, JSON.stringify(i.visual)));
              if (!items.length) return null;
              return (
                <section key={g.slug}>
                  <h3>
                    <a href={`#/p/${g.slug}`}>{g.title}</a> <span className="muted">· {g.canvas === "youtube" ? "YouTube" : "Reel"} · {items.length}</span>
                  </h3>
                  <div className={`tiles ${g.canvas}`}>
                    {items.map((i) => <Tile key={i.key} item={i} onOpen={() => setOpen(i)} />)}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </main>
      {open && <Big item={open} onClose={() => setOpen(null)} />}
      {creating && <NewProject onClose={() => setCreating(false)} />}
    </div>
  );
};

export const component = (r: Resolved) => (r.canvas === "youtube" ? Wide : Reel) as React.FC<Resolved>;
const frames = (r: Resolved) => Math.max(1, Math.round(r.duration * r.fps));
const Broken = ({ error }: { error: Error }) => <div className="broken">{error?.message || String(error)}</div>;

// A still of the settled graphic until the pointer is over it, then it plays on a loop. Tiles mount
// only near the screen, so a long list stays light.
export const Tile: React.FC<{ item: Item; onOpen: () => void }> = ({ item, onOpen }) => {
  const r = item.plan;
  const comp = compositionFor(r.canvas);
  const box = useRef<HTMLButtonElement>(null);
  const [near, setNear] = useState(false);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "400px" });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);
  const size = { width: "100%", aspectRatio: `${comp.width} / ${comp.height}` };
  return (
    <button ref={box} className="tile" onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} title={item.sub}>
      <div className="view" style={size}>
        {near &&
          (hover ? (
            <Player component={component(r)} inputProps={r} durationInFrames={frames(r)} fps={r.fps} compositionWidth={comp.width} compositionHeight={comp.height}
              style={size} inFrame={Math.round(item.from * r.fps)} outFrame={Math.min(frames(r) - 1, Math.round(item.to * r.fps))} autoPlay loop errorFallback={Broken} acknowledgeRemotionLicense />
          ) : (
            <Thumbnail component={component(r)} inputProps={r} durationInFrames={frames(r)} fps={r.fps} compositionWidth={comp.width} compositionHeight={comp.height}
              style={size} frameToDisplay={Math.min(frames(r) - 1, Math.round(item.settled * r.fps))} errorFallback={Broken} />
          ))}
      </div>
      <b>{item.title}</b>
      <span>{item.sub}</span>
    </button>
  );
};

// One graphic large, with controls, on a loop; with the footage for a project's graphic.
const Big: React.FC<{ item: Item; onClose: () => void }> = ({ item, onClose }) => {
  const [footage, setFootage] = useState(!!item.footage);
  const r = footage && item.footage ? item.footage : item.plan;
  const comp = compositionFor(r.canvas);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="big" onClick={onClose}>
      <div className="big-body" onClick={(e) => e.stopPropagation()}>
        <div className="big-head">
          <b>{item.title}</b>
          <span className="muted">{item.sub}</span>
          {item.footage && (
            <label className="small">
              <input type="checkbox" checked={footage} onChange={(e) => setFootage(e.target.checked)} /> Footage
            </label>
          )}
          {item.slug && <a href={`#/p/${item.slug}`}>Open project</a>}
          <button onClick={onClose}>Close</button>
        </div>
        <Player key={footage ? "f" : "p"} component={component(r)} inputProps={r} durationInFrames={frames(r)} fps={r.fps} compositionWidth={comp.width} compositionHeight={comp.height}
          style={{ width: "100%", maxHeight: "70vh", aspectRatio: `${comp.width} / ${comp.height}` }}
          inFrame={Math.round(item.from * r.fps)} outFrame={Math.min(frames(r) - 1, Math.round(item.to * r.fps))}
          autoPlay loop controls clickToPlay spaceKeyToPlayOrPause errorFallback={Broken} acknowledgeRemotionLicense />
        <pre>{JSON.stringify(item.visual, null, 2)}</pre>
      </div>
    </div>
  );
};
