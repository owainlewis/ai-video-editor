// The `doc` in the clean kit (engine/doc.ts lays it out and times it): a document or a table as a
// skeleton card in the diagram cards' neutral look. A tag and the real title; grey bars where its text
// would be, drawing on in a quick cascade; a row lighting on its word; a scan sweeping down it.
import React from "react";
import type { ResolvedVisual } from "../../engine/schema";
import { barShare, DOC, docBeats, docHead, docHeight } from "../../engine/doc";
import { cardTone, Icon } from "./flow";
import { k, move, SANS, usePalette } from "./kit";
import { tint } from "./prompt";

type DocV = Extract<ResolvedVisual, { kind: "doc" }>;

const BAR = "#DDE0DC";

export const DocView: React.FC<{
  v: DocV;
  time: number;
  start: number;
  w: number;
  h: number;
  slug?: string;
}> = ({ v, time: t, start, w, h, slug }) => {
  const c = cardTone(usePalette());
  const D = DOC;
  const H0 = docHeight(v);
  const head = docHead(v);
  const s = Math.min(1.15, w / D.width, h / H0);
  const b = docBeats(v, start, v.times);
  const inner = D.width - D.pad * 2;
  const table = !!v.cols;
  const rowH = table ? D.tableRow : D.row;
  const body = head + (table ? D.cols : 0);
  const colW = table ? inner / v.cols!.length : inner;
  const lit = (row: number) => Math.max(0, ...v.marks.map((m, j) => (m.row === row + 1 ? k(t, b.marks[j], 0.3) : 0)));
  // The scan: a soft band with a bright leading edge, from the first row to past the last.
  const scanP = b.scan !== undefined ? move(t, b.scan, D.scan) : 0;
  const scanOn = b.scan !== undefined && t >= b.scan && scanP < 1;
  const scanY = body + scanP * (v.rows * rowH);

  return (
    <div
      style={{
        position: "absolute",
        left: (w - D.width * s) / 2,
        top: (h - H0 * s) / 2,
        width: D.width,
        height: H0,
        transform: `scale(${s})`,
        transformOrigin: "0 0",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          background: c.fill,
          border: `${c.weight}px solid ${c.line}`,
          boxShadow: c.shadow ? "0 8px 28px rgba(17,17,17,0.07)" : "none",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: D.pad,
            top: D.pad - 6,
            display: "flex",
            alignItems: "center",
            gap: 18,
            height: 48,
          }}
        >
          {v.icon && <Icon src={v.icon} size={44} color={c.icon} slug={slug} />}
          {v.tag && (
            <div
              style={{
                height: 42,
                padding: "0 16px",
                borderRadius: 21,
                background: c.accentFill,
                color: c.accent,
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              {v.tag}
            </div>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: D.pad,
            top: D.pad + (v.icon || v.tag ? 62 : 6),
            width: inner,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 46,
            letterSpacing: "-0.02em",
            color: c.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {v.title}
        </div>
        <div
          style={{
            position: "absolute",
            left: D.pad,
            top: head - 18,
            width: inner,
            height: 1.5,
            background: c.line,
          }}
        />
        {table &&
          v.cols!.map((col, j) => (
            <div
              key={j}
              style={{
                position: "absolute",
                left: D.pad + colW * j,
                top: head,
                width: colW - 16,
                height: D.cols - 12,
                display: "flex",
                alignItems: "center",
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 26,
                color: c.sub,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {col}
            </div>
          ))}
        {Array.from({ length: v.rows }, (_, i) => {
          const y = body + i * rowH;
          const on = lit(i);
          const draw = k(t, b.rows[i], 0.3);
          const bar = on > 0 ? tint(c.accent, 0.2 + 0.25 * on) : BAR;
          return (
            <React.Fragment key={i}>
              {on > 0 && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      left: D.pad - 18,
                      top: y + 4,
                      width: (inner + 36) * on,
                      height: rowH - 8,
                      borderRadius: 12,
                      background: tint(c.accent, 0.1),
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: D.pad - 18,
                      top: y + 4,
                      width: 5,
                      height: rowH - 8,
                      borderRadius: 3,
                      background: c.accent,
                      opacity: on,
                    }}
                  />
                </>
              )}
              {table && i > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: D.pad,
                    top: y,
                    width: inner,
                    height: 1,
                    background: c.line,
                  }}
                />
              )}
              {(table ? v.cols! : [null]).map((_, j) => (
                <div
                  key={j}
                  style={{
                    position: "absolute",
                    left: D.pad + (table ? colW * j : 0),
                    top: y + (rowH - D.bar) / 2,
                    width: (table ? colW - 32 : inner) * barShare(i, table ? j : -1) * draw,
                    height: D.bar,
                    borderRadius: D.bar / 2,
                    background: bar,
                  }}
                />
              ))}
            </React.Fragment>
          );
        })}
        {scanOn && (
          <>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: scanY - rowH * 1.6,
                width: D.width,
                height: rowH * 1.6,
                background: `linear-gradient(180deg, ${tint(c.accent, 0)}, ${tint(c.accent, 0.12)})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: scanY - 1.5,
                width: D.width,
                height: 3,
                background: c.accent,
                opacity: 0.8,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};
