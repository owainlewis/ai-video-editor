// The prompt bar (`prompt`): its words wrapped to the bar, and when each part lands. Pure, so the
// renderer (effects/clean/prompt.tsx), the sound and the tests agree.
import type { VisualSpec } from "./schema.ts";
import { typeTime } from "./apps.ts";
import { textWidth } from "./flow.ts";

type Prompt = Extract<VisualSpec, { kind: "prompt" }>;

// The measures, in the 960 px design space the view scales to its box. A prompt is a composer: a
// text area of at least `minLines`, then a toolbar row with the product's logo on the left and the
// send button on the right. A search is a pill under a large logo, as a search page sets it.
export const PROMPT = { width: 960, pad: 44, size: 48, lead: 1.3, icon: 56, gap: 26, send: 68, toolbar: 104, logo: 52, minLines: 4, minSize: 34, maxLines: 4, pill: 148, searchLogo: 180, searchGap: 64 };

// The text as typed (no asterisks), and where the *marked* phrase sits in it.
export const promptText = (text: string) => {
  const plain = text.replace(/\*/g, "");
  const m = /\*([^*]+)\*/.exec(text);
  const from = m ? text.slice(0, m.index).replace(/\*/g, "").length : -1;
  return { plain, mark: m ? { from, to: from + m[1].length } : undefined };
};

// Greedy lines on spaces at `size`, as the browser wraps them. Each line keeps its trailing space, so
// the lines join back to the text and a character index maps to one line.
export const promptLines = (plain: string, size: number, width: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of plain.split(/(?<= )/)) {
    if (line && textWidth((line + word).trimEnd(), size, false) > width) {
      lines.push(line);
      line = "";
    }
    line += word;
  }
  return [...lines, line];
};

// The type size and lines: a search field is one line, shrinking to fit; a prompt box wraps.
export const promptLayout = (v: Prompt) => {
  const { plain } = promptText(v.text);
  const inner = PROMPT.width - PROMPT.pad * 2 - (v.search ? PROMPT.icon + PROMPT.gap : 0);
  if (v.search) {
    let size = PROMPT.size;
    while (size > PROMPT.minSize && textWidth(plain, size, false) > inner) size -= 1;
    const height = (v.app ? PROMPT.searchLogo + PROMPT.searchGap : 0) + PROMPT.pill;
    return {
      size,
      lines: [plain],
      inner,
      height,
      fits: textWidth(plain, size, false) <= inner,
    };
  }
  const lines = promptLines(plain, PROMPT.size, inner);
  const rows = Math.max(lines.length, PROMPT.minLines);
  const height = PROMPT.pad + rows * PROMPT.size * PROMPT.lead + PROMPT.toolbar;
  return {
    size: PROMPT.size,
    lines,
    inner,
    height,
    fits: lines.length <= PROMPT.maxLines,
  };
};

export const promptAnchors = (v: Prompt) => [v.at, v.mark, v.send];

// When it types, marks and sends. Unanchored, typing starts just after the cut, the marker lands as
// the phrase finishes typing, and the bar never sends (a press nobody mentions is noise).
export const promptBeats = (v: Prompt, start: number, times: number[] = []) => {
  const { plain, mark } = promptText(v.text);
  const t0 = v.at && times[0] !== undefined ? times[0] : start + 0.3;
  const t1 = t0 + typeTime(plain.length);
  const typedAt = (i: number) => t0 + (t1 - t0) * (i / Math.max(1, plain.length));
  const markAt = mark ? Math.max(v.mark && times[1] !== undefined ? times[1] : 0, typedAt(mark.to) + 0.1) : undefined;
  const sendAt = v.send && times[2] !== undefined ? Math.max(times[2], t1 + 0.1) : undefined;
  return { t0, t1, markAt, sendAt };
};

// How many characters show at `t`.
export const typedCount = (v: Prompt, t: number, b: ReturnType<typeof promptBeats>) => {
  const n = promptText(v.text).plain.length;
  return t <= b.t0 ? 0 : t >= b.t1 ? n : Math.floor((n * (t - b.t0)) / (b.t1 - b.t0));
};

export const promptIssues = (v: Prompt): string[] => {
  const out: string[] = [];
  const { mark } = promptText(v.text);
  const L = promptLayout(v);
  if (!L.fits)
    out.push(
      v.search
        ? `the search "${promptText(v.text).plain}" is too long for one line; keep it under about 34 characters`
        : `the prompt wraps to ${L.lines.length} lines; the bar holds ${PROMPT.maxLines}`,
    );
  if (v.mark && !mark) out.push("`mark` is set but no phrase in the text is *marked*");
  if ((v.text.match(/\*/g) ?? []).length > 2) out.push("mark one phrase only");
  return out;
};
