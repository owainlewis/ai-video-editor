// The `prompt` bar in the clean kit (engine/prompt.ts lays it out and times it): a white bar in the
// diagram cards' neutral look, the words typing in on their word with a caret, the *marked* phrase
// swept with a marker, the send button pressing. A search field is a pill with a magnifier, the
// product's real logo above it.
import React from "react";
import type { ResolvedVisual } from "../../engine/schema";
import { PROMPT, promptBeats, promptLayout, promptText, typedCount } from "../../engine/prompt";
import { cardTone, Icon } from "./flow";
import { k, SANS, usePalette } from "./kit";

type PromptV = Extract<ResolvedVisual, { kind: "prompt" }>;

// A "#RRGGBB" colour at `a` opacity: the marker is the accent, light enough to read through.
export const tint = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const Magnifier: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
    <circle cx="21" cy="21" r="13" fill="none" stroke={color} strokeWidth="4" />
    <path d="M31 31l11 11" stroke={color} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const SendButton: React.FC<{
  size: number;
  ready: number;
  press: number;
  c: ReturnType<typeof cardTone>;
}> = ({ size, ready, press, c }) => {
  // A quick dip as it is pressed, then it holds in the accent.
  const dip = press > 0 && press < 1 ? Math.sin(press * Math.PI) : 0;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: press > 0 ? c.accent : ready ? c.text : "#D5D7D3",
        transform: `scale(${1 - 0.1 * dip})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 48 48">
        <path d="M24 40V9 M11 21l13-13 13 13" fill="none" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export const PromptView: React.FC<{
  v: PromptV;
  time: number;
  start: number;
  w: number;
  h: number;
  slug?: string;
}> = ({ v, time: t, start, w, h, slug }) => {
  const c = cardTone(usePalette());
  const marker = tint(c.accent, 0.26);
  const P = PROMPT;
  const L = promptLayout(v);
  const { plain, mark } = promptText(v.text);
  const b = promptBeats(v, start, v.times);
  const n = typedCount(v, t, b);
  const lineH = L.size * P.lead;
  const logo = v.app && v.search ? P.searchLogo : 0;
  const logoGap = logo ? P.searchGap : 0;
  const barH = v.search ? P.pill : L.height;
  const totalH = L.height;
  const s = Math.min(1.15, w / P.width, h / (totalH + 20));
  const markP = b.markAt !== undefined ? k(t, b.markAt, 0.35) : 0;
  const press = b.sendAt !== undefined ? k(t, b.sendAt, 0.25) : 0;
  // The caret is solid while it types, then blinks; it goes once the prompt is sent.
  const caret = press === 0 && (t < b.t1 + 0.4 || Math.floor((t - b.t1) * 1.8) % 2 === 0);

  // One line of what has been typed so far, split where the marked phrase starts and ends.
  let offset = 0;
  const lines = L.lines.map((line, i) => {
    const a = offset,
      e = offset + line.length;
    offset = e;
    const shown = Math.max(0, Math.min(e, n) - a);
    const cuts = [a, ...(mark ? [mark.from, mark.to] : []), a + shown].filter((x) => x >= a && x <= a + shown).sort((x, y) => x - y);
    const parts = cuts.slice(1).map((x, j) => ({
      text: plain.slice(cuts[j], x),
      marked: !!mark && cuts[j] >= mark.from && x <= mark.to,
    }));
    const end = n > a && n <= e && (n < e || i === L.lines.length - 1);
    return (
      <div key={i} style={{ height: lineH, lineHeight: `${lineH}px`, whiteSpace: "pre" }}>
        {parts.map((p, j) =>
          p.text ? (
            // A marked run never carries the space at a line's end: the marker stops at the last letter.
            <React.Fragment key={j}>
              <span
                style={
                  p.marked
                    ? {
                        backgroundImage: `linear-gradient(${marker}, ${marker})`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${markP * 100}% 100%`,
                        borderRadius: 6,
                        padding: "2px 0",
                      }
                    : undefined
                }
              >
                {p.marked ? p.text.trimEnd() : p.text}
              </span>
              {p.marked && p.text.slice(p.text.trimEnd().length)}
            </React.Fragment>
          ) : null,
        )}
        {(end || (n === 0 && i === 0)) && caret && (
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: L.size * 1.05,
              marginLeft: 2,
              verticalAlign: "middle",
              background: c.text,
            }}
          />
        )}
      </div>
    );
  });

  const card = {
    boxSizing: "border-box",
    background: c.fill,
    border: `${c.weight}px solid ${c.line}`,
    boxShadow: c.shadow ? "0 8px 28px rgba(17,17,17,0.07)" : "none",
  } as const;
  const words = (
    <div
      style={{
        width: L.inner,
        flex: "none",
        fontFamily: SANS,
        fontSize: L.size,
        letterSpacing: "-0.01em",
        color: c.text,
      }}
    >
      {lines}
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: (w - P.width * s) / 2,
        top: (h - totalH * s) / 2,
        width: P.width,
        height: totalH,
        transform: `scale(${s})`,
        transformOrigin: "0 0",
      }}
    >
      {logo > 0 && (
        <div style={{ position: "absolute", left: (P.width - logo) / 2, top: 0 }}>
          <Icon src={v.app!} size={logo} color={c.icon} slug={slug} />
        </div>
      )}
      {v.search ? (
        <div
          style={{
            ...card,
            position: "absolute",
            left: 0,
            top: logo + logoGap,
            width: P.width,
            height: barH,
            borderRadius: barH / 2,
            padding: `0 ${P.pad}px`,
            display: "flex",
            alignItems: "center",
            gap: P.gap,
          }}
        >
          <div style={{ width: P.icon, flex: "none" }}>
            <Magnifier size={P.icon * 0.8} color={c.sub} />
          </div>
          {words}
        </div>
      ) : (
        <div
          style={{
            ...card,
            position: "absolute",
            left: 0,
            top: logo + logoGap,
            width: P.width,
            height: barH,
            borderRadius: 36,
            padding: `${P.pad}px ${P.pad}px 0`,
          }}
        >
          {words}
          {v.app && (
            <div
              style={{
                position: "absolute",
                left: P.pad,
                bottom: (P.toolbar - P.logo) / 2,
              }}
            >
              <Icon src={v.app} size={P.logo} color={c.icon} slug={slug} />
            </div>
          )}
          <div
            style={{
              position: "absolute",
              right: P.pad - 8,
              bottom: (P.toolbar - P.send) / 2,
            }}
          >
            <SendButton size={P.send} ready={n >= plain.length ? 1 : 0} press={press} c={c} />
          </div>
        </div>
      )}
    </div>
  );
};
