// The Grok Bot app (xAI), dark, from Owain's screenshot of it (projects/a1-reel-2/assets/app/
// .source.webp, 2026-11-13): its colours, its bot avatars, and its three views.
//   chat     one bot: the name pill on top, the bot's bubbles on the left, yours on the right, the
//            bot's working line beside its avatar, and "Message <bot>" at the bottom
//   bots     the sidebar list: the selected bot's tile, groups, each bot with its last message
//   profile  the bot's page: its avatar, name, Activity and Library, and its Upcoming tasks with
//            their switches
// Words come from the plan, never from the screenshot (its chat is private).
//
// The camera: one body size for the shot, the largest at which the view's fullest moment fits the
// window (30 px at least). When even that does not fit, the view pans to keep the newest part (the
// latest message, the bot that just arrived, the task being switched on) in frame.
import React from "react";
import type { ResolvedShot } from "../../engine/schema";
import { appBeats, appRows, typeRate } from "../../engine/apps";
import type { V } from "../soft";
import { bodyRange, Caret, clip, fit, inView, Lights, pan, px, SANS, Shimmer, snap, Stage, tail, typed, useBox, Window, windowSize, wrapLines } from "./kit";

// Sampled from the screenshot.
const G = {
  side: "#0C0C0C",
  bg: "#101010",
  card: "#1F1F1F",
  you: "#3A3A3A",
  line: "rgba(255,255,255,0.1)",
  ink: "#F2F2F2",
  muted: "#929292",
  blue: "#126DD2",
  unread: "#5198FB",
  star: "#F49312",
};
export const BOT_COLORS = { white: "#FDFDFD", green: "#13C36E", orange: "#F49314", purple: "#8D5AF9", red: "#FC2D3E" } as const;
type BotColor = keyof typeof BOT_COLORS;
type Shape = "round" | "bean" | "egg";

// The avatars, traced from the screenshot at 6x (2026-11-13) into a 100 x 100 box: the outline as a
// smooth curve through 28 samples round its centre, each eye as a capsule (from, to, thickness).
const BODY: Record<Exclude<Shape, "round">, string> = {
  bean: "M90.9 49.9C90.6 52.9 89.8 55.9 88.6 58.6C87.4 61.3 85.7 63.9 83.8 66C81.9 68.1 79.6 69.9 77.3 71.4C75 72.9 72.6 74 70.2 74.9C67.8 75.8 65.4 76.4 63.1 77C60.8 77.6 58.6 78.1 56.4 78.7C54.2 79.3 52.1 80 49.7 80.5C47.4 81 44.9 81.8 42.3 82C39.7 82.2 36.9 82.4 34.1 82C31.4 81.6 28.4 80.9 25.8 79.7C23.2 78.5 20.5 76.9 18.3 74.9C16.1 72.9 14.1 70.4 12.6 67.8C11.1 65.2 10.2 62.2 9.6 59.2C9 56.2 8.9 53.1 9.2 50.1C9.5 47.1 10.2 44.1 11.4 41.4C12.6 38.7 14.4 36.2 16.3 34.1C18.2 32 20.6 30.3 22.9 28.9C25.2 27.5 27.7 26.4 30 25.5C32.3 24.6 34.7 23.9 36.9 23.2C39.1 22.5 41.2 21.9 43.4 21.3C45.6 20.7 47.8 20 50.1 19.4C52.5 18.8 54.9 18.1 57.5 17.9C60.1 17.7 62.9 17.6 65.6 18C68.3 18.4 71.3 19.1 73.9 20.3C76.5 21.5 79.2 23.1 81.4 25.1C83.6 27.1 85.5 29.5 87 32.1C88.5 34.7 89.6 37.7 90.3 40.7C91 43.7 91.2 46.9 90.9 49.9Z",
  egg: "M87.2 51.8C87.4 54.6 87.3 57.6 86.9 60.5C86.5 63.4 85.9 66.4 84.8 69.1C83.7 71.8 82.2 74.5 80.4 76.9C78.6 79.3 76.4 81.4 74.1 83.3C71.8 85.2 69.1 86.8 66.4 88.1C63.7 89.4 60.8 90.4 57.9 91C55 91.6 51.9 91.8 48.9 91.7C45.9 91.6 42.9 91.2 40.1 90.4C37.3 89.6 34.5 88.4 32 87C29.5 85.6 27.1 83.8 25 81.8C22.9 79.8 21.1 77.6 19.5 75.3C17.9 73 16.6 70.4 15.6 67.8C14.6 65.2 13.7 62.5 13.3 59.9C12.9 57.2 12.9 54.6 13.1 51.9C13.3 49.2 13.9 46.6 14.5 43.9C15.1 41.2 15.6 38.6 16.4 35.9C17.1 33.1 17.9 30.3 19 27.4C20.1 24.5 21.2 21.1 23 18.5C24.8 15.9 26.6 12.6 29.5 11.2C32.4 9.8 35.9 10.1 39 10.3C42.1 10.5 45.5 11.9 48.5 12.9C51.5 13.9 54.2 15.2 56.8 16.4C59.4 17.5 61.9 18.6 64.3 19.8C66.7 21 69.2 22.2 71.4 23.7C73.6 25.2 75.8 27 77.6 29C79.4 31 81.1 33.2 82.5 35.6C83.9 38 85.1 40.7 85.9 43.4C86.7 46.1 87 48.9 87.2 51.8Z",
};
const EYES: Record<Shape, [number, number, number, number, number][]> = {
  round: [[50.7, 31.6, 57.7, 41.4, 10.3], [69, 21, 78.2, 33.8, 6.7]],
  bean: [[48.7, 36.9, 53.3, 46.2, 8.9], [69.9, 30.8, 74.8, 40.5, 8.6]],
  egg: [[54.4, 37.6, 58.8, 46.4, 9.6], [70, 32.6, 75.4, 43.2, 6.8]],
};

// A small deterministic number from a name, so each bot blinks and bobs on its own beat.
const seed = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7) / 997;

// A bot's avatar, drawn in vector so it can be shown at any size: the body in its colour with two
// dark capsule eyes. It bobs gently, blinks every 3 s or so (each eye squashes along its length),
// and bounces with a little squash and stretch when `lively` (talking or just arrived).
export const Blob: React.FC<{ color: BotColor; shape?: Shape; size: number; time: number; name: string; lively?: number }> = ({ color, shape, size, time, name, lively = 0 }) => {
  const sh: Shape = shape ?? (color === "white" ? "round" : color === "red" ? "egg" : "bean");
  const r = seed(name);
  const bob = Math.sin((time + r * 7) * 2.1) * 2.2;
  const hop = Math.abs(Math.sin(time * 7.5)) * 6 * lively;
  const tilt = Math.sin((time + r * 5) * 1.4) * 2.5 + Math.sin(time * 7) * 4 * lively;
  const squash = 1 - 0.06 * lively * Math.max(0, Math.cos(time * 15));
  // A blink every 2.6 to 4 s, about 0.14 s long.
  const period = 2.6 + r * 1.4;
  const ph = ((time + r * period) % period) / period;
  const blink = ph > 0.96 ? Math.abs(Math.sin(((ph - 0.96) / 0.04) * Math.PI)) : 0;
  const fill = BOT_COLORS[color];
  const dark = "#141414";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flex: "0 0 auto", overflow: "visible", translate: `0 ${(bob - hop) * (size / 100)}px`, rotate: `${tilt}deg`, scale: `${2 - squash} ${squash}`, transformOrigin: "50% 90%" }}>
      {sh === "round" ? <circle cx={50} cy={50.15} r={41.45} fill={fill} /> : <path d={BODY[sh]} fill={fill} />}
      {EYES[sh].map(([x1, y1, x2, y2, w], k) => {
        const [cx, cy] = [(x1 + x2) / 2, (y1 + y2) / 2];
        const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        return (
          <g key={k} transform={`translate(${cx} ${cy}) rotate(${a}) scale(${1 - 0.8 * blink} 1) rotate(${-a}) translate(${-cx} ${-cy})`}>
            <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={dark} strokeWidth={w} strokeLinecap="round" />
          </g>
        );
      })}
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
  const w = u * 1.6, h = u * 0.98;
  return (
    <div style={{ width: w, height: h, borderRadius: h, flex: "0 0 auto", position: "relative", background: on > 0.5 ? G.blue : "#3A3A3A" }}>
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
  const range = bodyRange(box, { winW, winH }, v.view === "chat" ? "chat" : "page");
  const rows = appRows(v, shot.start, v.times);
  const headH = (u: number) => Math.max(48, u * 2.1);
  const props = { v, time, winW, winH, shot, range, headH };
  const body = v.view === "chat" ? <Chat {...props} /> : v.view === "bots" ? <Bots {...props} at={rows.bots} /> : <Profile {...props} at={rows.tasks} />;
  return (
    <Stage backdrop={v.backdrop}>
      <Window w={winW} h={winH} r={Math.max(18, range[0] * 0.7)} bg={v.view === "bots" ? G.side : G.bg} edge="rgba(255,255,255,0.1)" time={time} start={shot.start} end={shot.end}>
        {body}
      </Window>
    </Stage>
  );
};

type ViewProps = { v: V<"grokbot">; time: number; winW: number; winH: number; shot: ResolvedShot; range: [number, number]; headH: (u: number) => number };

// The top bar: the traffic lights; in a chat, the bot's name pill and Share.
const Bar: React.FC<{ v: V<"grokbot">; u: number; h: number; time: number; chat?: boolean }> = ({ v, u, h, time, chat }) => (
  <div style={{ height: h, flex: "0 0 auto", display: "flex", alignItems: "center", padding: `0 ${h * 0.38}px`, position: "relative", fontFamily: SANS, color: G.ink }}>
    <Lights s={h * 0.24} />
    {chat && (
      <div style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", display: "flex", alignItems: "center", gap: u * 0.35, background: G.card, borderRadius: u, padding: `${u * 0.22}px ${u * 0.6}px ${u * 0.22}px ${u * 0.28}px`, fontSize: px(u * 0.84), whiteSpace: "nowrap" }}>
        <Blob color={v.bot.color} shape={v.bot.shape} size={u * 1.1} time={time} name={v.bot.name} />
        {v.bot.name}
      </div>
    )}
    <div style={{ flex: 1 }} />
    {chat && <div style={{ background: G.card, borderRadius: u, padding: `${u * 0.22}px ${u * 0.6}px`, fontSize: px(u * 0.8) }}>Share</div>}
  </div>
);

// ---- chat ----
const Chat: React.FC<ViewProps> = ({ v, time, winW, winH, shot, range, headH }) => {
  const beats = appBeats(v, shot.start, v.times);
  const geo = (u: number) => {
    const m = u * 0.8;
    const colW = Math.min(winW - 2 * m, u * 30);
    const composerH = u * 3.2;
    return { m, colW, room: winH - headH(u) - composerH - u * 0.2 };
  };
  const hOf = (type: string, text: string, u: number, colW: number) =>
    type === "user" ? wrapLines(text, colW * 0.78 - u * 1.3, u) * u * 1.38 + u * 0.8
    : type === "bot" ? wrapLines(text, colW * 0.88 - u * 1.3, u) * u * 1.38 + u * 0.8
    : type === "time" ? px(u * 0.8) * 1.4 + u * 0.3
    : u * 1.4;
  // The camera: the largest size at which every message of the shot fits (a status line goes when
  // the next step lands, so it counts only while it is last).
  const u = React.useMemo(() => {
    const lasting = v.steps.filter((s, i) => s.type !== "status" || i === v.steps.length - 1);
    return fit(range[0], range[1], (u) => {
      const g = geo(u);
      return lasting.reduce((n, s) => n + hOf(s.type, s.text, u, g.colW) + u * 0.55, 0) <= g.room;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, winW, winH, range[0], range[1]]);
  const { m, colW, room } = geo(u);
  const gap = u * 0.55;

  type Msg = { key: number; at: number; h: number; el: React.ReactNode };
  const msgs: Msg[] = [];
  let typing: { text: string; busy: boolean } | undefined;
  v.steps.forEach((s, i) => {
    const b = beats[i];
    if (time < b.t0) return;
    const h = hOf(s.type, s.text, u, colW);
    if (s.type === "user") {
      if (time < b.t1) {
        const t = typed(s.text, time, b.t0, typeRate(s.text.length));
        typing = { text: t, busy: t.length < s.text.length };
        return;
      }
      msgs.push({ key: i, at: b.t1, h, el: <div style={{ display: "flex", justifyContent: "flex-end", ...arrive(time, b.t1, u) }}><div style={{ maxWidth: "78%", background: G.you, borderRadius: u * 0.9, padding: `${u * 0.4}px ${u * 0.65}px`, fontSize: u, lineHeight: 1.38, textWrap: "pretty" }}>{s.text}</div></div> });
      return;
    }
    if (s.type === "bot") {
      msgs.push({ key: i, at: b.t0, h, el: <div style={{ display: "flex", ...arrive(time, b.t0, u) }}><div style={{ maxWidth: "88%", background: G.card, borderRadius: u * 0.9, padding: `${u * 0.4}px ${u * 0.65}px`, fontSize: u, lineHeight: 1.38, textWrap: "pretty" }}>{s.text}</div></div> });
      return;
    }
    if (s.type === "time") {
      msgs.push({ key: i, at: b.t0, h, el: <div style={{ textAlign: "center", fontSize: px(u * 0.8), lineHeight: 1.4, paddingTop: u * 0.3, color: G.muted, ...arrive(time, b.t0, u) }}>{s.text}</div> });
      return;
    }
    // status: the bot's working line, until the next step lands.
    const next = beats[i + 1];
    if (next && time >= next.t0) return;
    msgs.push({
      key: i,
      at: b.t0,
      h,
      el: (
        <div style={{ display: "flex", alignItems: "center", gap: u * 0.45, height: u * 1.4, fontSize: px(u * 0.92), whiteSpace: "nowrap", ...arrive(time, b.t0, u) }}>
          <Blob color={v.bot.color} shape={v.bot.shape} size={u * 1.2} time={time} name={v.bot.name} lively={0.5} />
          <Shimmer text={clip(s.text, colW - u * 1.7, px(u * 0.92))} time={time} base="#8A8A8A" hi="#EDEDED" speed={11} />
        </div>
      ),
    });
  });
  // The scroll: when the conversation outgrows the window, it eases up as each message lands.
  let acc = 0;
  const tops: number[] = [];
  const scrollTo = msgs.map((mm) => (tops.push(acc), (acc += mm.h + gap), { t: mm.at, y: Math.max(0, Math.min(acc - gap - room, tops[tops.length - 1])) }));
  const scroll = pan(time, scrollTo, 0.45);
  const t = typing?.text ?? "";
  return (
    <>
      <Bar v={v} u={u} h={headH(u)} time={time} chat />
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", padding: `${u * 0.2}px ${m}px 0`, fontFamily: SANS, color: G.ink }}>
        <div style={{ width: colW, display: "flex", flexDirection: "column", gap, translate: `0 ${-scroll}px` }}>
          {msgs.map((mm, k) => <div key={mm.key} style={{ opacity: inView(tops[k], mm.h, scroll, room, u) }}>{mm.el}</div>)}
        </div>
      </div>
      <div style={{ flex: "0 0 auto", height: u * 3.2, boxSizing: "border-box", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: `0 ${m}px ${u * 0.8}px`, fontFamily: SANS }}>
        <div style={{ width: colW, height: u * 2.1, borderRadius: u * 2, background: G.card, border: `1px solid ${G.line}`, display: "flex", alignItems: "center", gap: u * 0.45, padding: `0 ${u * 0.35}px 0 ${u * 0.6}px` }}>
          <Line d="M12 5v14M5 12h14" s={u * 0.9} color="#BDBDBD" />
          <div style={{ flex: 1, minWidth: 0, fontSize: u * 0.95, color: t ? G.ink : G.muted, whiteSpace: "nowrap", overflow: "hidden", display: "flex", justifyContent: t && t.length * u * 0.5 > colW - u * 6 ? "flex-end" : "flex-start" }}>
            <span style={{ whiteSpace: "pre" }}>{t ? tail(t, colW - u * 5.6, u * 0.95) : clip(`Message ${v.bot.name}`, colW - u * 5.2, u * 0.95)}</span>
            {typing && <Caret time={time} color={G.ink} busy={typing.busy} bar h="1.1em" />}
          </div>
          <Line d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4" s={u * 0.85} color="#BDBDBD" />
          <div style={{ width: u * 1.45, height: u * 1.45, borderRadius: u, background: G.ink, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <Line d="M6 10v4M9 7v10M12 9v6M15 6v12M18 10v4" s={u * 0.85} color="#101010" w={2.2} />
          </div>
        </div>
      </div>
    </>
  );
};

// ---- bots ----
// Heights, from the size `u`: the selected bot's tile, a group's name, a bot's row.
const TILE = 6.2, GROUP = 1.9, ROW = 2.9;
const Bots: React.FC<ViewProps & { at: number[] }> = ({ v, time, winW, winH, range, headH, at }) => {
  const groupsN = new Set(v.bots.map((b) => b.group ?? "")).size;
  const named = new Set(v.bots.map((b) => b.group).filter(Boolean)).size;
  const listH = (u: number, tile: boolean) => (tile ? TILE * u : 0) + named * GROUP * u + v.bots.length * ROW * u + groupsN * 0.4 * u + u * 0.6;
  // The camera: the largest size at which the whole list fits, with the selected bot's tile when
  // it still fits at a good size. Else the smallest size, and the list pans to each new bot.
  const { u, tile } = React.useMemo(() => {
    const room = (u: number) => winH - headH(u);
    const withTile = fit(range[0], range[1], (u) => listH(u, true) <= room(u));
    if (listH(withTile, true) <= room(withTile) && withTile >= Math.min(range[1], 36)) return { u: withTile, tile: true };
    return { u: fit(range[0], range[1], (u) => listH(u, false) <= room(u)), tile: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, winW, winH, range[0], range[1]]);
  const room = winH - headH(u);
  // The selected bot's tile, then each group's bots, in the plan's order, each row at its offset.
  type Placed = { b: V<"grokbot">["bots"][number]; at: number; top: number };
  // A group's rows stay together, as the app lists them, in the order the plan first names each group.
  const groups: { name?: string; top: number; bots: Placed[] }[] = [];
  v.bots.forEach((b, i) => {
    const g = groups.find((x) => x.name === b.group) ?? (groups.push({ name: b.group, top: 0, bots: [] }), groups[groups.length - 1]);
    g.bots.push({ b, at: at[i], top: 0 });
  });
  let y = u * 0.3 + (tile ? TILE * u : 0);
  for (const g of groups) {
    y += u * 0.4;
    g.top = y;
    if (g.name) y += GROUP * u;
    for (const p of g.bots) (p.top = y), (y += ROW * u);
  }
  const placed = groups.flatMap((g) => g.bots);
  const landed = placed.filter((p) => time >= p.at);
  // The pan: as each bot lands, keep its row in frame, the top edge on a group's name or a row.
  const tops = [...groups.filter((g) => g.name).map((g) => g.top), ...placed.map((p) => p.top)];
  const scroll = pan(time, landed.map((p) => ({ t: p.at, y: snap(p.top + ROW * u + u * 0.3 - room, tops) })), 0.5);
  return (
    <>
      <Bar v={v} u={u} h={headH(u)} time={time} />
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", fontFamily: SANS, color: G.ink }}>
        <div style={{ position: "absolute", left: Math.max(0, (winW - u * 26) / 2), right: Math.max(0, (winW - u * 26) / 2), top: 0, translate: `0 ${-scroll}px`, padding: `0 ${u * 0.9}px` }}>
          {tile && (
            <div style={{ position: "absolute", left: "50%", top: u * 0.3, translate: "-50% 0", height: TILE * u - u * 0.6, opacity: inView(u * 0.3, TILE * u - u * 0.6, scroll, room, u), background: G.card, borderRadius: u * 0.6, padding: `${u * 0.55}px ${u * 0.9}px ${u * 0.4}px`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 0.3, boxSizing: "border-box" }}>
              <div style={{ position: "relative" }}>
                <Blob color={v.bot.color} shape={v.bot.shape} size={u * 3} time={time} name={v.bot.name} />
                <div style={{ position: "absolute", right: -u * 0.1, bottom: u * 0.05, width: u * 0.95, height: u * 0.95, borderRadius: u, background: G.star, border: `${u * 0.12}px solid ${G.card}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width={u * 0.52} height={u * 0.52} viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#FFFFFF" /></svg>
                </div>
              </div>
              <div style={{ fontSize: px(u * 0.84), whiteSpace: "nowrap" }}>{v.bot.name}</div>
            </div>
          )}
          {groups.map((g, gi) => (
            <React.Fragment key={gi}>
              {g.name && g.bots.some((p) => time >= p.at) && (
                <div style={{ position: "absolute", top: g.top, left: u * 0.9, right: u * 0.9, height: GROUP * u, display: "flex", alignItems: "center", fontSize: px(u * 0.84), color: G.muted, opacity: inView(g.top, GROUP * u, scroll, room, u) }}>{g.name}</div>
              )}
              {g.bots.map((p, k) => {
                if (time < p.at) return null;
                const fresh = Math.max(0, 1 - Math.max(0, time - p.at) / 1.2);
                return (
                  <div key={k} style={{ position: "absolute", top: p.top, left: u * 0.9, right: u * 0.9, height: ROW * u, display: "flex", alignItems: "center", gap: u * 0.6, opacity: inView(p.top, ROW * u, scroll, room, u) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: u * 0.6, flex: 1, minWidth: 0, ...arrive(time, p.at, u) }}>
                      <Blob color={p.b.color} shape={p.b.shape} size={u * 1.9} time={time} name={p.b.name} lively={fresh} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: u, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.b.name}</div>
                        {p.b.preview && <div style={{ fontSize: px(u * 0.88), lineHeight: 1.3, color: G.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.b.preview}</div>}
                      </div>
                      {p.b.unread && <div style={{ width: u * 0.38, height: u * 0.38, borderRadius: u, background: G.unread, flex: "0 0 auto" }} />}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
};

// ---- profile ----
// Heights, from the size `u`: the header (avatar, name, tabs), the Upcoming label, a task's row.
const HEAD = 8.6, UPCOMING = 1.8, TASK = 2.6;
const Profile: React.FC<ViewProps & { at: number[] }> = ({ v, time, winW, winH, range, headH, at }) => {
  const n = v.tasks.length;
  const pageH = (u: number) => HEAD * u + (n ? UPCOMING * u + n * TASK * u + u * 0.7 : 0) + u * 0.5;
  // The camera: the largest size at which the whole page fits; else the smallest, panning down to
  // each task as it switches on.
  const u = React.useMemo(() => fit(range[0], range[1], (u) => pageH(u) <= winH - headH(u)), [v, winW, winH, range[0], range[1]]);
  const room = winH - headH(u);
  const taskTop = (i: number) => HEAD * u + UPCOMING * u + u * 0.35 + i * TASK * u;
  // The pan, onto the task being switched on; its top edge lands on the Upcoming label or a task.
  const tops = [HEAD * u, ...v.tasks.map((_, i) => taskTop(i) - u * 0.35)];
  const scroll = pan(time, v.tasks.map((task, i) => ({ t: at[i] >= 0 && task.at ? at[i] : -1, y: snap(taskTop(i) + TASK * u + u * 0.6 - room, tops) })), 0.5);
  // The page sits in the middle of the window when it has room to spare.
  const spare = Math.max(0, room - pageH(u));
  const view = room - spare * 0.4;
  return (
    <>
      <Bar v={v} u={u} h={headH(u)} time={time} />
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", fontFamily: SANS, color: G.ink }}>
        <div style={{ position: "absolute", left: Math.max(u * 0.9, (winW - u * 24) / 2), right: Math.max(u * 0.9, (winW - u * 24) / 2), top: spare * 0.4, translate: `0 ${-scroll}px` }}>
          <div style={{ height: HEAD * u, display: "flex", flexDirection: "column", alignItems: "center", opacity: inView(u * 2, HEAD * u - u * 2, scroll, view, u) }}>
            <Blob color={v.bot.color} shape={v.bot.shape} size={u * 3.6} time={time} name={v.bot.name} />
            <div style={{ fontSize: u * 1.15, margin: `${u * 0.45}px 0 ${u * 0.45}px`, whiteSpace: "nowrap" }}>{v.bot.name}</div>
            <div style={{ display: "flex", gap: u * 0.3, fontSize: px(u * 0.86) }}>
              <span style={{ background: "#1C1C1C", borderRadius: u, padding: `${u * 0.2}px ${u * 0.55}px` }}>Activity</span>
              <span style={{ color: G.muted, padding: `${u * 0.2}px ${u * 0.3}px` }}>Library</span>
            </div>
          </div>
          {n > 0 && <div style={{ height: UPCOMING * u, display: "flex", alignItems: "center", fontSize: px(u * 0.86), color: G.muted, paddingLeft: u * 0.2, opacity: inView(HEAD * u, UPCOMING * u, scroll, view, u) }}>Upcoming</div>}
          {n > 0 && (
            <div style={{ background: G.card, borderRadius: u * 0.6, padding: `${u * 0.35}px ${u * 0.6}px` }}>
              {v.tasks.map((task, i) => {
                // A task with its own words switches on as they are said; one without shows as set.
                const t0 = at[i];
                const anchored = t0 >= 0 && !!task.at;
                const on = task.on ? (anchored ? Math.min(1, Math.max(0, (time - t0) / 0.22)) : 1) : 0;
                const ease = on * on * (3 - 2 * on);
                return (
                  <div key={i} style={{ height: TASK * u, display: "flex", alignItems: "center", gap: u * 0.5, opacity: inView(taskTop(i), TASK * u, scroll, view, u) }}>
                    <Line d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" s={u * 0.9} color="#7A7A7A" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: u, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.name}</div>
                      <div style={{ fontSize: px(u * 0.88), lineHeight: 1.3, color: G.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.when}</div>
                    </div>
                    <Switch on={ease} u={u} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
