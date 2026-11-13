// The Grok Bot app (xAI), dark, from Owain's screenshot of it (projects/a1-reel-2/assets/app/
// .source.webp, 2026-11-13): its colours, its bot avatars, and its three views.
//   chat     one bot: the name pill on top, the bot's bubbles on the left, yours on the right, the
//            bot's working line beside its avatar, and "Message <bot>" at the bottom
//   bots     the sidebar list: the selected bot's tile, groups, each bot with its last message
//   profile  the bot's page: its avatar, name, Activity and Library, and its Upcoming tasks with
//            their switches
// Words come from the plan, never from the screenshot (its chat is private).
import React from "react";
import type { ResolvedShot } from "../../engine/schema";
import { appBeats, appRows, typeRate } from "../../engine/apps";
import type { V } from "../soft";
import { Caret, enter, linesFor, px, SANS, Shimmer, Stage, typed, useBox, windowSize } from "./kit";

// Sampled from the screenshot.
const G = {
  side: "#0C0C0C",
  bg: "#101010",
  card: "#1F1F1F",
  you: "#3D3D3D",
  line: "#1B1B1B",
  ink: "#F2F2F2",
  muted: "#929292",
  blue: "#126DD2",
  unread: "#5198FB",
  star: "#F49312",
};
export const BOT_COLORS = { white: "#FDFDFD", green: "#13C36E", orange: "#F49312", purple: "#8C5AF9", red: "#FC2D3E" } as const;
type BotColor = keyof typeof BOT_COLORS;
type Shape = "round" | "bean" | "egg";

// A small deterministic number from a name, so each bot blinks and bobs on its own beat.
const seed = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7) / 997;

// A bot's avatar: the blob in its colour with two dark eyes. It bobs gently, blinks now and then, and
// bounces a little when `lively` (talking or just arrived).
export const Blob: React.FC<{ color: BotColor; shape?: Shape; size: number; time: number; name: string; lively?: number }> = ({ color, shape, size, time, name, lively = 0 }) => {
  const sh: Shape = shape ?? (color === "white" ? "round" : color === "red" ? "egg" : "bean");
  const r = seed(name);
  const bob = Math.sin((time + r * 7) * 2.1) * 2.2 + Math.sin(time * 9) * 3 * lively;
  const tilt = Math.sin((time + r * 5) * 1.4) * 2.5 + Math.sin(time * 7) * 4 * lively;
  // A blink every 2.6 to 4 s, about 0.14 s long.
  const period = 2.6 + r * 1.4;
  const ph = ((time + r * period) % period) / period;
  const blink = ph > 0.96 ? Math.abs(Math.sin(((ph - 0.96) / 0.04) * Math.PI)) : 0;
  const eye = 1 - 0.88 * blink;
  const fill = BOT_COLORS[color];
  const dark = "#1E1E1E";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flex: "0 0 auto", overflow: "visible", translate: `0 ${bob * (size / 100)}px`, rotate: `${tilt}deg` }}>
      {/* Traced from the screenshot at 4x (2026-11-13). */}
      {sh === "round" && (
        <>
          <circle cx={50} cy={52} r={40} fill={fill} />
          <g style={{ transformOrigin: "56px 38px", scale: `1 ${eye}` }}>
            <path d="M 45 32 L 53 47" stroke={dark} strokeWidth={12.5} strokeLinecap="round" />
            <path d="M 62.5 27 L 67.5 37" stroke={dark} strokeWidth={10} strokeLinecap="round" />
          </g>
        </>
      )}
      {sh === "bean" && (
        <>
          <path d="M 6 62 C 2 42 18 28 46 24 C 74 20 94 24 95 41 C 96 58 80 66 54 72 C 28 78 9 80 6 62 Z" fill={fill} />
          <g style={{ transformOrigin: "65px 39px", scale: `1 ${eye}` }}>
            <ellipse cx={58} cy={41} rx={3.8} ry={7.8} fill={dark} transform="rotate(-16 58 41)" />
            <ellipse cx={72} cy={38} rx={3.8} ry={7.8} fill={dark} transform="rotate(-16 72 38)" />
          </g>
        </>
      )}
      {sh === "egg" && (
        <>
          <path d="M 24 8 C 42 8 68 22 80 40 C 92 60 84 86 60 92 C 36 98 14 84 13 62 C 12 42 14 20 24 8 Z" fill={fill} />
          <g style={{ transformOrigin: "64px 44px", scale: `1 ${eye}` }}>
            <ellipse cx={58} cy={46} rx={3.6} ry={7.4} fill={dark} transform="rotate(-16 58 46)" />
            <ellipse cx={70} cy={43} rx={3.6} ry={7.4} fill={dark} transform="rotate(-16 70 43)" />
          </g>
        </>
      )}
    </svg>
  );
};

// The app's small icons, as thin white line drawings.
const Line: React.FC<{ d: string; s: number; color?: string; w?: number }> = ({ d, s, color = G.ink, w = 1.8 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
    <path d={d} />
  </svg>
);

// The scheduled task's switch, sliding on in the app's blue.
const Switch: React.FC<{ on: number; u: number }> = ({ on, u }) => {
  const w = u * 1.55, h = u * 0.95;
  return (
    <div style={{ width: w, height: h, borderRadius: h, flex: "0 0 auto", position: "relative", background: on > 0.5 ? G.blue : "#3A3A3A", transition: "none" }}>
      <div style={{ position: "absolute", top: h * 0.1, left: h * 0.1 + (w - h) * on, width: h * 0.8, height: h * 0.8, borderRadius: h, background: "#F4F4F4", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
    </div>
  );
};

type Props = { shot: ResolvedShot; time: number; v: V<"grokbot"> };

const arrive = (time: number, at: number, u: number): React.CSSProperties => {
  const k = Math.min(1, Math.max(0, (time - at) / 0.3));
  const e = 1 - (1 - k) ** 3;
  return { opacity: e, translate: `0 ${(1 - e) * u * 0.8}px`, scale: String(0.96 + 0.04 * e) };
};

export const GrokBot: React.FC<Props> = ({ shot, time, v }) => {
  const box = useBox();
  const { winW, winH } = windowSize(box, v.backdrop, 1700);
  const u = Math.min(34, winW / 28, winH / 21);
  const rows = appRows(v, shot.start, v.times);
  const bot = v.bot;
  // The list and the page size their rows to fit the window with every row in it, so nothing is cut
  // when the last bot or task lands.
  const groupsN = new Set(v.bots.map((b) => b.group)).size;
  // With little room the selected bot's tile goes, so the rows keep a readable size.
  const rowsU = (tile: boolean) => Math.min(u, winH / ((tile ? 9 : 3.4) + groupsN * 2.1 + v.bots.length * 3.05));
  const tile = rowsU(true) >= 27;
  const listU = rowsU(tile);
  const pageU = Math.min(u, winH / (12.4 + (v.tasks.length ? 1.9 : 0) + v.tasks.length * 2.6));
  const body = v.view === "chat" ? <Chat {...{ v, time, u, winW, winH, shot }} /> : v.view === "bots" ? <Bots {...{ v, time, u: listU, at: rows.bots, tile }} /> : <Profile {...{ v, time, u: pageU, at: rows.tasks }} />;
  return (
    <Stage backdrop={v.backdrop}>
      <div style={{ width: winW, height: winH, borderRadius: u * 0.7, overflow: "hidden", background: v.view === "bots" ? G.side : G.bg, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 50px 120px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", fontFamily: SANS, color: G.ink, ...enter(time, shot.start, shot.end) }}>
        <div style={{ height: u * 2.1, flex: "0 0 auto", display: "flex", alignItems: "center", gap: u * 0.38, padding: `0 ${u * 0.7}px`, position: "relative" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: u * 0.45, height: u * 0.45, borderRadius: u, background: c }} />)}
          {v.view === "chat" && (
            <div style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", display: "flex", alignItems: "center", gap: u * 0.35, background: G.card, borderRadius: u, padding: `${u * 0.25}px ${u * 0.6}px ${u * 0.25}px ${u * 0.3}px`, fontSize: px(u * 0.82), whiteSpace: "nowrap" }}>
              <Blob color={bot.color} shape={bot.shape} size={u * 1.05} time={time} name={bot.name} />
              {bot.name}
            </div>
          )}
          <div style={{ flex: 1 }} />
          {v.view === "chat" && <div style={{ background: G.card, borderRadius: u, padding: `${u * 0.25}px ${u * 0.6}px`, fontSize: px(u * 0.78) }}>Share</div>}
        </div>
        {body}
      </div>
    </Stage>
  );
};

// ---- chat ----
const Chat: React.FC<{ v: V<"grokbot">; time: number; u: number; winW: number; winH: number; shot: ResolvedShot }> = ({ v, time, u, winW, winH, shot }) => {
  const beats = appBeats(v, shot.start, v.times);
  const colW = Math.min(winW - u * 2, u * 30);
  type Msg = { key: number; h: number; el: React.ReactNode };
  const msgs: Msg[] = [];
  let typing: { text: string; busy: boolean } | undefined;
  v.steps.forEach((s, i) => {
    const b = beats[i];
    if (time < b.t0) return;
    if (s.type === "user") {
      if (time < b.t1) {
        const t = typed(s.text, time, b.t0, typeRate(s.text.length));
        typing = { text: t, busy: t.length < s.text.length };
        return;
      }
      const lines = linesFor(s.text, colW * 0.75 - u * 1.2, u * 0.95);
      msgs.push({ key: i, h: lines * u * 1.33 + u * 1.5, el: <div style={{ display: "flex", justifyContent: "flex-end", ...arrive(time, b.t1, u) }}><div style={{ maxWidth: "75%", background: G.you, borderRadius: u * 0.9, padding: `${u * 0.4}px ${u * 0.65}px`, fontSize: px(u * 0.95), lineHeight: 1.4, textWrap: "pretty" }}>{s.text}</div></div> });
      return;
    }
    if (s.type === "bot") {
      const lines = linesFor(s.text, colW * 0.85 - u * 1.2, u * 0.95);
      msgs.push({ key: i, h: lines * u * 1.33 + u * 1.5, el: <div style={{ display: "flex", ...arrive(time, b.t0, u) }}><div style={{ maxWidth: "85%", background: G.card, borderRadius: u * 0.9, padding: `${u * 0.4}px ${u * 0.65}px`, fontSize: px(u * 0.95), lineHeight: 1.4, textWrap: "pretty" }}>{s.text}</div></div> });
      return;
    }
    if (s.type === "time") {
      msgs.push({ key: i, h: u * 1.8, el: <div style={{ textAlign: "center", fontSize: px(u * 0.78), color: G.muted, ...arrive(time, b.t0, u) }}>{s.text}</div> });
      return;
    }
    // status: the bot's working line, until the next step lands.
    const next = beats[i + 1];
    if (next && time >= next.t0) return;
    msgs.push({
      key: i,
      h: u * 1.9,
      el: (
        <div style={{ display: "flex", alignItems: "center", gap: u * 0.45, fontSize: px(u * 0.95), ...arrive(time, b.t0, u) }}>
          <Blob color={v.bot.color} shape={v.bot.shape} size={u * 1.25} time={time} name={v.bot.name} lively={0.5} />
          <Shimmer text={s.text} time={time} base="#8A8A8A" hi="#EDEDED" speed={11} />
        </div>
      ),
    });
  });
  const composerH = u * 2.6;
  let room = winH - u * 2.1 - composerH - u * 1.6;
  const fit: Msg[] = [];
  for (const m of [...msgs].reverse()) {
    if (m.h > room && fit.length) break;
    room -= m.h;
    fit.unshift(m);
  }
  const t = typing?.text ?? "";
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", padding: `0 ${u}px ${u * 0.5}px` }}>
        <div style={{ width: colW, display: "flex", flexDirection: "column", gap: u * 0.5 }}>{fit.map((m) => <div key={m.key}>{m.el}</div>)}</div>
      </div>
      <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "center", padding: `0 ${u}px ${u * 0.8}px` }}>
        <div style={{ width: colW, height: composerH * 0.78, borderRadius: u * 2, background: G.card, display: "flex", alignItems: "center", gap: u * 0.45, padding: `0 ${u * 0.4}px 0 ${u * 0.6}px` }}>
          <Line d="M12 5v14M5 12h14" s={u * 0.9} color="#BDBDBD" />
          <div style={{ flex: 1, minWidth: 0, fontSize: px(u * 0.92), color: t ? G.ink : G.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t || `Message ${v.bot.name}`}
            {typing && <Caret time={time} color={G.ink} busy={typing.busy} bar h="1.1em" />}
          </div>
          <Line d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4" s={u * 0.85} color="#BDBDBD" />
          <div style={{ width: u * 1.4, height: u * 1.4, borderRadius: u, background: G.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Line d="M6 10v4M9 7v10M12 9v6M15 6v12M18 10v4" s={u * 0.85} color="#101010" w={2.2} />
          </div>
        </div>
      </div>
    </>
  );
};

// ---- bots ----
const Bots: React.FC<{ v: V<"grokbot">; time: number; u: number; at: number[]; tile: boolean }> = ({ v, time, u, at, tile }) => {
  // The selected bot's tile, then each group's bots, in the plan's order.
  const groups: { name?: string; bots: { b: V<"grokbot">["bots"][number]; at: number }[] }[] = [];
  v.bots.forEach((b, i) => {
    if (time < at[i]) return;
    const g = groups.find((x) => x.name === b.group) ?? (groups.push({ name: b.group, bots: [] }), groups[groups.length - 1]);
    g.bots.push({ b, at: at[i] });
  });
  return (
    <div style={{ flex: 1, padding: `${u * 0.3}px ${u * 0.9}px`, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {tile && (
      <div style={{ alignSelf: "center", background: G.card, borderRadius: u * 0.6, padding: `${u * 0.6}px ${u * 0.8}px ${u * 0.45}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.3, marginBottom: u * 0.7 }}>
        <div style={{ position: "relative" }}>
          <Blob color={v.bot.color} shape={v.bot.shape} size={u * 2.7} time={time} name={v.bot.name} />
          <div style={{ position: "absolute", right: -u * 0.1, bottom: u * 0.05, width: u * 0.9, height: u * 0.9, borderRadius: u, background: G.star, border: `${u * 0.12}px solid ${G.card}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={u * 0.5} height={u * 0.5} viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#FFFFFF" /></svg>
          </div>
        </div>
        <div style={{ fontSize: px(u * 0.82) }}>{v.bot.name}</div>
      </div>
      )}
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: u * 0.5 }}>
          {g.name && <div style={{ fontSize: px(u * 0.82), color: G.muted, margin: `${u * 0.35}px 0 ${u * 0.3}px` }}>{g.name}</div>}
          {g.bots.map(({ b, at: t0 }) => {
            const fresh = Math.max(0, 1 - Math.max(0, time - t0) / 1.2);
            return (
              <div key={b.name} style={{ display: "flex", alignItems: "center", gap: u * 0.55, padding: `${u * 0.3}px 0`, ...arrive(time, t0, u) }}>
                <Blob color={b.color} shape={b.shape} size={u * 1.75} time={time} name={b.name} lively={fresh} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: px(u * 0.95), lineHeight: 1.3 }}>{b.name}</div>
                  {b.preview && <div style={{ fontSize: px(u * 0.85), lineHeight: 1.3, color: G.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.preview}</div>}
                </div>
                {b.unread && <div style={{ width: u * 0.36, height: u * 0.36, borderRadius: u, background: G.unread }} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ---- profile ----
const Profile: React.FC<{ v: V<"grokbot">; time: number; u: number; at: number[] }> = ({ v, time, u, at }) => (
  <div style={{ flex: 1, padding: `0 ${u * 0.9}px`, display: "flex", flexDirection: "column", alignItems: "stretch", minHeight: 0 }}>
    <div style={{ alignSelf: "center", marginTop: u * 0.2 }}>
      <Blob color={v.bot.color} shape={v.bot.shape} size={u * 3.2} time={time} name={v.bot.name} />
    </div>
    <div style={{ alignSelf: "center", fontSize: u * 1.1, margin: `${u * 0.5}px 0 ${u * 0.4}px` }}>{v.bot.name}</div>
    <div style={{ alignSelf: "center", display: "flex", gap: u * 0.3, fontSize: px(u * 0.85), marginBottom: u * 0.8 }}>
      <span style={{ background: "#191919", borderRadius: u, padding: `${u * 0.2}px ${u * 0.5}px` }}>Activity</span>
      <span style={{ color: G.muted, padding: `${u * 0.2}px ${u * 0.3}px` }}>Library</span>
    </div>
    {v.tasks.length > 0 && <div style={{ fontSize: px(u * 0.85), color: G.muted, marginBottom: u * 0.4, paddingLeft: u * 0.2 }}>Upcoming</div>}
    {v.tasks.length > 0 && (
      <div style={{ background: G.card, borderRadius: u * 0.6, padding: `${u * 0.3}px ${u * 0.6}px` }}>
        {v.tasks.map((task, i) => {
          // A task with its own words switches on as they are said; one without shows as set.
          const t0 = at[i];
          const anchored = t0 >= 0 && !!task.at;
          const on = task.on ? (anchored ? Math.min(1, Math.max(0, (time - t0) / 0.22)) : 1) : 0;
          const ease = on * on * (3 - 2 * on);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: u * 0.5, padding: `${u * 0.35}px 0` }}>
              <Line d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" s={u * 0.85} color="#6A6A6A" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: px(u * 0.92), lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.name}</div>
                <div style={{ fontSize: px(u * 0.82), lineHeight: 1.3, color: G.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.when}</div>
              </div>
              <Switch on={ease} u={u} />
            </div>
          );
        })}
      </div>
    )}
  </div>
);
