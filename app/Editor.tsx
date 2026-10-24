import { Player, type PlayerRef } from "@remotion/player";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compositionFor } from "../effects/canvas";
import { Reel } from "../effects/Reel";
import { Wide } from "../effects/Wide";
import type { Resolved } from "../engine/schema";
import { api, type ChatMessage, clock, type Issue, type Project } from "./api";
import { Library } from "./Library";
import { type Range, Timeline } from "./Timeline";

// The player plays the light preview copies, not the 4K master.
const playable = (r: Resolved): Resolved => ({
  ...r,
  video: r.video && r.preview?.video ? r.preview.video : r.video,
  audio: r.preview?.audio ?? r.audio,
});

export const Editor: React.FC<{ slug: string }> = ({ slug }) => {
  const [p, setP] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [selection, setSelection] = useState<Range | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");
  const player = useRef<PlayerRef>(null);

  const load = useCallback(
    () =>
      api.project(slug).then((d) => {
        setP(d);
        setChat(d.chat ?? []);
        setWorking(!!d.working);
        setError("");
      }).catch((e) => setError(String(e.message))),
    [slug],
  );
  useEffect(() => {
    load();
    return api.events((e) => {
      if (e.slug !== slug) return;
      if (e.type === "plan" || e.type === "status") load();
      if (e.type === "chat") {
        const m = e.message;
        if (m.role === "status") setWorking(m.text === "working");
        else setChat((c) => [...c, m]);
      }
    });
  }, [slug, load]);

  // Follow the player's clock for the timeline.
  useEffect(() => {
    const pl = player.current;
    if (!pl || !p?.resolved) return;
    const fps = p.resolved.fps;
    const on = (e: { detail: { frame: number } }) => setTime(e.detail.frame / fps);
    pl.addEventListener("frameupdate", on);
    return () => pl.removeEventListener("frameupdate", on);
  }, [p?.resolved]);

  const r = useMemo(() => (p?.resolved ? playable(p.resolved) : null), [p?.resolved]);
  const seek = (t: number) => {
    player.current?.seekTo(Math.round(t * (r?.fps ?? 30)));
    setTime(t);
  };

  if (error) return <Shell title={slug}><p className="error pad">{error}</p></Shell>;
  if (!p) return <Shell title={slug}><p className="pad muted">Loading…</p></Shell>;
  if (!r || !p.words)
    return (
      <Shell title={slug}>
        <div className="pad">
          <p>{p.status?.error ? `Import failed: ${p.status.error}` : `${p.status?.stage ?? "Importing"}…`}</p>
          {!p.status?.done && <p className="muted">This takes about a minute for a reel. The editor opens by itself when it is ready.</p>}
          {p.issues?.map((i, k) => <p key={k} className="error">{i.message}</p>)}
        </div>
      </Shell>
    );

  const comp = compositionFor(r.canvas);
  const errors = p.issues?.filter((i) => i.level === "error") ?? [];
  const music = (() => {
    try {
      return !!JSON.parse(p.plan ?? "{}").music;
    } catch {
      return false;
    }
  })();
  const rendering = p.status && !p.status.done;

  return (
    <Shell
      title={r.title}
      actions={
        <>
          <button className="quiet" onClick={() => api.remove(slug, r.title).then((done) => done && (location.hash = "#/")).catch((e) => setError(String(e.message)))}>
            Delete
          </button>
          <button onClick={() => api.post(slug, "undo")} disabled={(p.versions?.length ?? 0) < 2} title="Go back to the previous version of the plan">
            Undo
          </button>
          <span className="muted small">v{p.versions?.length ?? 1}</span>
          {p.render && !rendering && (
            <a className="button" href={`/${p.render.file}?t=${p.render.at}`} download>
              Download
            </a>
          )}
          <button className="primary" onClick={() => api.post(slug, "render")} disabled={!!rendering || errors.length > 0}>
            {rendering ? p.status!.stage : "Export video"}
          </button>
        </>
      }
    >
      <div className={`editor ${r.canvas === "youtube" ? "wide" : ""}`}>
        <Library slug={slug} assets={p.assets ?? []} words={p.words} time={time} onSeek={seek} onUse={(a) => setNote((n) => `${n}${n && !n.endsWith(" ") ? " " : ""}${a.path} `)} />
        <section className="stage">
          <Player
            ref={player}
            component={(r.canvas === "youtube" ? Wide : Reel) as React.FC<Resolved>}
            inputProps={r}
            durationInFrames={Math.max(1, Math.round(r.duration * r.fps))}
            fps={r.fps}
            compositionWidth={comp.width}
            compositionHeight={comp.height}
            style={{ height: "100%", maxWidth: "100%", aspectRatio: `${comp.width} / ${comp.height}` }}
            controls
            clickToPlay
            spaceKeyToPlayOrPause
            acknowledgeRemotionLicense
          />
        </section>
        <Chat
          slug={slug}
          messages={chat}
          working={working}
          selection={selection}
          time={time}
          words={p.words}
          note={note}
          setNote={setNote}
          issues={p.issues ?? []}
          onClear={() => setSelection(null)}
        />
        <section className="bottom">
          <Timeline r={r} words={p.words} time={time} selection={selection} camera={p.camera} music={music} onSeek={seek} onSelect={setSelection} />
        </section>
      </div>
    </Shell>
  );
};

const Shell: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, actions, children }) => (
  <div className="app">
    <header className="bar">
      <a className="brand" href="#/">Studio</a>
      <span className="title">{title}</span>
      <span className="spacer" />
      {actions}
    </header>
    {children}
  </div>
);

const Chat: React.FC<{
  slug: string;
  messages: ChatMessage[];
  working: boolean;
  selection: Range | null;
  time: number;
  words: { text: string; start: number }[];
  note: string;
  setNote: (n: string) => void;
  issues: Issue[];
  onClear: () => void;
}> = ({ slug, messages, working, selection, time, words, note, setNote, issues, onClear }) => {
  const [showChecks, setShowChecks] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo(0, list.current.scrollHeight);
  }, [messages.length, working]);

  const said = selection ? words.filter((w) => w.start >= selection.start - 0.05 && w.start < selection.end).map((w) => w.text).join(" ") : "";
  const send = async () => {
    if (!note.trim() || working) return;
    setError("");
    try {
      await api.post(slug, "chat", { note, selection: selection && { start: selection.start, end: selection.end }, playhead: time });
      setNote("");
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  return (
    <aside className="chat">
      <div className="messages" ref={list}>
        {messages.length === 0 && (
          <p className="muted small">
            Select a section on the timeline, then say what to change: "add a graphic for these three steps", "put a lower third with my name
            here", "make the captions smaller". You can also edit with Claude Code in a terminal; this page updates either way.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {working && <div className="msg tool">Claude is working…</div>}
      </div>
      {issues.length > 0 && (
        <div className="checks">
          <button className="quiet small" onClick={() => setShowChecks((v) => !v)}>
            {issues.some((i) => i.level === "error") ? "⚠ " : ""}
            {issues.length} check{issues.length > 1 ? "s" : ""} {showChecks ? "▾" : "▸"}
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
          <div className="chip muted">At {clock(time)}. Drag on the timeline to select a section.</div>
        )}
        <textarea
          value={note}
          placeholder="What should change?"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
        />
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <span className="muted small">⌘↩ to send</span>
          {working ? (
            <button onClick={() => api.post(slug, "stop")}>Stop</button>
          ) : (
            <button className="primary" onClick={send} disabled={!note.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
