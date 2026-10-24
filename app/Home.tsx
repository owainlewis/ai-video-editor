import React, { useEffect, useState } from "react";
import { api, clock, type ProjectSummary } from "./api";

// Projects, newest first, and a drop zone for a new clip.
export const Home: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [upload, setUpload] = useState<{ name: string; progress: number } | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  const load = () => api.projects().then(setProjects).catch((e) => setError(String(e.message)));
  useEffect(() => {
    load();
    return api.events((e) => e.type === "status" && load());
  }, []);

  const send = async (file: File) => {
    setError("");
    setUpload({ name: file.name, progress: 0 });
    try {
      const { slug } = await api.upload(file, (p) => setUpload({ name: file.name, progress: p }));
      if (slug) location.hash = `#/p/${slug}`;
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setUpload(null);
    }
  };

  return (
    <div className="home">
      <header className="bar">
        <span className="brand">Studio</span>
      </header>
      <main>
        <label
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) send(f);
          }}
        >
          <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
          {upload ? (
            <span>Uploading {upload.name}… {Math.round(upload.progress * 100)}%</span>
          ) : (
            <span>Drop a clip here, or click to choose one</span>
          )}
        </label>
        {error && <p className="error">{error}</p>}
        <ul className="projects">
          {projects.map((p) => (
            <li key={p.slug}>
              <button
                className="delete"
                title="Delete this project"
                onClick={() => api.remove(p.slug, p.title).then((done) => { if (done) load(); }).catch((e) => setError(String(e.message)))}
              >
                Delete
              </button>
              <a href={`#/p/${p.slug}`}>
                <strong>{p.title}</strong>
                <span>
                  {p.canvas === "youtube" ? "YouTube" : "Reel"}
                  {p.duration ? ` · ${clock(p.duration)}` : ""}
                  {p.status && !p.status.done ? ` · ${p.status.stage}…` : ""}
                  {p.status?.error ? " · failed" : ""}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};
