// Product moments drawn clean, full frame, in depth (Owain, 2026-10-25: "mock up Claude Code UI to
// make it cleaner... break free of the basics"). Each sits on the dark stage with a soft glow and a
// slow 3D settle, so the screen feels shot rather than pasted. Words come from the real source (the
// demo, the article); the chrome is neutral and draws no logo.
//   claudecode  a Claude Code session: a prompt types itself, output lands line by line, one phrase marked
//   search      a search bar types the query, then the real result card rises under it
//   tiers       a stack of cards in depth; the tier being said comes forward and its rule is marked
import React from "react";
import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import type { ResolvedShot, ResolvedVisual } from "../engine/schema";
import { easeInOut, In, lerp, Mark, MOVE, prog } from "./motion";
import { t as type } from "./theme";

type V<K extends ResolvedVisual["kind"]> = Extract<ResolvedVisual, { kind: K }> & { times?: number[] };
type Props = { shot: ResolvedShot; time: number };

const SAGE = "#B7CDBF";
const CLAY = "#D97757"; // Claude Code's working colour, used for its status line only
const MONO = '"SF Mono", "JetBrains Mono", Menlo, monospace';
const MARK = "rgba(183,205,191,0.42)";

// A slow 3D settle for a whole screen: tilted and back at the cut, nearly flat by the end, with a
// gentle push in. One curve for the shot, so it never stops moving and never jumps.
const useDepth = (shot: ResolvedShot, time: number, tilt = 1) => {
  const k = interpolate(time, [shot.start, shot.end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const settle = prog(time, shot.start, 1.1, easeInOut);
  return {
    transform: `perspective(2600px) rotateX(${lerp(14, 3, settle) * tilt}deg) rotateY(${lerp(-16, -4, settle) * tilt}deg) translateZ(${lerp(-220, 40, settle) + k * 60}px)`,
    opacity: prog(time, shot.start, 0.3),
  };
};

// The stage: graphite, a sage glow behind the subject that breathes a little.
const Stage: React.FC<{ time: number }> = ({ time }) => (
  <AbsoluteFill style={{ background: "#141413" }}>
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 40% at 50% ${46 + Math.sin(time * 0.8) * 2}%, rgba(183,205,191,0.16), transparent 70%)` }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)" }} />
  </AbsoluteFill>
);

// Characters of `text` typed by `time`, starting at `at`, at `cps` characters a second.
const typed = (text: string, time: number, at: number, cps = 26) => text.slice(0, Math.max(0, Math.floor((time - at) * cps)));
const Caret: React.FC<{ time: number; on: boolean; color: string; h?: string }> = ({ time, on, color, h = "1em" }) =>
  on ? <span style={{ display: "inline-block", width: "0.55em", height: h, marginLeft: 2, verticalAlign: "-0.15em", background: color, opacity: Math.floor(time * 2.2) % 2 ? 0.25 : 1 }} /> : null;

// ---------- Claude Code ----------
const ClaudeCode: React.FC<Props & { v: V<"claudecode"> }> = ({ shot, time, v }) => {
  const { width, height } = useVideoConfig();
  const depth = useDepth(shot, time);
  const tall = height > width;
  const w = Math.min(width * (tall ? 0.94 : 0.9), 1500);
  const fs = Math.round(w / (tall ? 21 : 30));
  const times = v.times ?? [];
  // Each line's time: its anchor, else just after the line before it.
  const ats: number[] = [];
  v.lines.forEach((l, i) => (ats[i] = times[i] ?? (i ? ats[i - 1] + (v.lines[i - 1].style === "prompt" ? v.lines[i - 1].text.length / 26 + 0.25 : 0.12) : shot.start + 0.35)));
  const markAt = v.mark ? (times[v.lines.length] ?? ats[v.mark.line] + 0.5) : Infinity;
  const lastPrompt = v.lines.map((l, i) => (l.style === "prompt" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  const working = v.status && time >= ats[0] && time < (ats[v.lines.findIndex((l) => l.style !== "prompt")] ?? Infinity);
  return (
    <AbsoluteFill>
      <Stage time={time} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: w, borderRadius: 22, overflow: "hidden", background: "#1A1918", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 60px 140px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)", ...depth }}>
          <div style={{ height: fs * 2.4, display: "flex", alignItems: "center", gap: fs * 0.5, padding: `0 ${fs}px`, background: "#232220", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["#ED6A5E", "#F4BF4F", "#61C554"].map((c) => (
              <div key={c} style={{ width: fs * 0.55, height: fs * 0.55, borderRadius: fs, background: c }} />
            ))}
            <div style={{ marginLeft: fs * 0.6, fontFamily: type.sans, fontWeight: 600, fontSize: fs * 0.8, color: "#CFCBC4" }}>{v.title ?? "Claude Code"}</div>
          </div>
          <div style={{ padding: `${fs * 1.1}px ${fs * 1.2}px ${fs * 1.4}px`, fontFamily: MONO, fontSize: fs, lineHeight: 1.5, color: "#D9D5CE", minHeight: fs * 1.5 * (v.lines.length + 1.5) }}>
            {v.lines.map((l, i) => {
              if (time < ats[i] - 0.01) return null;
              const marked = v.mark?.line === i;
              const body = (s: string) => {
                if (!marked) return s;
                const at = s.indexOf(v.mark!.phrase);
                if (at < 0) return s;
                return (
                  <>
                    {s.slice(0, at)}
                    <Mark t={time} at={markAt} color={MARK}>{v.mark!.phrase}</Mark>
                    {s.slice(at + v.mark!.phrase.length)}
                  </>
                );
              };
              if (l.style === "prompt") {
                const s = typed(l.text, time, ats[i]);
                return (
                  <div key={i} style={{ background: "rgba(255,255,255,0.07)", margin: `0 -${fs * 0.5}px ${fs * 0.4}px`, padding: `${fs * 0.15}px ${fs * 0.5}px`, borderRadius: 6, color: "#F2EFEA" }}>
                    <span style={{ color: "#8A867F" }}>{"❯ "}</span>
                    {s}
                    <Caret time={time} on={i === lastPrompt && s.length <= l.text.length} color="#F2EFEA" />
                  </div>
                );
              }
              const st: React.CSSProperties =
                l.style === "head" ? { fontWeight: 700, color: "#F2EFEA", marginTop: fs * 0.5 }
                : l.style === "item" ? {}
                : l.style === "dim" ? { color: "#8A867F" }
                : l.style === "ok" ? { color: SAGE }
                : {};
              return (
                <In key={i} t={time} at={ats[i]} rise={8}>
                  <div style={st}>{l.style === "item" ? <Item text={l.text} body={body} /> : body(l.text)}</div>
                </In>
              );
            })}
            {working && (
              <div style={{ color: CLAY, marginTop: fs * 0.4 }}>
                {"✻ "}
                {v.status}
                {".".repeat(1 + (Math.floor(time * 3) % 3))}
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// "1. SQL injection: rest": the number in its own column, the name in bold, as Claude Code does.
const Item: React.FC<{ text: string; body: (s: string) => React.ReactNode }> = ({ text, body }) => {
  const m = text.match(/^(\d+\.)\s+([^:(]+)(.*)$/);
  if (!m) return <>{body(text)}</>;
  return (
    <div style={{ display: "flex" }}>
      <span style={{ color: "#8A867F", flex: "0 0 1.8em" }}>{m[1]}</span>
      <span>
        <span style={{ fontWeight: 700, color: "#F2EFEA" }}>{body(m[2])}</span>
        {body(m[3])}
      </span>
    </div>
  );
};

// ---------- search ----------
const Search: React.FC<Props & { v: V<"search"> }> = ({ shot, time, v }) => {
  const { width, height } = useVideoConfig();
  const depth = useDepth(shot, time, 0.6);
  const w = Math.min(width * 0.92, 1400);
  const fs = Math.round(w / (height > width ? 19.5 : 24));
  const times = v.times ?? [];
  const at = times[0] ?? shot.start + 0.15;
  const s = typed(v.text, time, at, v.cps ?? 30);
  const done = s.length >= v.text.length;
  const resAt = v.result ? (times[1] ?? at + v.text.length / (v.cps ?? 30) + 0.3) : Infinity;
  const r = prog(time, resAt, MOVE, easeInOut);
  // The bar lifts as the result arrives, so the pair stays centred.
  const lift = r * fs * 2.2;
  return (
    <AbsoluteFill>
      <Stage time={time} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: w, translate: `0 ${-lift}px`, ...depth }}>
          <div style={{ height: fs * 2.1, borderRadius: fs * 1.05, background: "#F7F3EC", display: "flex", alignItems: "center", gap: fs * 0.55, padding: `0 ${fs * 0.8}px`, boxShadow: `0 30px 80px rgba(0,0,0,0.45), 0 0 0 ${done ? 6 : 0}px rgba(183,205,191,0.35)` }}>
            <svg width={fs * 0.9} height={fs * 0.9} viewBox="0 0 24 24" fill="none" stroke="#6E6B65" strokeWidth={2.4} strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 L21 21" />
            </svg>
            <div style={{ fontFamily: type.sans, fontWeight: 500, fontSize: fs, color: "#1F1F1D", whiteSpace: "nowrap", overflow: "hidden" }}>
              {s}
              <Caret time={time} on={!r} color="#1F1F1D" h="1.05em" />
            </div>
          </div>
          {v.result && time >= resAt && (
            <div style={{ marginTop: fs * 0.7, opacity: r, translate: `0 ${(1 - r) * fs * 1.2}px`, filter: `blur(${(1 - r) * 8}px)`, borderRadius: fs * 0.55, background: "#232220", border: "1px solid rgba(255,255,255,0.08)", padding: `${fs * 0.75}px ${fs * 0.9}px`, boxShadow: "0 40px 90px rgba(0,0,0,0.5)" }}>
              <div style={{ fontFamily: type.sans, fontSize: fs * 0.52, color: SAGE, letterSpacing: 0.5 }}>{v.result.site}</div>
              <div style={{ marginTop: fs * 0.2, fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.82, lineHeight: 1.15, color: "#F2EFEA" }}>{v.result.title}</div>
              {v.result.text && <div style={{ marginTop: fs * 0.3, fontFamily: type.sans, fontSize: fs * 0.55, lineHeight: 1.4, color: "#A3A19C" }}>{v.result.text}</div>}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- tiers ----------
const Tiers: React.FC<Props & { v: V<"tiers"> }> = ({ shot, time, v }) => {
  const { width, height } = useVideoConfig();
  const times = v.times ?? [];
  // times: each item's anchor then its mark's, in spoken order. An item with no anchor in this shot
  // shows dim from the start: a tier already covered, or one still to come (an open loop).
  // (The resolver gives unanchored parts a cascade time; here only spoken anchors count.)
  const ats = v.items.map((it, i) => (it.at ? (times[2 * i] ?? Infinity) : Infinity));
  const marks = v.items.map((it, i) => (it.markAt ? (times[2 * i + 1] ?? Infinity) : Infinity));
  let active = -1;
  ats.forEach((a, i) => time >= a && (active = i));
  // A tall frame gets bigger cards; a wide one keeps them to a comfortable reading size.
  const tall = height > width;
  const w = Math.min(width * (tall ? 0.79 : 0.86), 1400);
  const fs = Math.round(w / (tall ? 16.5 : 22));
  const cardH = fs * (tall ? 6.9 : 6.2);
  const gap = fs * 0.9;
  const n = v.items.length;
  const total = n * cardH + (n - 1) * gap;
  const top = (height - total) / 2;
  const depth = useDepth(shot, time, 0.45);
  return (
    <AbsoluteFill>
      <Stage time={time} />
      {v.title && (
        <In t={time} at={shot.start} style={{ position: "absolute", left: 0, right: 0, top: top - fs * 2.6, textAlign: "center" }}>
          <div style={{ fontFamily: type.sans, fontWeight: 600, fontSize: fs * 0.62, letterSpacing: fs * 0.12, color: "#A3A19C" }}>{v.title.toUpperCase()}</div>
        </In>
      )}
      <AbsoluteFill style={{ ...depth }}>
        {v.items.map((it, i) => {
          const on = prog(time, ats[i], MOVE, easeInOut);
          const off = i < active ? prog(time, ats[active], MOVE, easeInOut) : 0;
          const front = on * (1 - off);
          const seen = !isFinite(ats[i]) || time >= ats[i] - 0.05 || i < active;
          const y = top + i * (cardH + gap);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (width - w) / 2,
                top: y,
                width: w,
                height: cardH,
                borderRadius: fs * 0.7,
                background: "#1F1E1C",
                border: `1px solid ${front > 0.5 ? "rgba(183,205,191,0.55)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: `0 ${30 + 30 * front}px ${80 + 40 * front}px rgba(0,0,0,${0.35 + 0.25 * front})`,
                opacity: seen ? lerp(0.32, 1, front) : 0,
                filter: `blur(${seen ? 0 : 8}px)`,
                transform: `scale(${lerp(0.93, 1.03, front)}) translateZ(${front * 60}px)`,
                display: "flex",
                alignItems: "center",
                padding: `0 ${fs * 1.2}px`,
                gap: fs * 1.1,
              }}
            >
              <div style={{ width: fs * 0.28, alignSelf: "stretch", margin: `${fs * 1.1}px 0`, borderRadius: fs, background: front > 0.5 ? SAGE : "rgba(255,255,255,0.12)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.58, letterSpacing: fs * 0.1, color: SAGE }}>{it.label.toUpperCase()}</div>
                <div style={{ marginTop: fs * 0.2, fontFamily: type.sans, fontWeight: 700, fontSize: fs * 1.45, letterSpacing: "-0.02em", color: "#F2EFEA" }}>
                  <Mark t={time} at={marks[i]} color={MARK}>{it.rule}</Mark>
                </div>
                <div style={{ marginTop: fs * 0.25, fontFamily: type.sans, fontSize: fs * 0.62, lineHeight: 1.35, color: "#A3A19C" }}>{it.examples}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const UI_KINDS = new Set(["claudecode", "search", "tiers"]);
export const UiVisual: React.FC<Props> = ({ shot, time }) => {
  const v = shot.visual!;
  if (v.kind === "claudecode") return <ClaudeCode shot={shot} time={time} v={v} />;
  if (v.kind === "search") return <Search shot={shot} time={time} v={v} />;
  if (v.kind === "tiers") return <Tiers shot={shot} time={time} v={v} />;
  return null;
};
