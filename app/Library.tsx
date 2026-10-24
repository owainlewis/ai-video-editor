import React, { useMemo, useState } from "react";
import type { Word } from "../engine/schema";
import { api, type Asset, clock } from "./api";
import { toSentences } from "./Timeline";

// The left panel: the project's assets (drop b-roll and images in; click one to mention it in a
// note) and the script (click a line to jump to it).
export const Library: React.FC<{
  slug: string;
  assets: Asset[];
  words: Word[];
  time: number;
  onUse: (a: Asset) => void;
  onSeek: (t: number) => void;
}> = ({ slug, assets, words, time, onUse, onSeek }) => {
  const [tab, setTab] = useState<"assets" | "script">("assets");
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sentences = useMemo(() => toSentences(words), [words]);

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
          <label className="add">
            <input type="file" accept="video/*,image/*" multiple hidden onChange={(e) => add(e.target.files)} />
            {uploading ? `Adding ${uploading}…` : "Drop b-roll or images here, or click to add"}
          </label>
          {error && <p className="error small">{error}</p>}
          <div className="grid">
            {assets.map((a) => (
              <button key={a.path} className="asset" onClick={() => onUse(a)} title={`Mention ${a.path} in your note`}>
                <img src={`/${a.thumb}`} alt="" loading="lazy" />
                <span className="name">{a.name}</span>
                {a.duration !== undefined && <span className="dur">{clock(a.duration)}</span>}
              </button>
            ))}
          </div>
          {assets.length === 0 && <p className="muted small">No assets yet. Add b-roll, screenshots or logos, then ask Claude to use them.</p>}
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
