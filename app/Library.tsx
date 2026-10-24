import React, { useEffect, useMemo, useState } from "react";
import type { Word } from "../engine/schema";
import { api, type Asset, clock, type Effect, type LibraryClip } from "./api";
import { CLIP, toSentences } from "./Timeline";

// The left panel: the project's assets (drop b-roll and images in; click one to mention it in a
// note) and the script (click a line to jump to it).
export const Library: React.FC<{
  slug: string;
  assets: Asset[];
  words: Word[];
  time: number;
  onUse: (ref: string) => void;
  onSeek: (t: number) => void;
  canvas: string;
}> = ({ slug, assets, words, time, onUse, onSeek, canvas }) => {
  const [tab, setTab] = useState<"assets" | "effects" | "script">("assets");
  const [effects, setEffects] = useState<Effect[]>([]);
  useEffect(() => {
    api.effects(canvas).then(setEffects).catch(() => {});
  }, [canvas]);
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
  const addToLibrary = async (files: FileList | null) => {
    setError("");
    for (const f of Array.from(files ?? [])) {
      setUploading(f.name);
      try {
        await api.upload(f, () => {}, "/api/library");
      } catch (e) {
        setError(String((e as Error).message));
      }
    }
    setUploading(null);
  };

  // A clip dragged onto the timeline carries what it is and how long it runs.
  const drag = (e: React.DragEvent, ref: string, length: number) => {
    e.dataTransfer.setData(CLIP, JSON.stringify({ ref, length }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const add = async (files: FileList | null) => {
    setError("");
    for (const f of Array.from(files ?? [])) {
      setUploading(f.name);
      try {
        await api.upload(f, () => {}, `/api/projects/${slug}/assets`);
      } catch (e) {
        setError(String((e as Error).message));
      }
    }
    setUploading(null);
  };

  return (
    <aside className="library">
      <div className="tabs">
        <button className={tab === "assets" ? "on" : ""} onClick={() => setTab("assets")}>
          Assets
        </button>
        <button className={tab === "effects" ? "on" : ""} onClick={() => setTab("effects")}>
          Effects
        </button>
        <button className={tab === "script" ? "on" : ""} onClick={() => setTab("script")}>
          Script
        </button>
      </div>
      {tab === "assets" ? (
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
      ) : tab === "effects" ? (
        <div className="assets">
          <p className="muted small">Every graphic in your style. Click one to ask for it in your note.</p>
          <div className="effects">
            {effects.map((e) => (
              <button key={e.id} className="effect" onClick={() => onUse(`the ${e.kind} graphic (${e.id})`)} title={e.summary}>
                <img src={`/${e.thumb}`} alt="" loading="lazy" />
                <b>{e.kind}</b>
                <span>{e.summary}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="script">
          {sentences.map((s, i) => (
            <p key={i} className={time >= s.start && time < s.end ? "now" : ""} onClick={() => onSeek(s.start)}>
              <span className="t">{clock(s.start)}</span> {s.text}
            </p>
          ))}
        </div>
      )}
    </aside>
  );
};
