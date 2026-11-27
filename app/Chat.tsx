import React, { useEffect, useRef, useState } from "react";
import type { Change } from "../engine/changes";
import type { Resolved } from "../engine/schema";
import { settledTime } from "../effects/preview";
import { api, type ChatMessage, clock, type Issue, type Suggestion } from "./api";
import { type ChatRun, fieldName, groupChat, took } from "./runs";
import { ask, confirmIt } from "./dialog";
import { Clock, playhead } from "./playhead";
import { gist, kindGroup, type Range } from "./Timeline";

// The Claude panel: suggestions to review, one run per note (its steps folded, its answer, the
// graphics it changed and a Revert), the plan's checks, and the box to write a note in.

// Now, once a second while `on`.
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

// One changed graphic or plan field. A graphic still in the plan opens it, on its settled frame.
const ChangeRow: React.FC<{ c: Change; r: Resolved | null; onOpen: (id: string, t: number) => void }> = ({ c, r, onOpen }) => {
  if (c.type === "plan")
    return (
      <li className="plan">
        <span className="sign">~</span>
        <span className="what">{fieldName(c.field)}</span>
      </li>
    );
  const shot = c.type === "removed" ? undefined : r?.shots.find((s) => s.id === c.id);
  const kind = shot?.visual?.kind ?? c.kind;
  const words = (shot && (shot.hit?.text ?? gist(shot.visual))) || c.anchor;
  const body = (
    <>
      <span className="sign">{c.type === "added" ? "+" : c.type === "removed" ? "−" : "~"}</span>
      <span className={`swatch ${shot?.visual ? kindGroup(kind) : "plain"}`} />
      <span className="kind">{kind}</span>
      <span className="what">{words.replace(/\*/g, "")}</span>
      {shot && <span className="at">{clock(shot.start)}</span>}
    </>
  );
  return (
    <li className={c.type}>
      {shot ? (
        <button className="quiet" onClick={() => onOpen(shot.id ?? c.id, settledTime(shot))} title="Show this graphic">
          {body}
        </button>
      ) : (
        <span className="row-body" title={c.type === "removed" ? "Removed" : "No longer in the plan"}>{body}</span>
      )}
    </li>
  );
};

const RunView: React.FC<{ g: ChatRun; r: Resolved | null; newest: number; working: boolean; onOpen: (id: string, t: number) => void; onRevert: (from: number, to: number) => void }> = ({ g, r, newest, working, onOpen, onRevert }) => {
  const [open, setOpen] = useState(g.live);
  // Open while Claude works on it, folded once it is done.
  useEffect(() => setOpen(g.live), [g.live]);
  const now = useNow(g.live);
  const started = g.note ? Date.parse(g.note.at) : NaN;
  const steps = g.steps.length;
  const run = g.run;
  return (
    <div className={`run ${g.live ? "live" : ""}`}>
      {g.note && <div className="msg user">{g.note.text}</div>}
      {(steps > 0 || g.live) && (
        <div className="steps">
          <button className="quiet fold" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className={`caret ${open ? "open" : ""}`}>▸</span>
            {g.live ? (
              <span>Working{Number.isFinite(started) ? ` · ${took(now - started)}` : ""}</span>
            ) : (
              <span>
                {steps} step{steps === 1 ? "" : "s"}
                {run ? ` · ${took(run.ms)}` : ""}
              </span>
            )}
          </button>
          {open && (
            <ol>
              {g.steps.map((s, k) => (
                <li key={k} className={g.live && k === steps - 1 ? "now" : ""}>{s.text}</li>
              ))}
              {g.live && !steps && <li className="now">Reading the plan</li>}
            </ol>
          )}
        </div>
      )}
      {g.answers.map((m, k) => (
        <div key={k} className="msg claude">{m.text}</div>
      ))}
      {run?.changes && run.changes.length > 0 && (
        <div className="changes">
          <span className="label">Changed</span>
          <ul>
            {run.changes.map((c, k) => <ChangeRow key={k} c={c} r={r} onOpen={onOpen} />)}
          </ul>
        </div>
      )}
      {/* A note undone with ⌘Z has nothing left to revert. */}
      {run?.reverted !== undefined && run.reverted === newest ? (
        <span className="reverted">Reverted. Undo brings the note back.</span>
      ) : run?.from && run.to && newest >= run.to && (
        <button className="quiet revert small" disabled={working} onClick={() => onRevert(run.from!, run.to!)} title={`Put the plan back as it was before this note (version ${run.from}). Undo brings the note back.`}>
          {newest === run.to ? "Revert this note" : "Revert to before this note"}
        </button>
      )}
    </div>
  );
};

export const Chat: React.FC<{
  slug: string;
  r: Resolved | null;
  messages: ChatMessage[];
  working: boolean;
  newest: number;
  selection: Range | null;
  words: { text: string; start: number }[];
  note: string;
  setNote: (n: string) => void;
  issues: Issue[];
  suggestions: Suggestion[];
  onSeek: (t: number) => void;
  onOpen: (id: string, t: number) => void;
  onClear: () => void;
}> = ({ slug, r, messages, working, newest, selection, words, note, setNote, issues, suggestions, onSeek, onOpen, onClear }) => {
  const pending = suggestions.filter((s) => s.status === "pending");
  const [failed, setFailed] = useState<Record<string, string>>({});
  // Rejecting asks why; the reason goes with the suggestion, so the next round learns from it.
  const decide = async (id: string, accept: boolean) => {
    const note = accept ? "" : await ask({ title: "Reject this suggestion?", body: "Say why if you like. It helps the next round.", placeholder: "Too busy, wrong moment, not what I said…", ok: "Reject", optional: true });
    if (note === null) return;
    return api
      .post(slug, "decide", { id, accept, note })
      .then(() => setFailed((f) => ({ ...f, [id]: "" })))
      .catch((e) => setFailed((f) => ({ ...f, [id]: String(e.message) })));
  };
  const [showChecks, setShowChecks] = useState(false);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warnCount = issues.length - errorCount;
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const runs = groupChat(messages, working);
  const steps = runs.at(-1)?.steps.length ?? 0;
  // The list stays on its newest line while it is there: when a message lands, and when the panel
  // around it changes size (the checks open, a run folds). Scrolled up to read, it stays put.
  const pinned = useRef(true);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const onScroll = () => (pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24);
    const ro = new ResizeObserver(() => pinned.current && el.scrollTo(0, el.scrollHeight));
    el.addEventListener("scroll", onScroll);
    ro.observe(el);
    return () => (el.removeEventListener("scroll", onScroll), ro.disconnect());
  }, []);
  useEffect(() => {
    if (pinned.current) list.current?.scrollTo(0, list.current.scrollHeight);
  }, [messages.length, working, steps, runs.at(-1)?.run]);

  // Reverting a note that later changes built on drops those too, so it asks first.
  const revert = async (from: number, to: number) => {
    const later = newest - to;
    if (later > 0 && !(await confirmIt({ title: "Revert to before this note?", body: `This also drops ${later} later change${later === 1 ? "" : "s"}. Undo brings them back.`, ok: "Revert" }))) return;
    api.post(slug, "revert", { from }).catch((e) => setError(String(e.message)));
  };

  const said = selection ? words.filter((w) => w.start >= selection.start - 0.05 && w.start < selection.end).map((w) => w.text).join(" ") : "";
  const send = async () => {
    if (!note.trim() || working) return;
    setError("");
    pinned.current = true;
    try {
      await api.post(slug, "chat", { note, selection: selection && { start: selection.start, end: selection.end }, playhead: playhead.get() });
      setNote("");
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  return (
    <aside className="chat">
      <div className="panel-bar suggest-bar">
        <b>Claude</b>
        <span className="spacer" />
        {pending.length > 0 && <span className="muted small">{pending.length} to review</span>}
        <button onClick={() => api.post(slug, "suggest").catch((e) => setError(String(e.message)))} disabled={working}>
          Suggest graphics
        </button>
      </div>
      {pending.length > 0 && (
        <div className="drafts">
          {pending.map((d) => (
            <div key={d.id} className="draft-card">
              <button className="quiet when" onClick={() => onSeek(d.start + 0.05)}>
                {clock(d.start)} · {d.visual.kind} ({d.layout})
              </button>
              <p>{d.reason}</p>
              {failed[d.id] && <p className="error small">{failed[d.id]}</p>}
              <div className="row">
                <button className="small" onClick={() => decide(d.id, false)}>
                  Reject
                </button>
                <button className="small primary" onClick={() => decide(d.id, true)}>
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="messages" ref={list}>
        {runs.length === 0 && !working && (
          <p className="hint">
            <b>Tell Claude what to change</b>
            Drag on the timeline to select a stretch, or just park the playhead, then write a note. Press M to leave a note for the review instead.
          </p>
        )}
        {runs.map((g, i) => (
          <RunView key={g.note?.at ?? i} g={g} r={r} newest={newest} working={working} onOpen={onOpen} onRevert={revert} />
        ))}
      </div>
      {issues.length > 0 && (
        <div className="checks">
          <button className="small" onClick={() => setShowChecks((v) => !v)} title="What the plan's checks found">
            {errorCount > 0 && <span className="n error">{errorCount} error{errorCount > 1 ? "s" : ""}</span>}
            {warnCount > 0 && <span className="n warn">{warnCount} warning{warnCount > 1 ? "s" : ""}</span>}
            <span className="muted">{showChecks ? "Hide" : "Show"}</span>
          </button>
          {showChecks && issues.map((i, k) => <p key={k} className={`${i.level} small`}>{i.message}</p>)}
        </div>
      )}
      <div className="compose">
        {selection ? (
          <div className="chip">
            <span>
              {selection.label ? `${selection.label}, ` : ""}
              {clock(selection.start)} to {clock(selection.end)}
              {said ? `: "${said.length > 90 ? said.slice(0, 90) + "…" : said}"` : ""}
            </span>
            <button onClick={onClear} title="Clear the selection">×</button>
          </div>
        ) : (
          <div className="chip muted">At <Clock />. Drag on the timeline to select a section.</div>
        )}
        <div className="box">
          <textarea
            id="chat-note"
            value={note}
            placeholder="What should change?"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
          />
          <div className="row">
            <span className="muted small">{working ? "Claude is working" : "⌘↩ to send"}</span>
            {working ? (
              <button className="small" onClick={() => api.post(slug, "stop")}>Stop</button>
            ) : (
              <button className="primary small" onClick={send} disabled={!note.trim()}>
                Send
              </button>
            )}
          </div>
        </div>
        {error && <p className="error small">{error}</p>}
      </div>
    </aside>
  );
};
