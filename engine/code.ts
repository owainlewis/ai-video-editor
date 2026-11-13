// The `code` visual's engine (2026-11-13): an editor window and a diff view for software engineering
// moments. The plan supplies every line; nothing here writes code. Pure: the tokenizer that colours
// it, when each line types or changes, and the window's geometry. Drawn by effects/clean/code.tsx.
import type { VisualSpec } from "./schema.ts";

export type Code = Extract<VisualSpec, { kind: "code" }>;
export type Lang = "ts" | "js" | "py" | "json" | "bash" | "text";
export type TokKind = "plain" | "kw" | "str" | "num" | "com" | "fn" | "type" | "prop" | "var";
export type Tok = { text: string; kind: TokKind };

// The language from the file's name when the plan leaves it out.
export const langOf = (v: Pick<Code, "file" | "lang">): Lang => {
  if (v.lang) return v.lang;
  const ext = v.file.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? "";
  if (["ts", "tsx", "mts", "cts"].includes(ext)) return "ts";
  if (["js", "jsx", "mjs", "cjs"].includes(ext)) return "js";
  if (ext === "py") return "py";
  if (ext === "json") return "json";
  if (["sh", "bash", "zsh"].includes(ext) || /^(terminal|shell|bash|zsh)$/i.test(v.file)) return "bash";
  return "text";
};

const KW: Record<Lang, Set<string>> = {
  ts: new Set("import export from as default const let var function return if else for while do switch case break continue new class extends implements interface type enum async await try catch finally throw typeof instanceof in of void delete yield public private protected readonly static declare namespace keyof satisfies".split(" ")),
  js: new Set("import export from as default const let var function return if else for while do switch case break continue new class extends async await try catch finally throw typeof instanceof in of void delete yield static".split(" ")),
  py: new Set("def class return if elif else for while in not and or is import from as with try except finally raise lambda yield pass break continue global nonlocal async await assert del".split(" ")),
  json: new Set(),
  bash: new Set("if then else elif fi for in do done while until case esac function export local return set unset source".split(" ")),
  text: new Set(),
};
const CONST: Record<Lang, Set<string>> = {
  ts: new Set("true false null undefined this super".split(" ")),
  js: new Set("true false null undefined this super".split(" ")),
  py: new Set("True False None self cls".split(" ")),
  json: new Set("true false null".split(" ")),
  bash: new Set(),
  text: new Set(),
};

// One line into coloured runs. Lines are tokenized on their own: a snippet on screen is a few lines,
// and a comment or string that spans lines is rare enough to colour by its first characters.
export const tokenize = (line: string, lang: Lang): Tok[] => {
  if (lang === "text") return line ? [{ text: line, kind: "plain" }] : [];
  const out: Tok[] = [];
  const push = (text: string, kind: TokKind) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  const trimmed = line.trimStart();
  // A block comment's middle lines (" * ...") and its edges.
  if ((lang === "ts" || lang === "js") && /^(\/\*|\*)/.test(trimmed)) return [{ text: line, kind: "com" }];
  let i = 0;
  // Bash: the first word of a command is the command.
  let command = lang === "bash";
  while (i < line.length) {
    const rest = line.slice(i);
    const c = line[i];
    // Comments.
    if (((lang === "ts" || lang === "js") && rest.startsWith("//")) || ((lang === "py" || lang === "bash") && c === "#" && (lang === "py" || i === 0 || /\s/.test(line[i - 1])))) {
      push(rest, "com");
      break;
    }
    // Strings, to their closing quote on this line.
    const q = lang === "py" ? rest.match(/^[rbfu]{0,2}("""|'''|"|')/i) : /^["'`]/.test(c) ? [c, c] : null;
    if (q && (lang !== "json" || c === '"')) {
      const open = q[0], quote = q[1] ?? q[0];
      let j = open.length;
      while (j < rest.length && rest.slice(j, j + quote.length) !== quote) j += rest[j] === "\\" ? 2 : 1;
      const s = rest.slice(0, Math.min(rest.length, j + quote.length));
      // A JSON key is a string followed by a colon.
      push(s, lang === "json" && /^\s*:/.test(rest.slice(s.length)) ? "prop" : "str");
      i += s.length;
      command = false;
      continue;
    }
    // Numbers.
    const num = rest.match(/^(0x[\da-f]+|\d[\d_]*(\.\d+)?(e[+-]?\d+)?)/i);
    if (num && !/[\w$]/.test(line[i - 1] ?? "")) {
      push(num[0], "num");
      i += num[0].length;
      continue;
    }
    // Bash variables and flags.
    if (lang === "bash") {
      const v = rest.match(/^\$(\{[^}]*\}|[\w@?#*]+)/);
      if (v) { push(v[0], "var"); i += v[0].length; continue; }
      const flag = rest.match(/^--?[\w-]+/);
      if (flag && (i === 0 || /\s/.test(line[i - 1]))) { push(flag[0], "prop"); i += flag[0].length; continue; }
      if (/[|;&]/.test(c)) { push(c, "plain"); i++; command = true; continue; }
    }
    // Python decorators.
    if (lang === "py" && c === "@") {
      const d = rest.match(/^@[\w.]+/);
      if (d) { push(d[0], "fn"); i += d[0].length; continue; }
    }
    // Words.
    const word = rest.match(lang === "bash" ? /^[\w./~-]+/ : /^[A-Za-z_$][\w$]*/);
    if (word) {
      const w = word[0];
      const after = line.slice(i + w.length);
      const before = out.map((t) => t.text).join("").trimEnd();
      const kind: TokKind =
        lang === "bash" ? (command && !KW.bash.has(w) ? "fn" : KW.bash.has(w) ? "kw" : "plain")
        : KW[lang].has(w) ? "kw"
        : CONST[lang].has(w) ? "num"
        : /^\s*\(/.test(after) || /\b(def|function)$/.test(before) ? "fn"
        : /\bclass$/.test(before) || ((lang === "ts" || lang === "py") && /^[A-Z]/.test(w)) ? "type"
        : "plain";
      push(w, kind);
      i += w.length;
      if (lang === "bash" && !KW.bash.has(w)) command = false;
      continue;
    }
    push(c, "plain");
    i++;
  }
  return out;
};

// ---------- the parts and their times ----------

// What lands, in the order of the visual's anchors: every line, then every mark.
export const codeAnchors = (v: Code) => [...v.lines.map((l) => l.at), ...v.marks.map((m) => m.at)];
// Marks are searched from the shot's start again: a range is often named before its lines type on.
export const codeResets = (v: Code) => (v.marks.length ? [v.lines.length] : []);
export const isDiff = (v: Pick<Code, "lines">) => v.lines.some((l) => l.diff);

// Typing speed: brisk enough that a line is never a wait, slow enough to read the motion.
export const typeSecs = (chars: number) => Math.min(0.7, Math.max(0.2, chars / 48));
const CHANGE = 0.4; // a struck or added line's move, and the least time to the next change

// When each line starts and finishes landing, and when each mark sweeps in. A plain view types its
// lines one after another: a line starts on its word (`times`), never before the line above it has
// typed. A diff shows the file as it was; each change lands on its word, at least CHANGE after the
// change before it. Lines with no word of their own follow the line before.
export const codeBeats = (v: Code, start: number, times: number[] = []) => {
  const diff = isDiff(v);
  let prev = start + 0.15;
  const lines = v.lines.map((l, i) => {
    const given = times[i];
    if (diff && !l.diff) return { t0: start, t1: start };
    // Shown at once: on its own word, else from the start.
    if (!diff && !v.typed) {
      const t0 = l.at && given !== undefined ? Math.max(start, given) : start;
      return { t0, t1: t0 };
    }
    const t0 = Math.max(given ?? prev, prev);
    const t1 = diff ? t0 + 0.35 : t0 + typeSecs(l.text.length);
    prev = diff ? t0 + CHANGE : t1 + 0.04;
    return { t0, t1 };
  });
  const last = Math.max(start, ...lines.map((l) => l.t1));
  const marks = v.marks.map((m, j) => times[v.lines.length + j] ?? last + 0.4 + j * 0.8);
  return { lines, marks };
};
// The plan's times as the view really plays them (for checks, sounds and the library).
export const codeTimes = (v: Code, start: number, times: number[]) => {
  const b = codeBeats(v, start, times);
  return [...b.lines.map((l) => l.t0), ...b.marks];
};
// Every moment something lands: each line as it starts, each mark.
export const codeMoments = (v: Code, start: number, times: number[] = []) => {
  const b = codeBeats(v, start, times);
  const diff = isDiff(v);
  return [...b.lines.filter((_, i) => !diff || v.lines[i].diff).map((l) => l.t0), ...b.marks].sort((a, c) => a - c);
};

export const codeIssues = (v: Code): string[] => {
  const out: string[] = [];
  v.marks.forEach((m, j) => {
    const to = m.to ?? m.from;
    if (m.from > v.lines.length || to > v.lines.length || to < m.from) out.push(`mark ${j + 1} runs from line ${m.from} to ${to}, outside the ${v.lines.length} lines in the plan`);
  });
  const longest = Math.max(...v.lines.map((l) => l.text.replace(/\t/g, "  ").length));
  const most = codeChars(v);
  if (longest > most) out.push(`a line is ${longest} characters; the editor sets ${most} at most at a readable size${isDiff(v) ? " in a diff" : ""}, so break it`);
  return out;
};

// ---------- the window ----------

// The editor's geometry. Like the app windows (effects/apps/kit.tsx), the window is its box, edge to
// edge, and the camera picks one type size for the shot: the largest at which the longest line and
// every line fit, never under 30 px (so code reads on a phone), at most 46 on a reel's panel. A wide
// (YouTube) frame lays its panel out 900 px wide and scales it up by about 1.3 (effects/Wide.tsx), so
// there 24 to 38 px in the box is 31 to 49 in the frame. A file too long for its box at the least size
// scrolls, and the view pans to the line being typed, changed or marked (`codePans`).
// `em`: the monospace's advance (SF Mono and JetBrains Mono: 0.6). `row`: the line height.
// `chars`: the longest line a 960 px box sets at 30 px; a diff's sign column takes two of them.
export const CODE = { em: 0.6, min: 30, max: 46, wideMin: 24, wideMax: 38, chars: 46, row: 1.5 };
export const codeChars = (v: Pick<Code, "lines">) => CODE.chars - (isDiff(v) ? 2 : 0);

// The parts' sizes at body size `f`: the tab bar, the status bar, the side and top padding.
const parts = (f: number) => ({
  bar: Math.round(Math.max(60, f * 1.9)),
  status: Math.round(Math.max(52, f * 1.6)),
  padX: Math.round(f * 0.7),
  padY: Math.round(f * 0.6),
  row: Math.round(f * CODE.row),
});

export type CodeLayout = ReturnType<typeof codeLayout>;
export const codeLayout = (v: Pick<Code, "lines" | "start">, w: number, h: number, opts: { wide?: boolean } = {}) => {
  const diff = isDiff(v);
  const n = v.lines.length;
  const numbers = v.start + v.lines.filter((l) => l.diff !== "del").length - 1;
  const digits = Math.max(2, String(numbers).length);
  const chars = Math.max(12, ...v.lines.map((l) => l.text.replace(/\t/g, "  ").length));
  // Columns: the numbers and a gap, the sign (diff only), then the code.
  const gutterCols = digits + 1.4;
  const signCols = diff ? 1.6 : 0;
  const cols = gutterCols + signCols + chars;
  const fitsW = (f: number) => cols * CODE.em * f + 2 * parts(f).padX <= w + 0.5;
  const need = (f: number) => { const p = parts(f); return p.bar + p.status + 2 * p.padY + n * p.row; };
  const lo = opts.wide ? CODE.wideMin : CODE.min;
  const hi = Math.floor(Math.max(lo, Math.min(opts.wide ? CODE.wideMax : CODE.max, h / 12)));
  let font = lo;
  for (let f = hi; f >= lo; f--)
    if (fitsW(f) && need(f) <= h + 0.5) { font = f; break; }
  const { bar, status, padX, padY, row } = parts(font);
  // The code's viewport: whole rows only, so a file that scrolls never rests on half a line.
  const room = h - bar - status - 2 * padY;
  const scrolls = n * row > room + 0.5;
  const view = scrolls ? Math.max(row, Math.floor(room / row) * row) : room;
  return {
    font, bar, status, padX, padY, row, view, scrolls,
    gutter: Math.round(gutterCols * CODE.em * font),
    sign: Math.round(signCols * CODE.em * font),
    width: w, height: h, x: 0, y: 0,
    fits: fitsW(font),
  };
};

// The camera's pans for a file taller than its viewport: before each line types, each change lands
// and each mark sweeps in, the view moves the least it can to show that line or range whole (a range
// taller than the view shows from its top). Offsets are whole rows. Before an added line lands its
// row is closed, so the rows above it are measured as they are at that moment.
export const codePans = (v: Pick<Code, "lines" | "marks" | "typed">, L: Pick<CodeLayout, "row" | "view" | "scrolls">, b: ReturnType<typeof codeBeats>, start: number) => {
  if (!L.scrolls) return [];
  const diff = isDiff(v);
  const top = (i: number, at: number) => L.row * v.lines.slice(0, i).filter((l, j) => !(l.diff === "add" && b.lines[j].t0 > at + 1e-6)).length;
  const lead = 0.3; // the pan arrives as the thing lands, not after it
  const asks: { t: number; from: number; to: number; mark?: boolean }[] = [];
  v.lines.forEach((l, i) => {
    const { t0 } = b.lines[i];
    if (diff ? !!l.diff : v.typed || (l.at && t0 > start)) asks.push({ t: Math.max(start, t0 - lead), from: i, to: i });
  });
  v.marks.forEach((m, j) => asks.push({ t: Math.max(start, b.marks[j] - lead), from: m.from - 1, to: (m.to ?? m.from) - 1, mark: true }));
  asks.sort((a, c) => a.t - c.t);
  let y = 0;
  return asks.map((a) => {
    const at = a.t + lead;
    const y0 = top(a.from, at), y1 = top(a.to, at) + L.row;
    // A mark out of view comes to the middle, with its lines around it, as an editor reveals a line.
    if (y1 - y0 > L.view) y = y0;
    else if (a.mark && (y0 < y || y1 > y + L.view)) y = Math.round(((y0 + y1) / 2 - L.view / 2) / L.row) * L.row;
    else if (y0 < y) y = y0;
    else if (y1 > y + L.view) y = Math.ceil((y1 - L.view) / L.row) * L.row;
    y = Math.max(0, Math.min(y, top(v.lines.length, at) - L.view));
    return { t: a.t, y };
  });
};
