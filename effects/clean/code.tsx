// The `code` visual: an editor window in a light theme (GitHub Light's colours), drawn from the plan's
// lines by engine/code.ts. The window is its box, edge to edge, as the app windows are; the code is set
// at one size for the shot, the largest that fits (`codeLayout`). Lines type on with a caret; in a diff
// the file shows as it was, a removed line is struck red and an added one slides in green; a marked
// range lights on its word. A file too long for its box pans to the line that is landing.
import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import type { ResolvedVisual } from "../../engine/schema";
import { CODE, codeBeats, codeLayout, codePans, isDiff, langOf, tokenize, type TokKind } from "../../engine/code";
import { inView, pan } from "../apps/kit";
import { k, move, SANS, usePalette } from "./kit";
import { MONO } from "./text";

type CodeV = Extract<ResolvedVisual, { kind: "code" }>;

const SYNTAX: Record<TokKind, string> = { plain: "#1F2328", kw: "#CF222E", str: "#0A3069", num: "#0550AE", com: "#6E7781", fn: "#8250DF", type: "#953800", prop: "#0550AE", var: "#953800" };
const UI = { window: "#FFFFFF", bar: "#F6F8FA", border: "#D0D7DE", number: "#6E7781", dir: "#57606A", status: "#57606A", del: "#FFEBE9", delInk: "#CF222E", add: "#DAFBE1", addInk: "#1A7F37" };
const LANG_DOT: Record<string, string> = { ts: "#3178C6", js: "#E0B100", py: "#3572A5", json: "#8A6D3B", bash: "#3FB950", text: "#8C959F" };
// The language's name in the status bar, as the editor names it.
const LANG_NAME: Record<string, string> = { ts: "TypeScript", tsx: "TypeScript JSX", js: "JavaScript", jsx: "JavaScript JSX", py: "Python", json: "JSON", bash: "Shell Script", text: "Plain Text" };

export const CodeView: React.FC<{ v: CodeV; time: number; start: number; w: number; h: number }> = ({ v, time: t, start, w, h }) => {
  const pal = usePalette();
  const cfg = useVideoConfig();
  const wide = cfg.width > cfg.height;
  const L = useMemo(() => codeLayout(v, w, h, { wide }), [v, w, h, wide]);
  const lang = langOf(v);
  const toks = useMemo(() => v.lines.map((l) => tokenize(l.text.replace(/\t/g, "  "), lang)), [v.lines, lang]);
  const b = useMemo(() => codeBeats(v, start, v.times ?? []), [v, start]);
  const pans = useMemo(() => codePans(v, L, b, start), [v, L, b, start]);
  const scroll = Math.round(pan(t, pans, 0.45));
  const diff = isDiff(v);
  const f = L.font, cw = f * CODE.em;
  const tab = Math.max(26, Math.round(f * 0.8));
  const small = Math.max(26, Math.round(f * 0.72));
  const dot = Math.round(Math.max(16, f * 0.5));
  const slash = v.file.lastIndexOf("/");
  const [dir, base] = slash >= 0 ? [v.file.slice(0, slash + 1), v.file.slice(slash + 1)] : ["", v.file];
  // Each row's height now: an added line opens its row as it lands.
  const heights = v.lines.map((l, i) => (l.diff === "add" ? L.row * move(t, b.lines[i].t0, 0.35) : L.row));
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, x) => a + x, 0));
  // Line numbers in the new file: removed lines have none.
  let n = v.start - 1;
  const numbers = v.lines.map((l) => (l.diff === "del" ? "" : String(++n)));
  // The live mark: the newest one that has landed, fading as the next one lands.
  const marks = v.marks.map((m, j) => ({ ...m, to: m.to ?? m.from, t: b.marks[j], end: b.marks[j + 1] ?? Infinity }));
  const lit = (i: number) => marks.some((m) => t >= m.t && t < m.end && i + 1 >= m.from && i + 1 <= m.to);
  const typing = !diff && v.typed && b.lines.findIndex((l) => t >= l.t0 && t < l.t1 + 0.5);
  const typedChars = (i: number) => {
    const { t0, t1 } = b.lines[i];
    return Math.floor(v.lines[i].text.length * Math.min(1, Math.max(0, (t - t0) / Math.max(0.01, t1 - t0))));
  };
  // The status bar's caret: where the newest line typed or changed has left it.
  const cur = v.lines.reduce((c, l, i) => ((diff ? !!l.diff : v.typed || !!l.at) && t >= b.lines[i].t0 ? i : c), -1);
  const ln = cur < 0 ? v.start : Number(numbers[cur] || numbers.slice(cur).find(Boolean) || v.start);
  const col = cur < 0 ? 1 : diff ? (v.lines[cur].diff === "del" ? 1 : v.lines[cur].text.length + 1) : (v.typed ? typedChars(cur) : v.lines[cur].text.length) + 1;
  const indent = Math.min(...v.lines.map((l) => l.text.match(/^ +/)?.[0].length ?? Infinity));
  const ext = v.file.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? "";
  const langName = LANG_NAME[ext === "tsx" || ext === "jsx" ? ext : lang];
  const enter = k(t, start, 0.3);
  return (
    <div
      style={{
        position: "absolute",
        left: L.x,
        top: L.y,
        width: L.width,
        height: L.height,
        borderRadius: 22,
        background: UI.window,
        border: `2px solid ${UI.border}`,
        boxShadow: pal.name === "light" ? "0 24px 60px rgba(18,58,46,0.10)" : "0 24px 60px rgba(0,0,0,0.35)",
        overflow: "hidden",
        boxSizing: "border-box",
        opacity: enter,
        transform: enter < 1 ? `translateY(${Math.round((1 - enter) * 20)}px)` : undefined,
      }}
    >
      {/* The title bar: the window's three dots, then the file's tab. */}
      <div style={{ height: L.bar, background: UI.bar, borderBottom: `2px solid ${UI.border}`, display: "flex", alignItems: "stretch", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(dot * 0.75), padding: `0 ${Math.round(dot * 1.6)}px` }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: dot, height: dot, borderRadius: dot, background: c }} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(tab * 0.55), padding: `0 ${Math.round(tab * 1.1)}px`, background: UI.window, borderLeft: `2px solid ${UI.border}`, borderRight: `2px solid ${UI.border}`, borderTop: `4px solid ${pal.accent}`, marginBottom: -2 }}>
          <div style={{ width: Math.round(tab * 0.55), height: Math.round(tab * 0.55), borderRadius: 4, background: LANG_DOT[lang] }} />
          <div style={{ fontFamily: SANS, fontSize: tab, fontWeight: 500, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            {dir && <span style={{ color: UI.dir }}>{dir}</span>}
            <span style={{ color: SYNTAX.plain }}>{base}</span>
          </div>
        </div>
      </div>

      {/* The code's viewport: whole rows; a long file pans inside it. */}
      <div style={{ position: "relative", marginTop: L.padY, height: L.view, overflow: L.scrolls ? "hidden" : "visible" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, padding: `0 ${L.padX}px`, transform: scroll ? `translateY(${-scroll}px)` : undefined }}>
          {/* The marked range: a band behind its lines that sweeps in on its word. */}
          {marks.map((m, j) => {
            const p = k(t, m.t, 0.3) * (Number.isFinite(m.end) ? 1 - k(t, m.end, 0.25) : 1);
            if (p <= 0) return null;
            const top = tops[m.from - 1], height = tops[m.to - 1] + heights[m.to - 1] - tops[m.from - 1];
            return (
              <div key={j} style={{ position: "absolute", left: 0, top, width: "100%", height, opacity: p }}>
                <div style={{ position: "absolute", inset: 0, background: pal.name === "light" ? "#E4F0E8" : "#E6F0EA", transform: `scaleX(${k(t, m.t, 0.3)})`, transformOrigin: "left" }} />
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: pal.accent }} />
              </div>
            );
          })}
          {v.lines.map((l, i) => {
            const { t0, t1 } = b.lines[i];
            const shown = diff ? (l.diff === "add" ? t >= t0 : true) : t >= t0;
            const struck = l.diff === "del" ? k(t, t0, 0.3) : 0;
            const added = l.diff === "add" ? move(t, t0, 0.35) : 0;
            const chars = diff || !v.typed ? l.text.length : typedChars(i);
            // The words a typed line shows so far, run by run.
            let left = chars;
            const runs = toks[i].map((tk) => { const s = tk.text.slice(0, Math.max(0, left)); left -= tk.text.length; return { ...tk, text: s }; }).filter((tk) => tk.text);
            const tint = l.diff === "del" ? struck : l.diff === "add" ? added : 0;
            // A row the pan has taken past the viewport's edge fades, so no line is seen cut.
            const seen = L.scrolls ? inView(tops[i], heights[i], scroll, L.view, L.row) : 1;
            return (
              <div key={i} style={{ position: "relative", height: heights[i], display: "flex", alignItems: "center", fontFamily: MONO, fontSize: f, whiteSpace: "pre", fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "calt" 0', opacity: seen }}>
                {tint > 0 && <div style={{ position: "absolute", left: -L.padX, right: -L.padX, top: 0, bottom: 0, background: l.diff === "del" ? UI.del : UI.add, opacity: tint }} />}
                {shown && (
                  <>
                    <div style={{ position: "relative", width: L.gutter, flex: "none", paddingRight: cw * 1.4, boxSizing: "border-box", textAlign: "right", color: lit(i) ? SYNTAX.plain : UI.number, fontWeight: lit(i) ? 700 : 400 }}>{numbers[i]}</div>
                    {diff && <div style={{ position: "relative", width: L.sign, flex: "none", color: l.diff === "del" ? UI.delInk : UI.addInk, fontWeight: 700, opacity: tint }}>{l.diff === "del" ? "-" : l.diff === "add" ? "+" : ""}</div>}
                    <div style={{ position: "relative", opacity: l.diff === "add" ? Math.min(1, Math.max(0, (added - 0.6) / 0.4)) : l.diff === "del" ? 1 - 0.35 * struck : 1, transform: l.diff === "add" && added < 1 ? `translateX(${Math.round((1 - added) * -36)}px)` : undefined }}>
                      {runs.map((r, j) => <span key={j} style={{ color: SYNTAX[r.kind] }}>{r.text}</span>)}
                      {/* The caret while a line types, and for a moment after. */}
                      {typing === i && <span style={{ display: "inline-block", width: Math.max(3, Math.round(f * 0.1)), height: Math.round(f * 1.1), marginLeft: 1, verticalAlign: "middle", background: pal.accent, opacity: t < t1 || Math.floor(t * 3) % 2 ? 1 : 0 }} />}
                      {struck > 0 && <div style={{ position: "absolute", left: -4, top: "50%", height: Math.max(3, f * 0.09), marginTop: -Math.max(1.5, f * 0.045), width: `calc(${struck * 100}% + 8px)`, background: UI.delInk, borderRadius: 2 }} />}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* The status bar: where the caret is, the indent and the language. */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: L.status, background: UI.bar, borderTop: `2px solid ${UI.border}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: Math.round(small * 1.3), padding: `0 ${L.padX + Math.round(small * 0.4)}px`, fontFamily: SANS, fontSize: small, color: UI.status, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        <span>Ln {ln}, Col {col}</span>
        {Number.isFinite(indent) && <span>Spaces: {indent}</span>}
        <span>{langName}</span>
      </div>
    </div>
  );
};
