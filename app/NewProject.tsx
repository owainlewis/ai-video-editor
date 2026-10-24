import React, { useEffect, useState } from "react";
import { api } from "./api";

type Canvas = "reel" | "youtube";

// Start a project: name it, say whether it is a reel or a YouTube video, add the clip.
export const NewProject: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [title, setTitle] = useState("");
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && progress === null && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, progress]);

  // Guess the format from the clip's shape; Owain can still change it.
  const pick = (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      setCanvas((c) => c ?? (v.videoWidth >= v.videoHeight ? "youtube" : "reel"));
      URL.revokeObjectURL(v.src);
    };
    v.src = URL.createObjectURL(f);
  };

  const create = async () => {
    if (!file || !canvas) return;
    setError("");
    setProgress(0);
    try {
      const { slug } = await api.upload(file, setProgress, "/api/upload", { canvas, title: title.trim() });
      if (slug) location.hash = `#/p/${slug}`;
    } catch (e) {
      setError(String((e as Error).message));
      setProgress(null);
    }
  };

  const size = file ? `${(file.size / 1e9 >= 1 ? (file.size / 1e9).toFixed(1) + " GB" : Math.round(file.size / 1e6) + " MB")}` : "";
  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && progress === null && onClose()}>
      <div className="modal" role="dialog" aria-label="New project">
        <h2>New project</h2>
        <label className="field">
          <span>Name</span>
          <input autoFocus value={title} placeholder="How the Claude Code team does code review" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="field">
          <span>Format</span>
          <div className="formats">
            {(["reel", "youtube"] as const).map((c) => (
              <button key={c} className={`format ${canvas === c ? "on" : ""}`} onClick={() => setCanvas(c)}>
                <i className={c} />
                <b>{c === "reel" ? "Reel" : "YouTube"}</b>
                <small>{c === "reel" ? "9:16, captions, graphics throughout" : "16:9, graphics where you are on camera"}</small>
              </button>
            ))}
          </div>
        </div>
        <label
          className={`drop small ${over ? "over" : ""} ${file ? "has" : ""}`}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]);
          }}
        >
          <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          {file ? (
            <span>
              {file.name} <span className="muted">· {size}</span>
            </span>
          ) : (
            <span>Drop your finished cut here, or click to choose it</span>
          )}
        </label>
        {progress !== null && (
          <div className="progress">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
            <span>{progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : "Starting the import…"}</span>
          </div>
        )}
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button onClick={onClose} disabled={progress !== null}>
            Cancel
          </button>
          <button className="primary" onClick={create} disabled={!file || !canvas || progress !== null}>
            Create project
          </button>
        </div>
      </div>
    </div>
  );
};
