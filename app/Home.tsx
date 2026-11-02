import React, { useEffect, useState } from "react";
import { api, clock, type ProjectSummary } from "./api";
import { NewProject } from "./NewProject";

// Projects, newest first, and a drop zone for a new clip.
export const Home: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => api.projects().then(setProjects).catch((e) => setError(String(e.message)));
  useEffect(() => {
    load();
    return api.events((e) => e.type === "status" && load());
  }, []);

  return (
    <div className="home">
      <header className="bar">
        <span className="brand">Studio</span>
        <a href="#/gallery">Gallery</a>
      </header>
      <main>
        <div className="home-head">
          <h1>Projects</h1>
          <button className="primary" onClick={() => setCreating(true)}>
            New project
          </button>
        </div>
        {projects.length === 0 && (
          <button className="drop" onClick={() => setCreating(true)}>
            Start your first project
          </button>
        )}
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
      {creating && <NewProject onClose={() => setCreating(false)} />}
    </div>
  );
};
