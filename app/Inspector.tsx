import React, { useEffect, useMemo, useRef, useState } from "react";
import { phraseAt, planIndex, stripAnchors, wordAt } from "../engine/insert";
import { visualAnchors } from "../engine/resolve";
import type { Resolved, ResolvedShot, VisualSpec, Word } from "../engine/schema";
import { cards } from "../styles/blueprint/style";
import { api, clock, type Variants } from "./api";
import { settledTime, shotPlan } from "../effects/preview";
import { Tile } from "./Gallery";
import { playhead } from "./playhead";

// The inspector: one graphic, and the few things quicker by hand than by asking: its big words on
// screen, where it starts and ends, and its layout. Everything else (a flow's nodes, a page's
// highlights, an app's script) is Claude's: select the graphic and ask (Owain, 2026-11-26: "too much
// fuss on editing text and details"). Every change shows in the player at once (the shot is patched
// in the browser) and is saved to the plan a moment after the last keystroke, where the server
// resolves it and puts it back with the reason if it breaks the plan.

export type PlanShot = { at: string; layout: string; visual?: VisualSpec & Record<string, unknown>; header?: string | false; [k: string]: unknown };

// The big words a graphic puts on screen, each with how to write it back: the hit word, a diagram's
// title, the header, the words of a beats card, and a card's own title, text or label. Small print
// (labels in a flow, a page's highlights, an app's lines) is left to Claude.
export type BigWords = { key: string; label: string; value: string; set: (shot: PlanShot, value: string) => PlanShot };
export function bigWords(shot: PlanShot): BigWords[] {
  const out: BigWords[] = [];
  const hit = shot.hit as { text?: unknown } | undefined;
  if (typeof hit?.text === "string") out.push({ key: "hit", label: "Hit word", value: hit.text, set: (s, v) => ({ ...s, hit: { ...(s.hit as object), text: v } }) });
  const title = shot.title as { lines?: unknown } | undefined;
  if (Array.isArray(title?.lines))
    out.push({ key: "title", label: "Title", value: (title.lines as string[]).join("\n"), set: (s, v) => {
      const [a = "", ...rest] = v.split("\n");
      return { ...s, title: { ...(s.title as object), lines: [a, rest.join(" ")] } };
    } });
  if (typeof shot.header === "string") out.push({ key: "header", label: "Header", value: shot.header, set: (s, v) => ({ ...s, header: v || undefined }) });
  const v = shot.visual as Record<string, unknown> | undefined;
  if (v?.kind === "beats" && Array.isArray(v.items))
    (v.items as { text: string }[]).forEach((item, i) =>
      out.push({ key: `beat-${i}`, label: `Beat ${i + 1}`, value: item.text, set: (s, t) => {
        const items = ((s.visual as { items: { text: string }[] }).items).map((x, j) => (j === i ? { ...x, text: t } : x));
        return { ...s, visual: { ...(s.visual as object), items } as PlanShot["visual"] };
      } }),
    );
  for (const k of ["title", "text", "label"] as const)
    if (typeof v?.[k] === "string") {
      out.push({ key: `visual-${k}`, label: k[0].toUpperCase() + k.slice(1), value: v[k] as string, set: (s, t) => ({ ...s, visual: { ...(s.visual as object), [k]: t } as PlanShot["visual"] }) });
      break;
    }
  return out;
}

const LAYOUTS = { youtube: ["full", "side", "over", "media"], reel: ["split", "media", "scene", "full", "punch", "cutaway"], clean: ["split", "full", "card", "diagram", "over"] };

// The shot as the player should show it now: the plan's words over the resolved timing. A new
// card's parts land 0.4 s apart until the server resolves their words.
export function previewShot(rs: ResolvedShot, shot: PlanShot): ResolvedShot {
  const header = typeof shot.header === "string" ? shot.header : shot.header === false ? undefined : rs.header;
  if (!shot.visual) return { ...rs, layout: shot.layout as ResolvedShot["layout"], header, visual: undefined };
  const same = rs.visual?.kind === shot.visual.kind;
  const n = Math.max(1, visualAnchors(shot.visual).length);
  const times = same ? (rs.visual as { times?: number[] }).times : Array.from({ length: n }, (_, i) => rs.start + 0.3 + i * 0.4);
  const visual = { ...(same ? rs.visual : {}), ...shot.visual, times } as ResolvedShot["visual"];
  return { ...rs, layout: shot.layout as ResolvedShot["layout"], header, visual };
}

export const Inspector: React.FC<{
  slug: string;
  r: Resolved;
  plan: string;
  // The graphic, by its id.
  id: string;
  words: Word[];
  onPreview: (shot: ResolvedShot | null) => void;
  onAsk: () => void;
  onClose: () => void;
  onSeek: (t: number) => void;
  variants?: Variants | null;
  working: boolean;
}> = ({ slug, r, plan, id, words, onPreview, onAsk, onClose, onSeek, variants, working }) => {
  const k = r.shots.findIndex((s) => s.id === id);
  const rs = r.shots[k];
  const fromPlan = useMemo(() => {
    try {
      const shots = (JSON.parse(plan) as { shots: PlanShot[] }).shots;
      return shots[planIndex(shots, r.shots, k)] ?? null;
    } catch {
      return null;
    }
  }, [plan, r.shots, k]);
  const [shot, setShot] = useState<PlanShot | null>(fromPlan);
  const [error, setError] = useState("");
  const [brief, setBrief] = useState("");
  const [trying, setTrying] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  // A fresh plan from the server replaces the form, unless a change made here is still waiting to save.
  useEffect(() => {
    if (!timer.current) setShot(fromPlan);
  }, [fromPlan]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      timer.current = undefined;
      onPreview(null);
    };
  }, [id]);

  const save = (next: PlanShot) => {
    setShot(next);
    if (rs) onPreview(previewShot(rs, next));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      api
        .post(slug, "shot", { id, shot: next })
        .then(() => mounted.current && setError(""))
        .catch((e) => mounted.current && setError(String(e.message)));
    }, 700);
  };
  const remove = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    api.post(slug, "shot", { id, remove: true }).then(onClose).catch((e) => setError(String(e.message)));
  };

  if (!rs || !shot) return <aside className="inspector"><div className="pad muted">That graphic is no longer in the plan. <button className="small" onClick={onClose}>Close</button></div></aside>;

  const canvas = r.canvas === "youtube" ? "youtube" : r.style === "clean" ? "clean" : "reel";
  const card = cards.find((c) => c.kind === shot.visual?.kind);
  const sample = !!card?.sample && JSON.stringify(stripAnchors(shot.visual)) === JSON.stringify(stripAnchors(card.sample.visual));
  // The clean style has its own few layouts, whatever the graphic.
  const layouts = canvas === "clean" ? [...new Set([...LAYOUTS.clean, shot.layout])] : [...new Set([...(card?.layouts.filter((l) => (LAYOUTS[canvas] as string[]).includes(l)) ?? LAYOUTS[canvas]), shot.layout])];
  const end = r.shots.slice(k + 1).find((s) => !s.keep)?.start ?? r.duration;
  const said = words.filter((w) => w.start >= rs.start - 0.05 && w.start < end).map((w) => w.text).join(" ");

  // Start on the word under the playhead: a phrase from there that the plan finds in place.
  const startHere = () => {
    const prev = k > 0 ? wordAt(words, r.shots[k - 1].start) : -1;
    const i = wordAt(words, playhead.get());
    const at = i > prev ? phraseAt(words, i, prev) : null;
    if (!at) return setError("Move the playhead onto a word after the previous shot starts.");
    save({ ...shot, at });
  };
  // End on the word under the playhead: the shot after this one starts there instead.
  const endHere = () => {
    if (end >= r.duration - 0.05) return setError("This graphic runs to the end of the video.");
    api.post(slug, "shot-end", { id, to: playhead.get() }).then(() => setError("")).catch((e) => setError(String(e.message)));
  };
  const onScreen = bigWords(shot);

  return (
    <aside className="inspector">
      <div className="panel-bar">
        <b>{shot.visual?.kind ?? "picture"}</b>
        <span className="muted">{clock(rs.start)} to {clock(end)}</span>
        <span className="spacer" />
        <button className="icon close" onClick={onClose} title="Close the graphic (Esc)" aria-label="Close">×</button>
      </div>
      {error && <p className="insp-error">Not saved: {error}</p>}
      <div className="insp-body">
        {sample && <p className="warn small">These are the library's sample words. Change them to what is said here.</p>}
        <p className="said">"{said.length > 160 ? said.slice(0, 160) + "…" : said}"</p>
        <label className="f">
          <span>Starts on</span>
          <div className="row gap">
            <input value={shot.at} onChange={(e) => save({ ...shot, at: e.target.value })} />
            <button className="small" onClick={startHere} title="Start on the word under the playhead">Playhead</button>
          </div>
        </label>
        <div className="f">
          <span>Ends</span>
          <div className="row gap">
            <span className="muted small grow">{clock(end)}, before "{words.find((w) => w.start >= end - 0.05)?.text ?? "the end"}"</span>
            <button className="small" onClick={endHere} title="End on the word under the playhead">Playhead</button>
          </div>
        </div>
        <div className="f">
          <span>Layout</span>
          <div className="seg wrap">
            {layouts.map((l) => <button key={l} className={shot.layout === l ? "on" : ""} onClick={() => save({ ...shot, layout: l })}>{l}</button>)}
          </div>
        </div>
        {onScreen.length > 0 && (
          <div className="f">
            <span>On screen</span>
            {onScreen.map((w) => (
              <label key={w.key} className="f">
                <span className="sub">{w.label}</span>
                <textarea className="field-text" rows={w.value.includes("\n") ? 2 : 1} value={w.value} onChange={(e) => save(w.set(shot, e.target.value))} />
              </label>
            ))}
          </div>
        )}
        <p className="muted small">For anything else on this graphic, ask Claude.</p>
        <Takes
          r={r}
          k={k}
          variants={variants && Math.abs(variants.start - rs.start) < 0.05 ? variants : null}
          working={working}
          brief={brief}
          setBrief={setBrief}
          trying={trying}
          onAsk={() => api.post(slug, "variants", { start: rs.start, note: brief }).then(() => setError("")).catch((e) => setError(String(e.message)))}
          onTry={(id, shot) => (setTrying(id), onPreview(shot), onSeek(settledTime(shot)))}
          onUse={(id) => api.post(slug, "variant-use", { id }).then(() => setTrying(null)).catch((e) => setError(String(e.message)))}
          onClear={() => (setTrying(null), onPreview(null), api.post(slug, "variant-clear"))}
        />
      </div>
      <div className="insp-foot">
        <button className="small" onClick={onAsk} title="Select this graphic and write to Claude about it">Ask Claude</button>
        <span className="spacer" />
        {shot.visual && <button className="small quiet" onClick={remove} title="Take the graphic off; the picture plays as cut (Delete)">Remove</button>}
      </div>
    </aside>
  );
};

// Claude's takes on this graphic, side by side, each playing live with the footage. Click one to
// play it in the main player; Use puts it in the plan. Nothing is rendered.
const Takes: React.FC<{
  r: Resolved;
  k: number;
  variants: Variants | null;
  working: boolean;
  brief: string;
  setBrief: (s: string) => void;
  trying: string | null;
  onAsk: () => void;
  onTry: (id: string, shot: ResolvedShot) => void;
  onUse: (id: string) => void;
  onClear: () => void;
}> = ({ r, k, variants, working, brief, setBrief, trying, onAsk, onTry, onUse, onClear }) => {
  const drawing = working && variants && !variants.items.length;
  return (
    <div className="takes">
      <div className="f">
        <span>Takes</span>
        <div className="row gap">
          <input value={brief} placeholder="Optional: what to try (bolder, a diagram…)" onChange={(e) => setBrief(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !working && onAsk()} />
          <button className="small" disabled={working} onClick={onAsk} title="Claude draws three or four different takes on this graphic">{drawing ? "Drawing…" : "Ask Claude"}</button>
        </div>
      </div>
      {drawing && <p className="muted small">Claude is drawing takes. They appear here to compare, live, in a minute or so.</p>}
      {variants && variants.items.length > 0 && (
        <>
          <div className="take-grid">
            {variants.items.map((v) => {
              const shot = v.resolved;
              const plan = shot ? { ...shotPlan({ ...r, shots: r.shots.map((s, i) => (i === k ? shot : s)) }, k, true) } : null;
              return (
                <div key={v.id} className={`take ${trying === v.id ? "on" : ""}`}>
                  {plan && shot ? (
                    <Tile item={{ key: v.id, title: v.label, sub: v.reason ?? "", plan, from: Math.max(0, shot.start - 0.3), to: Math.min(r.duration, shot.end + 0.3), settled: settledTime(shot), visual: shot.visual }} onOpen={() => onTry(v.id, shot)} />
                  ) : (
                    <div className="broken">{v.label}</div>
                  )}
                  {v.problems.map((p, i) => <p key={i} className="error small">{p}</p>)}
                  <button className="small primary" disabled={!!v.problems.length} onClick={() => onUse(v.id)}>Use</button>
                </div>
              );
            })}
          </div>
          <button className="small quiet" onClick={onClear}>Discard takes</button>
        </>
      )}
    </div>
  );
};

// The inspector with nothing picked.
export const NoInspector: React.FC = () => (
  <aside className="inspector">
    <div className="panel-bar"><b>Inspector</b></div>
    <div className="panel-empty">
      <b>Nothing selected</b>
      Click a graphic on the timeline or in the Graphics tab to edit it here.
    </div>
  </aside>
);
