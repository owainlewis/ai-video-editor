import React from "react";
import { Img } from "remotion";
import { actionBeats, actionOffset, MOVE, typedChars } from "../engine/actions";
import type { ResolvedVisual } from "../engine/schema";
import { textWidth } from "./apps/kit";
import { src } from "./soft";
import { ease } from "./theme";

type V = Extract<ResolvedVisual, { kind: "image" }>;
type Box = [number, number, number, number];

// The cursor: the same arrow `record` films over a live page, so a captured page and a filmed one
// read as one agent at work. The tip is at (5, 3) of its 24-unit box.
const ARROW = "M5 3l14 9-6.5 1.2L9 20z";
const RING = "#B7CDBF";

// Where the cursor lands on a target: a field near its right end, clear of the text it types;
// anything else in its middle.
const aim = (a: NonNullable<V["actions"]>[number], r: Box): [number, number] => (a.act === "type" ? [r[0] + r[2] * 0.82, r[1] + r[3] * 0.62] : [r[0] + r[2] / 2, r[1] + r[3] / 2]);

// An agent at work on a captured page, drawn over the capture inside the camera's frame (so it
// moves with the page): the cursor travels to each target and clicks, a field types its text in the
// page's own type, a box shows ticked as the page draws it. `k`: screen px per image px.
export const PageActions: React.FC<{ slug: string; v: V; time: number; start: number; k: number; cursor: number }> = ({ slug, v, time, start, k, cursor }) => {
  const [iw, ih] = v.size ?? [1600, 1000];
  const actions = v.actions ?? [];
  if (!actions.some((a) => a.rect)) return null;
  const beats = actionBeats(actions, start, (v.times ?? []).slice(actionOffset(v)));
  const pts = actions.map((a) => (a.rect ? aim(a, a.rect as Box) : null));
  // The cursor rests below and right of the first target, then makes each trip on the way to a click.
  const first = pts.find(Boolean)!;
  let at: [number, number] = [Math.min(0.92, first[0] + 0.14), Math.min(0.95, first[1] + 0.12)];
  actions.forEach((_, i) => {
    const p = pts[i];
    if (!p) return;
    const e = ease(Math.max(0, Math.min(1, (time - (beats[i].t - MOVE)) / MOVE)));
    at = [at[0] + (p[0] - at[0]) * e, at[1] + (p[1] - at[1]) * e];
  });
  const px = (x: number, y: number) => ({ left: x * iw * k, top: y * ih * k });
  // The field that has focus: from its click until the next click.
  const focused = beats.filter((b) => time >= b.t).length - 1;
  return (
    <>
      {actions.map((a, i) => {
        const r = a.rect as Box | undefined;
        if (!r) return null;
        const b = beats[i];
        if (a.act === "check") {
          if (time < b.t || !a.checked) return null;
          return <Img key={i} src={src(slug, a.checked)} style={{ position: "absolute", ...px(r[0], r[1]), width: r[2] * iw * k, height: r[3] * ih * k }} />;
        }
        if (a.act !== "type" || !a.font || time < b.t) return null;
        const f = a.font;
        const n = typedChars(a.text ?? "", b, time);
        const size = f.size * ih * k;
        const pad = f.pad * iw * k;
        const family = `${f.family ? `${f.family}, ` : ""}Helvetica, Arial, sans-serif`;
        const inner = r[2] * iw * k - pad * 2;
        const shown = f.secret ? "•".repeat(n) : (a.text ?? "").slice(0, n);
        // A one-line field scrolls with its caret, as an input does.
        const over = Math.max(0, textWidth(shown, size, family, f.weight ?? 400) - inner);
        const caret = i === focused && (time < b.t1 + 0.05 || Math.floor((time - b.t1) * 1.9) % 2 === 1);
        return (
          <React.Fragment key={i}>
            {i === focused && a.focused && (
              <Img src={src(slug, a.focused.src)} style={{ position: "absolute", ...px(a.focused.box[0], a.focused.box[1]), width: a.focused.box[2] * iw * k, height: a.focused.box[3] * ih * k }} />
            )}
            <div style={{ position: "absolute", ...px(r[0], r[1]), width: r[2] * iw * k, height: r[3] * ih * k }}>
              {/* The page's own field colour over its placeholder, once the first letter is in. */}
              {n > 0 && <div style={{ position: "absolute", left: pad * 0.45, right: pad * 0.45, top: "16%", bottom: "16%", background: f.bg ?? "#fff" }} />}
              <div style={{ position: "absolute", left: pad, width: inner, top: 0, bottom: 0, overflow: "hidden", display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    whiteSpace: "pre",
                    fontFamily: family,
                    fontSize: size,
                    fontWeight: f.weight ?? 400,
                    color: f.color ?? "#111",
                    translate: `${-over}px 0`,
                  }}
                >
                  {shown}
                  <span style={{ width: Math.max(1.5, size * 0.07), height: size * 1.15, marginLeft: 1, background: f.color ?? "#111", opacity: caret ? 1 : 0 }} />
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      {actions.map((a, i) => {
        const p = pts[i];
        const q = (time - beats[i].t) / 0.4;
        if (!p || q < 0 || q > 1) return null;
        const d = cursor * 1.7;
        return (
          <div
            key={`r${i}`}
            style={{
              position: "absolute",
              ...px(p[0], p[1]),
              width: d,
              height: d,
              marginLeft: -d / 2,
              marginTop: -d / 2,
              borderRadius: "50%",
              background: RING,
              opacity: 0.6 * (1 - q),
              scale: String(0.3 + 1.3 * q),
            }}
          />
        );
      })}
      <svg
        width={cursor}
        height={cursor}
        viewBox="0 0 24 24"
        style={{ position: "absolute", ...px(at[0], at[1]), marginLeft: (-cursor * 5) / 24, marginTop: (-cursor * 3) / 24, overflow: "visible", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}
      >
        <path d={ARROW} fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
};
