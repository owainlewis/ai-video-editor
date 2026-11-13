import React, { useEffect, useState } from "react";
import { thisWeek, WEEKLY_TARGET } from "../engine/approve";
import { api, clock, type ProjectSummary } from "./api";
import { LABEL } from "./Approval";
import { confirmIt } from "./dialog";
import { NewProject } from "./NewProject";
import { ago, Side } from "./ui";

type Kind = "all" | "reel" | "youtube";

// Projects, newest first: a frame of each, what it is, and where it has got to. New project takes
// a finished cut.
export const Home: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  const load = () => api.projects().then(setProjects).catch((e) => setError(String(e.message)));
  useEffect(() => {
    load();
    return api.events((e) => e.type === "status" && load());
  }, []);

  // The week's reels: how many were approved since Monday, against the target.
  const reels = (projects ?? []).filter((p) => p.approval).length;
  const approved = thisWeek((projects ?? []).map((p) => p.approval?.at));
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (projects ?? []).filter((p) => (kind === "all" || p.canvas === kind) && words.every((w) => `${p.title} ${p.slug}`.toLowerCase().includes(w)));

  return (
    <div className="shell">
      <Side on="projects" count={projects?.length} onNew={() => setCreating(true)} />
      <main className="main">
        <div className="page">
          <div className="page-head">
            <h1>Projects</h1>
            {projects && projects.length > 0 && <span className="count">{shown.length}</span>}
            <span className="spacer" />
            {projects && projects.length > 0 && (
              <>
                <input className="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
                <div className="seg">
                  {(["all", "reel", "youtube"] as const).map((k) => (
                    <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                      {k === "all" ? "All" : k === "reel" ? "Reels" : "YouTube"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {reels > 0 && <Week approved={approved} />}
          {error && <p className="error">{error}</p>}
          {projects?.length === 0 && (
            <div className="empty">
              <p>No projects yet. Start one from a finished cut.</p>
              <button className="primary" onClick={() => setCreating(true)}>
                New project
              </button>
            </div>
          )}
          {projects && projects.length > 0 && shown.length === 0 && <p className="empty">No project matches that.</p>}
          <div className="cards">
            {shown.map((p) => (
              <Card
                key={p.slug}
                p={p}
                onDelete={() =>
                  confirmIt({ title: `Delete "${p.title}"?`, body: "It moves to projects/.trash, so you can get it back from there.", ok: "Delete", danger: true })
                    .then((yes) => (yes ? api.remove(p.slug).then(load) : undefined))
                    .catch((e) => setError(String(e.message)))
                }
              />
            ))}
          </div>
        </div>
      </main>
      {creating && <NewProject onClose={() => setCreating(false)} />}
    </div>
  );
};

// This week (Monday to Sunday): approved reels against the target, in words and as a meter.
const Week: React.FC<{ approved: number }> = ({ approved }) => (
  <div className="week" title="Reels approved since Monday">
    <span>
      This week: <b>{approved}</b> of {WEEKLY_TARGET} approved
    </span>
    <span className="meter" aria-hidden>
      {Array.from({ length: WEEKLY_TARGET }, (_, k) => (
        <i key={k} className={k < approved ? "on" : ""} />
      ))}
    </span>
  </div>
);

// Where a project has got to, in a word or two. A reel says where its approval is; a YouTube video
// says nothing while it is simply being edited.
const state = (p: ProjectSummary): { text: string; cls: string } | null =>
  p.status?.error
    ? { text: p.status.stage === "Failed" ? "Import failed" : p.status.stage, cls: "failed" }
    : p.status && !p.status.done
      ? { text: `${p.status.stage}…`, cls: "busy" }
      : p.approval
        ? { text: LABEL[p.approval.state], cls: p.approval.state }
        : p.exported
        ? { text: "Exported", cls: "done" }
        : p.review?.approved
          ? { text: `${p.review.approved} of ${p.review.total} approved`, cls: "" }
          : null;

const Card: React.FC<{ p: ProjectSummary; onDelete: () => void }> = ({ p, onDelete }) => {
  const s = state(p);
  const kind = p.canvas === "youtube" ? "youtube" : "reel";
  return (
    <div className="card">
      <a className="hit" href={`#/p/${p.slug}`}>
        <div className={`thumb ${kind}`}>
          {p.thumb ? <img src={`/${p.thumb}`} alt="" loading="lazy" /> : <i className="blank" />}
          {s && <span className={`state ${s.cls}`}>{s.text}</span>}
        </div>
        <span className="name" title={p.title}>{p.title}</span>
        <span className="about">
          <span>
            {kind === "youtube" ? "YouTube" : "Reel"}
            {p.duration ? `, ${clock(p.duration).replace(/\.\d$/, "")}` : ""}
          </span>
          <span>{ago(p.modified)}</span>
        </span>
      </a>
      <button className="delete" title="Move this project to projects/.trash" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
};
