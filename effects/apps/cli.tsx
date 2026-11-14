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
import { appBeats, askTime, typeRate, type Beat } from "../../engine/apps";
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
  // From 2.1.323 (2026-11-14): the permission box's dashes, plan mode, accept edits, and a diff's
  // removed and added lines (text, row, and the changed words).
  dash: "#505050",
  teal: "#48968C",
  violet: "#AF87FF",
  delFg: "#DC5A5A",
  delBg: "#3D0100",
  delHi: "#5C0200",
  addFg: "#50C850",
  addBg: "#022800",
  addHi: "#044700",
};
// Claude Code colours code in Monokai (from the same capture).
const MK = { fg: "#F8F8F2", key: "#F92672", store: "#66D9EF", name: "#A6E22E", str: "#E6DB74", num: "#AE81FF", note: "#75715E", type: "#FD971F" };
const CX = { fg: "#E8E8E8", dim: "#8E8E8E", cyan: "#63A8F8", green: "#A6E3A1", model: "#F6E2B7", path: "#ABDFA7", hi: "#FFFFFF" };
const BG = "#161616";

// A run of text in a row: its characters and how they are drawn (`bg`: a band behind it, `i` italic).
type Cell = { s: string; c?: string; b?: boolean; i?: boolean; bg?: string; deco?: boolean; node?: React.ReactNode };
// `spare`: a row a short window drops first (a hint under a box), so what matters stays in frame.
type Row = Cell[] & { box?: { cols: number; edge: "top" | "mid" | "bottom" }; bg?: string; spare?: boolean };
const spare = (r: Row): Row => Object.assign(r, { spare: true });

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

// ---- Claude Code's code: Monokai colours, numbered lines and diffs, as 2.1.323 draws them ----

const KEY = /^(export|import|from|return|if|else|throw|new|await|async|for|while|of|in|default|case|switch|break|continue|try|catch|finally|as|extends|yield|delete|typeof)$/;
const STORE = /^(function|const|let|var|class|interface|type|enum|def)$/;
// One line of code as coloured runs: keywords, declarations, called names, strings, numbers, notes.
export const highlight = (code: string): Cell[] => {
  const out: Cell[] = [];
  const re = /(\/\/.*$|#.*$)|(`[^`]*`?|"[^"]*"?|'[^']*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|[^\sA-Za-z_$\d"'`]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const [t, note, str, num, word] = m;
    const next = code.slice(m.index + t.length);
    const c = note ? MK.note : str ? MK.str : num ? MK.num : word ? (KEY.test(word) ? MK.key : STORE.test(word) ? MK.store : /^\s*\(/.test(next) ? MK.name : MK.fg) : MK.fg;
    const last = out[out.length - 1];
    if (last && last.c === c) last.s += t;
    else out.push({ s: t, c });
  }
  return out.length ? out : [{ s: "", c: MK.fg }];
};

type CodeLine = { s: string; n?: number; op?: "add" | "del" };
// The words that changed between a removed line and the added line after it, which Claude Code
// marks brighter ("Hello" to "Hi" in the capture, not the name between them): a word diff, each
// line split into words, spaces and marks, and the longest run they share kept plain.
type Span = [number, number];
export const changed = (a: string, b: string): [Span[], Span[]] => {
  const split = (s: string) => s.match(/[A-Za-z0-9_$]+|\s+|[^A-Za-z0-9_$\s]/g) ?? [];
  const x = split(a), y = split(b);
  const L = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const keepX = new Set<number>(), keepY = new Set<number>();
  for (let i = 0, j = 0; i < x.length && j < y.length; )
    if (x[i] === y[j]) (keepX.add(i++), keepY.add(j++));
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  const spans = (t: string[], keep: Set<number>) => {
    const out: Span[] = [];
    let at = 0;
    t.forEach((w, k) => {
      if (!keep.has(k) && w.trim()) {
        const last = out[out.length - 1];
        // Words changed together, with only spaces between them, light up as one run.
        if (last && /^\s*$/.test(t.slice(0, k).join("").slice(last[1]))) last[1] = at + w.length;
        else out.push([at, at + w.length]);
      }
      at += w.length;
    });
    return out;
  };
  return [spans(x, keepX), spans(y, keepY)];
};
// Colours one code line, with its changed spans on `hi`.
const paint = (s: string, row: string | undefined, hi: string | undefined, spans: Span[] = []): Cell[] => {
  const cells = highlight(s).map((c) => ({ ...c, bg: row }));
  if (!spans.length || !hi) return cells;
  const out: Cell[] = [];
  let at = 0;
  for (const c of cells)
    for (let i = 0; i < c.s.length; ) {
      const p = at + i;
      const inside = spans.some(([f, t]) => p >= f && p < t);
      const edge = Math.min(c.s.length, ...spans.flatMap(([f, t]) => [f, t]).filter((e) => e > p).map((e) => e - at));
      out.push({ ...c, s: c.s.slice(i, edge), bg: inside ? hi : row });
      i = edge;
      if (i >= c.s.length) at += c.s.length;
    }
  return out;
};
// Numbered code rows. A diff (any line with an `op`) shows " 2 -" and " 2 +" on red and green
// bands across the row from the number on; plain code (what a Write wrote) is just numbered.
// `lead` is how far in the numbers sit; `right` columns at the end stay unbanded.
export const codeRows = (lines: CodeLine[], W: number, lead: number, right = 0): Row[] => {
  const diff = lines.some((l) => l.op);
  // A line added in place of a removed one keeps its number; every other line counts on.
  let n = 0;
  const nums = lines.map((l, k) => (l.n !== undefined ? (n = l.n) : l.op === "add" && lines[k - 1]?.op === "del" ? n : ++n));
  const width = Math.max(1, ...nums.map((x) => String(x).length));
  return lines.map((l, k): Row[] => {
    const num = String(nums[k]).padStart(width);
    const prev = lines[k - 1], next = lines[k + 1];
    const pair = l.op === "del" && next?.op === "add" ? changed(l.s, next.s) : l.op === "add" && prev?.op === "del" ? changed(prev.s, l.s) : undefined;
    const span = pair ? (l.op === "del" ? pair[0] : pair[1]) : undefined;
    // A line longer than the room wraps, its rest under the code on the same band, as the CLI wraps it.
    const room = Math.max(4, W - lead - width - (diff ? 3 : 1) - right);
    const cells = paint(l.s, l.op === "del" ? CC.delBg : l.op === "add" ? CC.addBg : undefined, l.op === "del" ? CC.delHi : CC.addHi, span);
    const parts: Cell[][] = [[]];
    let col = 0;
    for (const c of cells)
      for (let i = 0; i < c.s.length; ) {
        if (col === room) (parts.push([]), (col = 0));
        const take = Math.min(c.s.length - i, room - col);
        parts[parts.length - 1].push({ ...c, s: c.s.slice(i, i + take) });
        (i += take), (col += take);
      }
    if (!diff) return parts.map((p, k): Row => [{ s: " ".repeat(lead) }, { s: (k ? " ".repeat(width) : num) + " ", c: MK.fg }, ...p]);
    const bg = l.op === "del" ? CC.delBg : l.op === "add" ? CC.addBg : undefined;
    const fg = l.op === "del" ? CC.delFg : l.op === "add" ? CC.addFg : MK.fg;
    const mark = l.op === "del" ? "-" : l.op === "add" ? "+" : " ";
    return parts.map((p, k): Row => {
      const used = p.reduce((n, c) => n + c.s.length, 0);
      const fill = bg ? Math.max(0, room - used) : 0;
      return [{ s: " ".repeat(Math.max(0, lead - 1)) }, { s: k ? " ".repeat(width + 3) : ` ${num} ${mark}`, c: fg, bg }, ...p, ...(fill ? [{ s: " ".repeat(fill), bg }] : [])];
    });
  }).flat();
};
// What an Update's ⎿ line says: "Added 1 line, removed 1 line".
const tally = (lines: CodeLine[]) => {
  const add = lines.filter((l) => l.op === "add").length, del = lines.filter((l) => l.op === "del").length;
  const n = (k: number) => `${k} line${k === 1 ? "" : "s"}`;
  return add && del ? `Added ${n(add)}, removed ${n(del)}` : add ? `Added ${n(add)}` : `Removed ${n(del)}`;
};

// The permission box, as manual mode puts it up under the history in place of the input: a rule,
// what is asked ("Create file", "Edit file", "Bash command"), the code or the command between dashed
// rules, the question, and the choices, the one picked marked ❯ in lavender.
const askRows = (s: { name?: string; text: string; lines?: CodeLine[]; desc?: string }, pick: number, cwd: string, W: number): Row[] => {
  const name = s.name ?? "Bash";
  const bash = /^bash$/i.test(name);
  const edit = !bash && (s.lines ?? []).some((l) => l.op);
  const file = s.text.split("/").pop() ?? s.text;
  // The dashed rules are dividers, drawn dim as the CLI draws them; QC does not read them as text.
  const dash: Row = [{ s: "╌".repeat(W), c: CC.dash, deco: true }];
  const rows: Row[] = [[{ s: "─".repeat(W), c: CC.lavender }], [{ s: " " + (bash ? "Bash command" : edit ? "Edit file" : "Create file"), c: CC.lavender, b: true }]];
  if (bash) {
    if (s.desc) rows.push(...wrap([{ s: " " }], [{ s: s.desc, c: CC.grey }], W, 1));
    rows.push(dash, ...wrap([{ s: " " }], [{ s: s.text }], W, 1), dash, spare([{ s: " This command requires approval" }]), spare(blank()));
  } else rows.push([{ s: " " + cut(s.text, W - 2), c: CC.grey }], dash, ...codeRows(s.lines ?? [], W, edit ? 1 : 2), dash);
  rows.push(...wrap([{ s: " " }], [{ s: bash ? "Do you want to proceed?" : edit ? `Do you want to make this edit to ${file}?` : `Do you want to create ${file}?` }], W - 1, 1));
  const cmd = s.text.split(/\s+/).slice(0, 2).join(" ");
  const choices: Cell[][] = bash
    ? [[{ s: "Yes" }], [{ s: "Yes, and don't ask again for " }, { s: cmd, b: true }, { s: " commands in " }, { s: cwd, b: true }], [{ s: "Yes, and switch to auto mode" }, { s: " · auto mode handles these prompts for you", c: CC.grey }], [{ s: "No" }]]
    : [[{ s: "Yes" }], [{ s: "Yes, and switch to accept edits (auto-approve file edits and common file commands) for this session (shift+tab)" }], [{ s: "No" }]];
  choices.forEach((c, k) => {
    const on = k + 1 === pick;
    const lead: Cell[] = [{ s: on ? " ❯ " : "   ", c: CC.lavender }, { s: `${k + 1}. `, c: CC.grey }];
    rows.push(...wrap(lead, on ? c.map((x) => ({ ...x, c: x.c ?? CC.lavender })) : c, W - 1, 6));
  });
  rows.push(spare(blank()), spare([{ s: " Esc to cancel · Tab to amend", c: CC.grey }]));
  return rows;
};

// Plan mode's "Ready to code?", which takes the whole terminal: the plan between dashed rules (its
// title bold italic, a line ending in ":" a heading, `code` in lavender), then the question and the
// three ways on, the first picked.
const planRows = (s: { text: string; items?: string[] }, W: number): Row[] => {
  const body = (t: string): Cell[] => segs(t).map((g) => ({ s: g.s, c: g.code ? CC.lavender : undefined, b: g.bold }));
  const rows: Row[] = [
    [{ s: "▔".repeat(W), c: CC.lavender }],
    blank(),
    [{ s: "  " }, { s: "─".repeat(W - 4), c: CC.teal }],
    [{ s: "   Ready to code?", c: CC.lavender, b: true }],
    blank(),
    [{ s: "   Here is Claude's plan:" }],
    [{ s: "  " }, { s: "╌".repeat(W - 4), c: CC.dash, deco: true }],
  ];
  // The title, then a blank row (a heading brings its own).
  const heads = (line?: string) => !!line && /:$/.test(line.trim()) && !/^[-*]/.test(line.trim());
  if (s.text) rows.push(...wrap([{ s: "   " }], [{ s: s.text, b: true, i: true }], W - 2, 3), ...(heads(s.items?.[0]) ? [] : [blank()]));
  for (const line of s.items ?? []) {
    if (heads(line)) rows.push(blank(), [{ s: "   " }, { s: cut(line.trim().replace(/:$/, ""), W - 5), b: true }], blank());
    else rows.push(...wrap([{ s: "   " }], body(line), W - 2, /^\s*[-*] /.test(line) ? 5 : 3));
  }
  rows.push([{ s: "  " }, { s: "╌".repeat(W - 4), c: CC.dash, deco: true }], blank(), [{ s: "  " }, { s: "─".repeat(W - 4), c: CC.teal }]);
  rows.push(...wrap([{ s: "   " }], [{ s: "Claude has written up a plan and is ready to execute. Would you like to proceed?", c: CC.grey }], W - 2, 3), blank());
  rows.push(...wrap([{ s: "   ❯ ", c: CC.lavender }, { s: "1. ", c: CC.grey }], [{ s: "Yes, and use auto mode", c: CC.lavender }], W - 2, 8));
  rows.push(...wrap([{ s: "     " }, { s: "2. ", c: CC.grey }], [{ s: "Yes, manually approve edits" }], W - 2, 8));
  rows.push(...wrap([{ s: "     " }, { s: "3. ", c: CC.grey }], [{ s: "Tell Claude what to change", c: CC.grey }], W - 2, 8));
  return rows;
};

// When subagent `k` of `n` finishes: the first soon after launch, the rest spread over the beat.
const agentDone = (b: Beat, k: number, n: number) => b.t0 + 0.8 + ((b.t1 - b.t0 - 0.9) * (k + 1)) / Math.max(1, n);

// The footer under the input: the permission mode, in its colour.
const MODES: Record<string, Cell[]> = {
  auto: [{ s: "  ⏵⏵ auto mode on", c: CC.yellow }, { s: " (shift+tab to cycle)", c: CC.grey }],
  accept: [{ s: "  ⏵⏵ accept edits on", c: CC.violet }, { s: " (shift+tab to cycle)", c: CC.grey }],
  plan: [{ s: "  ⏸ plan mode on", c: CC.teal }, { s: " (shift+tab to cycle)", c: CC.grey }],
  manual: [{ s: "  ⏸ manual mode on", c: CC.grey }],
};

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
      welcome.push([{ s: "           " }, { s: "Claude Code", b: true, c: CC.fg }, ...(W >= 31 ? [{ s: " v2.1.323", c: CC.grey }] : [])]);
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
  let asking = null as { step: (typeof v.steps)[number]; t0: number } | null;
  let takeover = null as Row[] | null;
  // How far through the plan the reader is, 0 to 1: a plan taller than the window scrolls down to
  // its choices, as the terminal would.
  let reading = 0;
  // Subagents still out: their waiting line stands in for the working line.
  let waiting = false;
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
    // Subagents (2.1.323 launches them in the background): the launch with each task on a branch,
    // then each one's finish as it lands, and the waiting line until the last is in.
    if (s.type === "agents") {
      const items = s.items ?? [];
      const n = items.length;
      hist.push(blank(), [{ s: "⏺ ", c: CC.green }, { s: String(n), b: true }, { s: ` background agent${n === 1 ? "" : "s"} launched` }, ...(W >= 44 ? [{ s: " (↓ to manage)", c: CC.grey }] : [])]);
      // The branches join row to row, as box-drawing does; QC reads them as lines, not text.
      items.forEach((it, k) => hist.push([{ s: "   " }, { s: k === n - 1 ? "└" : "├", c: CC.grey, deco: true }, { s: " " }, { s: cut(it, W - 5), b: true }]));
      const done = items.filter((_, k) => time >= agentDone(b, k, n));
      done.forEach((it, k) => hist.push(blank(), ...wrap([{ s: "⏺ ", c: CC.green }], [{ s: `Agent "${it}" finished` }, { s: ` · ${Math.max(1, Math.round(agentDone(b, k, n) - b.t0 + 3))}s`, c: CC.grey }], W, 2)));
      if (done.length < n) {
        const left = n - done.length;
        hist.push(blank(), ...wrap([{ s: "✻ ", c: CC.grey }], [{ s: "Waiting for ", c: CC.grey }, { s: String(left), c: CC.grey, b: true }, { s: ` background agent${left === 1 ? "" : "s"} to finish`, c: CC.grey }], W, 2));
        waiting = true;
      }
      return;
    }
    // Plan mode's question takes the terminal until it is answered.
    if (s.type === "plan") {
      // Answered at the end of its beat, unless the script ends on it: then it holds on the choices.
      if (time < b.t1 || i === v.steps.length - 1) (takeover = planRows(s, W)), (reading = Math.min(1, Math.max(0, (time - b.t0 - 0.5) / Math.max(0.1, b.t1 - b.t0 - 1.3))));
      return;
    }
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
      // Asked first (manual mode): the call waits, its dot grey and still, while the box is up.
      const waiting = !!s.ask && time < b.t0 + askTime(s);
      if (waiting) asking = { step: s, t0: b.t0 };
      // The dot blinks while the tool runs, and turns green when it is done.
      const off = !done && !waiting && Math.floor((time - b.t0) * 2.4) % 2 === 1;
      hist.push(...wrap([{ s: "⏺ ", c: done ? CC.green : CC.grey, node: off ? <span style={{ opacity: 0 }}>⏺ </span> : undefined }], [{ s: name, b: true }, { s: `(${s.text})` }], W, 2));
      if (waiting) return;
      const lines = s.lines ?? [];
      const out = s.out ?? (lines.length ? [lines.some((l) => l.op) ? tally(lines) : `Wrote ${lines.length} line${lines.length === 1 ? "" : "s"} to ${s.text}`] : []);
      if (!done) hist.push([{ s: "  ⎿  Running…", c: CC.grey }]);
      else {
        out.forEach((o, k) => hist.push([{ s: k ? "     " : "  ⎿  ", c: CC.grey }, { s: cut(o, W - 5) }]));
        // What it wrote, or its diff, under the ⎿ line, as 2.1.323 shows them.
        if (lines.length) hist.push(...codeRows(lines, W, 6, lines.some((l) => l.op) && W >= 60 ? 6 : 0));
      }
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
    working = time >= sentAt && time < endAt && !asking && !waiting;
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
        MODES[v.mode ?? "auto"].map((c, k) => (k && W < 40 ? { ...c, s: "" } : c)),
      ]
    : [
        ...wrap([{ s: "› ", b: true }], text ? [{ s: text }] : [{ s: "Ask Codex to do anything", c: CX.dim }], W - 1, 2).map((r, k, all) => (k === all.length - 1 && text ? [...r, { s: " ", node: caret }] : r)),
        blank(),
        [{ s: "  " }, { s: cut(model, Math.min(24, W - 6)), c: CX.model }, ...(W >= 30 ? [{ s: " · " }, { s: cut(v.cwd, W - 7 - Math.min(24, model.length)), c: CX.path }] : [])],
        [{ s: "  " }, { s: "?", b: true }, { s: " for shortcuts", c: CX.dim }],
      ];
  // The permission box stands in for the input while it is up; the cursor moves to the choice
  // picked a moment before it is taken.
  if (asking) {
    const pick = (asking.step.pick ?? 1) > 1 && time > asking.t0 + 0.9 ? asking.step.pick ?? 1 : 1;
    return { welcome, hist, bottom: askRows(asking.step, pick, v.cwd, W), takeover, reading };
  }
  // Claude Code draws its menu above the input box, Codex just above its prompt line.
  return { welcome, hist, bottom: [...menuRows, ...input], takeover, reading };
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
        return s.takeover ? s.takeover.length <= g.rows : s.hist.length + s.bottom.filter((r) => !r.spare).length + 1 <= g.rows;
      });
    });
    // The script and the box decide it; `time` does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, shot.start, shot.end, winW, winH, box.panel]);
  const { pad, barH, rowH, cols: W, rows: maxRows } = grid(fs, winW, winH);
  const { welcome, hist, bottom: full, takeover, reading } = screen(v, beats, time, W);
  // A box taller than the window drops its spare rows (from the end) before anything else.
  let bottom = full;
  while (bottom.length > maxRows - 1 && bottom.some((r) => r.spare)) {
    const k = bottom.map((r) => !!r.spare).lastIndexOf(true);
    bottom = [...bottom.slice(0, k), ...bottom.slice(k + 1)];
  }
  // Still too tall (a permission box in a short window): its top scrolls off, as the terminal would
  // scroll, so the question and the choices stay in view.
  if (bottom.length > maxRows - 1) bottom = bottom.slice(bottom.length - (maxRows - 1));
  // The plan scrolls, eased, from its top to its choices.
  const over = takeover ? Math.max(0, takeover.length - maxRows) : 0;
  const top = Math.round(over * (reading < 0.5 ? 2 * reading * reading : 1 - (-2 * reading + 2) ** 2 / 2));

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
        <span key={k} data-qc={c.deco ? "ambient" : undefined} style={{ color: c.c, fontWeight: c.b ? 700 : 400, ...(c.i ? { fontStyle: "italic" } : {}), ...(c.bg ? { background: c.bg } : {}) }}>{c.node ?? c.s}</span>
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
          {takeover ? (
            // Plan mode's question fills the terminal from the top.
            takeover.slice(top, top + maxRows).map((r, k) => <RowView key={`p${k + top}`} r={r} />)
          ) : (
            <>
              <div style={{ position: "relative" }}>
                {clawdOn && <Clawd fs={fs} time={time} />}
                {shown.map((r, k) => <RowView key={k + drop} r={r} />)}
              </div>
              <div style={{ flex: 1 }} />
              {bottom.map((r, k) => <RowView key={`b${k}`} r={r} />)}
            </>
          )}
        </div>
      </Window>
    </Stage>
  );
};
