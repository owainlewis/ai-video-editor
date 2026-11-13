// The Claude desktop app, dark: the sidebar (New, Search, Projects, Artifacts, Scheduled, Customize,
// then recent chats), the conversation and the composer, as the app lays them out (Owain's screen
// recordings of it, 2026-11-12, and the Code session in research/reels/nmdvmu2dyyhl). A chat's
// replies are set in the serif, a Code session's in the sans. On a narrow window the app hides its
// sidebar, so a split's panel shows the conversation alone.
//
// The camera: one body size for the shot, the largest at which its fullest moment fits the window
// (30 px at least). A script too long for that scrolls, easing to keep the newest message in view.
import React from "react";
import type { ResolvedShot } from "../../engine/schema";
import { appBeats, typeRate, type Beat } from "../../engine/apps";
import type { V } from "../soft";
import { Clawd } from "./cli";
import { bodyRange, Caret, fit, Lights, MONO, pan, px, SANS, segs, SERIF, Shimmer, Stage, tail, clip, inView, typed, useBox, Window, windowSize, wrapLines } from "./kit";

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s);

const C = {
  bg: "#262624",
  side: "#1F1E1D",
  line: "rgba(250,249,245,0.09)",
  ink: "#FAF9F5",
  body: "#E8E6DC",
  muted: "#A6A39A",
  bubble: "#141413",
  field: "#30302E",
  code: "#1A1918",
  clay: "#C6613F",
  green: "#3FA45B",
  // The selected row in the sidebar (solid, so the text is read against it).
  hover: "#2E2D2A",
};

// The app's thin line icons.
const Icon: React.FC<{ d: string; s: number; color?: string; w?: number }> = ({ d, s, color = C.muted, w = 1.7 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
    <path d={d} />
  </svg>
);
const ICON = {
  plus: "M12 5v14M5 12h14",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20",
  projects: "M5 8h14v11H5zM7 5h10M9 2.8h6",
  artifacts: "M8 4h9a2 2 0 0 1 2 2v9M5 8h9a1 1 0 0 1 1 1v10H6a1 1 0 0 1-1-1z",
  scheduled: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  customize: "M4 9h16v10H4zM8 9V6h8v3",
  chevron: "M8 10l4 4 4-4",
  right: "M10 8l4 4-4 4",
  up: "M12 19V5M6 11l6-6 6 6",
  laptop: "M5 6h14v9H5zM3 18h18",
  folder: "M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
  tick: "M7 12.5l3.2 3.2L17 9",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
};

type Props = { shot: ResolvedShot; time: number; v: V<"claudeapp"> };

// Text with `code` spans and **bold**, as the app sets them.
const Rich: React.FC<{ text: string; u: number }> = ({ text, u }) => (
  <>
    {segs(text).map((g, k) =>
      g.code ? (
        <span key={k} style={{ fontFamily: MONO, fontSize: "max(26px, 0.88em)", background: C.code, border: `1px solid ${C.line}`, borderRadius: u * 0.18, padding: `0 ${u * 0.14}px` }}>{g.s}</span>
      ) : (
        <span key={k} style={{ fontWeight: g.bold ? 700 : undefined }}>{g.s}</span>
      ),
    )}
  </>
);

// The sizes everything is set at, from the body size `u`.
const sizes = (u: number, chat: boolean) => ({
  reply: u,
  you: u,
  small: px(u * 0.86),
  label: px(u * 0.78),
  lead: chat ? 1.5 : 1.45,
  gap: u * 0.7,
});

// The conversation as items: what each step puts in the list, and when.
type Item = { i: number; type: V<"claudeapp">["steps"][number]["type"]; text: string; items: string[]; b: Beat; next?: Beat };

// An item's height at body size `u` in a column `colW` wide (for the fit and the scroll; the
// browser lays the items out itself).
const heightOf = (it: Item, u: number, colW: number, chat: boolean) => {
  const z = sizes(u, chat);
  const fam = chat ? SERIF : SANS;
  switch (it.type) {
    case "user": return wrapLines(it.text, colW * 0.82 - u * 1.4, z.you) * z.you * 1.4 + u * 0.9;
    case "text": return wrapLines(it.text, colW, z.reply, fam) * z.reply * z.lead;
    case "list": return (it.text ? z.reply * z.lead + u * 0.3 : 0) + it.items.reduce((n, s) => n + wrapLines(s, colW - u * 1.4, z.reply, fam) * z.reply * z.lead + u * 0.3, 0);
    case "todo": return it.items.reduce((n, s) => n + Math.max(1.7, wrapLines(s, colW - u * 2.8, u) * 1.35) * u, 0) + u * 0.8;
    default: return z.small * 1.5;
  }
};

export const ClaudeApp: React.FC<Props> = ({ shot, time, v }) => {
  const box = useBox();
  const { winW, winH } = windowSize(box, v.backdrop, 1720);
  const wide = winW >= 1300 && !box.panel;
  const sideW = wide ? winW * 0.22 : 0;
  const chat = v.mode === "chat";
  const beats = appBeats(v, shot.start, v.times);
  const items: Item[] = v.steps.map((s, i) => ({ i, type: s.type, text: s.text, items: s.items ?? [], b: beats[i], next: beats[i + 1] }));
  // The list as the shot ends: every message sent and every reply in full (a think step has gone).
  const conv = items.filter((it) => it.type !== "folder" && it.type !== "think");
  const hasFolder = items.some((it) => it.type === "folder");

  const geo = (u: number) => {
    const headH = Math.max(44, u * 1.55);
    const m = u * 0.8;
    const colW = Math.min(winW - sideW - 2 * m, u * 32);
    const composerH = chat ? u * 5.1 : u * 4.9;
    return { headH, m, colW, composerH, room: winH - headH - composerH - u * 0.8 };
  };
  // The camera: the largest body size at which the conversation, and a Code session's opening
  // screen, fit the window.
  const u = React.useMemo(() => {
    const [lo, hi] = bodyRange(box, { winW, winH }, "chat");
    return fit(lo, hi, (u) => {
      const g = geo(u);
      const list = conv.reduce((n, it) => n + heightOf(it, u, g.colW, chat) + sizes(u, chat).gap, 0);
      const open = chat ? 0 : u * (3.5 + 1.5 + 1.7 + 2.8) + u * 4.2;
      return list <= g.room && open <= winH - g.headH - u;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, shot.start, winW, winH, box.panel]);
  const { headH, m, colW, room, composerH } = geo(u);
  const z = sizes(u, chat);
  const fam = chat ? SERIF : SANS;

  // What has landed: sent messages and replies, newest last, each with its height. Each draws at its
  // top in the list; a line the scroll has taken past the top edge fades, so none is seen cut.
  type Msg = { key: number; at: number; h: number; rows?: boolean; el: (top: number) => React.ReactNode };
  const msgs: Msg[] = [];
  let scroll = 0;
  const vis = (y: number, h = u * 1.5) => inView(y, h, scroll, room, u);
  let typing: { text: string; busy: boolean } | undefined;
  // Code, before the first message: the folder menu, open from `t0` until `t1`, then picked.
  let folder: { items: string[]; pick: string; t0: number; t1: number } | undefined;
  for (const it of items) {
    const { b } = it;
    if (time < b.t0) continue;
    const rise = (at: number): React.CSSProperties => {
      const k = Math.min(1, Math.max(0, (time - at) / 0.25));
      return { opacity: k, translate: `0 ${(1 - k) * u * 0.5}px` };
    };
    const h = heightOf(it, u, colW, chat);
    if (it.type === "folder") {
      folder = { items: it.items, pick: it.text, t0: b.t0, t1: b.t1 };
      continue;
    }
    if (it.type === "todo") {
      msgs.push({
        key: it.i,
        at: b.t0,
        h,
        rows: true,
        el: (top) => (
          <div style={{ background: C.code, border: `1px solid ${C.line}`, borderRadius: u * 0.5, padding: `${u * 0.4}px ${u * 0.6}px`, fontFamily: SANS, fontSize: z.reply, lineHeight: 1.35, color: C.body, ...rise(b.t0) }}>
            {it.items.map((s, k) => {
              const at = b.t0 + 0.3 + k * 0.35;
              const done = Math.min(1, Math.max(0, (time - at) / 0.18));
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: u * 0.5, minHeight: u * 1.7, opacity: (0.55 + 0.45 * done) * vis(top + u * 0.4 + k * u * 1.7) }}>
                  <div style={{ width: u * 0.95, height: u * 0.95, borderRadius: u, flex: "0 0 auto", border: `1.5px solid ${done > 0.5 ? C.green : C.muted}`, background: done > 0.5 ? C.green : undefined, display: "flex", alignItems: "center", justifyContent: "center", scale: String(1 + 0.18 * Math.sin(done * Math.PI)) }}>
                    {done > 0.5 && <Icon d={ICON.tick} s={u * 0.72} color="#FFFFFF" w={2.4} />}
                  </div>
                  <span><Rich text={s} u={u} /></span>
                </div>
              );
            })}
          </div>
        ),
      });
      continue;
    }
    if (it.type === "user") {
      if (time < b.t1) {
        const t = typed(it.text, time, b.t0, typeRate(it.text.length));
        typing = { text: t, busy: t.length < it.text.length };
        continue;
      }
      msgs.push({
        key: it.i,
        at: b.t1,
        h,
        el: () => (
          <div style={{ display: "flex", justifyContent: "flex-end", ...rise(b.t1) }}>
            <div style={{ maxWidth: "82%", background: C.bubble, borderRadius: u * 0.75, padding: `${u * 0.45}px ${u * 0.7}px`, fontFamily: SANS, fontSize: z.you, lineHeight: 1.4, color: C.ink, textWrap: "pretty" }}><Rich text={it.text} u={u} /></div>
          </div>
        ),
      });
      continue;
    }
    if (it.type === "text") {
      // The reply streams in a few words at a time.
      const words = it.text.split(/(?<= )/);
      const n = Math.max(1, Math.ceil(((time - b.t0) / Math.max(0.1, b.t1 - b.t0)) * words.length));
      msgs.push({ key: it.i, at: b.t0, h, el: () => <div style={{ fontFamily: fam, fontSize: z.reply, lineHeight: z.lead, color: C.body, textWrap: "pretty" }}><Rich text={words.slice(0, n).join("")} u={u} /></div> });
      continue;
    }
    if (it.type === "list") {
      const shown = it.items.filter((_, k) => time >= b.t0 + 0.3 + k * 0.35);
      // Each bullet's top within the list, for the fade at the window's top edge.
      const head = it.text ? z.reply * z.lead + u * 0.3 : 0;
      const at: number[] = [];
      it.items.reduce((y, s) => (at.push(y), y + wrapLines(s, colW - u * 1.4, z.reply, fam) * z.reply * z.lead + u * 0.3), head);
      msgs.push({
        key: it.i,
        at: b.t0,
        h,
        rows: true,
        el: (top) => (
          <div style={{ fontFamily: fam, fontSize: z.reply, lineHeight: z.lead, color: C.body }}>
            {it.text && <div style={{ fontWeight: 600, color: C.ink, fontFamily: SANS, marginBottom: u * 0.3, opacity: vis(top) }}>{it.text}</div>}
            {shown.map((s, k) => (
              <div key={k} style={{ display: "flex", gap: u * 0.55, marginBottom: u * 0.3, ...rise(b.t0 + 0.3 + k * 0.35), opacity: Math.min(vis(top + at[k]), Math.min(1, Math.max(0, (time - b.t0 - 0.3 - k * 0.35) / 0.25))) }}>
                <span style={{ color: C.muted }}>•</span>
                <span><Rich text={s} u={u} /></span>
              </div>
            ))}
          </div>
        ),
      });
      continue;
    }
    if (it.type === "tool") {
      msgs.push({
        key: it.i,
        at: b.t0,
        h,
        el: () => (
          <div style={{ display: "flex", alignItems: "center", gap: u * 0.2, fontFamily: SANS, fontSize: z.small, lineHeight: 1.5, color: C.muted, whiteSpace: "nowrap", ...rise(b.t0) }}>
            {cut(it.text || "Ran a command", Math.floor(colW / (z.small * 0.5)))}
            <Icon d={ICON.right} s={u * 0.75} />
          </div>
        ),
      });
      continue;
    }
    // think: shown only while it is the newest step.
    if (it.next && time >= it.next.t0) continue;
    const word = cut(it.text || "Thinking", Math.floor(colW / (z.small * 0.52)));
    msgs.push({ key: it.i, at: b.t0, h, el: () => <div style={{ fontFamily: SANS, fontSize: z.small, lineHeight: 1.5, color: C.muted }}><Shimmer text={word} time={time} base="#8F8C84" hi="#E8E6DC" speed={10} /></div> });
  }

  // The scroll: when the list outgrows the window, it eases up as each message lands, far enough to
  // show the newest whole (or its start, when it is taller than the window).
  let acc = 0;
  const tops: number[] = [];
  const scrollTo = msgs.map((mm) => (tops.push(acc), (acc += mm.h + z.gap), { t: mm.at, y: Math.max(0, Math.min(acc - z.gap - room, tops[tops.length - 1])) }));
  scroll = pan(time, scrollTo, 0.45);

  const t = typing?.text ?? "";
  const placeholder = chat ? "Reply to Claude…" : "Type / for commands";
  const title = v.title ?? (chat ? "New chat" : "New session");
  // A Code session opens on "What should we build?", with the folder picker, until the first message.
  const empty = !chat && !msgs.length;
  const fieldW = colW + u * 0.6;
  const send = t ? (
    <div style={{ width: u * 1.3, height: u * 1.3, borderRadius: chat ? u * 0.35 : u, flex: "0 0 auto", background: C.clay, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={ICON.up} s={u * 0.78} color="#FFFFFF" w={2.2} /></div>
  ) : chat ? (
    <div style={{ width: u * 1.3, height: u * 1.3, borderRadius: u * 0.35, flex: "0 0 auto", background: C.clay, opacity: 0.45, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={ICON.up} s={u * 0.78} color="#FFFFFF" w={2.2} /></div>
  ) : (
    <Icon d={ICON.mic} s={u * 0.95} color={C.muted} />
  );
  // The field is one line: typing a long prompt, it shows the end, as the app keeps the caret in
  // view; the placeholder is cut with an ellipsis.
  const room1 = fieldW - u * (chat ? 1.4 : 3.6);
  const fieldText = (
    <div style={{ flex: chat ? undefined : 1, minWidth: 0, fontSize: z.you, lineHeight: 1.4, color: t ? C.ink : C.muted, minHeight: u * 1.35, padding: `0 ${u * 0.1}px`, whiteSpace: "pre" }}>
      {t ? tail(t, room1 - u, z.you) : clip(placeholder, room1, z.you)}
      {typing && <Caret time={time} color={C.ink} busy={typing.busy} bar h="1.1em" />}
    </div>
  );
  const composer = (
    <div style={{ width: fieldW, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ background: C.field, border: `1px solid ${C.line}`, borderRadius: u * 0.75, padding: `${u * 0.5}px ${u * 0.55}px`, boxShadow: "0 6px 20px rgba(0,0,0,0.2)", fontFamily: SANS }}>
        {chat ? (
          <>
            {fieldText}
            <div style={{ display: "flex", alignItems: "center", marginTop: u * 0.45, gap: u * 0.4 }}>
              <div style={{ width: u * 1.3, height: u * 1.3, borderRadius: u * 0.35, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={ICON.plus} s={u * 0.8} /></div>
              <div style={{ width: u * 1.3, height: u * 1.3, borderRadius: u * 0.35, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={ICON.sliders} s={u * 0.8} /></div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: z.label, color: C.muted, display: "flex", alignItems: "center", gap: u * 0.1 }}>{v.model}<Icon d={ICON.chevron} s={u * 0.6} /></span>
              {send}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: u * 0.4 }}>
            <Icon d={ICON.plus} s={u * 0.85} />
            {fieldText}
            {send}
          </div>
        )}
      </div>
      {!chat && (
        <div style={{ display: "flex", alignItems: "center", marginTop: u * 0.4, padding: `0 ${u * 0.3}px`, fontFamily: SANS, fontSize: z.label, color: C.muted }}>
          <span style={{ display: "flex", alignItems: "center" }}>Auto<Icon d={ICON.chevron} s={u * 0.6} /></span>
          <div style={{ flex: 1 }} />
          <span style={{ color: C.ink }}>{v.model}</span>
          <span style={{ marginLeft: u * 0.3, display: "flex", alignItems: "center" }}>{v.effort}<Icon d={ICON.chevron} s={u * 0.6} /></span>
        </div>
      )}
    </div>
  );
  // The pickers above the composer on the empty screen; the folder menu drops from the second.
  const open = folder && time >= folder.t0 && time < folder.t1;
  const picked = folder && time >= folder.t1 ? folder.pick : undefined;
  const hi = folder ? (time >= folder.t0 + 0.55 ? Math.max(0, folder.items.indexOf(folder.pick)) : -1) : -1;
  const chip = (icon: string, label: string, active = false) => (
    <div style={{ display: "flex", alignItems: "center", gap: u * 0.3, padding: `${u * 0.24}px ${u * 0.48}px`, borderRadius: u * 0.4, border: `1px solid ${active ? "#4A7FD6" : C.line}`, background: active ? "rgba(74,127,214,0.12)" : C.field, fontSize: z.label, color: C.ink, whiteSpace: "nowrap" }}>
      <Icon d={icon} s={u * 0.75} color={C.ink} />
      {label}
    </div>
  );
  const menuItems = folder ? [...folder.items, "Choose a different folder…"] : [];
  const emptyView = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 0.7, padding: `0 ${m}px`, fontFamily: SANS, minHeight: 0 }}>
      <div style={{ position: "relative", width: u * 0.9 * 0.6 * 9, height: u * 0.9 * 1.3 * 3 }}><Clawd fs={u * 0.9} time={time} /></div>
      {/* The folder menu is a popover over the greeting, as in the app; covered, it is not read. */}
      <div data-qc={open ? "ambient" : undefined} style={{ fontSize: u * 1.1, color: C.ink, fontWeight: 500 }}>What should we build?</div>
      <div style={{ width: fieldW, position: "relative", display: "flex", gap: u * 0.4 }}>
        {chip(ICON.laptop, "Local")}
        {chip(ICON.folder, picked ?? "Select folder", !!open)}
        {open && folder && (
          <div style={{ position: "absolute", left: u * 3.9, bottom: u * 2.0, minWidth: u * 9.5, background: "#2A2927", border: `1px solid ${C.line}`, borderRadius: u * 0.45, padding: u * 0.25, boxShadow: "0 18px 40px rgba(0,0,0,0.45)", fontSize: z.small, color: C.ink, opacity: Math.min(1, (time - folder.t0) / 0.15), translate: `0 ${(1 - Math.min(1, (time - folder.t0) / 0.15)) * u * 0.3}px` }}>
            {menuItems.map((f, k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: u * 0.4, padding: `${u * 0.3}px ${u * 0.4}px`, borderRadius: u * 0.3, whiteSpace: "nowrap", background: k === hi ? "#3A3936" : undefined, color: k === folder.items.length ? C.muted : C.ink }}>
                <Icon d={ICON.folder} s={u * 0.75} color={k === folder.items.length ? C.muted : C.ink} />
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
      {composer}
    </div>
  );
  // The empty screen hands over to the conversation with a quick fade.
  const since = msgs.length ? Math.min(...msgs.map((mm) => mm.at)) : Infinity;
  const handover = hasFolder ? Math.min(1, Math.max(0, (time - since) / 0.3)) : 1;

  return (
    <Stage backdrop={v.backdrop}>
      <Window w={winW} h={winH} r={Math.max(16, u * 0.6)} bg={C.bg} edge={C.line} time={time} start={shot.start} end={shot.end} column={false}>
        {wide && (
          <div style={{ width: sideW, flex: "0 0 auto", background: C.side, borderRight: `1px solid ${C.line}`, padding: `${u * 0.7}px ${u * 0.5}px`, display: "flex", flexDirection: "column", fontFamily: SANS, fontSize: px(u * 0.82), color: C.ink }}>
            <div style={{ marginBottom: u * 0.9, paddingLeft: u * 0.3 }}><Lights s={u * 0.42} /></div>
            {([["plus", "New"], ["search", "Search"], ["projects", "Projects"], ["artifacts", "Artifacts"], ["scheduled", "Scheduled"], ["customize", "Customize"]] as const).map(([ic, label], k) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: u * 0.45, padding: `${u * 0.3}px ${u * 0.35}px`, borderRadius: u * 0.3, background: k === 0 ? C.hover : undefined }}>
                <Icon d={ICON[ic]} s={u * 0.8} color={C.ink} />
                {label}
              </div>
            ))}
            {v.recents.length > 0 && <div style={{ marginTop: u * 1.1, marginBottom: u * 0.3, paddingLeft: u * 0.35, fontSize: px(u * 0.74), color: C.muted }}>Recents</div>}
            {v.recents.map((r, k) => (
              <div key={k} style={{ padding: `${u * 0.28}px ${u * 0.35}px`, borderRadius: u * 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: r === v.title ? C.hover : undefined }}>{r}</div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: u * 0.4, paddingLeft: u * 0.3 }}>
              <div style={{ width: Math.max(40, u * 1.2), height: Math.max(40, u * 1.2), borderRadius: u, background: "#3A3936", display: "flex", alignItems: "center", justifyContent: "center", fontSize: px(u * 0.62), color: C.ink }}>O</div>
              <span>Owain</span>
              <span style={{ color: C.muted }}>· Max</span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ height: headH, flex: "0 0 auto", display: "flex", alignItems: "center", gap: u * 0.3, padding: `0 ${headH * 0.42}px`, fontFamily: SANS, fontSize: px(headH * 0.46), color: C.ink, borderBottom: `1px solid ${C.line}` }}>
            {!wide && <div style={{ marginRight: u * 0.4 }}><Lights s={headH * 0.28} /></div>}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
            <Icon d={ICON.chevron} s={headH * 0.4} color={C.muted} />
          </div>
          {empty ? (
            emptyView
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, opacity: handover }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: `${u * 0.8}px ${m}px 0`, minHeight: 0, overflow: "hidden" }}>
                <div style={{ width: colW, display: "flex", flexDirection: "column", gap: z.gap, translate: `0 ${-scroll}px` }}>
                  {msgs.map((mm, k) => <div key={mm.key} style={{ opacity: mm.rows ? 1 : vis(tops[k], mm.h) }}>{mm.el(tops[k])}</div>)}
                </div>
              </div>
              <div style={{ flex: "0 0 auto", height: composerH, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: `0 ${m}px ${u * 0.6}px` }}>{composer}</div>
            </div>
          )}
        </div>
      </Window>
    </Stage>
  );
};
