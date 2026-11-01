// Delegation diagrams for the Linear video (Owain, 2026-11-01: "I'd favour diagrams over just text in
// places like this"). Drawn in the flow diagram's card look, which he liked: rounded cards on the
// theme's card colour, hairline edges, 5 px lines that draw on with a dot riding the tip.
//
//   board  a small task board: "You" at the top, task rows below, a line drawing from You to each
//          row as its assignee chip (a teammate or Claude) lands on its word.
//          props: { owner?: string, rows: [{ task?: string, who: "teammate" | "agent", name: string }] }
//          times: [board lands, then one per row]
//   shift  before and after: on the left a chat going back and forth, on the right one task assigned
//          to the agent that turns to Done. The left dims when the right lands.
//          props: { before: string, after: string, task?: string, agent: string }
//          times: [chat starts, task assigned, task done]
//   task   one real task assigned to the agent, its subtasks ticking off, then Done (below).
//   thread a comment that tags the agent, and its reply (below).
import React from "react";
import { easeInOut, prog } from "../motion";
import { pal, SoftAccented } from "../soft";
import { t } from "../theme";
import type { CustomProps } from "./index";

type Row = { task?: string; who: "teammate" | "agent"; name: string };

// A plain person: head and shoulders. A generic icon, not anyone's likeness.
const Person: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="8.5" r="4" fill={color} />
    <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" fill={color} />
  </svg>
);

// A generic agent: a rounded square with a spark. Not a product logo.
const Agent: React.FC<{ size: number; color: string; ink: string }> = ({ size, color, ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="6" fill={color} />
    <path d="M12 6.5l1.4 3.9 3.9 1.4-3.9 1.4L12 17.1l-1.4-3.9-3.9-1.4 3.9-1.4z" fill={ink} />
  </svg>
);

const Chip: React.FC<{ row: Row; fs: number; c: ReturnType<typeof pal>; p: number }> = ({ row, fs, c, p }) => (
  <div style={{ display: "flex", alignItems: "center", gap: fs * 0.35, padding: `${fs * 0.22}px ${fs * 0.5}px ${fs * 0.22}px ${fs * 0.28}px`, borderRadius: 999, border: `1.5px solid ${p > 0.5 ? c.accent : c.line}`, opacity: 0.25 + 0.75 * p, filter: `blur(${(1 - p) * 6}px)` }}>
    {row.who === "agent" ? <Agent size={fs * 1.05} color={c.accent} ink={c.card} /> : <Person size={fs * 1.05} color={c.muted} />}
    <span style={{ fontFamily: t.sans, fontWeight: 600, fontSize: fs * 0.82, color: c.ink }}>{row.name}</span>
  </div>
);

export const Board: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const c = pal(shot.tone);
  const rows = (props.rows ?? []) as Row[];
  const owner = String(props.owner ?? "You");
  const land = prog(time, times[0] ?? shot.start, 0.4);
  const fs = Math.min(40, width / 22);
  const cardW = Math.min(width * 0.92, 820);
  const rowH = fs * 2.6;
  const headH = fs * 2.6;
  const gap = fs * 0.7;
  const cardH = headH + rows.length * (rowH + gap) + fs * 1.2;
  const x0 = (width - cardW) / 2;
  const y0 = (height - cardH) / 2;
  const trunk = x0 + fs * 2.1;
  return (
    <div style={{ position: "relative", width, height }}>
      <div style={{ position: "absolute", left: x0, top: y0, width: cardW, height: cardH, borderRadius: 28, background: c.card, border: `1.5px solid ${c.line}`, boxShadow: c.shadow, opacity: land, filter: `blur(${(1 - land) * 8}px)`, translate: `0 ${(1 - land) * 30}px` }} />
      <div style={{ position: "absolute", left: x0 + fs * 1.2, top: y0 + fs * 0.8, display: "flex", alignItems: "center", gap: fs * 0.45, opacity: land }}>
        <div style={{ width: fs * 1.8, height: fs * 1.8, borderRadius: 999, background: c.ink, color: c.card, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.sans, fontWeight: 700, fontSize: fs * 0.85 }}>{owner.slice(0, 1)}</div>
        <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: fs * 1.15, letterSpacing: -fs * 0.03, color: c.ink }}>{owner}</div>
      </div>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {rows.map((_, i) => {
          const at = times[i + 1] ?? shot.start + 0.5 + i * 0.6;
          const draw = prog(time, at - 0.35, 0.45, easeInOut);
          if (draw <= 0) return null;
          const ty = y0 + headH + i * (rowH + gap) + rowH / 2;
          const sy = y0 + fs * 2.6;
          const tx = x0 + fs * 3.4;
          const d = `M${trunk} ${sy} L${trunk} ${ty - fs * 0.6} Q${trunk} ${ty} ${trunk + fs * 0.6} ${ty} L${tx} ${ty}`;
          const tip = draw < 1;
          return (
            <g key={i}>
              <path d={d} pathLength={1} fill="none" stroke={c.accent} strokeWidth={5} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - draw} />
              {tip && <circle r={7} fill={c.accent} cx={draw < 0.75 ? trunk : trunk + (tx - trunk) * ((draw - 0.75) / 0.25)} cy={draw < 0.75 ? sy + (ty - sy) * (draw / 0.75) : ty} />}
            </g>
          );
        })}
      </svg>
      {rows.map((row, i) => {
        const at = times[i + 1] ?? shot.start + 0.5 + i * 0.6;
        const p = prog(time, at, 0.3);
        const show = prog(time, (times[0] ?? shot.start) + 0.15 + i * 0.08, 0.4);
        const top = y0 + headH + i * (rowH + gap);
        const left = x0 + fs * 3.4;
        return (
          <div key={i} style={{ position: "absolute", left, top, width: cardW - fs * 4.4, height: rowH, borderRadius: 18, border: `1.5px solid ${c.line}`, display: "flex", alignItems: "center", gap: fs * 0.6, padding: `0 ${fs * 0.5}px 0 ${fs * 0.7}px`, boxSizing: "border-box", opacity: show }}>
            <div style={{ width: fs * 0.75, height: fs * 0.75, borderRadius: 999, border: `2.5px solid ${c.faint}`, flex: "none" }} />
            {row.task ? (
              <div style={{ flex: 1, minWidth: 0, fontFamily: t.sans, fontWeight: 600, fontSize: fs * 0.9, color: c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.task}</div>
            ) : (
              <div style={{ flex: 1, height: fs * 0.45, borderRadius: 99, background: c.faint, maxWidth: "55%" }} />
            )}
            <Chip row={row} fs={fs} c={c} p={p} />
          </div>
        );
      })}
    </div>
  );
};

export const Shift: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const c = pal(shot.tone);
  const chatAt = times[0] ?? shot.start;
  const assignAt = times[1] ?? shot.start + 2;
  const doneAt = times[2] ?? assignAt + 1.2;
  const fs = Math.min(38, width / 25);
  const gap = fs * 1.1;
  const colW = (Math.min(width, 900) * 0.9 - gap) / 2;
  // As tall as five chat bubbles under the label, so neither card stands half empty.
  const colH = Math.min(height * 0.9, fs * 12.4);
  const x0 = (width - (colW * 2 + gap)) / 2;
  const y0 = (height - colH) / 2;
  const left = prog(time, chatAt, 0.4);
  const right = prog(time, assignAt, 0.4);
  const fadeLeft = 1 - 0.55 * prog(time, assignAt, 0.5);
  const done = prog(time, doneAt, 0.3);
  const card = (x: number, k: number, dim = 1): React.CSSProperties => ({ position: "absolute", left: x, top: y0, width: colW, height: colH, borderRadius: 28, background: c.card, border: `1.5px solid ${c.line}`, boxShadow: c.shadow, opacity: k * dim, filter: `blur(${(1 - k) * 8}px)`, translate: `0 ${(1 - k) * 30}px`, boxSizing: "border-box", padding: fs * 0.9 });
  const label = (text: string) => <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: fs * 0.62, letterSpacing: 3, textTransform: "uppercase", color: c.muted }}>{text}</div>;
  // The chat: bubbles from you and the agent taking turns, one landing about every 0.45 s, the
  // oldest scrolling off, so it keeps going back and forth until the right side lands.
  const bubbleH = fs * 1.3;
  const step = 0.45;
  const n = Math.max(0, Math.floor((Math.min(time, assignAt + 0.5) - chatAt) / step) + 1);
  const shown = Array.from({ length: Math.min(n, 5) }, (_, k) => n - Math.min(n, 5) + k);
  const agent = String(props.agent ?? "Claude");
  return (
    <div style={{ position: "relative", width, height }}>
      <div style={card(x0, left, fadeLeft)}>
        {label(String(props.before ?? "Back and forth"))}
        <div style={{ marginTop: fs * 0.9, display: "flex", flexDirection: "column", gap: fs * 0.45 }}>
          {shown.map((m) => {
            const mine = m % 2 === 0;
            const p = prog(time, chatAt + m * step, 0.18);
            return (
              <div key={m} style={{ alignSelf: mine ? "flex-end" : "flex-start", width: `${mine ? 58 : 72 - (m % 3) * 8}%`, height: bubbleH, borderRadius: bubbleH / 2, background: mine ? c.faint : "transparent", border: mine ? "none" : `1.5px solid ${c.line}`, opacity: p, translate: `0 ${(1 - p) * 10}px` }} />
            );
          })}
        </div>
      </div>
      <div style={card(x0 + colW + gap, right)}>
        {label(String(props.after ?? "Assign work"))}
        <div style={{ marginTop: fs * 0.9, borderRadius: 18, border: `${1.5 + done * 1.5}px solid ${done > 0.5 ? c.accent : c.line}`, padding: fs * 0.6, display: "flex", flexDirection: "column", gap: fs * 0.6 }}>
          {props.task ? (
            <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: fs * 0.95, letterSpacing: -fs * 0.02, color: c.ink }}>
              <SoftAccented text={String(props.task)} c={c} />
            </div>
          ) : (
            <div style={{ height: fs * 0.5, width: "70%", borderRadius: 99, background: c.faint }} />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: fs * 0.4 }}>
            <Chip row={{ who: "agent", name: agent }} fs={fs * 0.85} c={c} p={right} />
            <div style={{ position: "relative", fontFamily: t.sans, fontWeight: 600, fontSize: fs * 0.7, whiteSpace: "nowrap", padding: `${fs * 0.18}px ${fs * 0.5}px`, borderRadius: 999, border: `1.5px solid ${done > 0.5 ? c.accent : c.line}`, color: done > 0.5 ? c.ink : c.muted }}>
              {done > 0.5 ? "Done ✓" : "Todo"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- task ----------
// One real task assigned to the agent, its subtasks ticking off in a quick cascade, then Done.
// props: { title, agent, subtasks: string[] }   times: [card lands, assigned, done]
export const Task: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const c = pal(shot.tone);
  const subs = (props.subtasks ?? []) as string[];
  const landAt = times[0] ?? shot.start;
  const assignAt = times[1] ?? landAt + 0.6;
  const doneAt = times[2] ?? assignAt + 1.5;
  const fs = Math.min(54, width / 19);
  const cardW = Math.min(width * 0.9, 1000);
  const rowH = fs * 1.55;
  const cardH = fs * 4.6 + subs.length * rowH + fs * 1.0;
  const x0 = (width - cardW) / 2;
  const y0 = (height - cardH) / 2;
  const land = prog(time, landAt, 0.4);
  const assigned = prog(time, assignAt, 0.3);
  const done = prog(time, doneAt, 0.3);
  // Subtasks tick between the assignment and Done, evenly.
  const tickAt = (k: number) => assignAt + 0.35 + ((doneAt - assignAt - 0.35) * (k + 1)) / (subs.length + 1);
  return (
    <div style={{ position: "relative", width, height }}>
      <div style={{ position: "absolute", left: x0, top: y0, width: cardW, height: cardH, borderRadius: 28, background: c.card, border: `${1.5 + done * 1.5}px solid ${done > 0.5 ? c.accent : c.line}`, boxShadow: c.shadow, boxSizing: "border-box", padding: `${fs * 0.9}px ${fs}px`, opacity: land, filter: `blur(${(1 - land) * 8}px)`, translate: `0 ${(1 - land) * 30}px` }}>
        <div style={{ fontFamily: t.sans, fontWeight: 700, fontSize: fs * 1.05, letterSpacing: -fs * 0.03, color: c.ink, whiteSpace: "nowrap" }}>{String(props.title ?? "")}</div>
        <div style={{ marginTop: fs * 0.55, display: "flex", alignItems: "center", gap: fs * 0.4 }}>
          <Chip row={{ who: "agent", name: String(props.agent ?? "Claude") }} fs={fs * 0.8} c={c} p={assigned} />
          <div style={{ fontFamily: t.sans, fontWeight: 600, fontSize: fs * 0.66, whiteSpace: "nowrap", padding: `${fs * 0.16}px ${fs * 0.45}px`, borderRadius: 999, border: `1.5px solid ${done > 0.5 ? c.accent : c.line}`, color: done > 0.5 ? c.ink : c.muted }}>{done > 0.5 ? "Done ✓" : assigned > 0.5 ? "In progress" : "Todo"}</div>
        </div>
        <div style={{ marginTop: fs * 0.7, borderTop: `1px solid ${c.line}` }}>
          {subs.map((sub, k) => {
            const tick = prog(time, tickAt(k), 0.2);
            return (
              <div key={k} style={{ height: rowH, display: "flex", alignItems: "center", gap: fs * 0.5, borderBottom: k < subs.length - 1 ? `1px solid ${c.line}` : "none" }}>
                <div style={{ width: fs * 0.72, height: fs * 0.72, borderRadius: 999, border: `2.5px solid ${tick > 0.5 ? c.accent : c.faint}`, background: tick > 0.5 ? c.accent : "transparent", color: c.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs * 0.5, fontWeight: 700, flex: "none" }}>{tick > 0.5 ? "✓" : ""}</div>
                <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: fs * 0.78, color: tick > 0.5 ? c.ink : c.muted }}>{sub}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- thread ----------
// A comment on a task: you tag the agent, and its reply lands under it, like tagging a teammate.
// props: { you?: string, comment: string (starts with the @name), agent, reply }   times: [comment, reply, tag pulse]
export const Thread: React.FC<CustomProps> = ({ shot, time, props, times, width, height }) => {
  const c = pal(shot.tone);
  const fs = Math.min(54, width / 19);
  const cardW = Math.min(width * 0.9, 1000);
  const x0 = (width - cardW) / 2;
  const commentAt = times[0] ?? shot.start;
  const replyAt = times[1] ?? commentAt + 1.2;
  const pulseAt = times[2] ?? replyAt + 0.8;
  const a = prog(time, commentAt, 0.4);
  const b = prog(time, replyAt, 0.4);
  const pulse = prog(time, pulseAt, 0.25) * (1 - prog(time, pulseAt + 0.5, 0.4));
  const comment = String(props.comment ?? "");
  const tag = comment.match(/^@\S+/)?.[0] ?? "";
  const rest = comment.slice(tag.length);
  const you = String(props.you ?? "You");
  const bubble = (k: number): React.CSSProperties => ({ borderRadius: 22, background: c.card, border: `1.5px solid ${c.line}`, boxShadow: c.shadow, padding: `${fs * 0.7}px ${fs * 0.9}px`, opacity: k, filter: `blur(${(1 - k) * 8}px)`, translate: `0 ${(1 - k) * 24}px` });
  const name = (text: string, icon: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: fs * 0.35, marginBottom: fs * 0.4 }}>
      {icon}
      <span style={{ fontFamily: t.sans, fontWeight: 700, fontSize: fs * 0.72, color: c.ink }}>{text}</span>
    </div>
  );
  return (
    <div style={{ position: "relative", width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: cardW, display: "flex", flexDirection: "column", gap: fs * 0.7, marginLeft: x0 * 0 }}>
        <div style={bubble(a)}>
          {name(you, <div style={{ width: fs * 1.05, height: fs * 1.05, borderRadius: 999, background: c.ink, color: c.card, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.sans, fontWeight: 700, fontSize: fs * 0.55 }}>{you.slice(0, 1)}</div>)}
          <div style={{ fontFamily: t.sans, fontWeight: 500, fontSize: fs * 0.95, lineHeight: 1.3, color: c.ink, textWrap: "balance" }}>
            <span style={{ fontWeight: 700, color: c.card, background: c.accent, borderRadius: 8, padding: `0 ${fs * 0.18}px`, boxShadow: `0 0 0 ${pulse * fs * 0.25}px ${c.accent}` }}>{tag}</span>
            {rest}
          </div>
        </div>
        <div style={{ ...bubble(b), marginLeft: fs * 1.6 }}>
          {name(String(props.agent ?? "Claude"), <Agent size={fs * 1.05} color={c.accent} ink={c.card} />)}
          <div style={{ display: "flex", alignItems: "center", gap: fs * 0.4, fontFamily: t.sans, fontWeight: 500, fontSize: fs * 0.85, color: c.muted }}>
            <span style={{ width: fs * 0.45, height: fs * 0.45, borderRadius: 999, background: c.accent, opacity: 0.5 + 0.5 * Math.abs(Math.sin((time - replyAt) * 4)) }} />
            {String(props.reply ?? "")}
          </div>
        </div>
      </div>
    </div>
  );
};
