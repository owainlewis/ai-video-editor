import React, { useEffect, useMemo, useState } from "react";
import type { CutPlan, Resolved, Word } from "../engine/schema";
import { deleteRange } from "../engine/cut";
import { tighten, type Trim, wordsRange } from "../engine/tighten";
import { api, type Asset, type BinClip, clock, type Effect, type LibraryClip } from "./api";
import { CLIP, gist, SOURCE, toSentences } from "./Timeline";
import { Tile } from "./Gallery";
import { cardPlan, settledTime, shotPlan } from "../effects/preview";
import { Clock, playhead, usePlayhead } from "./playhead";

// The left panel: the project's clips (its media bin: drag one onto the A-roll track to cut it in),
// its assets (drop b-roll and images in; click one to mention it in a note) and the script (click a
// line to jump to it).
export const Library: React.FC<{
  slug: string;
  assets: Asset[];
  words: Word[];
  onUse: (ref: string) => void;
  onSeek: (t: number) => void;
  canvas: string;
  theme?: Resolved["theme"];
  bin: BinClip[];
  r: Resolved;
  picked: string | null;
  onPick: (id: string) => void;
  cut: CutPlan;
  onCut: (cut: CutPlan) => Promise<unknown>;
  onSelect: (range: { start: number; end: number; label?: string } | null) => void;
}> = ({ slug, assets, words, onUse, onSeek, canvas, theme, bin, r, picked, onPick, cut, onCut, onSelect }) => {
  const [tab, setTab] = useState<"clips" | "assets" | "graphics" | "effects" | "script">("graphics");
  // A library card goes in at the playhead and opens in the inspector.
  const place = (card: string) =>
    api.post(slug, "place", { card, at: playhead.get() }).then((d) => onPick((d as { id: string }).id)).catch((e) => setError(String(e.message)));
  const graphics = useMemo(
    () =>
      r.shots.flatMap((s, i) => {
        if (!s.visual || s.keep) return [];
        const plan = shotPlan(r, i, false);
        return [{ key: `${s.start}`, id: s.id ?? "", start: s.start, title: s.visual.kind === "custom" ? `custom: ${(s.visual as { name?: string }).name}` : s.visual.kind, sub: `${clock(s.start)} · ${gist(s.visual) || s.anchor}`, plan, from: Math.max(0, s.start - 0.3), to: Math.min(r.duration, s.end + 0.3), settled: settledTime(s), visual: s.visual }];
      }),
    [r],
  );
  const [effects, setEffects] = useState<Effect[]>([]);
  useEffect(() => {
    const load = () => api.effects(canvas).then(setEffects).catch(() => {});
    load();
    // The gallery can change the library while this is open.
    return api.events((e) => e.type === "cards" && load());
  }, [canvas]);
  // Cards off the project's look stay out of the way unless asked for.
  const [showOff, setShowOff] = useState(false);
  const off = effects.filter((e) => e.off).length;
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sentences = useMemo(() => toSentences(words), [words]);
  const [clips, setClips] = useState<LibraryClip[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const load = () => api.library().then((l) => (setClips(l.clips), setBusy(l.busy))).catch(() => {});
    load();
    return api.events((e) => e.type === "library" && load());
  }, []);
  const shown = clips.filter((c) => !query.trim() || query.toLowerCase().split(/\s+/).every((w) => `${c.id} ${c.description} ${c.tags.join(" ")}`.toLowerCase().includes(w)));
  const uploadTo = (url: string) => async (files: FileList | null) => {
    setError("");
    for (const f of Array.from(files ?? [])) {
      setUploading(f.name);
      try {
        await api.upload(f, () => {}, url);
      } catch (e) {
        setError(String((e as Error).message));
      }
    }
    setUploading(null);
  };
  const addToLibrary = uploadTo("/api/library");
  const add = uploadTo(`/api/projects/${slug}/assets`);
  const addClips = uploadTo(`/api/projects/${slug}/clips`);

  // A clip dragged onto the timeline carries what it is and how long it runs.
  const drag = (e: React.DragEvent, ref: string, length: number) => {
    e.dataTransfer.setData(CLIP, JSON.stringify({ ref, length }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className={`library ${canvas === "reel" ? "reel" : ""}`}>
      <div className="tabs">
        <button className={tab === "clips" ? "on" : ""} onClick={() => setTab("clips")}>
          Clips
        </button>
        <button className={tab === "assets" ? "on" : ""} onClick={() => setTab("assets")}>
          Assets
        </button>
        <button className={tab === "graphics" ? "on" : ""} onClick={() => setTab("graphics")}>
          Graphics
        </button>
        <button className={tab === "effects" ? "on" : ""} onClick={() => setTab("effects")}>
          Library
        </button>
        <button className={tab === "script" ? "on" : ""} onClick={() => setTab("script")}>
          Script
        </button>
      </div>
      {tab === "clips" ? (
        <div
          className={`assets ${over ? "over" : ""}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(SOURCE) || e.dataTransfer.types.includes(CLIP)) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            addClips(e.dataTransfer.files);
          }}
        >
          <p className="muted small">Takes and recordings for this video. Drag one onto the A-roll track to cut it in; split with B, trim by dragging an edge.</p>
          <label className="add">
            <input type="file" accept="video/*" multiple hidden onChange={(e) => addClips(e.target.files)} />
            {uploading ? `Adding ${uploading}…` : "Drop takes here, or click to add"}
          </label>
          {error && <p className="error small">{error}</p>}
          <div className="grid">
            {bin.map((c) => (
              <button
                key={c.id}
                className="asset"
                draggable={c.ready}
                onDragStart={(e) => {
                  e.dataTransfer.setData(SOURCE, JSON.stringify({ src: c.id, length: c.duration }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                title={c.ready ? `${c.name}. Drag onto the A-roll track.` : c.status?.error ?? c.status?.stage ?? "Importing"}
              >
                {c.ready ? <img src={`/${c.id === "main" ? slug : `${slug}/clips/${c.id}`}/checks/frame.jpg`} alt="" loading="lazy" /> : <span className="pending">{c.status?.error ? "Failed" : (c.status?.stage ?? "Importing")}</span>}
                <span className="name">{c.name}</span>
                {c.ready && <span className="dur">{clock(c.duration)}</span>}
              </button>
            ))}
          </div>
        </div>
      ) : tab === "assets" ? (
        <div
          className={`assets ${over ? "over" : ""}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(CLIP)) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            add(e.dataTransfer.files);
          }}
        >
          <h4>This project</h4>
          <label className="add">
            <input type="file" accept="video/*,image/*" multiple hidden onChange={(e) => add(e.target.files)} />
            {uploading ? `Adding ${uploading}…` : "Drop clips or images for this project"}
          </label>
          {error && <p className="error small">{error}</p>}
          <div className="grid">
            {assets.map((a) => (
              <button key={a.path} className="asset" draggable={a.kind === "video"} onDragStart={(e) => drag(e, a.path, a.duration ?? 3)} onClick={() => onUse(a.path)} title={`Drag onto the timeline, or click to mention ${a.path} in your note`}>
                <img src={`/${a.thumb}`} alt="" loading="lazy" />
                <span className="name">{a.name}</span>
                {a.duration !== undefined && <span className="dur">{clock(a.duration)}</span>}
              </button>
            ))}
          </div>
          <h4>
            B-roll library <span className="muted">· every project</span>
          </h4>
          <input className="search" placeholder="Search: typing, desk, overhead…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="add">
            <input type="file" accept="video/*" multiple hidden onChange={(e) => addToLibrary(e.target.files)} />
            {busy ? "Splitting into shots and describing them…" : "Add clips to the library"}
          </label>
          <div className="grid">
            {shown.map((c) => (
              <button key={c.id} className="asset" draggable onDragStart={(e) => drag(e, `broll:${c.id}`, c.duration)} onClick={() => onUse(`broll:${c.id}`)} title={`${c.description || c.id}. Drag onto the timeline, or click to mention it.`}>
                <img src={`/${c.thumb}`} alt="" loading="lazy" />
                <span className="name">{c.description || c.id}</span>
                <span className="dur">{clock(c.duration)}</span>
              </button>
            ))}
          </div>
          {clips.length > 0 && shown.length === 0 && <p className="muted small">No b-roll matches "{query}".</p>}
        </div>
      ) : tab === "graphics" ? (
        <div className="assets">
          <p className="muted small">Every graphic in this video. Click one to edit it.</p>
          {error && <p className="error small">{error}</p>}
          <div className="effects">
            {graphics.map((g) => (
              <div key={g.key} className={picked === g.id ? "picked" : ""}>
                <Tile item={g} onOpen={() => (onPick(g.id), onSeek(Math.min(g.to - 0.4, g.start + 1.5)))} />
              </div>
            ))}
          </div>
          {graphics.length === 0 && <p className="muted small">No graphics yet. Add one from the Library tab, or ask Claude.</p>}
        </div>
      ) : tab === "effects" ? (
        <div className="assets">
          <p className="muted small">
            Every graphic in this video's look ({lookName(canvas, theme)}), live. House graphics first. Hover to play; click one to add it at the playhead (<Clock />). <a href={`#/gallery?canvas=${canvas}&theme=${theme === "dark" || theme === "black" ? "dark" : "light"}`}>Open the gallery</a>
          </p>
          {error && <p className="error small">{error}</p>}
          <div className="effects">
            {effects
              .filter((e) => showOff || !e.off)
              .map((e) => {
                const plan = cardPlan(e.id, canvas === "reel" ? "reel" : "youtube", theme, false);
                const item = { key: e.id, title: e.name ?? e.kind, sub: e.off ? `${e.off}. ${e.summary}` : e.summary, plan, from: 0, to: plan.duration, settled: settledTime(plan.shots[0]), visual: plan.shots[0].visual };
                return (
                  // Shown on request, dimmed: off this look.
                  <div key={e.id} style={e.off ? { opacity: 0.45 } : undefined}>
                    <Tile item={item} onOpen={() => place(e.id)} />
                  </div>
                );
              })}
          </div>
          {off > 0 && (
            <button className="small quiet" onClick={() => setShowOff((v) => !v)}>
              {showOff ? "Hide" : "Show"} {off} card{off === 1 ? "" : "s"} off this look
            </button>
          )}
        </div>
      ) : (
        <Script words={words} sentences={sentences} cut={cut} onCut={onCut} onSeek={onSeek} onSelect={onSelect} />
      )}
    </aside>
  );
};

// The look a project's graphics draw in, as Owain names it.
const lookName = (canvas: string, theme?: Resolved["theme"]) =>
  canvas === "reel" ? "clean reel" : theme === "black" ? "Black" : theme === "dark" ? "Graphite" : "Ivory";

// The script, word by word: select words and cut them (the button, or Delete), as in a text editor.
// Tighten proposes what to lose (retakes, fillers, long pauses) struck through in the script; click
// one to keep it, then cut the rest in one go. Every cut is one version, so undo brings it back.
const Script: React.FC<{
  words: Word[];
  sentences: { start: number; end: number; text: string }[];
  cut: CutPlan;
  onCut: (cut: CutPlan) => Promise<unknown>;
  onSeek: (t: number) => void;
  onSelect: (range: { start: number; end: number; label?: string } | null) => void;
}> = ({ words, cut, onCut, onSeek, onSelect }) => {
  // The word being said: the script is redrawn when the playhead reaches the next word.
  const here = usePlayhead((t) => words.findIndex((w, i) => t >= w.start && t < (words[i + 1]?.start ?? w.end)));
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [trims, setTrims] = useState<(Trim & { on: boolean })[] | null>(null);
  const [error, setError] = useState("");
  // A new cut moves every word, so old proposals and selections no longer point at the right ones.
  useEffect(() => (setTrims(null), setPicked(null)), [words]);
  const struck = useMemo(() => {
    const m = new Map<number, Trim & { on: boolean }>();
    for (const t of trims ?? []) if (t.words) for (let i = t.words[0]; i <= t.words[1]; i++) m.set(i, t);
    return m;
  }, [trims]);
  const pauses = useMemo(() => new Map((trims ?? []).filter((t) => t.kind === "pause").map((t) => [words.findIndex((w) => w.end > t.from - 0.2), t])), [trims, words]);

  const select = () => {
    const sel = window.getSelection();
    const at = (n: Node | null) => Number((n instanceof Element ? n : n?.parentElement)?.closest("[data-i]")?.getAttribute("data-i") ?? NaN);
    const a = at(sel?.anchorNode ?? null);
    const b = at(sel?.focusNode ?? null);
    if (!sel || sel.isCollapsed || Number.isNaN(a) || Number.isNaN(b)) return;
    const range: [number, number] = [Math.min(a, b), Math.max(a, b)];
    setPicked(range);
    const [start, end] = wordsRange(words, range[0], range[1]);
    onSelect({ start, end, label: `${range[1] - range[0] + 1} words` });
  };
  const apply = (ranges: [number, number][]): Promise<boolean> => {
    let next = cut;
    for (const [a, b] of [...ranges].sort((x, y) => y[0] - x[0])) next = deleteRange(next, a, b);
    setError("");
    return onCut(next)
      .then(() => (onSelect(null), true))
      .catch((e) => (setError(String(e.message)), false));
  };
  const kept = (trims ?? []).filter((t) => t.on);
  const saves = kept.reduce((s, t) => s + t.to - t.from, 0);

  // Sentences rebuilt over word indices, so each word keeps its place for selecting and striking.
  const lines = useMemo(() => {
    const out: number[][] = [];
    let cur: number[] = [];
    words.forEach((w, i) => {
      cur.push(i);
      const next = words[i + 1];
      if (/[.?!]$/.test(w.text) || !next || next.start - w.end > 0.8 || cur.length >= 30) (out.push(cur), (cur = []));
    });
    return out;
  }, [words]);

  return (
    <div className="script-panel">
      <div className="script-bar">
        {picked ? (
          <>
            <button className="small primary" onClick={() => apply([wordsRange(words, picked[0], picked[1])]).then((ok) => ok && setPicked(null))}>Cut {picked[1] - picked[0] + 1} word{picked[0] === picked[1] ? "" : "s"}</button>
            <button className="small quiet" onClick={() => (setPicked(null), onSelect(null), window.getSelection()?.removeAllRanges())}>Cancel</button>
          </>
        ) : trims ? (
          <>
            <button className="small primary" disabled={!kept.length} onClick={() => apply(kept.map((t) => [t.from, t.to]))}>Cut {kept.length} ({saves.toFixed(1)}s)</button>
            <button className="small quiet" onClick={() => setTrims(null)}>Cancel</button>
          </>
        ) : (
          <>
            <button className="small" onClick={() => setTrims(tighten(words).map((t) => ({ ...t, on: true })))} title="Find retakes, filler words and long pauses">Tighten</button>
            <span className="muted small">Select words to cut them.</span>
          </>
        )}
      </div>
      {trims && (
        <p className="muted small trims-note">
          {trims.length ? `${trims.filter((t) => t.kind === "retake").length} retakes, ${trims.filter((t) => t.kind === "filler").length} fillers, ${trims.filter((t) => t.kind === "pause").length} long pauses. Struck words go; click one to keep it.` : "Nothing to tighten: no retakes, fillers or long pauses."}
        </p>
      )}
      {error && <p className="error small">{error}</p>}
      <div className="script" onMouseUp={select}>
        {lines.map((line, n) => {
          const s = words[line[0]];
          return (
            <p key={n} className={here >= line[0] && here <= line[line.length - 1] ? "now" : ""}>
              <span className="t" onClick={() => onSeek(s.start)}>{clock(s.start)}</span>{" "}
              {line.map((i) => {
                const t = struck.get(i);
                const p = pauses.get(i);
                const toggle = (x: Trim & { on: boolean }) => setTrims((all) => all!.map((y) => (y === x ? { ...y, on: !y.on } : y)));
                return (
                  <React.Fragment key={i}>
                    <span
                      data-i={i}
                      className={`w ${t ? `drop ${t.kind} ${t.on ? "" : "off"}` : ""} ${picked && i >= picked[0] && i <= picked[1] ? "sel" : ""} ${i === here ? "here" : ""}`}
                      title={t ? `${t.kind}: click to ${t.on ? "keep" : "cut"}` : clock(words[i].start)}
                      onClick={() => (t ? toggle(t) : window.getSelection()?.isCollapsed && onSeek(words[i].start + 0.01))}
                    >
                      {words[i].text}
                    </span>
                    {p && <span className={`gap ${p.on ? "" : "off"}`} onClick={() => toggle(p)} title="Long pause: click to keep it">{p.text.replace(" pause", "")}</span>}{" "}
                  </React.Fragment>
                );
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
};
