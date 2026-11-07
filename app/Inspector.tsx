import React, { useEffect, useMemo, useRef, useState } from "react";
import { phraseAt, planIndex, stripAnchors, wordAt } from "../engine/insert";
import { visualAnchors } from "../engine/resolve";
import type { Resolved, ResolvedShot, VisualSpec, Word } from "../engine/schema";
import { cards } from "../styles/blueprint/style";
import { api, clock, type Variants } from "./api";
import { settledTime, shotPlan } from "../effects/preview";
import { Tile } from "./Gallery";

// The inspector: one graphic, edited by hand. Every change shows in the player at once (the shot is
// patched in the browser) and is saved to the plan a moment after the last keystroke, where the
// server resolves it and puts it back with the reason if it breaks the plan. Claude is for the big
// asks; a typo, a word, a layout or a different card is quicker here.

export type PlanShot = { at: string; layout: string; visual?: VisualSpec & Record<string, unknown>; header?: string | false; [k: string]: unknown };

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
  start: number;
  words: Word[];
  time: number;
  onPreview: (shot: ResolvedShot | null) => void;
  onAsk: () => void;
  onClose: () => void;
  onSeek: (t: number) => void;
  variants?: Variants | null;
  working: boolean;
}> = ({ slug, r, plan, start, words, time, onPreview, onAsk, onClose, onSeek, variants, working }) => {
  // The shot nearest `start`: a graphic just placed starts where its word does, a hair from the drop.
  const k = r.shots.reduce((best, s, i) => (Math.abs(s.start - start) < Math.abs((r.shots[best]?.start ?? Infinity) - start) ? i : best), -1);
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
  const [raw, setRaw] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [trying, setTrying] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  // A fresh plan from the server replaces the form, unless a change made here is still waiting to save.
  useEffect(() => {
    if (!timer.current) setShot(fromPlan);
  }, [fromPlan]);
  useEffect(() => () => onPreview(null), [start]);

  const save = (next: PlanShot) => {
    setShot(next);
    if (rs) onPreview(previewShot(rs, next));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      api.post(slug, "shot", { start: rs.start, shot: next }).then(() => setError("")).catch((e) => setError(String(e.message)));
    }, 700);
  };
  const remove = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    api.post(slug, "shot", { start: rs.start, remove: true }).then(onClose).catch((e) => setError(String(e.message)));
  };

  if (!rs || !shot) return <aside className="chat inspector"><div className="pad muted">That graphic is no longer in the plan. <button className="small" onClick={onClose}>Back</button></div></aside>;

  const canvas = r.canvas === "youtube" ? "youtube" : r.style === "clean" ? "clean" : "reel";
  const kinds = cards.filter((c) => c.sample && (canvas === "youtube" ? c.tier === "overlay" || c.layouts.some((l) => l === "side" || l === "over" || l === "media") : c.tier !== "overlay"));
  const card = cards.find((c) => c.kind === shot.visual?.kind);
  const sample = !!card?.sample && JSON.stringify(stripAnchors(shot.visual)) === JSON.stringify(stripAnchors(card.sample.visual));
  // The clean style has its own few layouts, whatever the graphic.
  const layouts = canvas === "clean" ? [...new Set([...LAYOUTS.clean, shot.layout])] : [...new Set([...(card?.layouts.filter((l) => (LAYOUTS[canvas] as string[]).includes(l)) ?? LAYOUTS[canvas]), shot.layout])];
  const end = r.shots.slice(k + 1).find((s) => !s.keep)?.start ?? r.duration;
  const said = words.filter((w) => w.start >= rs.start - 0.05 && w.start < end).map((w) => w.text).join(" ");

  // Start on the word under the playhead: a phrase from there that the plan finds in place.
  const startHere = () => {
    const prev = k > 0 ? wordAt(words, r.shots[k - 1].start) : -1;
    const i = wordAt(words, time);
    const at = i > prev ? phraseAt(words, i, prev) : null;
    if (!at) return setError("Move the playhead onto a word after the previous shot starts.");
    save({ ...shot, at });
  };
  // End on the word under the playhead: the shot after this one starts there instead.
  const endHere = () => {
    if (end >= r.duration - 0.05) return setError("This graphic runs to the end of the video.");
    api.post(slug, "shot-end", { start: rs.start, to: time }).then(() => setError("")).catch((e) => setError(String(e.message)));
  };
  const swap = (id: string) => {
    const c = cards.find((x) => x.id === id);
    if (!c?.sample) return;
    const layout = c.layouts.includes(shot.layout as never) ? shot.layout : c.layouts.find((l) => (LAYOUTS[canvas] as string[]).includes(l)) ?? shot.layout;
    save({ ...shot, layout: canvas === "youtube" && c.tier === "overlay" ? "over" : layout, visual: stripAnchors(c.sample.visual) as PlanShot["visual"] });
  };

  return (
    <aside className="chat inspector">
      <div className="insp-head">
        <button className="quiet small" onClick={onClose} title="Back to the chat (Esc)">← Chat</button>
        <b>{shot.visual?.kind ?? "picture"}</b>
        <span className="muted small">{clock(rs.start)} to {clock(end)}</span>
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
        {canvas === "reel" && (
          <label className="f">
            <span>Header</span>
            <input value={typeof shot.header === "string" ? shot.header : ""} placeholder="One *accent* word" onChange={(e) => save({ ...shot, header: e.target.value || undefined })} />
          </label>
        )}
        {shot.visual && (
          <label className="f">
            <span>Graphic</span>
            <select value={card?.id ?? ""} onChange={(e) => swap(e.target.value)}>
              {(!card || !kinds.includes(card)) && <option value={card?.id ?? ""}>{shot.visual.kind} (drawn for this video)</option>}
              {kinds.map((c) => <option key={c.id} value={c.id}>{c.kind}: {c.summary.slice(0, 60)}</option>)}
            </select>
          </label>
        )}
        {shot.visual && (raw === null ? (
          <Fields value={shot.visual} onChange={(v) => save({ ...shot, visual: v as PlanShot["visual"] })} />
        ) : (
          <textarea className="json" value={raw} spellCheck={false} onChange={(e) => {
            setRaw(e.target.value);
            try {
              save({ ...shot, visual: JSON.parse(e.target.value) });
            } catch {
              // Saved once it parses again.
            }
          }} />
        ))}
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
        {shot.visual && <button className="small" onClick={() => setRaw(raw === null ? JSON.stringify(shot.visual, null, 2) : null)}>{raw === null ? "JSON" : "Form"}</button>}
        <button className="small" onClick={onAsk} title="Select this graphic and ask Claude to change it">Ask Claude</button>
        <span className="spacer" />
        {shot.visual && <button className="small quiet" onClick={remove} title="Take the graphic off; the picture plays as cut (Delete)">Remove</button>}
      </div>
    </aside>
  );
};

const LABELS: Record<string, string> = { at: "lands on", text: "text", title: "title", label: "label", items: "items" };
const blank = (v: unknown): unknown => (typeof v === "string" ? "" : Array.isArray(v) ? [] : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : v);

// A form for any visual: text, numbers, switches, lists and groups, read from the value itself, so
// every kind in the schema is editable without a form of its own.
const Fields: React.FC<{ value: unknown; onChange: (v: unknown) => void; name?: string }> = ({ value, onChange, name }) => {
  const label = name && <span>{LABELS[name] ?? name}</span>;
  if (typeof value === "string")
    return (
      <label className="f">
        {label}
        {value.length > 48 ? <textarea value={value} onChange={(e) => onChange(e.target.value)} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}
      </label>
    );
  if (typeof value === "number") return <label className="f">{label}<input type="number" value={value} step="any" onChange={(e) => onChange(+e.target.value)} /></label>;
  if (typeof value === "boolean") return <label className="f check"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
  if (Array.isArray(value)) {
    // A rectangle or a point: numbers on one line.
    if (value.every((x) => typeof x === "number"))
      return <label className="f">{label}<input defaultValue={value.join(", ")} onBlur={(e) => onChange(e.target.value.split(",").map((x) => +x.trim()))} /></label>;
    return (
      <div className="f">
        {label}
        <div className="items">
          {value.map((x, i) => (
            <div key={i} className="item">
              <span className="n">{i + 1}</span>
              <div className="grow"><Fields value={x} onChange={(v) => onChange(value.map((y, j) => (j === i ? v : y)))} /></div>
              <button className="quiet small" title="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {value.length > 0 && <button className="small" onClick={() => onChange([...value, blank(value[value.length - 1])])}>Add</button>}
        </div>
      </div>
    );
  }
  if (value && typeof value === "object")
    return (
      <div className={name ? "f group" : "fields"}>
        {label}
        {Object.entries(value as Record<string, unknown>)
          .filter(([k]) => k !== "kind")
          .map(([k, x]) => <Fields key={k} name={k} value={x} onChange={(v) => onChange({ ...(value as object), [k]: v })} />)}
      </div>
    );
  return null;
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
