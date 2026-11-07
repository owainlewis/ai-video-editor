// The Elephant-Goldfish Model, drawn as one diagram that builds for the whole explanation
// (projects/egm/DESIGN.md, 2026-11-05). On black, sage on the part being said.
//   The elephant (a big circle that fills with project files) drafts the spec. The spec rises and
//   seven goldfish (small empty circles: no memory) land under it, each reading it; egm-review runs
//   seven reviewer subagents (skills/egm-review/SKILL.md). The four the script names light in turn,
//   in pipeline order. Then they fall away: the spec, you, and only then the code.
// props: { jobs?: [string, string, string, string] }
// times: [elephant, whole project, talk, drafts, spec, goes to, goldfish, subagents, no memory,
//         only see, code, stranger, one job, seven, job 1, job 2, job 3, job 4, you, final calls,
//         only then, code]
import React from "react";
import { AbsoluteFill } from "remotion";
import { easeInOut, easeOut, lerp, prog } from "../motion";
import { t as type } from "../theme";
import type { CustomProps } from "./index";

const BG = "#000000";
const INK = "#F5F5F2";
const MUTED = "#9C9C98";
const LINE = "rgba(245,245,242,0.22)";
const SAGE = "#B7CDBF";

type P = { x: number; y: number };
const mix = (a: P, b: P, k: number): P => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

// An arrow from the edge of one shape to the edge of another, drawn on as k goes 0 to 1.
const Arrow: React.FC<{ a: P; b: P; ra: number; rb: number; k: number; color?: string; w: number; opacity?: number }> = ({ a, b, ra, rb, k, color = INK, w, opacity = 1 }) => {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
  const s = { x: a.x + ux * ra, y: a.y + uy * ra };
  const e = { x: b.x - ux * rb, y: b.y - uy * rb };
  const tip = mix(s, e, k);
  const h = w * 4.2;
  const head = k > 0.85 ? (k - 0.85) / 0.15 : 0;
  const px = -uy, py = ux;
  return (
    <g opacity={opacity * (k > 0 ? 1 : 0)}>
      <line x1={s.x} y1={s.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <path d={`M ${tip.x - ux * h + px * h * 0.6} ${tip.y - uy * h + py * h * 0.6} L ${tip.x} ${tip.y} L ${tip.x - ux * h - px * h * 0.6} ${tip.y - uy * h - py * h * 0.6}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={head} />
    </g>
  );
};

export const Egm: React.FC<CustomProps> = ({ shot, time, props, times, width: W, height: H }) => {
  const jobs = (props.jobs as string[] | undefined) ?? ["Not over-built", "A new engineer can follow", "Critiques the design", "Ready to build"];
  const at = (i: number) => times[i] ?? shot.start + 0.4 + i * 1.6;
  const u = Math.min(W, H * 1.2) / 100;
  const sw = u * 0.55;

  // Stage changes.
  const kB = prog(time, at(5), 0.6, easeInOut); // the spec goes to the goldfish
  const kD = prog(time, at(18), 0.6, easeInOut); // you and the code

  // The elephant: big at first, then steps back and leaves; the goldfish never see its chat.
  const eA = { x: W * 0.29, y: H * 0.47 }, eB = { x: W * 0.12, y: H * 0.14 };
  const ePos = mix(eA, eB, kB);
  const eR = lerp(Math.min(W * 0.22, H * 0.3), u * 5.5, kB);
  const eIn = prog(time, at(0) - 0.1, 0.4, easeOut);
  const eOp = 1 - kB;

  // The spec page: beside the elephant, then above the goldfish, then on the left of you.
  const sA = { x: W * 0.76, y: H * 0.47 }, sB = { x: W * 0.5, y: H * 0.26 }, sD = { x: W * 0.15, y: H * 0.5 };
  const sPos = mix(mix(sA, sB, kB), sD, kD);
  const pw = lerp(lerp(W * 0.2, W * 0.17, kB), W * 0.17, kD), ph = pw * 1.3;
  const sIn = prog(time, at(4) - 0.1, 0.35, easeOut);
  const lines = 5;
  const written = Math.max(0, Math.min(lines, (time - at(4)) / 0.16));
  // On "stranger" a reading bar runs down the page.
  const read = prog(time, at(11), 1.4, easeInOut);
  const reading = time > at(11) && time < at(11) + 1.6;
  // While you talk it through: a chat bubble where the spec will land, gone as the arrow draws.
  const talk = prog(time, at(2) - 0.05, 0.3, easeOut) * (1 - prog(time, at(3) - 0.1, 0.3));
  // The code the goldfish also read, beside the spec.
  const oldCode = prog(time, at(10) - 0.05, 0.35, easeOut) * (1 - kD);

  // The goldfish: seven small circles under the spec. The four named jobs light the reviewers that
  // do them, in pipeline order: zoom out first, implementation readiness last.
  const gR = u * 5;
  const gPos = Array.from({ length: 7 }, (_, i) => ({ x: W * (0.125 + i * 0.125), y: H * 0.69 + kD * H * 0.12 }));
  const gIn = (i: number) => prog(time, at(6) + i * 0.08, 0.35, easeOut);
  const gName = prog(time, at(7) - 0.05, 0.3) * (1 - prog(time, at(12), 0.3));
  const noMemory = prog(time, at(8) - 0.05, 0.3) * (1 - prog(time, at(12), 0.3));
  const lit = [0, 1, 2, 6];
  const job = [14, 15, 16, 17].reduce((n, b, i) => (time >= at(b) - 0.05 ? i : n), -1);
  const said = job >= 0 && time < at(18) ? lit[job] : -1;
  // One caption under the row: "Seven goldfish", then each job as it is said.
  const captions = ["Seven goldfish", ...jobs];
  const capBeats = [13, 14, 15, 16, 17];
  const gOp = 1 - kD;

  // You and the code.
  const youPos = { x: W * 0.5, y: H * 0.5 };
  const youIn = prog(time, at(18) + 0.25, 0.35, easeOut);
  const tick = prog(time, at(19) - 0.05, 0.3, easeOut);
  const codePos = { x: W * 0.85, y: H * 0.5 };
  const codeIn = prog(time, at(21) - 0.05, 0.35, easeOut);
  const cw = W * 0.2, ch = cw * 0.72;

  const fsBig = u * 7, fs = u * 5.4, fsSmall = u * 4;
  const label = (x: number, y: number, text: string, opacity: number, o: { size?: number; color?: string; serif?: boolean; anchor?: "middle" | "start" | "end" } = {}) => (
    <text x={x} y={y} textAnchor={o.anchor ?? "middle"} fontFamily={o.serif ? type.serif : type.sans} fontStyle={o.serif ? "italic" : "normal"} fontWeight={o.serif ? 400 : 700} fontSize={o.size ?? fs} letterSpacing={o.serif ? 0 : "-0.02em"} fill={o.color ?? INK} opacity={opacity}>{text}</text>
  );

  // Project files inside the elephant: dots on a ring around its name, appearing in turn on "whole project".
  const files = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.66 : 0.8;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, k: prog(time, at(1) - 0.2 + i * 0.05, 0.25, easeOut) };
  });

  return (
    <AbsoluteFill style={{ background: BG }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {/* the elephant */}
        <g opacity={eIn * eOp} transform={`translate(${ePos.x} ${ePos.y})`}>
          <circle r={eR * lerp(0.85, 1, eIn)} fill="#0B0B0B" stroke={time < at(5) ? SAGE : LINE} strokeWidth={sw * 1.4} />
          {files.map((f, i) => <circle key={i} cx={f.x * eR} cy={f.y * eR} r={u * 0.9 * (1 - kB)} fill={MUTED} opacity={f.k * (1 - kB)} />)}
          {label(0, eR * 0.18 + fsBig * 0.3, "Elephant", 1 - kB, { size: fsBig })}
          {label(0, eR + fs * 1.5, "knows everything", prog(time, at(0) + 0.3, 0.3) * (1 - kB), { serif: true, color: MUTED })}
        </g>
        <Arrow a={eA} b={sA} ra={Math.min(W * 0.22, H * 0.3) + u * 2} rb={W * 0.1 + u * 2} k={prog(time, at(3) - 0.1, 0.45, easeInOut)} w={sw} opacity={1 - kB} />
        <g opacity={talk} transform={`translate(${sA.x} ${sA.y}) scale(${lerp(0.85, 1, talk)})`}>
          <path d={`M ${-W * 0.1} ${-u * 7} h ${W * 0.2} v ${u * 11} h ${-W * 0.12} l ${-u * 4} ${u * 4} v ${-u * 4} h ${-W * 0.08} Z`} fill="#0B0B0B" stroke={MUTED} strokeWidth={sw} strokeLinejoin="round" />
          {[0, 1].map((i) => <rect key={i} x={-W * 0.07} y={-u * 3.6 + i * u * 3.4} width={W * (i ? 0.09 : 0.14)} height={u * 0.9} rx={u * 0.45} fill={MUTED} opacity={prog(time, at(2) + 0.1 + i * 0.25, 0.25)} />)}
        </g>

        {/* arrows from each goldfish up to the spec */}
        {gPos.map((g, i) => (
          <Arrow key={i} a={g} b={{ x: sPos.x, y: sPos.y + ph / 2 + fs * 1.9 }} ra={gR + u * 1.2} rb={u * 1.5} k={prog(time, at(9) + i * 0.06, 0.45, easeInOut)} w={sw * 0.6} color={said === i ? SAGE : MUTED} opacity={gOp} />
        ))}

        {/* the spec */}
        <g opacity={sIn} transform={`translate(${sPos.x} ${sPos.y + (1 - sIn) * u * 3})`}>
          <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} rx={u * 1.4} fill="#0B0B0B" stroke={time >= at(4) && time < at(5) ? SAGE : INK} strokeOpacity={0.85} strokeWidth={sw * 1.2} />
          {Array.from({ length: lines }, (_, i) => {
            const k = Math.max(0, Math.min(1, written - i));
            const lw = pw * (i === lines - 1 ? 0.42 : 0.68);
            return <rect key={i} x={-pw * 0.34} y={-ph * 0.3 + i * ph * 0.13} width={lw * k} height={u * 0.9} rx={u * 0.45} fill={MUTED} />;
          })}
          {reading && <rect x={-pw * 0.42} y={-ph * 0.34 + read * ph * 0.58} width={pw * 0.84} height={ph * 0.12} rx={u} fill={SAGE} opacity={0.22} />}
          {label(0, ph / 2 + fs * 1.4, "Spec", 1)}
          {/* approved, on "final calls" */}
          <g opacity={tick} transform={`translate(${pw / 2} ${-ph / 2}) scale(${lerp(0.6, 1, tick)})`}>
            <circle r={u * 3.4} fill={SAGE} />
            <path d={`M ${-u * 1.5} 0 L ${-u * 0.4} ${u * 1.2} L ${u * 1.7} ${-u * 1.2}`} fill="none" stroke={BG} strokeWidth={sw * 1.3} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>

        {/* the code the goldfish read, beside the spec */}
        <g opacity={oldCode} transform={`translate(${sB.x + W * 0.23} ${sB.y})`}>
          <rect x={-W * 0.065} y={-ph * 0.36} width={W * 0.13} height={ph * 0.72} rx={u * 1.2} fill="none" stroke={MUTED} strokeWidth={sw} strokeDasharray={`${u * 1.4} ${u * 1.1}`} />
          {label(0, fsSmall * 0.35, "Code", 1, { size: fsSmall, color: MUTED })}
        </g>

        {/* the goldfish */}
        {gPos.map((g, i) => {
          const k = gIn(i);
          const on = said === i;
          return (
            <g key={i} opacity={k * gOp} transform={`translate(${g.x} ${g.y})`}>
              <circle r={gR * lerp(0.6, 1, k)} fill={on ? SAGE : "#0B0B0B"} stroke={on ? SAGE : INK} strokeWidth={sw} />
            </g>
          );
        })}
        {label(W / 2, H * 0.69 + gR + fs * 1.6, "Goldfish", gName * gOp, { size: fs, anchor: "end" })}
        {label(W / 2 + u * 1.5, H * 0.69 + gR + fs * 1.6, "no memory", noMemory * gOp, { serif: true, color: MUTED, size: fs, anchor: "start" })}
        {captions.map((c, i) => {
          const next = capBeats[i + 1];
          const o = prog(time, at(capBeats[i]) - 0.05, 0.25) * (next === undefined ? 1 : 1 - prog(time, at(next) - 0.05, 0.15));
          return <React.Fragment key={c}>{label(W / 2, H * 0.69 + gR + fs * 1.6, c, o * gOp, { color: i ? INK : MUTED, serif: !i })}</React.Fragment>;
        })}

        {/* you, then the code */}
        <Arrow a={sD} b={youPos} ra={pw / 2 + u * 2} rb={u * 9} k={prog(time, at(18) + 0.35, 0.4, easeInOut) * kD} w={sw} />
        <g opacity={youIn} transform={`translate(${youPos.x} ${youPos.y})`}>
          <circle cy={-u * 3.6} r={u * 3.2} fill={time >= at(18) && time < at(21) ? SAGE : INK} />
          <path d={`M ${-u * 6} ${u * 5.6} C ${-u * 6} ${u * 0.6} ${u * 6} ${u * 0.6} ${u * 6} ${u * 5.6} Z`} fill={time >= at(18) && time < at(21) ? SAGE : INK} />
          {label(0, u * 5.6 + fs * 1.6, "You", 1)}
        </g>
        <Arrow a={youPos} b={codePos} ra={u * 9} rb={cw / 2 + u * 2} k={prog(time, at(20) - 0.05, at(21) - at(20) + 0.1, easeInOut)} w={sw} color={SAGE} />
      </svg>
      {/* the code, in HTML so its label is read against the box it sits on */}
      <div style={{ position: "absolute", left: codePos.x - cw / 2, top: codePos.y - ch / 2, width: cw, height: ch, borderRadius: u * 1.4, background: SAGE, opacity: codeIn, scale: String(lerp(0.85, 1, codeIn)), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: type.sans, fontWeight: 700, fontSize: fsBig * 0.9, letterSpacing: "-0.02em", color: BG }}>Code</div>
    </AbsoluteFill>
  );
};
