import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { compositionFor } from "../effects/canvas";
import { settledTime } from "../effects/preview";
import { isGraphic } from "../engine/resolve";
import { type Item, type ItemReview, type Note, noteTime, seenPath, type Status } from "../engine/review";
import type { Resolved, ResolvedShot } from "../engine/schema";
import { api, clock, type Project } from "./api";
import { NoteBox, playable, Shell, SoundPick } from "./Editor";
import { component, Tile } from "./Gallery";
import { Preflight, preflight } from "./Preflight";
import { useProject } from "./project";
import { gist } from "./Timeline";

// Review before render (#/p/<slug>/review). Every moment that changes on screen is an item: it
// loops live with the footage and its sound, beside what is said, its checks and its QC strip.
// Approve it or ask for a change; notes go to Claude in one run, and whatever changes comes back
// to the queue as waiting, with the old version beside it. Watch plays the whole video through,
// with M to drop a note without stopping. Nothing here is rendered.
//
// Keys: J and K move, A approves, C asks for a change, N goes to the next waiting item, W watches
// the whole video, M writes a note at the playhead, P shows the phone frame (reels), Escape leaves a field.

type Tab = "queue" | "notes" | "export";
const KEYS: [string, string][] = [
  ["J or K", "Next or previous graphic"],
  ["A", "Approve, and go to the next one waiting"],
  ["C", "Ask for a change and write why"],
  ["N", "Next graphic waiting"],
  ["W", "Watch the whole video, or go back to one graphic"],
  ["M", "Write a note at this moment"],
  ["P", "Phone frame, on a reel"],
  ["Space", "Play or pause"],
  ["Esc", "Leave a text field"],
];
const LABEL: Record<Status, string> = { waiting: "Waiting", approved: "Approved", change: "Change" };

export const Review: React.FC<{ slug: string }> = ({ slug }) => {
  const { p, error, chat, working } = useProject(slug);
  const [current, setCurrent] = useState<string | null>(null);
  const [only, setOnly] = useState<"all" | Status>("all");
  const [tab, setTab] = useState<Tab>("queue");
  const [watch, setWatch] = useState(false);
  const [phone, setPhone] = useState(false);
  const [noting, setNoting] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [failed, setFailed] = useState("");
  const player = useRef<PlayerRef>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // The review plays the mix (made on its own, see SoundPick): it is the last look before an export.
  const [picked, setMixed] = useState<boolean | null>(null);
  const mixed = picked ?? true;
  const mix = mixed && p?.mix ? p.mix.file : undefined;
  const r = useMemo(() => (p?.resolved ? playable(p.resolved, mix) : null), [p?.resolved, mix]);
  const state = p?.review;
  const items = state?.items ?? [];
  const shown = items.filter((it) => only === "all" || state!.review.items[it.id]?.status === only);
  const item = items.find((it) => it.id === current) ?? shown[0] ?? items[0];
  const fps = r?.fps ?? 30;
  const act = (run: Promise<unknown>): Promise<boolean> =>
    run.then(() => (setFailed(""), true)).catch((e) => (setFailed(String(e.message)), false));

  // The item loops from just before it to just after it.
  const total = Math.max(1, Math.round((r?.duration ?? 0) * fps));
  const from = item ? Math.max(0, Math.round((item.start - 0.4) * fps)) : 0;
  const to = item ? Math.max(from + 1, Math.min(total - 1, Math.round((item.end + 0.4) * fps))) : total - 1;
  useEffect(() => {
    if (watch || !item) return;
    player.current?.seekTo(from);
    player.current?.play();
  }, [item?.id, watch]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    setWatch(false);
    setTab("queue");
    setCurrent(it.id);
  };
  const next = (status?: Status) => {
    const at = items.findIndex((it) => it.id === item?.id);
    const rest = [...items.slice(at + 1), ...items.slice(0, at)];
    go(status ? rest.find((it) => state!.review.items[it.id]?.status === status) : rest[0]);
  };
  const decide = (it: Item, change: { status?: Status; comment?: string }) => act(api.post(slug, "review", { id: it.id, hash: it.hash, ...change }));
  const seek = (t: number) => {
    setWatch(true);
    // The player for the whole video mounts first; then it can seek.
    setTimeout(() => player.current?.seekTo(Math.round(t * fps)), 0);
  };

  const keys = useRef({ item, items, shown, next, decide, watch });
  keys.current = { item, items, shown, next, decide, watch };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest?.("input, textarea, select");
      if (e.key === "Escape" && typing) return (typing as HTMLElement).blur();
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = keys.current;
      const key = e.key.toLowerCase();
      const at = k.shown.findIndex((it) => it.id === k.item?.id);
      if (key === "j") go(k.shown[Math.min(k.shown.length - 1, at + 1)]);
      else if (key === "k") go(k.shown[Math.max(0, at - 1)]);
      else if (key === "n") k.next("waiting");
      else if (key === "a" && k.item && !k.watch) k.decide(k.item, { status: "approved" }).then((ok) => ok && k.next("waiting"));
      else if (key === "c" && k.item && !k.watch) (k.decide(k.item, { status: "change" }), field.current?.focus());
      else if (key === "w") setWatch((w) => !w);
      else if (key === "p") setPhone((v) => !v);
      else if (key === "m") setNoting((player.current?.getCurrentFrame() ?? 0) / fps);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [slug, fps]);

  if (error) return <Shell title={slug}><p className="error pad">{error}</p></Shell>;
  if (!p || !r || !p.words || !state) return <Shell title={slug}><p className="pad muted">{p && !p.resolved ? "The plan has errors. Fix them in the editor first." : "Loading…"}</p></Shell>;

  const comp = compositionFor(r.canvas);
  const reel = r.canvas === "reel";
  const running = !!p.status && !p.status.done;
  const qc = p.qc;
  const pre = preflight(p);
  const notes = [...state.review.notes].map((n) => ({ ...n, t: noteTime(n, p.words!) })).sort((a, b) => a.t - b.t);
  const openNotes = notes.filter((n) => n.status !== "done");
  const rv = item ? state.review.items[item.id] : undefined;
  const last = chat.at(-1);

  return (
    <Shell
      title={r.title}
      kind="Review"
      keys={KEYS}
      actions={
        <>
          <a className="button" href={`#/p/${slug}`}>Back to the editor</a>
          <span className="muted small counts">
            <b>{state.counts.approved}</b> approved, <b className={state.counts.change ? "change" : ""}>{state.counts.change}</b> to change, <b>{state.counts.waiting}</b> waiting
          </span>
          <button disabled={running} onClick={() => act(api.post(slug, "qc"))} title="Measure every graphic that changed since the last run: safe area, collisions, type size, contrast">
            {running ? p.status!.stage : !qc ? "Run QC" : qc.stale.length ? `Run QC (${qc.stale.length} changed)` : "QC up to date"}
          </button>
          {working ? (
            <button onClick={() => api.post(slug, "stop")}>Claude is working… Stop</button>
          ) : (
            <button disabled={!state.open} onClick={() => act(api.post(slug, "review-send"))} title="Every open note and change, to Claude, in one run">
              Send {state.open || ""} to Claude
            </button>
          )}
          <button className={pre.ready ? "primary" : ""} onClick={() => setSheet(true)}>
            Export…
          </button>
        </>
      }
    >
      <div className="review">
        <aside className="queue">
          <div className="tabs">
            <button className={tab === "queue" ? "on" : ""} onClick={() => setTab("queue")}>Graphics {items.length}</button>
            <button className={tab === "notes" ? "on" : ""} onClick={() => setTab("notes")}>Notes {openNotes.length || ""}</button>
            <button className={tab === "export" ? "on" : ""} onClick={() => setTab("export")}>Export</button>
          </div>
          {tab === "queue" && (
            <>
              <div className="seg filter">
                {(["all", "waiting", "change", "approved"] as const).map((f) => (
                  <button key={f} className={only === f ? "on" : ""} onClick={() => setOnly(f)}>
                    {f === "all" ? "All" : LABEL[f]}
                  </button>
                ))}
              </div>
              <div className="rows">
                {shown.map((it) => {
                  const s = state.review.items[it.id]?.status ?? "waiting";
                  const found = qc?.items.find((x) => x.id === it.id)?.issues.filter((i) => i.level === "error").length ?? 0;
                  return (
                    <button key={it.id} className={`qrow ${s} ${!watch && item?.id === it.id ? "on" : ""}`} onClick={() => go(it)}>
                      <i title={LABEL[s]} />
                      <span className="n">{it.n}</span>
                      <span className="what">
                        <b>{it.kind ?? it.layout}</b> {gist(r.shots[it.index]?.visual) || it.anchor}
                      </span>
                      {found > 0 && <span className="error small">{found} QC</span>}
                      <span className="t">{clock(it.start)}</span>
                    </button>
                  );
                })}
                {!shown.length && <p className="muted small pad">Nothing here.</p>}
              </div>
            </>
          )}
          {tab === "notes" && (
            <div className="rows">
              <p className="muted small pad">Press M at any moment to write a note there. Notes go to Claude with the changes.</p>
              {notes.map((n) => (
                <NoteRow key={n.id} note={n} onSeek={() => seek(n.t)} onChange={(change) => act(api.post(slug, "note", { id: n.id, ...change }))} />
              ))}
            </div>
          )}
          {tab === "export" && <ExportTab p={p} onOpen={() => setSheet(true)} />}
          {(working || last) && <p className="last muted small">{working ? (last?.role === "tool" ? last.text : "Claude is working…") : last?.role === "claude" ? last.text : ""}</p>}
        </aside>

        <section className="stage">
          <div className="stage-tools">
            <div className="seg">
              <button className={!watch ? "on" : ""} onClick={() => setWatch(false)} title="Loop the graphic picked in the list">This graphic</button>
              <button className={watch ? "on" : ""} onClick={() => setWatch(true)} title="Play the whole video through (W)">Watch all</button>
            </div>
            <SoundPick slug={slug} p={p} on={mixed} set={setMixed} />
            {reel && (
              <div className="seg">
                <button className={phone ? "on" : ""} onClick={() => setPhone((v) => !v)} title="Draw Instagram's interface over the reel (P)">Phone</button>
              </div>
            )}
          </div>
          <div className="screen">
            {tab === "export" && p.render ? (
              <video key={p.render.at} src={`/${p.render.file}?t=${p.render.at}`} controls style={{ maxHeight: "100%", maxWidth: "100%" }} />
            ) : (
              <div className="frame" style={{ aspectRatio: `${comp.width} / ${comp.height}` }}>
                <Player
                  key={watch ? "all" : "item"}
                  ref={player}
                  component={component(r)}
                  inputProps={r}
                  durationInFrames={total}
                  fps={fps}
                  compositionWidth={comp.width}
                  compositionHeight={comp.height}
                  style={{ width: "100%", height: "100%" }}
                  {...(watch ? {} : { inFrame: from, outFrame: to, loop: true, autoPlay: true })}
                  controls
                  clickToPlay
                  spaceKeyToPlayOrPause
                  acknowledgeRemotionLicense
                />
                {reel && phone && <PhoneFrame />}
              </div>
            )}
          </div>
          {noting !== null && (
            <NoteBox at={noting} onCancel={() => setNoting(null)} onSave={(text) => act(api.post(slug, "note", { t: noting, text })).then((ok) => ok && setNoting(null))} />
          )}
          {failed && <p className="error small">{failed}</p>}
        </section>

        <aside className="decide">
          {watch || !item || !rv ? (
            <div className="pad">
              <p className="muted">Watching the whole video. Press M to write a note at any moment; it keeps playing.</p>
              {openNotes.length > 0 && <p className="small">{openNotes.length} open note{openNotes.length === 1 ? "" : "s"}.</p>}
              <p className="muted small">Pick a graphic on the left to approve it or ask for a change.</p>
            </div>
          ) : (
            <Decision
              key={`${item.id}-${item.hash}`}
              slug={slug}
              p={p}
              r={r}
              item={item}
              rv={rv}
              field={field}
              onDecide={(change) => decide(item, change)}
              onApprove={() => decide(item, { status: "approved" }).then((ok) => ok && next("waiting"))}
            />
          )}
        </aside>
      </div>
      {sheet && <Preflight slug={slug} p={p} onClose={() => setSheet(false)} review={false} />}
    </Shell>
  );
};

// One item: what is said, the decision, the note, what Claude answered, how it looked before it
// changed, and everything the checks and QC say about it.
const Decision: React.FC<{
  slug: string;
  p: Project;
  r: Resolved;
  item: Item;
  rv: ItemReview;
  field: React.RefObject<HTMLTextAreaElement | null>;
  onDecide: (change: { status?: Status; comment?: string }) => Promise<unknown>;
  onApprove: () => void;
}> = ({ slug, p, r, item, rv, field, onDecide, onApprove }) => {
  const [comment, setComment] = useState(rv.comment);
  const qc = p.qc?.items.find((x) => x.id === item.id);
  const stale = !!p.qc?.stale.includes(item.id);
  const checks = (p.issues ?? []).filter((i) => item.anchor && i.message.includes(`"${item.anchor}"`));
  // The decision before this version, when the graphic has changed since.
  const past = rv.status === "waiting" ? rv.history.at(-1) : undefined;
  const [before, setBefore] = useState<ResolvedShot[] | null>(null);
  useEffect(() => {
    setBefore(null);
    if (!past) return;
    fetch(`/${slug}/${seenPath(item.id, past.hash)}`).then((x) => (x.ok ? x.json() : null)).then(setBefore).catch(() => {});
  }, [slug, item.id, past?.hash]);
  const save = () => comment !== rv.comment && onDecide({ comment });

  return (
    <div className="decision">
      <div className="insp-head">
        <b>
          #{item.n} {item.kind ?? item.layout}
        </b>
        <span className="muted small">
          {item.layout} · {clock(item.start)} to {clock(item.end)}
        </span>
        <span className="spacer" />
        <a className="small" href={`#/p/${slug}?shot=${encodeURIComponent(item.id)}`}>Open in the editor</a>
      </div>
      <div className="insp-body">
        <p className="said">"{item.said.length > 220 ? item.said.slice(0, 220) + "…" : item.said}"</p>
        <div className="verdict">
          <button className={`approve ${rv.status === "approved" ? "on" : ""}`} onClick={onApprove} title="Approve and go to the next waiting graphic (A)">
            Approve
          </button>
          <button className={`change ${rv.status === "change" ? "on" : ""}`} onClick={() => (onDecide({ status: "change", comment }), field.current?.focus())} title="Ask for a change (C)">
            Change
          </button>
          {rv.status !== "waiting" && (
            <button className="quiet small" onClick={() => onDecide({ status: "waiting" })}>
              Clear
            </button>
          )}
        </div>
        <textarea ref={field} value={comment} placeholder="What should change? Saved when you leave the box, sent with the other notes." onChange={(e) => setComment(e.target.value)} onBlur={save} />
        {rv.reply && (
          <p className="reply">
            <b>Claude:</b> {rv.reply}
          </p>
        )}
        {past && (
          <div className="before">
            <p className="small">
              <b>Changed since you {past.status === "approved" ? "approved it" : "asked for a change"}.</b>
              {past.comment && <> Your note: "{past.comment}"</>}
            </p>
            {past.reply && (
              <p className="reply">
                <b>Claude:</b> {past.reply}
              </p>
            )}
            {before?.length ? (
              <div className={`pair ${r.canvas}`}>
                <Tile
                  item={{ key: `before-${past.hash}`, title: "Before", sub: "", plan: { ...r, shots: before, chunks: [], sfx: [], audio: null }, from: Math.max(0, before[0].start - 0.3), to: Math.min(r.duration, before[before.length - 1].end + 0.3), settled: settledTime(before[0]), visual: before[0].visual }}
                  onOpen={() => {}}
                />
                <Tile
                  item={{ key: `now-${item.hash}`, title: "Now", sub: "", plan: { ...r, shots: r.shots.slice(item.index, item.last + 1), chunks: [], sfx: [], audio: null }, from: Math.max(0, item.start - 0.3), to: Math.min(r.duration, item.end + 0.3), settled: settledTime(r.shots[item.index]), visual: r.shots[item.index].visual }}
                  onOpen={() => {}}
                />
              </div>
            ) : null}
          </div>
        )}
        <div className="found">
          <h4>Checks</h4>
          {checks.map((i, k) => (
            <p key={k} className={`${i.level} small`}>{i.message}</p>
          ))}
          {!checks.length && <p className="muted small">The plan's checks say nothing about this one.</p>}
          <h4>QC {stale && <span className="warn">· out of date</span>}</h4>
          {!qc && <p className="muted small">{isGraphic(r.shots[item.index]) ? "Not measured yet. Run QC." : "Nothing here for QC to measure: it checks graphics, and this is picture and text."}</p>}
          {qc?.issues.map((i, k) => (
            <p key={k} className={`${i.level} small`}>{i.message.replace(/^shot \d+ \([^)]*\)(?: at [\d.]+s)?: /, "")}</p>
          ))}
          {qc && !qc.issues.length && <p className="muted small">{stale ? "It passed before it changed." : "Passes: safe area, collisions, type size, contrast."}</p>}
          {qc && (
            <a href={`/${qc.sheet}?t=${encodeURIComponent(p.qc!.at)}`} target="_blank" rel="noreferrer" title="Before, first frame, each reveal, settled, after. Click to open it large.">
              <img className="strip" src={`/${qc.sheet}?t=${encodeURIComponent(p.qc!.at)}`} alt="QC frames" loading="lazy" />
            </a>
          )}
        </div>
        {rv.history.length > 0 && (
          <div className="found">
            <h4>Earlier</h4>
            {[...rv.history].reverse().map((h, k) => (
              <p key={k} className="muted small">
                {LABEL[h.status]} {h.at.slice(0, 10)}
                {h.comment ? `: "${h.comment}"` : ""}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const NoteRow: React.FC<{ note: Note; onSeek: () => void; onChange: (change: { status?: Note["status"]; remove?: boolean }) => void }> = ({ note, onSeek, onChange }) => (
  <div className={`nrow ${note.status}`}>
    <div className="row">
      <button className="quiet small when" onClick={onSeek} title="Play from here">
        {clock(note.t)}
      </button>
      <span className="muted small">{note.status === "open" ? "Open" : note.status === "sent" ? (note.reply ? "Answered" : "Sent") : "Done"}</span>
    </div>
    <p>{note.text}</p>
    {note.reply && (
      <p className="reply">
        <b>Claude:</b> {note.reply}
      </p>
    )}
    <div className="row acts">
      {note.status !== "done" && <button className="small" onClick={() => onChange({ status: "done" })}>Done</button>}
      {note.status !== "open" && <button className="small quiet" onClick={() => onChange({ status: "open" })} title="Send it to Claude again">Reopen</button>}
      <button className="small quiet" onClick={() => onChange({ remove: true })}>Delete</button>
    </div>
  </div>
);

// After an export: the file, and what the export check found (length, graphics placed, loudness).
const ExportTab: React.FC<{ p: Project; onOpen: () => void }> = ({ p, onOpen }) => {
  const check = p.exportCheck;
  const made = p.render ? new Date(p.render.at) : null;
  // A check older than the file it sits beside belongs to an earlier export.
  const fresh = check && made && Math.abs(new Date(check.at).getTime() - made.getTime()) < 10 * 60 * 1000;
  return (
    <div className="rows pad">
      {!p.render && <p className="muted small">No export yet.</p>}
      {p.render && (
        <>
          <p className="small">
            Exported {made!.toLocaleString()}. It plays on the right.
          </p>
          <a className="button small" href={`/${p.render.file}?t=${p.render.at}`} download>
            Download
          </a>
        </>
      )}
      {check && fresh && (
        <div className="found">
          <h4>Export check</h4>
          {check.issues.map((i, k) => (
            <p key={k} className={`${i.level} small`}>{i.message}</p>
          ))}
          {!check.issues.length && <p className="small">Length, size and every graphic's place are right.</p>}
          {check.lufs !== undefined && <p className="muted small">Loudness {check.lufs} LUFS{check.size ? ` · ${check.size}` : ""}{check.sections !== undefined ? ` · ${check.sections} graphic sections` : ""}</p>}
        </div>
      )}
      <button className="small" onClick={onOpen}>
        Check and export…
      </button>
    </div>
  );
};

// Instagram's interface over a reel, roughly where it sits, so nothing that matters hides under it.
// The shaded bands are an approximation drawn by hand, not Instagram's own numbers.
const PhoneFrame: React.FC = () => (
  <div className="phone" title="Roughly where Instagram draws its interface">
    <div className="band top"><span>Reels</span></div>
    <div className="band side">
      {["♡", "◯", "➤", "⋯"].map((c, k) => (
        <i key={k}>{c}</i>
      ))}
    </div>
    <div className="band bottom">
      <div><i className="avatar" /> <b>your handle</b> <em>Follow</em></div>
      <p>The caption sits here, two lines of it before "more"…</p>
      <p className="audio">♫ Original audio</p>
    </div>
  </div>
);
