import React, { useEffect, useMemo, useState } from "react";
import type { Word } from "../engine/schema";
import { api, type Asset, clock, type LibraryClip } from "./api";
import { toSentences } from "./Timeline";

// The left panel: the project's assets (drop b-roll and images in; click one to mention it in a
// note) and the script (click a line to jump to it).
export const Library: React.FC<{
  slug: string;
  assets: Asset[];
  words: Word[];
  time: number;
  onUse: (ref: string) => void;
  onSeek: (t: number) => void;
}> = ({ slug, assets, words, time, onUse, onSeek }) => {
  const [tab, setTab] = useState<"assets" | "script">("assets");
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
        <button className={tab === "script" ? "on" : ""} onClick={() => setTab("script")}>
          Script
        </button>
      </div>
      {tab === "assets" ? (
        <div
          className={`assets ${over ? "over" : ""}`}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
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
              <button key={a.path} className="asset" onClick={() => onUse(a.path)} title={`Mention ${a.path} in your note`}>
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
              <button key={c.id} className="asset" onClick={() => onUse(`broll:${c.id}`)} title={c.description || c.id}>
                <img src={`/${c.thumb}`} alt="" loading="lazy" />
                <span className="name">{c.description || c.id}</span>
                <span className="dur">{clock(c.duration)}</span>
              </button>
            ))}
          </div>
          {clips.length > 0 && shown.length === 0 && <p className="muted small">No b-roll matches "{query}".</p>}
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
