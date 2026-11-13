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
  if (longest > CODE.chars) out.push(`a line is ${longest} characters; the editor sets ${CODE.chars} at most at a readable size, so break it`);
  return out;
};

// ---------- the window ----------

// The editor's geometry, in the box it is given. Monospace advance: 0.61 em (Menlo, SF Mono).
export const CODE = { em: 0.61, max: 38, min: 24, chars: 48, fill: 0.62, row: 1.6 };
export const codeLayout = (v: Pick<Code, "lines" | "start">, w: number, h: number) => {
  const diff = isDiff(v);
  const n = v.lines.length;
  const numbers = v.start + v.lines.filter((l) => l.diff !== "del").length - 1;
  const digits = Math.max(2, String(numbers).length);
  const chars = Math.max(12, ...v.lines.map((l) => l.text.replace(/\t/g, "  ").length));
  // Columns: the numbers, a space, the sign (diff only), then the code.
  const cols = digits + 1.5 + (diff ? 2 : 0) + chars;
  const padX = 28;
  const byWidth = (w - 2 * padX) / (cols * CODE.em);
  // Height: the tab bar (2.1 em), the padding above and below (0.7 em each), the rows.
  const byHeight = h / (2.1 + 1.4 + n * CODE.row);
  const font = Math.floor(Math.max(CODE.min, Math.min(CODE.max, byWidth, byHeight)));
  const bar = Math.round(Math.max(64, font * 2.1));
  const padY = Math.round(font * 0.7);
  const row = Math.round(font * CODE.row);
  const need = bar + 2 * padY + n * row;
  // An editor window keeps its size with room below the last line, so the panel never looks empty.
  const height = Math.min(h, Math.max(need, CODE.fill * h));
  const gutter = Math.round((digits + 1.5) * CODE.em * font);
  const sign = diff ? Math.round(2 * CODE.em * font) : 0;
  return { font, bar, padX, padY, row, gutter, sign, width: w, height, x: 0, y: (h - height) / 2, fits: font * CODE.em * cols + 2 * padX <= w + 0.5 && need <= h + 0.5 };
};
