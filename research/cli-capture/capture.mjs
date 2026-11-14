// Runs Claude Code in a virtual terminal, drives it with a script, and snaps the screen: every
// cell's text and 24-bit colour, as JSON and as an HTML page to look at.
//   node capture.mjs <script.json> <outdir>
// A script is a list of steps: { "send": "text" }, { "key": "enter|tab|shift-tab|esc|up|down|1|2" },
// { "wait": ms }, { "until": "regex", "timeout": ms }, { "snap": "name" }.
import pty from "node-pty";
import xterm from "@xterm/headless";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , scriptFile, outDir] = process.argv;
const script = JSON.parse(readFileSync(scriptFile, "utf8"));
mkdirSync(outDir, { recursive: true });
const COLS = script.cols ?? 100, ROWS = script.rows ?? 42;
const project = script.cwd ?? mkdtempSync(join(tmpdir(), "cc-demo-"));
for (const [name, body] of Object.entries(script.files ?? {})) writeFileSync(join(project, name), body);

const env = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", FORCE_COLOR: "3" };
for (const k of Object.keys(env)) if (k.startsWith("CLAUDECODE") || k.startsWith("CLAUDE_CODE_ENTRYPOINT") || k === "CLAUDE_CODE_SSE_PORT" || k.startsWith("CLAUDE_CODE_CHILD")) delete env[k];

const term = new xterm.Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true, scrollback: 2000 });
const args = ["--permission-mode", script.mode ?? "default", "--model", script.model ?? "haiku", "--settings", JSON.stringify({ statusLine: { type: "command", command: "true" } })];
const p = pty.spawn("claude", args, { name: "xterm-256color", cols: COLS, rows: ROWS, cwd: project, env });
p.onData((d) => term.write(d));

const KEYS = { enter: "\r", tab: "\t", "shift-tab": "\x1b[Z", esc: "\x1b", up: "\x1b[A", down: "\x1b[B", "1": "1", "2": "2", "3": "3", space: " " };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

// The visible screen, as rows of runs { s, fg, bg, b, d, i, u }.
function screen() {
  const buf = term.buffer.active;
  const rows = [];
  for (let y = 0; y < ROWS; y++) {
    const line = buf.getLine(buf.viewportY + y);
    const runs = [];
    if (line)
      for (let x = 0; x < COLS; x++) {
        const c = line.getCell(x);
        if (!c || c.getWidth() === 0) continue;
        const fg = c.isFgRGB() ? hex(c.getFgColor()) : c.isFgPalette() ? `p${c.getFgColor()}` : null;
        const bg = c.isBgRGB() ? hex(c.getBgColor()) : c.isBgPalette() ? `p${c.getBgColor()}` : null;
        const st = { fg, bg, b: !!c.isBold(), d: !!c.isDim(), i: !!c.isItalic(), u: !!c.isUnderline(), v: !!c.isInverse() };
        const ch = c.getChars() || " ";
        const last = runs[runs.length - 1];
        if (last && JSON.stringify({ ...last, s: 0 }) === JSON.stringify({ ...st, s: 0 })) last.s += ch;
        else runs.push({ s: ch, ...st });
      }
    rows.push(runs);
  }
  return rows;
}
const text = () => screen().map((r) => r.map((c) => c.s).join("")).join("\n");

const PAL = ["#000000", "#cd3131", "#0dbc79", "#e5e510", "#2472c8", "#bc3fbc", "#11a8cd", "#e5e5e5", "#666666", "#f14c4c", "#23d18b", "#f5f543", "#3b8eea", "#d670d6", "#29b8db", "#ffffff"];
const col = (c) => (c == null ? null : c.startsWith("p") ? PAL[+c.slice(1)] ?? "#888" : c);
function snap(name) {
  const rows = screen();
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ cols: COLS, rows }, null, 1));
  writeFileSync(join(outDir, `${name}.txt`), rows.map((r) => r.map((c) => c.s).join("")).join("\n"));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = rows
    .map((r) => `<div>${r.map((c) => { let fg = col(c.fg) ?? "#E8E8E8", bg = col(c.bg); if (c.v) [fg, bg] = [bg ?? "#161616", fg]; return `<span style="color:${fg};${bg ? `background:${bg};` : ""}${c.b ? "font-weight:700;" : ""}${c.d ? "opacity:.6;" : ""}${c.i ? "font-style:italic;" : ""}">${esc(c.s)}</span>`; }).join("")}</div>`)
    .join("");
  writeFileSync(join(outDir, `${name}.html`), `<!doctype html><meta charset=utf-8><body style="margin:0;background:#161616;font:15px/1.3 Menlo,monospace;white-space:pre;padding:12px">${html}</body>`);
  console.log(`snap ${name}`);
}

for (const step of script.steps) {
  if (step.send) for (const ch of step.send) (p.write(ch), await sleep(12));
  if (step.key) p.write(KEYS[step.key] ?? step.key);
  if (step.wait) await sleep(step.wait);
  if (step.until) {
    const re = new RegExp(step.until, "m"), end = Date.now() + (step.timeout ?? 60000);
    while (!re.test(text()) && Date.now() < end) await sleep(300);
    if (!re.test(text())) console.log(`timeout waiting for ${step.until}`);
  }
  if (step.snap) (await sleep(400), snap(step.snap));
}
writeFileSync(join(outDir, "_last.txt"), text());
p.kill();
console.log(`project ${project}`);
process.exit(0);
