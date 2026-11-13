// Claude Code and Codex in a terminal, drawn as the real CLIs draw themselves. Both were captured on
// 2026-11-13 by running them in a virtual terminal and reading every cell's text and colour (Claude
// Code 2.1.321, Codex CLI 0.157.1), with Owain's screen recordings of Claude Code for the full-screen
// layout. The terminal is a grid of rows: text wraps at the last column, the input sits at the
// bottom, and when the history fills the window the oldest rows scroll off the top.
import React from "react";
import type { ResolvedShot } from "../../engine/schema";
import { appBeats, typeRate, type Beat } from "../../engine/apps";
import type { V } from "../soft";
import { Caret, enter, MONO, SANS, segs, Shimmer, Stage, typed, useBox, windowSize } from "./kit";

// The colours each CLI sends (24-bit, from the capture).
const CC = {
  fg: "#E8E8E8",
  white: "#FFFFFF",
  grey: "#999999",
  rule: "#888888",
  clay: "#D77757",
  clayHi: "#EB9F7F",
  lavender: "#B1B9F9",
  yellow: "#FFC107",
  green: "#4EBA65",
};
const CX = { fg: "#E8E8E8", dim: "#8E8E8E", cyan: "#63A8F8", green: "#A6E3A1", model: "#F6E2B7", path: "#ABDFA7", hi: "#FFFFFF" };
const BG = "#161616";

// A run of text in a row: its characters and how they are drawn.
type Cell = { s: string; c?: string; b?: boolean; node?: React.ReactNode };
type Row = Cell[] & { box?: { cols: number; edge: "top" | "mid" | "bottom" }; bg?: string };

// Word-wraps runs at `width` columns. The first row starts with `lead`; the rest are indented by
// `indent` spaces, as Claude Code and Codex hang a message under its bullet.
const wrap = (lead: Cell[], body: Cell[], width: number, indent: number): Row[] => {
  const rows: Row[] = [];
  let row: Row = [...lead];
  let col = lead.reduce((n, c) => n + c.s.length, 0);
  const push = () => {
    rows.push(row);
    row = [{ s: " ".repeat(indent) }];
    col = indent;
  };
  for (const cell of body) {
    for (const word of cell.s.split(/(?<= )/)) {
      if (col + word.trimEnd().length > width && col > indent) push();
      let w = word;
      // A word longer than a whole row breaks at the edge, as a terminal does.
      while (col + w.trimEnd().length > width) {
        const fit = width - col;
        row.push({ ...cell, s: w.slice(0, fit) });
        w = w.slice(fit);
        push();
      }
      if (col === indent && rows.length && w.startsWith(" ")) w = w.trimStart();
      row.push({ ...cell, s: w });
      col += w.length;
    }
  }
  rows.push(row);
  return rows;
};
// Cuts a run to `n` columns with an ellipsis.
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s);
const blank: Row = [{ s: "" }];

// Claude Code's working glyph, forwards then back.
const SPIN = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
// Clawd, Claude Code's mascot, from the three rows of block characters it prints at start-up.
const CLAWD = [" ▐▛███▛█ ", "▝▜██████▀", " ▝▝   ▝▝ "];
const QUAD: Record<string, number[]> = { " ": [0, 0, 0, 0], "█": [1, 1, 1, 1], "▐": [0, 1, 0, 1], "▌": [1, 0, 1, 0], "▛": [1, 1, 1, 0], "▜": [1, 1, 0, 1], "▝": [0, 1, 0, 0], "▀": [1, 1, 0, 0] };
export const Clawd: React.FC<{ fs: number }> = ({ fs }) => {
  // Each character cell is half as wide as a row is tall, split into four quadrants.
  const cw = fs * 0.6, rh = fs * 1.3;
  const cells: React.ReactNode[] = [];
  CLAWD.forEach((line, y) =>
    [...line].forEach((ch, x) =>
      (QUAD[ch] ?? [0, 0, 0, 0]).forEach((on, q) => {
        if (!on) return;
        cells.push(<rect key={`${y}-${x}-${q}`} x={x * cw + (q % 2) * (cw / 2)} y={y * rh + Math.floor(q / 2) * (rh / 2)} width={cw / 2 + 0.5} height={rh / 2 + 0.5} fill={CC.clay} />);
      }),
    ),
  );
  return <svg width={cw * 9} height={rh * 3} style={{ position: "absolute", left: 0, top: 0 }}>{cells}</svg>;
};

type Props = { shot: ResolvedShot; time: number; v: V<"cli"> };

export const Cli: React.FC<Props> = ({ shot, time, v }) => {
  const box = useBox();
  const claude = v.app === "claude-code";
  const tall = box.height > box.width * 0.7 || box.panel;
  const cols = tall ? 46 : 74;
  const { winW, winH } = windowSize(box, v.backdrop, 1640);
  const fs = winW / (cols * 0.6 + 2);
  const rowH = fs * 1.3;
  const pad = fs;
  const barH = fs * 1.7;
  const maxRows = Math.floor((winH - barH - pad * 1.2) / rowH);
  const beats = appBeats(v, shot.start, v.times);
  const W = cols;

  // ---- the history: every step that has started, as rows ----
  const hist: Row[] = [];
  const model = v.model ?? (claude ? "Opus 5.5 · Claude Max" : "GPT-6-Astra medium");
  if (v.welcome) {
    if (claude) {
      // Clawd draws over the first nine columns of these three rows.
      hist.push([{ s: "           " }, { s: "Claude Code", b: true, c: CC.fg }, { s: " v2.1.321", c: CC.grey }]);
      hist.push([{ s: "           " }, { s: cut(model, W - 11), c: CC.grey }]);
      hist.push([{ s: "           " }, { s: cut(v.cwd, W - 11), c: CC.grey }]);
    } else {
      const hint = "   /model to change";
      const room = W - 4;
      const lines: Row[] = [
        [{ s: ">_ " }, { s: "OpenAI Codex", b: true }, { s: " (v0.157.1)", c: CX.dim }],
        [],
        [{ s: "model:     ", c: CX.dim }, { s: model }, ...(11 + model.length + hint.length <= room ? [{ s: "   " }, { s: "/model", c: CX.cyan }, { s: " to change", c: CX.dim }] : [])],
        [{ s: "directory: ", c: CX.dim }, { s: cut(v.cwd, room - 11) }],
      ];
      const inner = Math.min(room, Math.max(...lines.map((l) => l.reduce((n, c) => n + c.s.length, 0))));
      lines.forEach((l, k) => {
        const row: Row = [{ s: " " }, ...l.map((c) => ({ ...c, s: cut(c.s, inner) }))];
        row.box = { cols: inner + 2, edge: k === 0 ? "top" : k === lines.length - 1 ? "bottom" : "mid" };
        hist.push(row);
      });
    }
  }

  // The turn: from a prompt being sent until a done step or the last reply. While it runs, the
  // working line sits under the history.
  let sentAt = Infinity;
  let verb = "";
  let working = false;
  const turnStart = (i: number) => beats[i].t1;
  let lastSent = -1;
  v.steps.forEach((s, i) => {
    const b = beats[i];
    if (time < b.t0) return;
    if (s.type === "prompt") {
      if (time < b.t1) return; // still in the input
      hist.push(blank);
      // Claude Code sets a sent prompt on a grey band the width of the terminal.
      const sent = wrap(claude ? [{ s: "❯ ", c: CC.grey }] : [{ s: "› ", b: true }], [{ s: s.text, c: claude ? CC.white : CX.fg }], W, 2);
      if (claude) sent.forEach((r) => (r.bg = "#373737"));
      hist.push(...sent);
      sentAt = turnStart(i);
      lastSent = i;
      verb = "";
      return;
    }
    if (s.type === "think") return void (verb = s.text);
    if (s.type === "done") {
      hist.push(blank);
      const secs = Math.max(1, Math.round(b.t0 - sentAt));
      const text = s.text || `Worked for ${secs}s`;
      hist.push(...(claude ? wrap([{ s: "✻ ", c: CC.grey }], [{ s: text, c: CC.grey }], W, 2) : [[{ s: "─ " + cut(text, W - 4) + " " + "─".repeat(Math.max(0, W - text.length - 3)), c: CX.dim }]]));
      sentAt = Infinity;
      return;
    }
    hist.push(blank);
    if (s.type === "text") {
      const body = segs(s.text).map((g): Cell => ({ s: g.s, c: g.code ? (claude ? CC.lavender : CX.green) : undefined, b: g.bold }));
      // Rows land a few at a time, as the reply arrives.
      const rows = wrap([{ s: claude ? "⏺ " : "• ", c: claude ? CC.white : undefined }], body, W, 2);
      const shown = Math.max(1, Math.ceil(((time - b.t0) / Math.max(0.1, b.t1 - b.t0)) * rows.length));
      hist.push(...rows.slice(0, shown));
      return;
    }
    // A tool call: running until its beat ends, then done with its output.
    const done = time >= b.t1 - 0.25;
    const name = s.name ?? (claude ? "Bash" : "Ran");
    if (claude) {
      // The dot blinks while the tool runs, and turns green when it is done.
      const off = !done && Math.floor((time - b.t0) * 2.4) % 2 === 1;
      hist.push(...wrap([{ s: "⏺ ", c: done ? CC.green : CC.grey, node: off ? <span style={{ opacity: 0 }}>⏺ </span> : undefined }], [{ s: name, b: true }, { s: `(${s.text})` }], W, 2));
      const out = s.out ?? [];
      if (!done) hist.push([{ s: "  ⎿  Running…", c: CC.grey }]);
      else out.forEach((o, k) => hist.push([{ s: k ? "     " : "  ⎿  ", c: CC.grey }, { s: cut(o, W - 5) }]));
    } else {
      const explore = /^(read|list|search)$/i.test(name);
      const head = explore ? (done ? "Explored" : "Exploring") : done ? "Ran" : "Running";
      hist.push(...wrap([{ s: "• ", c: done ? undefined : CX.dim }], explore ? [{ s: head, b: true }] : [{ s: head, b: true }, { s: " " + s.text }], W, 4));
      if (explore) hist.push([{ s: "  └ ", c: CX.dim }, { s: name[0].toUpperCase() + name.slice(1).toLowerCase(), c: CX.cyan }, { s: " " + cut(s.text, W - 6 - name.length) }]);
      else if (done) (s.out ?? []).forEach((o, k) => hist.push([{ s: k ? "    " : "  └ ", c: CX.dim }, { s: cut(o, W - 4), c: CX.dim }]));
    }
  });
  // Working: after a prompt is sent and before its turn's done step or final reply lands.
  if (isFinite(sentAt) && lastSent >= 0) {
    const rest = v.steps.slice(lastSent + 1);
    const endAt = (() => {
      const d = rest.findIndex((s) => s.type === "done");
      if (d >= 0) return beats[lastSent + 1 + d].t0;
      const lastText = rest.map((s, k) => (s.type === "text" ? k : -1)).filter((k) => k >= 0).pop();
      return lastText !== undefined ? beats[lastSent + 1 + lastText].t0 : Infinity;
    })();
    working = time >= sentAt && time < endAt;
  }
  if (working) {
    const secs = Math.floor(time - sentAt);
    hist.push(blank);
    if (claude) {
      const tail = ` (${secs}s · ↓ ${Math.floor(secs * 23 + 12)} tokens)`;
      const word = cut(verb || "Thinking", W - tail.length - 3) + "…";
      const glyph = SPIN[Math.floor(time * 8) % SPIN.length];
      hist.push([{ s: glyph + " ", c: CC.clay }, { s: word, node: <Shimmer text={word} time={time} base={CC.clay} hi={CC.clayHi} /> }, { s: tail, c: CC.grey }]);
    } else {
      const word = cut(verb || "Working", W - 30);
      hist.push([{ s: "• ", c: CX.dim }, { s: word, b: true, node: <Shimmer text={word} time={time} base={CX.dim} hi={CX.hi} /> }, { s: ` (${secs}s • esc to interrupt)`, c: CX.dim }]);
    }
  }

  // ---- the input: what is being typed now, and the command menu for a "/" ----
  const typingIdx = v.steps.findIndex((s, i) => s.type === "prompt" && time >= beats[i].t0 && time < beats[i].t1);
  const tStep = typingIdx >= 0 ? v.steps[typingIdx] : undefined;
  const tBeat: Beat | undefined = typingIdx >= 0 ? beats[typingIdx] : undefined;
  const text = tStep && tBeat ? typed(tStep.text, time, tBeat.t0, typeRate(tStep.text.length)) : "";
  const busy = !!tStep && text.length < (tStep?.text.length ?? 0);
  const menu = tStep?.menu && text.startsWith("/") ? tStep.menu.filter((m) => m.name.startsWith(text.split(" ")[0]) || text.length < 2) : [];
  const menuRows: Row[] = [];
  const nameW = Math.min(Math.max(0, ...menu.map((m) => m.name.length)) + 3, Math.floor(W * 0.55));
  menu.forEach((m, k) => {
    const sel = k === 0;
    const name = cut(m.name, nameW - 3).padEnd(nameW - 1);
    const desc = cut(m.desc, W - nameW - 2);
    if (claude) menuRows.push([{ s: sel ? "❯ " : "  ", c: CC.lavender }, { s: name, c: sel ? CC.lavender : CC.fg }, { s: desc, c: sel ? CC.lavender : CC.grey }]);
    else menuRows.push([{ s: sel ? "› " : "  ", b: true }, { s: name, b: sel }, { s: desc, c: sel ? undefined : CX.dim }]);
  });
  const caret = <Caret time={time} color={claude ? CC.fg : CX.fg} busy={busy} />;
  const input: Row[] = claude
    ? [
        [{ s: "─".repeat(W), c: CC.rule }],
        ...wrap([{ s: "❯ ", c: CC.fg }], [{ s: text }], W - 1, 2).map((r, k, all) => (k === all.length - 1 ? [...r, { s: " ", node: caret }] : r)),
        [{ s: "─".repeat(W), c: CC.rule }],
        [{ s: "  ⏵⏵ auto mode on", c: CC.yellow }, { s: W >= 40 ? " (shift+tab to cycle)" : "", c: CC.grey }],
      ]
    : [
        ...wrap([{ s: "› ", b: true }], text ? [{ s: text }] : [{ s: "Ask Codex to do anything", c: CX.dim }], W - 1, 2).map((r, k, all) => (k === all.length - 1 && text ? [...r, { s: " ", node: caret }] : r)),
        blank,
        [{ s: "  " }, { s: cut(model, 24), c: CX.model }, { s: " · " }, { s: cut(v.cwd, W - 7 - Math.min(24, model.length)), c: CX.path }],
        [{ s: "  " }, { s: "?", b: true }, { s: " for shortcuts", c: CX.dim }],
      ];
  // Claude Code draws its menu above the input box, Codex just above its prompt line.
  const bottom: Row[] = [...menuRows, ...input];

  // ---- fit: the newest rows that fit, the input pinned to the bottom ----
  const room = Math.max(0, maxRows - bottom.length - 1);
  const drop = Math.max(0, hist.length - room);
  const shown = hist.slice(drop);
  const clawdOn = claude && v.welcome && drop === 0;
  const title = claude ? "✳ Claude Code" : "codex";

  const edge = "1px solid rgba(232,232,232,0.42)";
  const RowView: React.FC<{ r: Row }> = ({ r }) => (
    <div style={{ height: rowH, lineHeight: `${rowH}px`, whiteSpace: "pre", ...(r.bg ? { background: r.bg, margin: `0 ${-pad}px`, padding: `0 ${pad}px` } : {}), ...(r.box ? { width: r.box.cols * fs * 0.6 + 2, boxSizing: "border-box" as const, borderLeft: edge, borderRight: edge, ...(r.box.edge === "top" ? { borderTop: edge, borderRadius: `${fs * 0.3}px ${fs * 0.3}px 0 0`, lineHeight: `${rowH + fs * 0.25}px` } : r.box.edge === "bottom" ? { borderBottom: edge, borderRadius: `0 0 ${fs * 0.3}px ${fs * 0.3}px`, lineHeight: `${rowH - fs * 0.25}px` } : {}) } : {}) }}>
      {r.map((c, k) => (
        <span key={k} style={{ color: c.c, fontWeight: c.b ? 700 : 400 }}>{c.node ?? c.s}</span>
      ))}
    </div>
  );
  return (
    <Stage backdrop={v.backdrop}>
      <div style={{ width: winW, height: winH, borderRadius: fs * 0.55, overflow: "hidden", background: BG, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 50px 120px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", ...enter(time, shot.start, shot.end) }}>
        <div style={{ height: barH, flex: "0 0 auto", position: "relative", display: "flex", alignItems: "center", gap: fs * 0.42, padding: `0 ${fs * 0.75}px`, background: "#232323", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} style={{ width: fs * 0.5, height: fs * 0.5, borderRadius: fs, background: c }} />
          ))}
          <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: SANS, fontWeight: 500, fontSize: Math.max(24, fs * 0.72), color: "#B9B9B9" }}>{title}</div>
        </div>
        <div style={{ position: "relative", flex: 1, padding: `${pad * 0.6}px ${pad}px`, fontFamily: MONO, fontSize: fs, color: claude ? CC.fg : CX.fg, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative" }}>
            {clawdOn && <Clawd fs={fs} />}
            {shown.map((r, k) => <RowView key={k + drop} r={r} />)}
          </div>
          <div style={{ flex: 1 }} />
          {bottom.map((r, k) => <RowView key={`b${k}`} r={r} />)}
        </div>
      </div>
    </Stage>
  );
};
