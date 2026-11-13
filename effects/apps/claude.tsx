// The Claude desktop app, dark: the sidebar (New, Search, Projects, Artifacts, Scheduled, Customize,
// then recent chats), the conversation and the composer, as the app lays them out (Owain's screen
// recordings of it, 2026-11-12). A chat's replies are set in the serif, a Code session's in the sans.
// On a narrow window the app hides its sidebar, so a split's panel shows the conversation alone.
import React from "react";
import type { ResolvedShot } from "../../engine/schema";
import { appBeats, typeRate } from "../../engine/apps";
import type { V } from "../soft";

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s);
import { Clawd } from "./cli";
import { Caret, enter, linesFor, px, MONO, SANS, segs, SERIF, Shimmer, Stage, typed, useBox, windowSize } from "./kit";

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
  // The selected row in the sidebar (solid, so the text is read against it).
  hover: "#2E2D2A",
};

// The sidebar's icons, drawn as the app's thin line icons.
const Icon: React.FC<{ d: string; s: number; color?: string }> = ({ d, s, color = C.muted }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
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
};

type Props = { shot: ResolvedShot; time: number; v: V<"claudeapp"> };

// Text with `code` spans and **bold**, as the app sets them.
const Rich: React.FC<{ text: string; u: number }> = ({ text, u }) => (
  <>
    {segs(text).map((g, k) =>
      g.code ? (
        <span key={k} style={{ fontFamily: MONO, fontSize: "max(25px, 0.92em)", background: C.code, border: `1px solid ${C.line}`, borderRadius: u * 0.18, padding: `0 ${u * 0.14}px` }}>{g.s}</span>
      ) : (
        <span key={k} style={{ fontWeight: g.bold ? 700 : undefined }}>{g.s}</span>
      ),
    )}
  </>
);

export const ClaudeApp: React.FC<Props> = ({ shot, time, v }) => {
  const box = useBox();
  const { winW, winH } = windowSize(box, v.backdrop, 1720);
  const wide = winW >= 1300 && !box.panel;
  const sideW = wide ? winW * 0.22 : 0;
  const u = Math.min(34, (winW - sideW) / 28, winH / 21);
  const chat = v.mode === "chat";
  const beats = appBeats(v, shot.start, v.times);
  const colW = Math.min(winW - sideW - u * 2.4, u * 30);
  const size = px(u * (chat ? 1.02 : 0.96));

  // What has landed: sent messages and replies, newest last.
  type Msg = { key: number; h: number; el: React.ReactNode };
  const msgs: Msg[] = [];
  let typing: { text: string; busy: boolean } | undefined;
  // Code, before the first message: the folder menu, open from `t0` until `t1`, then picked.
  let folder: { items: string[]; pick: string; t0: number; t1: number } | undefined;
  v.steps.forEach((s, i) => {
    const b = beats[i];
    if (time < b.t0) return;
    const rise = (at: number): React.CSSProperties => {
      const k = Math.min(1, Math.max(0, (time - at) / 0.25));
      return { opacity: k, translate: `0 ${(1 - k) * u * 0.5}px` };
    };
    if (s.type === "folder") {
      folder = { items: s.items ?? [], pick: s.text, t0: b.t0, t1: b.t1 };
      return;
    }
    if (s.type === "todo") {
      const items = s.items ?? [];
      msgs.push({
        key: i,
        h: items.length * u * 1.75 + u * 1.2,
        el: (
          <div style={{ background: C.code, border: `1px solid ${C.line}`, borderRadius: u * 0.5, padding: `${u * 0.35}px ${u * 0.6}px`, fontFamily: SANS, fontSize: px(u * 0.9), color: C.body, ...rise(b.t0) }}>
            {items.map((it, k) => {
              const at = b.t0 + 0.3 + k * 0.35;
              const done = Math.min(1, Math.max(0, (time - at) / 0.18));
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: u * 0.5, height: u * 1.7, opacity: 0.55 + 0.45 * done }}>
                  <div style={{ width: u * 0.95, height: u * 0.95, borderRadius: u, flex: "0 0 auto", border: `1.5px solid ${done > 0.5 ? "#3FA45B" : C.muted}`, background: done > 0.5 ? "#3FA45B" : undefined, display: "flex", alignItems: "center", justifyContent: "center", scale: String(1 + 0.18 * Math.sin(done * Math.PI)) }}>
                    {done > 0.5 && <Icon d={ICON.tick} s={u * 0.72} color="#FFFFFF" />}
                  </div>
                  <span><Rich text={it} u={u} /></span>
                </div>
              );
            })}
          </div>
        ),
      });
      return;
    }
    if (s.type === "user") {
      if (time < b.t1) {
        const t = typed(s.text, time, b.t0, typeRate(s.text.length));
        typing = { text: t, busy: t.length < s.text.length };
        return;
      }
      const lines = linesFor(s.text, colW * 0.8 - u * 1.4, u * 0.98);
      msgs.push({
        key: i,
        h: lines * u * 0.98 * 1.4 + u * 1.6,
        el: (
          <div style={{ display: "flex", justifyContent: "flex-end", ...rise(b.t1) }}>
            <div style={{ maxWidth: "80%", background: C.bubble, borderRadius: u * 0.75, padding: `${u * 0.45}px ${u * 0.7}px`, fontFamily: SANS, fontSize: px(u * 0.98), lineHeight: 1.4, color: C.ink, textWrap: "pretty" }}><Rich text={s.text} u={u} /></div>
          </div>
        ),
      });
      return;
    }
    if (s.type === "text") {
      // The reply streams in a few words at a time.
      const words = s.text.split(/(?<= )/);
      const n = Math.max(1, Math.ceil(((time - b.t0) / Math.max(0.1, b.t1 - b.t0)) * words.length));
      const lines = linesFor(s.text, colW, size, chat ? 0.47 : 0.5);
      msgs.push({ key: i, h: lines * size * 1.5 + u * 0.9, el: <div style={{ fontFamily: chat ? SERIF : SANS, fontSize: size, lineHeight: 1.5, color: C.body, textWrap: "pretty" }}><Rich text={words.slice(0, n).join("")} u={u} /></div> });
      return;
    }
    if (s.type === "list") {
      const items = s.items ?? [];
      const shown = items.filter((_, k) => time >= b.t0 + 0.3 + k * 0.35);
      const lines = items.reduce((n, it) => n + linesFor(it, colW - u * 1.4, size, chat ? 0.47 : 0.5), 0);
      msgs.push({
        key: i,
        h: lines * size * 1.5 + items.length * u * 0.3 + (s.text ? size * 1.6 : 0) + u * 0.6,
        el: (
          <div style={{ fontFamily: chat ? SERIF : SANS, fontSize: size, lineHeight: 1.5, color: C.body }}>
            {s.text && <div style={{ fontWeight: 600, color: C.ink, fontFamily: SANS, marginBottom: u * 0.3 }}>{s.text}</div>}
            {shown.map((it, k) => (
              <div key={k} style={{ display: "flex", gap: u * 0.55, marginBottom: u * 0.3, ...rise(b.t0 + 0.3 + k * 0.35) }}>
                <span style={{ color: C.muted }}>•</span>
                <span><Rich text={it} u={u} /></span>
              </div>
            ))}
          </div>
        ),
      });
      return;
    }
    if (s.type === "tool") {
      msgs.push({
        key: i,
        h: u * 1.9,
        el: (
          <div style={{ display: "flex", alignItems: "center", gap: u * 0.2, fontFamily: SANS, fontSize: px(u * 0.9), color: C.muted, ...rise(b.t0) }}>
            {s.text || "Ran a command"}
            <Icon d={ICON.right} s={u * 0.75} />
          </div>
        ),
      });
      return;
    }
    // think: shown only while it is the newest step.
    const next = beats[i + 1];
    if (next && time >= next.t0) return;
    const word = cut(s.text || "Thinking", Math.floor(colW / (u * 0.92 * 0.52)));
    msgs.push({ key: i, h: u * 1.9, el: <div style={{ fontFamily: SANS, fontSize: px(u * 0.92), color: C.muted }}><Shimmer text={word} time={time} base="#8F8C84" hi="#E8E6DC" speed={10} /></div> });
  });

  // Keep the newest messages that fit above the composer, as the conversation scrolls.
  const composerH = u * (chat ? 4.4 : 3.6) + (chat ? 0 : u * 1.8);
  const headH = u * 2.4;
  let room = winH - headH - composerH - u * 1.2;
  const fit: Msg[] = [];
  for (const m of [...msgs].reverse()) {
    if (m.h > room && fit.length) break;
    room -= m.h;
    fit.unshift(m);
  }
  const t = typing?.text ?? "";
  const placeholder = chat ? "Reply to Claude…" : "Type / for commands";
  const title = v.title ?? (chat ? "New chat" : "New session");
  // A Code session opens on "What should we build?", with the folder picker, until the first message.
  const empty = !chat && !msgs.length;
  const fieldW = colW + u * 0.6;
  const send = <div style={{ width: u * 1.25, height: u * 1.25, borderRadius: chat ? u * 0.35 : u, flex: "0 0 auto", background: C.clay, opacity: t ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={ICON.up} s={u * 0.75} color="#FFFFFF" /></div>;
  const text = (
    <div style={{ flex: chat ? undefined : 1, minWidth: 0, fontSize: px(u * 0.95), lineHeight: 1.4, color: t ? C.ink : C.muted, minHeight: u * 1.35, padding: `0 ${u * 0.15}px` }}>
      {t || placeholder}
      {typing && <Caret time={time} color={C.ink} busy={typing.busy} bar h="1.1em" />}
    </div>
  );
  const composer = (
    <div style={{ width: fieldW, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ background: C.field, border: `1px solid ${C.line}`, borderRadius: u * 0.75, padding: `${u * 0.55}px ${u * 0.6}px`, boxShadow: "0 6px 20px rgba(0,0,0,0.2)", fontFamily: SANS }}>
        {chat ? (
          <>
            {text}
            <div style={{ display: "flex", alignItems: "center", marginTop: u * 0.5, gap: u * 0.5 }}>
              <div style={{ width: u * 1.25, height: u * 1.25, borderRadius: u * 0.35, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={ICON.plus} s={u * 0.8} /></div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: px(u * 0.8), color: C.muted, display: "flex", alignItems: "center", gap: u * 0.1 }}>{v.model}<Icon d={ICON.chevron} s={u * 0.6} /></span>
              {send}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: u * 0.45 }}>
            <Icon d={ICON.plus} s={u * 0.8} />
            {text}
            {send}
          </div>
        )}
      </div>
      {!chat && (
        <div style={{ display: "flex", alignItems: "center", marginTop: u * 0.45, padding: `0 ${u * 0.3}px`, fontFamily: SANS, fontSize: px(u * 0.78), color: C.muted }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: u * 0.3, padding: `${u * 0.22}px ${u * 0.45}px`, borderRadius: u * 0.4, border: `1px solid ${active ? "#4A7FD6" : C.line}`, background: active ? "rgba(74,127,214,0.12)" : C.field, fontSize: px(u * 0.8), color: C.ink, whiteSpace: "nowrap" }}>
      <Icon d={icon} s={u * 0.72} color={C.ink} />
      {label}
    </div>
  );
  const emptyView = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 0.7, padding: `0 ${u * 1.2}px`, fontFamily: SANS, minHeight: 0 }}>
      <div style={{ position: "relative", width: u * 0.9 * 0.6 * 9, height: u * 0.9 * 1.3 * 3 }}><Clawd fs={u * 0.9} /></div>
      {/* The folder menu is a popover over the greeting, as in the app; covered, it is not read. */}
      <div data-qc={open ? "ambient" : undefined} style={{ fontSize: px(u * 1.05), color: C.ink }}>What should we build?</div>
      <div style={{ width: fieldW, position: "relative", display: "flex", gap: u * 0.4 }}>
        {chip(ICON.laptop, "Local")}
        {chip(ICON.folder, picked ?? "Select folder", !!open)}
        {open && folder && (
          <div style={{ position: "absolute", left: u * 3.6, bottom: u * 1.9, minWidth: u * 9, background: "#2A2927", border: `1px solid ${C.line}`, borderRadius: u * 0.45, padding: u * 0.25, boxShadow: "0 18px 40px rgba(0,0,0,0.45)", fontSize: px(u * 0.85), color: C.ink, opacity: Math.min(1, (time - folder.t0) / 0.15) }}>
            {[...folder.items, "Choose a different folder…"].map((f, k) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: u * 0.4, padding: `${u * 0.3}px ${u * 0.4}px`, borderRadius: u * 0.3, background: k === hi ? "#3A3936" : undefined, color: k === folder!.items.length ? C.muted : C.ink }}>
                <Icon d={ICON.folder} s={u * 0.72} color={k === folder!.items.length ? C.muted : C.ink} />
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
      {composer}
    </div>
  );

  return (
    <Stage backdrop={v.backdrop}>
      <div style={{ width: winW, height: winH, borderRadius: u * 0.6, overflow: "hidden", background: C.bg, border: `1px solid ${C.line}`, boxShadow: "0 50px 120px rgba(0,0,0,0.55)", display: "flex", ...enter(time, shot.start, shot.end) }}>
        {wide && (
          <div style={{ width: sideW, flex: "0 0 auto", background: C.side, borderRight: `1px solid ${C.line}`, padding: `${u * 0.7}px ${u * 0.5}px`, display: "flex", flexDirection: "column", fontFamily: SANS, fontSize: px(u * 0.82), color: C.ink }}>
            <div style={{ display: "flex", gap: u * 0.32, marginBottom: u * 0.9, paddingLeft: u * 0.3 }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: u * 0.42, height: u * 0.42, borderRadius: u, background: c }} />)}
            </div>
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
          <div style={{ height: headH, flex: "0 0 auto", display: "flex", alignItems: "center", gap: u * 0.3, padding: `0 ${u * 0.8}px`, fontFamily: SANS, fontSize: px(u * 0.8), color: C.ink, borderBottom: `1px solid ${C.line}` }}>
            {!wide && <div style={{ display: "flex", gap: u * 0.32, marginRight: u * 0.5 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: u * 0.42, height: u * 0.42, borderRadius: u, background: c }} />)}</div>}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
            <Icon d={ICON.chevron} s={u * 0.7} color={C.muted} />
          </div>
          {empty ? (
            emptyView
          ) : (
            <>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: `${u * 0.8}px ${u * 1.2}px 0`, minHeight: 0 }}>
                <div style={{ width: colW, display: "flex", flexDirection: "column", gap: u * 0.6 }}>
                  {fit.map((m) => <div key={m.key}>{m.el}</div>)}
                </div>
              </div>
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", padding: `0 ${u * 1.2}px ${u * 0.7}px` }}>{composer}</div>
            </>
          )}
        </div>
      </div>
    </Stage>
  );
};
