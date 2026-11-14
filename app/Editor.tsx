import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { compositionFor } from "../effects/canvas";
import { type Beat, beatAt, reelBeats } from "../engine/beats";
import { deleteRange, type Levels, rippleDelete, splitAt, wholeCut } from "../engine/cut";
import type { CutPlan, Resolved, ResolvedShot } from "../engine/schema";
import { noteTime } from "../engine/review";
import { api, type ChatMessage, clock, type Issue, type Project, type Suggestion } from "./api";
import { BeatBar } from "./Beats";
import { Clock, playhead, usePlayhead } from "./playhead";
import { ask } from "./dialog";
import { Preflight } from "./Preflight";
import { ApprovalBadge, useApproval } from "./Approval";
import { useProject } from "./project";
import { KeysButton, RedoIcon, ThemeSwitch, UndoIcon } from "./ui";

const KEYS: [string, string][] = [
  ["Space", "Play or pause"],
  ["J K L", "Play back, stop, play forward (again to go faster)"],
  ["← or →", "Step a beat on a reel, a frame on YouTube (Shift: a second)"],
  ["I or O", "Mark the start or end of a selection"],
  ["B", "Split the cut at the playhead"],
  ["Delete", "Remove the picked graphic, segment or selection"],
  ["M", "Write a review note at the playhead"],
  ["⌘Z or ⇧⌘Z", "Undo or redo"],
  ["⌘↩", "Send the note to Claude"],
  ["Esc", "Close the open graphic"],
];
import { component } from "./Gallery";
import { Inspector } from "./Inspector";
import { Library } from "./Library";
import { type Range, Timeline } from "./Timeline";

// The player plays the light preview copies, not the 4K master. `mix`: the mixed sound (voice,
// music, effects) in place of the voice alone.
export const playable = (r: Resolved, mix?: string): Resolved => ({
  ...r,
  video: r.video && r.preview?.video ? r.preview.video : r.video,
  audio: mix ?? r.preview?.audio ?? r.audio,
  ...(mix && r.cut ? { cut: r.cut.map((c) => ({ ...c, audio: undefined })) } : {}),
});

// Voice or Mix: what the player sounds like. Mix is the export's own mix of the plan as it is (a
// few seconds on a reel, longer on a long video). While Mix is picked it is made, and remade, on
// its own once the plan has been still for a moment: Owain never heard the music or the effects in
// the editor because the mix waited for a click (2026-11-13). One try per plan, so a mix that fails
// is not retried in a loop.
export const SoundPick: React.FC<{ slug: string; p: Project; on: boolean; set: (on: boolean) => void }> = ({ slug, p, on, set }) => {
  const [error, setError] = useState("");
  const running = !!p.status && !p.status.done;
  const make = () => api.post(slug, "mix").then(() => setError("")).catch((e) => setError(String(e.message)));
  const tried = useRef<unknown>(null);
  const stale = !p.mix || !p.mix.fresh;
  useEffect(() => {
    if (!on || !stale || running || !p.resolved || tried.current === p.resolved) return;
    const t = setTimeout(() => ((tried.current = p.resolved), make()), 1500);
    return () => clearTimeout(t);
  }, [on, stale, running, p.resolved]);
  return (
    <div className="seg sound" title={error || "What the player sounds like: the voice alone, or the mix with music and sound effects"}>
      <button className={!on || !p.mix ? "on" : ""} onClick={() => set(false)}>Voice</button>
      <button className={on && p.mix ? "on" : ""} onClick={() => (set(true), (!p.mix || !p.mix.fresh) && !running && make())}>
        {on && running ? p.status!.stage : on && p.mix && !p.mix.fresh ? "Mix (out of date)" : "Mix"}
      </button>
      {on && p.mix && !p.mix.fresh && !running && <button onClick={make} title="The plan's sound changed since this mix was made">Remix</button>}
    </div>
  );
};

export const Editor: React.FC<{ slug: string }> = ({ slug }) => {
  const { p, error, setError, chat, working } = useProject(slug);
  const [selection, setSelection] = useState<Range | null>(null);
  const [note, setNote] = useState("");
  const [dropError, setDropError] = useState("");
  const [segment, setSegment] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  // The graphic open in the inspector (by its id), and its unsaved look while it is edited.
  // `?shot=<id>` in the address opens one, as the review page's "Open in the editor" does.
  const [picked, setPicked] = useState<string | null>(() => new URLSearchParams(location.hash.split("?")[1] ?? "").get("shot"));
  const [draft, setDraft] = useState<ResolvedShot | null>(null);
  // A note being written for the review (M): the time it was started at.
  const [noting, setNoting] = useState<number | null>(null);
  const [preflight, setPreflight] = useState(false);
  const approve = useApproval(slug, setDropError);
  // The mix by default, so the sound effects are heard; the voice alone until a mix exists.
  const [mixed, setMixed] = useState(true);
  const mix = mixed && p?.mix ? p.mix.file : undefined;
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

  // The player's clock goes to the playhead store (app/playhead.tsx), not to this component's
  // state: only what shows the time is redrawn as it plays.
  useEffect(() => playhead.set(0), [slug]);
  useEffect(() => {
    const pl = player.current;
    if (!pl || !p?.resolved) return;
    const fps = p.resolved.fps;
    const on = (e: { detail: { frame: number } }) => playhead.set(e.detail.frame / fps);
    pl.addEventListener("frameupdate", on);
    return () => pl.removeEventListener("frameupdate", on);
  }, [p?.resolved]);

  const r = useMemo(() => {
    if (!p?.resolved) return null;
    const base = playable(p.resolved, mix);
    if (!draft) return base;
    return { ...base, shots: base.shots.map((s) => (s.id === draft.id ? draft : s)) };
  }, [p?.resolved, draft, mix]);
  // The server's next plan includes the edit, so the patch is dropped when it arrives.
  useEffect(() => setDraft(null), [p?.resolved]);
  const seek = (t: number) => {
    player.current?.seekTo(Math.round(t * (r?.fps ?? 30)));
    playhead.set(t);
  };
  // A reel's beats, for stepping through its graphics one change at a time (app/Beats.tsx).
  const beats = useMemo(() => (r && r.canvas === "reel" && p?.words ? reelBeats(r.shots, p.words, r.duration, r.fps) : []), [r, p?.words]);
  const step = (i: number) => {
    const b = beats[Math.max(0, Math.min(beats.length - 1, i))];
    if (!b) return;
    stopShuttle();
    seek(b.at);
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
  const keys = useRef({ selection, segment, cut, rate, picked, duration: r?.duration ?? 0, fps: r?.fps ?? 30, beats, step, seek });
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
  keys.current = { selection, segment, cut, rate, picked, duration: r?.duration ?? 0, fps: r?.fps ?? 30, beats, step, seek };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]")) return;
      const k = keys.current;
      const pl = player.current;
      const time = playhead.get();
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
        api.post(slug, "shot", { id: k.picked, remove: true }).then(() => setPicked(null)).catch((err) => setDropError(String(err.message)));
      } else if (key === "b") saveCut(splitAt(k.cut, time)).catch(() => {});
      // A note for the review at this moment. The video keeps playing while it is written.
      else if (key === "m") setNoting(time);
      else if (key === "delete" || key === "backspace") {
        e.preventDefault();
        if (k.segment) saveCut(rippleDelete(k.cut, k.segment)).then(() => setSegment(null)).catch(() => {});
        else if (k.selection && k.selection.end - k.selection.start > 0.04)
          saveCut(deleteRange(k.cut, k.selection.start, k.selection.end)).then(() => (setSelection(null), k.seek(k.selection!.start))).catch(() => {});
      } else if (key === "i" || key === "o") {
        // The marks outlive the selection, so moving the playhead between I and O keeps the other one.
        const m = marks.current;
        if (key === "i") (m.in = time), m.out !== undefined && m.out <= time && (m.out = undefined);
        else (m.out = time), m.in !== undefined && m.in >= time && (m.in = undefined);
        setSelection({ start: m.in ?? 0, end: m.out ?? k.duration });
      }
      else if (key === "arrowleft" || key === "arrowright") {
        // A reel steps a beat at a time. A video with no beats steps a frame, or a second with Shift.
        const dir = key === "arrowright" ? 1 : -1;
        if (k.beats.length) k.step(beatAt(k.beats, time) + dir);
        else (stopShuttle(), k.seek(Math.max(0, Math.min(k.duration, time + dir * (e.shiftKey ? 1 : 1 / k.fps)))));
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
  const review = p.review;
  // A reel whose final export is current is approved from here; Approve is then the next step.
  const approval = p.approval;
  const toApprove = !!approval?.ready && approval.state !== "approved" && !rendering;
  // Notes not yet closed, where their words are now.
  const notes = (review?.review.notes ?? []).filter((n) => n.status !== "done").map((n) => ({ ...n, t: noteTime(n, p.words!) }));

  return (
    <Shell
      title={r.title}
      kind={r.canvas === "youtube" ? "YouTube" : "Reel"}
      badge={approval && <ApprovalBadge a={approval} />}
      keys={KEYS}
      actions={
        <>
          <button className="icon" onClick={() => api.post(slug, "undo")} disabled={(p.versions?.length ?? 0) < 2} title="Undo: go back to the previous version of the plan and cut (⌘Z)" aria-label="Undo">
            <UndoIcon />
          </button>
          <button className="icon" onClick={() => api.post(slug, "redo")} disabled={!p.redo} title="Redo: bring back what was undone (⇧⌘Z)" aria-label="Redo">
            <RedoIcon />
          </button>
          <span className="version" title={`Version ${p.versions?.length ?? 1} of the plan. Every change is kept.`}>v{p.versions?.length ?? 1}</span>
          <span className="gap" />
          {review && review.items.length > 0 && (
            <a className="button" href={`#/p/${slug}/review`} title="Look at every graphic before rendering: approve it, or ask for a change">
              Review {review.counts.approved}/{review.items.length}
            </a>
          )}
          {p.render && !rendering && (
            <a className="button" href={`/${p.render.file}?t=${p.render.at}`} download>
              Download
            </a>
          )}
          {approval?.record && approval.reveal && approval.state === "approved" && (
            <button onClick={approve.reveal} title={approval.record.video}>
              Show in Finder
            </button>
          )}
          {toApprove && (
            <button className="primary" disabled={!!approve.busy} onClick={approve.approve} title={`Put the export, its image and its caption in a folder in ${approval!.folder}`}>
              {approve.busy === "approve" ? "Approving…" : approval!.state === "stale" ? "Approve again" : "Approve"}
            </button>
          )}
          <button className={toApprove ? "" : "primary"} onClick={() => setPreflight(true)} disabled={!!rendering} title={errors.length ? "The plan has errors; see what is in the way" : "Check the video is ready, then export"}>
            {rendering ? p.status!.stage : "Export"}
          </button>
        </>
      }
    >
      <div className={`editor ${r.canvas === "youtube" ? "wide" : ""}`}>
        <Library slug={slug} r={r} picked={picked} onPick={(t) => setPicked(t)} cut={cut} onCut={saveCut} onSelect={setSelection} bin={p.bin ?? []} canvas={r.canvas} theme={r.theme} assets={p.assets ?? []} words={p.words} onSeek={seek} onUse={(ref) => setNote((n) => `${n}${n && !n.endsWith(" ") ? " " : ""}${ref} `)} />
        <section className="stage">
          <div className="screen">
          <Player
            ref={player}
            component={component(r)}
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
          </div>
          <div className="stage-tools">
            <SoundPick slug={slug} p={p} on={mixed} set={setMixed} />
          </div>
          {beats.length > 0 && <LiveBeatBar beats={beats} shots={r.shots} onStep={step} />}
          {noting !== null && (
            <NoteBox
              at={noting}
              onCancel={() => setNoting(null)}
              onSave={(text) => api.post(slug, "note", { t: noting, text }).then(() => setNoting(null)).catch((e) => setDropError(String(e.message)))}
            />
          )}
        </section>
        {picked !== null ? (
          <Inspector
            key={picked}
            slug={slug}
            r={p.resolved!}
            plan={p.plan ?? "{}"}
            id={picked}
            words={p.words}
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
          <Timeline r={r} words={p.words} selection={selection} camera={p.camera} music={music} onSeek={seek} onSelect={setSelection} drafts={(p.suggestions ?? []).filter((x) => x.status === "pending")} onDropClip={(ref, at, length) => api.post(slug, "drop", { ref, at, length }).then(() => setError("")).catch((e) => setDropError(String(e.message)))}
            cut={cut} bin={p.bin ?? []} clipWords={p.clipWords ?? {}} levels={levels} segment={segment} onSegment={setSegment} onCut={saveCut} onShotStart={shotStart}
            picked={picked} onPick={(t) => (setPicked(t), setSegment(null))} beats={beats} onBeat={step} notes={notes}
            previews={p.previews ?? {}} rendering={!!rendering} onParts={(change) => api.post(slug, "parts", change).catch((e) => setDropError(String(e.message)))} onRender={(ask) => api.post(slug, "render", ask).catch((e) => setDropError(String(e.message)))} />
          {dropError && (
            <div className="toast" onClick={() => setDropError("")}>
              {dropError}
            </div>
          )}
        </section>
      </div>
      {preflight && <Preflight slug={slug} p={p} onClose={() => setPreflight(false)} />}
    </Shell>
  );
};

// The beat under the playhead, redrawn only when the playhead crosses into another beat.
const LiveBeatBar: React.FC<{ beats: Beat[]; shots: ResolvedShot[]; onStep: (i: number) => void }> = ({ beats, shots, onStep }) => {
  const current = usePlayhead((t) => beatAt(beats, t));
  return <BeatBar beats={beats} current={current} shots={shots} onStep={onStep} />;
};

// A note for the review, at the moment M was pressed. Enter saves it, Escape drops it.
export const NoteBox: React.FC<{ at: number; onSave: (text: string) => void; onCancel: () => void }> = ({ at, onSave, onCancel }) => {
  const [text, setText] = useState("");
  return (
    <div className="notebox">
      <span className="muted small">Note at {clock(at)}</span>
      <input
        autoFocus
        value={text}
        placeholder="What is wrong here? Enter to save."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) onSave(text);
          if (e.key === "Escape") onCancel();
        }}
      />
      <button className="small quiet" onClick={onCancel}>Cancel</button>
    </div>
  );
};

export const Shell: React.FC<{ title: string; kind?: string; badge?: React.ReactNode; keys?: [string, string][]; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, kind, badge, keys, actions, children }) => (
  <div className="app">
    <header className="bar">
      <a className="brand" href="#/" title="All projects">Studio</a>
      <span className="crumb">
        <a href="#/">Projects</a>
        <span>/</span>
        <span className="title">
          {title}
          {kind && <span className="kind">{kind}</span>}
        </span>
        {badge}
      </span>
      <span className="spacer" />
      {actions}
      {keys && <KeysButton keys={keys} />}
      <ThemeSwitch />
    </header>
    {children}
  </div>
);

const Chat: React.FC<{
  slug: string;
  messages: ChatMessage[];
  working: boolean;
  selection: Range | null;
  words: { text: string; start: number }[];
  note: string;
  setNote: (n: string) => void;
  issues: Issue[];
  suggestions: Suggestion[];
  onSeek: (t: number) => void;
  onClear: () => void;
}> = ({ slug, messages, working, selection, words, note, setNote, issues, suggestions, onSeek, onClear }) => {
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
  useEffect(() => {
    list.current?.scrollTo(0, list.current.scrollHeight);
  }, [messages.length, working]);

  const said = selection ? words.filter((w) => w.start >= selection.start - 0.05 && w.start < selection.end).map((w) => w.text).join(" ") : "";
  const send = async () => {
    if (!note.trim() || working) return;
    setError("");
    try {
      await api.post(slug, "chat", { note, selection: selection && { start: selection.start, end: selection.end }, playhead: playhead.get() });
      setNote("");
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  return (
    <aside className="chat">
      <div className="suggest-bar">
        <h3 className="panel-h">Claude</h3>
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
        {messages.length === 0 && !working && (
          <p className="hint">
            <b>Tell Claude what to change</b>
            Drag on the timeline to select a stretch, or just park the playhead, then write a note. Press M to leave a note for the review instead.
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
