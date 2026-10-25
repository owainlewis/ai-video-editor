// Seven moves from the five-reel study (docs/PLAYBOOK.md, 2026-10-25), built as custom graphics so
// each reel can use or bend them. Every one keeps changing: something lands every second or so.
//   statbadge  a frosted number over the real page, blurred behind it
//   stopwatch  the slow way's timer climbing in red, then a reset to the fast way in green
//   timeline   a scrubber whose coloured segments fill in on their words, a playhead riding along
//   hub        a centre mark, spokes drawing out to each name in turn, a tick popping on each
//   phases     a hero card that swaps per phase over a footer that keeps the place ("2 of 4")
//   verifier   an arrow draws to a checker, its checklist answers row by row, then the verdict
//   igcta      Follow clicks to Following, the keyword types into a comment, a DM drops in
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { easeInOut, lerp, prog } from "../motion";
import { t as type } from "../theme";
import { Digits } from "../frame";
import type { CustomProps } from "./index";

const SAGE = "#B7CDBF";
const PINE = "#2C4441";
const GREEN = "#3E7B5B";
const RED = "#D9534F";
const MONO = '"SF Mono", Menlo, monospace';
const clampT = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const tone = (panel: boolean) => ({
  ink: panel ? "#1F1F1D" : "#F2EFEA",
  muted: panel ? "#6E6B65" : "#A3A19C",
  card: panel ? "#FBFAF7" : "#1F1E1C",
  edge: panel ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.09)",
  shadow: panel ? "0 24px 60px rgba(0,0,0,0.16)" : "0 30px 80px rgba(0,0,0,0.5)",
});
const str = (x: unknown, d = "") => (typeof x === "string" ? x : d);
const arr = <T,>(x: unknown) => (Array.isArray(x) ? (x as T[]) : []);
const tick = (time: number, at: number) => prog(time, at, 0.22, easeInOut);
const Check: React.FC<{ k: number; size: number; color?: string }> = ({ k, size, color = GREEN }) => (
  <div style={{ width: size, height: size, borderRadius: size, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.7, fontWeight: 800, scale: String(k * (1 + 0.25 * Math.sin(k * Math.PI))), opacity: k }}>✓</div>
);

// ---------- statbadge ----------
// props: { src (path under projects/, e.g. "my-reel/assets/captures/repo.png"), focus?: [x,y,w,h] of the image to fill, value: number, prefix?, suffix?, label }
// times: [badge lands]
export const StatBadge: React.FC<CustomProps> = ({ shot, time, props, times, width }) => {
  const at = times[0] ?? shot.start + 0.8;
  const blur = prog(time, at - 0.15, 0.35, easeInOut);
  const k = prog(time, at, 0.4, easeInOut);
  const value = Number(props.value ?? 0);
  const roll = interpolate(time, [at, at + 0.7], [0, value], { ...clampT, easing: easeInOut });
  const [fx, fy, fw] = (props.focus as number[]) ?? [0, 0, 1];
  const push = interpolate(time, [shot.start, shot.end], [1, 1.08], clampT);
  const fs = Math.round(width / 6.5);
  return (
    <AbsoluteFill style={{ overflow: "hidden", borderRadius: 28 }}>
      <div style={{ position: "absolute", inset: 0, filter: `blur(${blur * 14}px) brightness(${1 - blur * 0.25})`, scale: String(push) }}>
        <Img src={staticFile(str(props.src))} style={{ position: "absolute", width: width / fw, left: (-fx * width) / fw, top: (-fy * width) / fw }} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: k, scale: String(lerp(1.25, 1, k)), translate: `0 ${(1 - k) * 30}px`, padding: `${fs * 0.3}px ${fs * 0.6}px`, borderRadius: fs * 0.35, background: "rgba(20,20,19,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 40px 100px rgba(0,0,0,0.45)", textAlign: "center", color: "#F2EFEA" }}>
          <div style={{ fontFamily: type.sans, fontWeight: 700, fontSize: fs, lineHeight: `${fs}px`, letterSpacing: "-0.03em", display: "flex", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>
            {str(props.prefix)}
            <Digits value={roll} size={fs} />
            {str(props.suffix)}
          </div>
          <div style={{ marginTop: fs * 0.12, fontFamily: type.serif, fontStyle: "italic", fontSize: fs * 0.36, color: SAGE }}>{str(props.label)}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- stopwatch ----------
// props: { slow: { label, caption }, fast: { label, caption } }   times: [slow starts, reset to fast]
export const Stopwatch: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const c = tone(panel);
  const slow = (props.slow ?? {}) as { label?: string; caption?: string };
  const fast = (props.fast ?? {}) as { label?: string; caption?: string };
  const t0 = times[0] ?? shot.start + 0.2;
  const t1 = times[1] ?? t0 + 2;
  const fastOn = time >= t1;
  const r = Math.min(width, height) * 0.27;
  // The slow hand races and keeps going; at the reset it whips back to twelve and barely moves.
  const angle = fastOn ? interpolate(time, [t1, t1 + 0.25, t1 + 3], [360 * 6, 0, 18], { ...clampT, easing: easeInOut }) : Math.max(0, time - t0) * 720;
  const col = fastOn ? GREEN : RED;
  const flash = fastOn ? 1 - prog(time, t1, 0.5) : 0;
  const label = fastOn ? fast.label : slow.label;
  const caption = fastOn ? fast.caption : slow.caption;
  const k = prog(time, fastOn ? t1 : t0, 0.25, easeInOut);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: r * 2, height: r * 2, scale: String(1 + 0.06 * flash) }}>
        <svg width={r * 2} height={r * 2} viewBox="-100 -100 200 200" style={{ position: "absolute", inset: 0 }}>
          <circle r={92} fill={c.card} stroke={col} strokeWidth={6} />
          {Array.from({ length: 60 }, (_, i) => (
            <line key={i} x1={0} y1={-84} x2={0} y2={i % 5 ? -79 : -72} stroke={c.muted} strokeWidth={i % 5 ? 1 : 2.5} transform={`rotate(${i * 6})`} />
          ))}
          <line x1={0} y1={10} x2={0} y2={-74} stroke={col} strokeWidth={4} strokeLinecap="round" transform={`rotate(${angle})`} />
          <circle r={6} fill={col} />
        </svg>
        <div style={{ position: "absolute", left: r - r * 0.12, top: -r * 0.2, width: r * 0.24, height: r * 0.16, borderRadius: 6, background: col }} />
      </div>
      <div style={{ marginTop: r * 0.25, textAlign: "center", opacity: k, translate: `0 ${(1 - k) * 16}px` }}>
        <div style={{ fontFamily: type.sans, fontWeight: 800, fontSize: r * 0.5, letterSpacing: "-0.03em", color: col }}>{label}</div>
        <div style={{ fontFamily: type.serif, fontStyle: "italic", fontSize: r * 0.22, color: c.muted }}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- timeline ----------
// props: { segments: [{ label, color }] }   times: one per segment (when it starts filling)
export const Timeline: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const c = tone(panel);
  const segs = arr<{ label: string; color: string }>(props.segments);
  const n = segs.length;
  const starts = segs.map((_, i) => times[i] ?? shot.start + 0.3 + i);
  const ends = starts.map((s, i) => starts[i + 1] ?? Math.min(shot.end - 0.2, s + 1.2));
  const w = width * 0.86;
  const x0 = (width - w) / 2;
  const fs = Math.round(width / 17);
  const barY = height * 0.5;
  const barH = fs * 0.75;
  // The playhead rides the fill: where the last started segment has reached.
  let head = 0;
  segs.forEach((_, i) => {
    const f = interpolate(time, [starts[i], ends[i]], [0, 1], clampT);
    if (time >= starts[i]) head = (i + f) / n;
  });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x0, top: barY - barH / 2, width: w, height: barH, borderRadius: barH, background: panel ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)", overflow: "hidden", display: "flex" }}>
        {segs.map((s, i) => {
          const f = interpolate(time, [starts[i], ends[i]], [0, 1], clampT);
          return (
            <div key={i} style={{ width: w / n, height: "100%", borderRight: i < n - 1 ? `2px solid ${panel ? "#F4F1EA" : "#141413"}` : "none" }}>
              <div style={{ width: `${f * 100}%`, height: "100%", background: s.color }} />
            </div>
          );
        })}
      </div>
      {/* playhead */}
      <div style={{ position: "absolute", left: x0 + head * w, top: barY, width: barH * 1.9, height: barH * 1.9, translate: "-50% -50%", borderRadius: barH * 2, background: "#fff", border: `3px solid ${c.ink}`, boxShadow: "0 6px 16px rgba(0,0,0,0.25)" }} />
      {/* labels alternate above and below so they never collide */}
      {segs.map((s, i) => {
        const k = prog(time, starts[i], 0.25, easeInOut);
        const above = i % 2 === 0;
        const cx = x0 + (w / n) * (i + 0.5);
        return (
          <div key={i} style={{ position: "absolute", left: cx, top: above ? barY - barH - fs * 0.5 : barY + barH + fs * 0.5, translate: above ? "-50% -100%" : "-50% 0", display: "flex", flexDirection: above ? "column-reverse" : "column", alignItems: "center", gap: fs * 0.25, opacity: lerp(0.3, 1, k) }}>
            <div style={{ width: 2, height: fs * 0.8, background: k > 0.5 ? s.color : c.edge }} />
            <div style={{ padding: `${fs * 0.25}px ${fs * 0.5}px`, borderRadius: fs, background: k > 0.5 ? s.color : c.card, color: k > 0.5 ? "#fff" : c.muted, border: `1px solid ${c.edge}`, fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.82, whiteSpace: "nowrap", scale: String(0.85 + 0.15 * k), boxShadow: k > 0.5 ? `0 10px 24px ${s.color}55` : "none" }}>{s.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- hub ----------
// props: { center, spokes: string[] }   times: [centre lands, then one per spoke]
export const Hub: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const c = tone(panel);
  const spokes = arr<string>(props.spokes);
  const n = spokes.length;
  const cx = width / 2, cy = height / 2;
  const R = Math.min(width, height) * 0.38;
  const fs = Math.round(width / 19);
  const c0 = times[0] ?? shot.start;
  const ats = spokes.map((_, i) => times[i + 1] ?? c0 + 0.4 + i * 0.3);
  const ck = prog(time, c0, 0.3, easeInOut);
  const spin = 0;
  const nodes = spokes.map((s, i) => {
    // Spokes start half a step off vertical, so none sits level with the centre label.
    const a = ((-90 + 180 / n + (360 / n) * i + spin) * Math.PI) / 180;
    return { s, x: cx + Math.cos(a) * width * 0.3, y: cy + Math.sin(a) * height * 0.36, at: ats[i] };
  });
  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={c.edge} strokeWidth={2} strokeDasharray="6 10" />
        {nodes.map((nd, i) => {
          const k = prog(time, nd.at - 0.25, 0.3, easeInOut);
          return <line key={i} x1={cx} y1={cy} x2={lerp(cx, nd.x, k)} y2={lerp(cy, nd.y, k)} stroke={PINE} strokeWidth={3} strokeLinecap="round" opacity={0.7} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: cx, top: cy, translate: "-50% -50%", padding: `${fs * 0.5}px ${fs * 0.9}px`, borderRadius: fs * 0.6, background: "#1A1918", color: "#F2EFEA", fontFamily: type.sans, fontWeight: 800, fontSize: fs * 1.1, boxShadow: c.shadow, opacity: ck, scale: String(0.8 + 0.2 * ck), whiteSpace: "nowrap" }}>{str(props.center)}</div>
      {nodes.map((nd, i) => {
        const k = prog(time, nd.at, 0.25, easeInOut);
        return (
          <div key={i} style={{ position: "absolute", left: nd.x, top: nd.y, translate: "-50% -50%", display: "flex", alignItems: "center", gap: fs * 0.3, padding: `${fs * 0.35}px ${fs * 0.6}px`, borderRadius: fs, background: c.card, border: `1.5px solid ${k > 0.5 ? PINE : c.edge}`, boxShadow: c.shadow, fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.85, color: c.ink, whiteSpace: "nowrap", opacity: lerp(0.35, 1, k), scale: String(0.85 + 0.15 * k) }}>
            {nd.s}
            <Check k={prog(time, nd.at + 0.15, 0.25)} size={fs * 1.05} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- phases ----------
// props: { title, phases: [{ label, agent, detail }] }   times: one per phase
export const Phases: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const c = tone(panel);
  const phases = arr<{ label: string; agent?: string; detail?: string }>(props.phases);
  const n = phases.length;
  const ats = phases.map((_, i) => times[i] ?? shot.start + 0.3 + i);
  let cur = 0;
  ats.forEach((a, i) => time >= a && (cur = i));
  const fs = Math.round(width / 22);
  const p = phases[cur] ?? { label: "" };
  const swap = prog(time, ats[cur], 0.3, easeInOut);
  const w = width * 0.88;
  const progress = (cur + interpolate(time, [ats[cur], ats[cur + 1] ?? shot.end], [0, 1], clampT)) / n;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      {/* hero: the phase being said, swapping with a blur */}
      <div style={{ position: "absolute", top: height * 0.06, width: w, height: height * 0.46, borderRadius: fs * 0.7, background: "#1A1918", color: "#F2EFEA", boxShadow: c.shadow, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${fs * 1.2}px`, overflow: "hidden" }}>
        <div style={{ opacity: swap, filter: `blur(${(1 - swap) * 10}px)`, translate: `${(1 - swap) * 40}px 0` }}>
          <div style={{ fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.6, letterSpacing: fs * 0.1, color: SAGE }}>PHASE {cur + 1}</div>
          <div style={{ fontFamily: type.sans, fontWeight: 800, fontSize: fs * 1.9, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{p.label}</div>
          {p.agent && <div style={{ marginTop: fs * 0.3, fontFamily: MONO, fontSize: fs * 0.7, color: "#D97757" }}>{p.agent}</div>}
          {p.detail && <div style={{ marginTop: fs * 0.25, fontFamily: type.sans, fontSize: fs * 0.7, color: "#A3A19C" }}>{p.detail}</div>}
        </div>
      </div>
      {/* footer: stays put, keeps the place */}
      <div style={{ position: "absolute", top: height * 0.57, width: w, borderRadius: fs * 0.6, background: c.card, border: `1px solid ${c.edge}`, boxShadow: c.shadow, padding: `${fs * 0.6}px ${fs * 0.8}px` }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.7, color: c.ink }}>
          <span>{str(props.title)}</span>
          <span style={{ color: c.muted }}>
            Phase {cur + 1} of {n}
          </span>
        </div>
        <div style={{ marginTop: fs * 0.4, height: fs * 0.3, borderRadius: fs, background: c.edge, overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: PINE }} />
        </div>
        <div style={{ marginTop: fs * 0.45, display: "flex", flexDirection: "column", gap: fs * 0.2 }}>
          {phases.map((ph, i) => {
            const done = i < cur;
            const on = i === cur;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: fs * 0.4, fontFamily: type.sans, fontSize: fs * 0.72, fontWeight: on ? 700 : 500, color: done || on ? c.ink : c.muted }}>
                {done ? <Check k={1} size={fs * 0.75} /> : on ? <Spinner size={fs * 0.75} time={time} /> : <div style={{ width: fs * 0.75, height: fs * 0.75, borderRadius: fs, border: `2px solid ${c.edge}` }} />}
                {ph.label}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
const Spinner: React.FC<{ size: number; time: number }> = ({ size, time }) => (
  <div style={{ width: size, height: size, borderRadius: size, border: `3px solid ${SAGE}`, borderTopColor: PINE, rotate: `${time * 540}deg` }} />
);

// ---------- verifier ----------
// props: { from, to, rows: [{ q, a }], verdict }   times: [arrow draws, each row, verdict]
export const Verifier: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const c = tone(panel);
  const rows = arr<{ q: string; a: string }>(props.rows);
  const fs = Math.round(width / 18);
  const tA = times[0] ?? shot.start + 0.2;
  const rowAt = rows.map((_, i) => times[i + 1] ?? tA + 0.7 + i * 0.4);
  const vAt = times[rows.length + 1] ?? (rowAt[rowAt.length - 1] ?? tA) + 0.6;
  const draw = prog(time, tA, 0.6, easeInOut);
  const node = (label: string, x: number, k: number, dark: boolean) => (
    <div style={{ position: "absolute", left: x, top: height * 0.1, translate: "-50% 0", padding: `${fs * 0.45}px ${fs * 0.8}px`, borderRadius: fs * 0.5, background: dark ? "#1A1918" : c.card, color: dark ? "#F2EFEA" : c.ink, border: `1px solid ${c.edge}`, boxShadow: c.shadow, fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.85, whiteSpace: "nowrap", opacity: k, scale: String(0.85 + 0.15 * k) }}>{label}</div>
  );
  const xA = width * 0.24, xB = width * 0.74, y = height * 0.1 + fs * 0.9;
  const v = prog(time, vAt, 0.35, easeInOut);
  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <path d={`M ${xA + fs * 2.4} ${y} C ${xA + fs * 4} ${y - fs * 2}, ${xB - fs * 4} ${y - fs * 2}, ${xB - fs * 3.2} ${y}`} fill="none" stroke={PINE} strokeWidth={4} strokeLinecap="round" strokeDasharray="10 10" opacity={draw} style={{ clipPath: `inset(0 ${(1 - draw) * 100}% 0 0)` }} />
      </svg>
      {node(str(props.from), xA, 1, false)}
      {node(str(props.to), xB, prog(time, tA + 0.5, 0.3, easeInOut), true)}
      <div style={{ position: "absolute", left: width * 0.08, right: width * 0.08, top: height * 0.32, borderRadius: fs * 0.6, background: c.card, border: `1px solid ${c.edge}`, boxShadow: c.shadow, padding: `${fs * 0.4}px ${fs * 0.8}px` }}>
        {rows.map((rw, i) => {
          const k = prog(time, rowAt[i], 0.25, easeInOut);
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${fs * 0.4}px 0`, borderBottom: i < rows.length - 1 ? `1px solid ${c.edge}` : "none", opacity: lerp(0.25, 1, k), fontFamily: type.sans, fontSize: fs * 0.8 }}>
              <span style={{ color: c.ink, fontWeight: 600 }}>{rw.q}</span>
              <span style={{ fontFamily: MONO, color: PINE, fontWeight: 700, opacity: k }}>{rw.a}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: width / 2, top: height * 0.8, translate: "-50% 0", display: "flex", alignItems: "center", gap: fs * 0.4, padding: `${fs * 0.45}px ${fs * 0.9}px`, borderRadius: fs, background: GREEN, color: "#fff", fontFamily: type.sans, fontWeight: 800, fontSize: fs * 1, opacity: v, scale: String(lerp(1.3, 1, v)), boxShadow: `0 20px 50px ${GREEN}66`, whiteSpace: "nowrap" }}>✓ {str(props.verdict)}</div>
    </AbsoluteFill>
  );
};

// ---------- igcta ----------
// props: { handle, keyword, dm }   times: [follow click, keyword typed, DM drops]
export const IgCta: React.FC<CustomProps> = ({ shot, time, props, times, width, height, panel }) => {
  const c = tone(panel);
  const fs = Math.round(width / 16);
  const tF = times[0] ?? shot.start + 0.4;
  const tC = times[1] ?? tF + 0.8;
  const tD = times[2] ?? tC + 1;
  const followed = time >= tF;
  const press = prog(time, tF - 0.1, 0.15) * (1 - prog(time, tF + 0.05, 0.15));
  const kw = str(props.keyword);
  const typedKw = kw.slice(0, Math.max(0, Math.floor((time - tC) * 14)));
  const posted = time >= tC + kw.length / 14 + 0.25;
  const dm = prog(time, tD, 0.4, easeInOut);
  const w = width * 0.84;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      {/* the DM notification drops from the top */}
      <div style={{ position: "absolute", top: lerp(-fs * 4, height * 0.03, dm), width: w, borderRadius: fs * 0.7, background: "rgba(30,30,30,0.92)", color: "#F2EFEA", padding: `${fs * 0.5}px ${fs * 0.7}px`, display: "flex", gap: fs * 0.5, alignItems: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.35)", zIndex: 2, opacity: dm }}>
        <div style={{ width: fs * 1.4, height: fs * 1.4, borderRadius: fs, background: `linear-gradient(135deg, ${SAGE}, ${PINE})` }} />
        <div style={{ fontFamily: type.sans }}>
          <div style={{ fontWeight: 700, fontSize: fs * 0.7 }}>{str(props.handle)}</div>
          <div style={{ fontSize: fs * 0.66, color: "#CFCBC4" }}>{str(props.dm)}</div>
        </div>
      </div>
      {/* profile card with the Follow button */}
      <div style={{ position: "absolute", top: height * 0.2, width: w, borderRadius: fs * 0.7, background: c.card, border: `1px solid ${c.edge}`, boxShadow: c.shadow, padding: fs * 0.8, display: "flex", alignItems: "center", gap: fs * 0.6 }}>
        <div style={{ width: fs * 2.4, height: fs * 2.4, borderRadius: fs * 2, background: `linear-gradient(135deg, ${SAGE}, ${PINE})` }} />
        <div style={{ flex: 1, fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.85, color: c.ink }}>{str(props.handle)}</div>
        <div style={{ padding: `${fs * 0.35}px ${fs * 0.8}px`, borderRadius: fs * 0.4, background: followed ? c.edge : "#1A1918", color: followed ? c.ink : "#fff", fontFamily: type.sans, fontWeight: 700, fontSize: fs * 0.72, scale: String(1 - press * 0.1) }}>{followed ? "Following" : "Follow"}</div>
      </div>
      {/* comment box: the keyword types in, then posts */}
      <div style={{ position: "absolute", top: height * 0.5, width: w, display: "flex", flexDirection: "column", gap: fs * 0.4 }}>
        {posted && (
          <div style={{ alignSelf: "flex-start", padding: `${fs * 0.35}px ${fs * 0.6}px`, borderRadius: fs * 0.6, background: c.card, border: `1px solid ${c.edge}`, fontFamily: type.sans, fontSize: fs * 0.8, color: c.ink, opacity: prog(time, tC + kw.length / 14 + 0.25, 0.2) }}>
            <b>you</b> {kw}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: fs * 0.4, padding: `${fs * 0.4}px ${fs * 0.6}px`, borderRadius: fs, background: c.card, border: `1.5px solid ${time >= tC && !posted ? PINE : c.edge}`, fontFamily: type.sans, fontSize: fs * 0.85 }}>
          <span style={{ flex: 1, color: typedKw && !posted ? c.ink : c.muted, fontWeight: 600 }}>{posted ? "Add a comment..." : typedKw || "Add a comment..."}</span>
          <span style={{ color: PINE, fontWeight: 800, opacity: typedKw && !posted ? 1 : 0.35 }}>Post</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
