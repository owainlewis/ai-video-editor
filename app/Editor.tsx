import { Player, type PlayerRef } from "@remotion/player";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compositionFor } from "../effects/canvas";
import { Reel } from "../effects/Reel";
import { Wide } from "../effects/Wide";
import { deleteRange, type Levels, rippleDelete, splitAt, wholeCut } from "../engine/cut";
import type { CutPlan, Resolved, ResolvedShot } from "../engine/schema";
import { api, type ChatMessage, clock, type Issue, type Project, type Suggestion } from "./api";
import { Inspector } from "./Inspector";
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
  const [dropError, setDropError] = useState("");
  const [segment, setSegment] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  // The graphic open in the inspector (by its start time), and its unsaved look while it is edited.
  const [picked, setPicked] = useState<number | null>(null);
  const [draft, setDraft] = useState<ResolvedShot | null>(null);
  const player = useRef<PlayerRef>(null);
  // Each clip's loudness, read once, so trims snap to the real pauses between words.
  const [levels, setLevels] = useState<Record<string, Levels>>({});
  const ready = (p?.bin ?? []).filter((c) => c.ready).map((c) => c.id).join(",");
  useEffect(() => {
    for (const id of ready.split(",").filter((x) => x && !levels[x]))
      fetch(`/${id === "main" ? slug : `${slug}/clips/${id}`}/build/level.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((l: Levels | null) => l && setLevels((m) => ({ ...m, [id]: l })))
        .catch(() => {});
  }, [slug, ready]);

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

  const r = useMemo(() => {
    if (!p?.resolved) return null;
    const base = playable(p.resolved);
    if (!draft) return base;
    return { ...base, shots: base.shots.map((s) => (Math.abs(s.start - draft.start) < 0.02 ? draft : s)) };
  }, [p?.resolved, draft]);
  // The server's next plan includes the edit, so the patch is dropped when it arrives.
  useEffect(() => setDraft(null), [p?.resolved]);
  const seek = (t: number) => {
    player.current?.seekTo(Math.round(t * (r?.fps ?? 30)));
    setTime(t);
  };

  // Every cut edit writes the whole cut back; the server saves it as a version and resolves the
  // plan on it, and the editor reloads when it says so.
  const cut: CutPlan = p?.cut ?? wholeCut(r?.duration ?? 0);
  // A re-cut moves what plays at every time, so a selected range no longer means the same words.
  const cutKey = JSON.stringify(p?.cut ?? null);
  const firstCut = useRef(cutKey);
  useEffect(() => {
    if (firstCut.current === cutKey) return;
    firstCut.current = cutKey;
    setSelection(null);
    marks.current = {};
  }, [cutKey]);
  const saveCut = (next: CutPlan) =>
    api.post(slug, "cut", { cut: next }).catch((e) => {
      setDropError(String(e.message));
      throw e;
    });
  const shotStart = (from: number, to: number) =>
    api.post(slug, "shot-start", { from, to }).catch((e) => {
      setDropError(String(e.message));
    });

  // The editor's keys, as in Final Cut: J K L to play back, pause and play (again to go faster),
  // I and O to mark a range, B to blade at the playhead, Delete to ripple delete the selected
  // segment or the marked range, Cmd-Z and Shift-Cmd-Z to undo and redo. Not while typing a note.
  const keys = useRef({ time, selection, segment, cut, rate, picked, duration: r?.duration ?? 0 });
  const marks = useRef<{ in?: number; out?: number }>({});
  // J K L: which way the playhead is moving, and the timer that steps it back for J.
  const shuttle = useRef<{ dir: -1 | 0 | 1; speed: number; timer?: number }>({ dir: 0, speed: 1 });
  const stopShuttle = () => {
    clearInterval(shuttle.current.timer);
    shuttle.current = { dir: 0, speed: 1 };
    player.current?.pause();
    setRate(1);
  };
  // Pausing from the player's own controls or the space bar ends the shuttle too.
  useEffect(() => {
    const pl = player.current;
    if (!pl) return;
    const paused = () => shuttle.current.dir === 1 && ((shuttle.current = { dir: 0, speed: 1 }), setRate(1));
    pl.addEventListener("pause", paused);
    return () => pl.removeEventListener("pause", paused);
  }, [p?.resolved]);
  keys.current = { time, selection, segment, cut, rate, picked, duration: r?.duration ?? 0 };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]")) return;
      const k = keys.current;
      const pl = player.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        api.post(slug, e.shiftKey ? "redo" : "undo");
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "escape" && k.picked !== null) setPicked(null);
      else if ((key === "delete" || key === "backspace") && k.picked !== null) {
        // With a graphic open, Delete takes the graphic off; it never cuts the footage under it.
        e.preventDefault();
        api.post(slug, "shot", { start: k.picked, remove: true }).then(() => setPicked(null)).catch((err) => setDropError(String(err.message)));
      } else if (key === "b") saveCut(splitAt(k.cut, k.time)).catch(() => {});
      else if (key === "delete" || key === "backspace") {
        e.preventDefault();
        if (k.segment) saveCut(rippleDelete(k.cut, k.segment)).then(() => setSegment(null)).catch(() => {});
        else if (k.selection && k.selection.end - k.selection.start > 0.04)
          saveCut(deleteRange(k.cut, k.selection.start, k.selection.end)).then(() => (setSelection(null), seek(k.selection!.start))).catch(() => {});
      } else if (key === "i" || key === "o") {
        // The marks outlive the selection, so moving the playhead between I and O keeps the other one.
        const m = marks.current;
        if (key === "i") (m.in = k.time), m.out !== undefined && m.out <= k.time && (m.out = undefined);
        else (m.out = k.time), m.in !== undefined && m.in >= k.time && (m.in = undefined);
        setSelection({ start: m.in ?? 0, end: m.out ?? k.duration });
      }
      else if (key === "k") stopShuttle();
      else if (key === "l") {
        // Again while playing forward goes faster: 2x, then 4x.
        if (shuttle.current.dir === 1) setRate(Math.min(4, k.rate * 2));
        else {
          clearInterval(shuttle.current.timer);
          shuttle.current = { dir: 1, speed: 1 };
          setRate(1);
          pl?.play();
        }
      } else if (key === "j") {
        // Backwards, silent: the player's audio cannot run in reverse, so the playhead steps back.
        if (shuttle.current.dir === -1) shuttle.current.speed = Math.min(4, shuttle.current.speed * 2);
        else {
          stopShuttle();
          const fps = r?.fps ?? 30;
          shuttle.current = { dir: -1, speed: 1, timer: window.setInterval(() => {
            const frame = (pl?.getCurrentFrame() ?? 0) - shuttle.current.speed;
            pl?.seekTo(Math.max(0, frame));
            if (frame <= 0) stopShuttle();
          }, 1000 / fps) };
        }
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [slug]);

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
          <button onClick={() => api.post(slug, "undo")} disabled={(p.versions?.length ?? 0) < 2} title="Go back to the previous version of the plan and cut (⌘Z)">
            Undo
          </button>
          <button onClick={() => api.post(slug, "redo")} disabled={!p.redo} title="Bring back what was undone (⇧⌘Z)">
            Redo
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
        <Library slug={slug} r={r} picked={picked} onPick={(t) => setPicked(t)} cut={cut} onCut={saveCut} onSelect={setSelection} bin={p.bin ?? []} canvas={r.canvas} theme={r.theme} assets={p.assets ?? []} words={p.words} time={time} onSeek={seek} onUse={(ref) => setNote((n) => `${n}${n && !n.endsWith(" ") ? " " : ""}${ref} `)} />
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
            playbackRate={rate}
            controls
            clickToPlay
            spaceKeyToPlayOrPause
            acknowledgeRemotionLicense
          />
        </section>
        {picked !== null ? (
          <Inspector
            key={picked}
            slug={slug}
            r={p.resolved!}
            plan={p.plan ?? "{}"}
            start={picked}
            words={p.words}
            time={time}
            onPreview={setDraft}
            onAsk={() => setPicked(null)}
            onClose={() => setPicked(null)}
            onSeek={seek}
            variants={p.variants}
            working={working}
          />
        ) : (
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
          suggestions={p.suggestions ?? []}
          onSeek={seek}
          onClear={() => setSelection(null)}
        />
        )}
        <section className="bottom">
          <Timeline r={r} words={p.words} time={time} selection={selection} camera={p.camera} music={music} onSeek={seek} onSelect={setSelection} drafts={(p.suggestions ?? []).filter((x) => x.status === "pending")} onDropClip={(ref, at, length) => api.post(slug, "drop", { ref, at, length }).then(() => setError("")).catch((e) => setDropError(String(e.message)))}
            cut={cut} bin={p.bin ?? []} clipWords={p.clipWords ?? {}} levels={levels} segment={segment} onSegment={setSegment} onCut={saveCut} onShotStart={shotStart}
            picked={picked} onPick={(t) => (setPicked(t), setSegment(null))} />
          {dropError && (
            <div className="toast" onClick={() => setDropError("")}>
              {dropError}
            </div>
          )}
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
  suggestions: Suggestion[];
  onSeek: (t: number) => void;
  onClear: () => void;
}> = ({ slug, messages, working, selection, time, words, note, setNote, issues, suggestions, onSeek, onClear }) => {
  const pending = suggestions.filter((s) => s.status === "pending");
  const [failed, setFailed] = useState<Record<string, string>>({});
  const decide = (id: string, accept: boolean) =>
    api
      .post(slug, "decide", { id, accept, note: accept ? "" : (prompt("Why not? (optional, it helps the next round)") ?? "") })
      .then(() => setFailed((f) => ({ ...f, [id]: "" })))
      .catch((e) => setFailed((f) => ({ ...f, [id]: String(e.message) })));
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
      <div className="suggest-bar">
        <button onClick={() => api.post(slug, "suggest").catch((e) => setError(String(e.message)))} disabled={working}>
          Suggest graphics
        </button>
        {pending.length > 0 && <span className="muted small">{pending.length} to review</span>}
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
