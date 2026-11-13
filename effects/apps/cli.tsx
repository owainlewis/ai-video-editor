// Claude Code and Codex in a terminal, drawn as the real CLIs draw themselves. Both were captured on
// 2026-11-13 by running them in a virtual terminal and reading every cell's text and colour (Claude
// Code 2.1.321, Codex CLI 0.157.1), with Owain's screen recordings of Claude Code for the full-screen
// layout. Clawd's glyphs and his blink are the ones in the 2.1.321 binary. The terminal is a grid of
// rows: text wraps at the last column, the input sits at the bottom, and when the history fills the
// window the oldest rows scroll off the top.
//
// The camera: the type is as large as the script allows. The terminal's font is fitted so the
// busiest moment of the shot fits the window, between 30 px and the box's largest body size; the
// columns follow from it, as a terminal resized to that font would wrap.
import React from "react";
import type { ResolvedShot } from "../../engine/schema";
import { appBeats, typeRate, type Beat } from "../../engine/apps";
import type { V } from "../soft";
import { bodyRange, Caret, fit, Lights, MONO, SANS, segs, Shimmer, Stage, typed, useBox, Window, windowSize } from "./kit";

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
        const fit = Math.max(1, width - col);
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
const blank = (): Row => [{ s: "" }];

// Claude Code's working glyph, forwards then back.
const SPIN = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
// Clawd, Claude Code's mascot: three rows of block characters (the 2.1.321 binary's default pose:
// arms down, eyes open, both feet). Closed, each eye is a lid (a dark bar along the cell's foot).
const CLAWD = [" ▐▛███▛█ ", "▝▜██████▀", " ▝▝   ▝▝ "];
const EYES = [2, 6];
const QUAD: Record<string, number[]> = { " ": [0, 0, 0, 0], "█": [1, 1, 1, 1], "▐": [0, 1, 0, 1], "▌": [1, 0, 1, 0], "▛": [1, 1, 1, 0], "▜": [1, 1, 0, 1], "▝": [0, 1, 0, 0], "▘": [1, 0, 0, 0], "▀": [1, 1, 0, 0] };
// He blinks every 4 s or so, for a sixth of a second.
const blinking = (time: number) => time % 4.1 > 3.94;
export const Clawd: React.FC<{ fs: number; time?: number }> = ({ fs, time = 0 }) => {
  // Each cell is 0.6 em wide and a row 1.3 em tall, split into quadrants; runs merge into one rect
  // each and snap to whole pixels, so no seam shows between them.
  const cw = fs * 0.6, rh = fs * 1.3;
  const shut = blinking(time);
  const rects: React.ReactNode[] = [];
  CLAWD.forEach((line, y) => {
    for (const half of [0, 1]) {
      const on = [...line].flatMap((ch, x) => {
        const q = QUAD[ch] ?? [0, 0, 0, 0];
        const eye = shut && y === 0 && EYES.includes(x);
        // A shut eye: the whole cell lit but for a thin lid at its foot.
        return eye ? [1, 1] : [q[half * 2], q[half * 2 + 1]];
      });
      for (let i = 0; i < on.length; ) {
        if (!on[i]) { i++; continue; }
        let j = i;
        while (j < on.length && on[j]) j++;
        const top = y * rh + half * (rh / 2);
        rects.push(<rect key={`${y}-${half}-${i}`} x={Math.round((i * cw) / 2)} y={Math.round(top)} width={Math.round((j * cw) / 2) - Math.round((i * cw) / 2)} height={Math.round(top + rh / 2) - Math.round(top)} fill={CC.clay} />);
        i = j;
      }
    }
  });
  if (shut) EYES.forEach((x) => rects.push(<rect key={`lid${x}`} x={Math.round(x * cw)} y={Math.round(rh * 0.78)} width={Math.round(cw)} height={Math.max(2, Math.round(rh * 0.14))} fill={BG} />));
  return <svg width={Math.ceil(cw * 9)} height={Math.ceil(rh * 3)} shapeRendering="crispEdges" style={{ position: "absolute", left: 0, top: 0 }}>{rects}</svg>;
};

type Props = { shot: ResolvedShot; time: number; v: V<"cli"> };

// Everything on the terminal at `time`, at `W` columns: the welcome rows, the history and the rows
// pinned to the bottom (the command menu, the input and its footer).
const screen = (v: V<"cli">, beats: Beat[], time: number, W: number) => {
  const claude = v.app === "claude-code";
  const model = v.model ?? (claude ? "Opus 5.5 · Claude Max" : "GPT-6-Astra medium");
  const welcome: Row[] = [];
  if (v.welcome) {
    if (claude) {
      // Clawd draws over the first nine columns of these three rows.
      welcome.push([{ s: "           " }, { s: "Claude Code", b: true, c: CC.fg }, ...(W >= 31 ? [{ s: " v2.1.321", c: CC.grey }] : [])]);
      welcome.push([{ s: "           " }, { s: cut(model, W - 11), c: CC.grey }]);
      welcome.push([{ s: "           " }, { s: cut(v.cwd, W - 11), c: CC.grey }]);
    } else {
      const hint = "   /model to change";
      const room = W - 4;
      const lines: Row[] = [
        [{ s: ">_ " }, { s: "OpenAI Codex", b: true }, ...(W >= 33 ? [{ s: " (v0.157.1)", c: CX.dim }] : [])],
        [],
        [{ s: "model:     ", c: CX.dim }, { s: cut(model, room - 11) }, ...(11 + model.length + hint.length <= room ? [{ s: "   " }, { s: "/model", c: CX.cyan }, { s: " to change", c: CX.dim }] : [])],
        [{ s: "directory: ", c: CX.dim }, { s: cut(v.cwd, room - 11) }],
      ];
      const inner = Math.min(room, Math.max(...lines.map((l) => l.reduce((n, c) => n + c.s.length, 0))));
      lines.forEach((l, k) => {
        const row: Row = [{ s: " " }, ...l.map((c) => ({ ...c, s: cut(c.s, inner) }))];
        row.box = { cols: inner + 2, edge: k === 0 ? "top" : k === lines.length - 1 ? "bottom" : "mid" };
        welcome.push(row);
      });
    }
  }

  // The turn: from a prompt being sent until a done step or the last reply. While it runs, the
  // working line sits under the history.
  const hist: Row[] = [];
  let sentAt = Infinity;
  let verb = "";
  let lastSent = -1;
  v.steps.forEach((s, i) => {
    const b = beats[i];
    if (time < b.t0) return;
    if (s.type === "prompt") {
      if (time < b.t1) return; // still in the input
      if (hist.length || welcome.length) hist.push(blank());
      // Claude Code sets a sent prompt on a grey band the width of the terminal.
      const sent = wrap(claude ? [{ s: "❯ ", c: CC.grey }] : [{ s: "› ", b: true }], [{ s: s.text, c: claude ? CC.white : CX.fg }], W, 2);
      if (claude) sent.forEach((r) => (r.bg = "#373737"));
      hist.push(...sent);
      sentAt = b.t1;
      lastSent = i;
      verb = "";
      return;
    }
    if (s.type === "think") return void (verb = s.text);
    if (s.type === "done") {
      hist.push(blank());
      const secs = Math.max(1, Math.round(b.t0 - sentAt));
      const text = s.text || `Worked for ${secs}s`;
      hist.push(...(claude ? wrap([{ s: "✻ ", c: CC.grey }], [{ s: text, c: CC.grey }], W, 2) : [[{ s: "─ " + cut(text, W - 4) + " " + "─".repeat(Math.max(0, W - text.length - 3)), c: CX.dim }]]));
      sentAt = Infinity;
      return;
    }
    hist.push(blank());
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
  let working = false;
  if (isFinite(sentAt) && lastSent >= 0) {
    const rest = v.steps.slice(lastSent + 1);
    const d = rest.findIndex((s) => s.type === "done");
    const lastText = rest.map((s, k) => (s.type === "text" ? k : -1)).filter((k) => k >= 0).pop();
    const endAt = d >= 0 ? beats[lastSent + 1 + d].t0 : lastText !== undefined ? beats[lastSent + 1 + lastText].t0 : Infinity;
    working = time >= sentAt && time < endAt;
  }
  if (working) {
    const secs = Math.floor(time - sentAt);
    hist.push(blank());
    if (claude) {
      const tail = W >= 34 ? ` (${secs}s · ↓ ${Math.floor(secs * 23 + 12)} tokens)` : ` (${secs}s)`;
      const word = cut(verb || "Thinking", W - tail.length - 3) + "…";
      const glyph = SPIN[Math.floor(time * 8) % SPIN.length];
      hist.push([{ s: glyph + " ", c: CC.clay }, { s: word, node: <Shimmer text={word} time={time} base={CC.clay} hi={CC.clayHi} /> }, { s: tail, c: CC.grey }]);
    } else {
      const tail = W >= 36 ? ` (${secs}s • esc to interrupt)` : ` (${secs}s)`;
      const word = cut(verb || "Working", W - tail.length - 2);
      hist.push([{ s: "• ", c: CX.dim }, { s: word, b: true, node: <Shimmer text={word} time={time} base={CX.dim} hi={CX.hi} /> }, { s: tail, c: CX.dim }]);
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
        blank(),
        [{ s: "  " }, { s: cut(model, Math.min(24, W - 6)), c: CX.model }, ...(W >= 30 ? [{ s: " · " }, { s: cut(v.cwd, W - 7 - Math.min(24, model.length)), c: CX.path }] : [])],
        [{ s: "  " }, { s: "?", b: true }, { s: " for shortcuts", c: CX.dim }],
      ];
  // Claude Code draws its menu above the input box, Codex just above its prompt line.
  return { welcome, hist, bottom: [...menuRows, ...input] };
};

// The terminal's geometry at font size `fs` in a window `winW` x `winH`.
const grid = (fs: number, winW: number, winH: number) => {
  const pad = fs * 0.8;
  const barH = Math.max(44, fs * 1.5);
  const rowH = fs * 1.3;
  const cols = Math.floor((winW - 2 * pad) / (fs * 0.6));
  const rows = Math.floor((winH - barH - pad * 1.1) / rowH);
  return { pad, barH, rowH, cols, rows };
};

export const Cli: React.FC<Props> = ({ shot, time, v }) => {
  const box = useBox();
  const claude = v.app === "claude-code";
  const { winW, winH } = windowSize(box, v.backdrop, 1640);
  const beats = appBeats(v, shot.start, v.times);

  // The camera: the largest font at which the busiest moment of the shot (its history, without the
  // welcome, and the bottom rows) fits the window, sampled at every step's start, middle and end.
  const fs = React.useMemo(() => {
    const [lo, hi] = bodyRange(box, { winW, winH }, "terminal");
    const at = [...beats.flatMap((b) => [b.t0 + 0.02, (b.t0 + b.t1) / 2, b.t1 - 0.02, b.t1 + 0.02]), shot.end - 0.05];
    return fit(lo, hi, (f) => {
      const g = grid(f, winW, winH);
      if (g.cols < 24) return false;
      return at.every((t) => {
        const s = screen(v, beats, t, g.cols);
        return s.hist.length + s.bottom.length + 1 <= g.rows;
      });
    });
    // The script and the box decide it; `time` does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, shot.start, shot.end, winW, winH, box.panel]);
  const { pad, barH, rowH, cols: W, rows: maxRows } = grid(fs, winW, winH);
  const { welcome, hist, bottom } = screen(v, beats, time, W);

  // ---- fit: the newest rows that fit, the input pinned to the bottom. The welcome stays while it
  // all fits and leaves whole (never half a header), as the history scrolls it off. ----
  const room = Math.max(0, maxRows - bottom.length - 1);
  const head = welcome.length && welcome.length + 1 + hist.length <= room ? [...welcome, ...(hist.length ? [] : [blank()])] : [];
  const all = [...head, ...hist];
  // No blank row at the very top of the window: the history starts on its first line.
  const lead = head.length ? 0 : all.findIndex((r) => r.length > 1 || r[0]?.s !== "");
  const drop = Math.max(0, all.length - room, lead);
  const shown = all.slice(drop);
  const clawdOn = claude && head.length > 0;
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
      <Window w={winW} h={winH} r={Math.max(16, fs * 0.5)} bg={BG} edge="rgba(255,255,255,0.12)" time={time} start={shot.start} end={shot.end}>
        <div style={{ height: barH, flex: "0 0 auto", position: "relative", display: "flex", alignItems: "center", padding: `0 ${barH * 0.42}px`, background: "#232323", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <Lights s={barH * 0.3} />
          <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: SANS, fontWeight: 500, fontSize: Math.max(26, barH * 0.44), color: "#B9B9B9" }}>{title}</div>
        </div>
        <div style={{ position: "relative", flex: 1, padding: `${pad * 0.5}px ${pad}px ${pad * 0.6}px`, fontFamily: MONO, fontSize: fs, color: claude ? CC.fg : CX.fg, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ position: "relative" }}>
            {clawdOn && <Clawd fs={fs} time={time} />}
            {shown.map((r, k) => <RowView key={k + drop} r={r} />)}
          </div>
          <div style={{ flex: 1 }} />
          {bottom.map((r, k) => <RowView key={`b${k}`} r={r} />)}
        </div>
      </Window>
    </Stage>
  );
};
