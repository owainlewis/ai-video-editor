// Grok Bot gets its own email address (projects/a1-reel-2, 2026-11-12). Labels are the words Owain
// says; the product's real labels are shown on the real docs page (assets/captures/email.png), not
// redrawn here. The agent is Owain's real bot avatar (props.avatar, "logo:gradient-bot"), which bobs
// as bots do in the app; an email address is an envelope, an account is a card. No rings of dots
// (Owain, 2026-11-13: "looks kind of creepy"). Split diagrams stay above y 830.
import React from "react";
import { at, C, k, lerp, Label, Line, move, Rect, Ring, Stage } from "../clean/kit";
import type { CustomProps } from "./index";

// An envelope: a card with the flap drawn on after it.
const Envelope: React.FC<{ x: number; y: number; w: number; p: number; color?: string; opacity?: number }> = ({ x, y, w, p, color = C.white, opacity = 1 }) => {
  const h = w * 0.68;
  return (
    <g opacity={opacity}>
      <Rect x={x - w / 2} y={y - h / 2} w={w} h={h} p={p} color={color} r={4} />
      <Line a={[x - w / 2 + 4, y - h / 2 + 4]} b={[x, y + h * 0.08]} p={k(p, 0.6, 0.4)} color={color} />
      <Line a={[x + w / 2 - 4, y - h / 2 + 4]} b={[x, y + h * 0.08]} p={k(p, 0.6, 0.4)} color={color} />
    </g>
  );
};

// The bot's real avatar, `h` tall, centred on x, y: it rises in on `at` and then bobs gently.
const Bot: React.FC<{ src: string; x: number; y: number; h: number; t: number; at: number }> = ({ src, x, y, h, t, at: a }) => {
  const p = k(t, a, 0.35);
  if (p <= 0.01) return null;
  const bob = Math.sin(((t - a) / 2.2) * Math.PI * 2) * h * 0.025, rise = (1 - p) * 30;
  // A thin outline in the line colour, so the white avatar keeps its edge on a light stage.
  return (
    <g opacity={Math.min(1, p * 1.5)}>
      <image href={src} x={x - h / 2} y={y - h / 2 + rise + bob} width={h} height={h} />
      <Ring x={x} y={y + rise + bob} r={h / 2} p={1} w={3} />
    </g>
  );
};
const avatar = (props: Record<string, unknown>) => String(props.avatar ?? "");

// "If you want your AI agents to act like real employees, you need to give them their own email
// address, so they can sign up for different accounts without using yours": the bot; its own envelope
// lands beside it; lines run down to three accounts; your envelope, off to the side, is struck.
// times: [employees, own email, sign up, accounts, yours]
export const GbInbox: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [staff, own, sign, accounts, yours] = [0, 1, 2, 3, 4].map((i) => at(times, i, shot.start));
  const ax = 640, ay = 250, xs = [240, 540, 840], ry = 640;
  return (
    <Stage width={width} height={height}>
      <Bot src={avatar(props)} x={420} y={ay} h={220} t={t} at={shot.start} />
      <Ring x={420} y={ay} r={136} p={k(t, staff, 0.4)} w={4} color={C.sage} />
      <Envelope x={ax} y={ay} w={130} p={k(t, own, 0.35)} color={C.sage} />
      <Label x={ax + 90} y={ay + 16} size={46} anchor="start" opacity={k(t, own + 0.1)}>own email</Label>
      {xs.map((x, i) => (
        <g key={x}>
          <Line a={[ax + (x - ax) * 0.2, ay + 70]} b={[x, ry - 70]} p={k(t, sign + i * 0.1, 0.3)} head />
          <Rect x={x - 80} y={ry - 50} w={160} h={110} p={k(t, accounts + i * 0.12, 0.3)} r={10} />
          <Line a={[x - 50, ry - 10]} b={[x + 50, ry - 10]} p={k(t, accounts + i * 0.12 + 0.15, 0.2)} opacity={0.6} />
          <Line a={[x - 50, ry + 20]} b={[x + 20, ry + 20]} p={k(t, accounts + i * 0.12 + 0.2, 0.2)} opacity={0.6} />
        </g>
      ))}
      <Envelope x={140} y={170} w={90} p={k(t, yours, 0.3)} opacity={1 - 0.5 * k(t, yours + 0.3, 0.2)} />
      <Line a={[80, 210]} b={[200, 130]} p={k(t, yours + 0.3, 0.2)} w={5} color={C.sage} />
      <Label x={140} y={280} size={42} opacity={k(t, yours + 0.1)}>yours</Label>
    </Stage>
  );
};

// "You can also just ask your agent to go and do this for you, and it will prompt you through the whole
// process": you and the bot; your ask goes across; the bot takes it on (a ring round it); its prompts come back, one line at a time; on
// "whole process" a card with a tick lands between you, the approval.
// times: [ask, do this, prompt, whole process]
export const GbAsk: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [ask, task, prompt, whole] = [0, 1, 2, 3].map((i) => at(times, i, shot.start));
  const ux = 200, bx = 880, y = 330;
  const rows = [0, 1, 2];
  return (
    <Stage width={width} height={height}>
      <Ring x={ux} y={y} r={90} p={k(t, shot.start, 0.35)} w={4} />
      <Label x={ux} y={y + 160} size={46} opacity={k(t, shot.start + 0.1)}>you</Label>
      <Bot src={avatar(props)} x={bx} y={y} h={180} t={t} at={shot.start + 0.1} />
      <Ring x={bx} y={y} r={110} p={k(t, task, 0.4)} w={4} color={C.sage} />
      <Label x={bx} y={y + 160} size={46} color={C.sage} opacity={k(t, shot.start + 0.2)}>agent</Label>
      <Line a={[ux + 110, y - 110]} b={[bx - 110, y - 110]} p={k(t, ask, 0.35)} w={4} head />
      {rows.map((i) => (
        <Line key={i} a={[bx - 110, y - 20 + i * 70]} b={[ux + 110, y - 20 + i * 70]} p={k(t, lerp(prompt, whole, i / 3), 0.3)} w={3} head color={C.sage} />
      ))}
      <Rect x={440} y={600} w={200} h={140} p={k(t, whole, 0.3)} r={14} color={C.sage} />
      <Line a={[495, 672]} b={[530, 705]} p={k(t, whole + 0.2, 0.15)} w={6} color={C.sage} />
      <Line a={[530, 705]} b={[590, 638]} p={k(t, whole + 0.3, 0.15)} w={6} color={C.sage} />
    </Stage>
  );
};

// "Now your bot can answer emails for you without confusing people, and it can also sign up to any
// accounts using its own email address and credentials": the bot with its envelope; replies go up to
// three people; then lines go down to accounts, each opened with the agent's own email and a key.
// times: [answer, confusing, sign up, accounts, own email, credentials]
export const GbWork: React.FC<CustomProps> = ({ time: t, times, width, height, shot, props }) => {
  const [answer, people, sign, accounts, own, creds] = [0, 1, 2, 3, 4, 5].map((i) => at(times, i, shot.start));
  const ax = 220, ay = 430;
  const top = [150, 290], low = [560, 700];
  const px = [560, 760, 960], cards = [600, 800];
  return (
    <Stage width={width} height={height}>
      <Bot src={avatar(props)} x={ax} y={ay - 30} h={200} t={t} at={shot.start} />
      <Envelope x={ax} y={ay + 110} w={100} p={k(t, shot.start + 0.15, 0.35)} color={C.sage} />
      {px.map((x, i) => (
        <g key={x}>
          <Line a={[ax + 120, ay - 60]} b={[x - 50, top[0] + 10]} p={move(t, answer + i * 0.12, 0.35)} head />
          <Ring x={x} y={top[0]} r={40} p={k(t, answer + i * 0.12 + 0.2, 0.25)} w={3} />
          <Envelope x={x} y={top[1] - 30} w={70} p={k(t, people + i * 0.1, 0.3)} opacity={0.8} />
        </g>
      ))}
      {cards.map((x, i) => (
        <g key={x}>
          <Line a={[ax + 120, ay + 60]} b={[x - 100, low[0]]} p={move(t, sign + i * 0.12, 0.35)} head />
          <Rect x={x - 90} y={low[0] - 70} w={180} h={250} p={k(t, accounts + i * 0.12, 0.3)} r={12} />
          <Envelope x={x} y={low[0] - 5} w={80} p={k(t, own + i * 0.1, 0.3)} color={C.sage} />
          <Ring x={x - 25} y={low[1] - 20} r={18} p={k(t, creds + i * 0.1, 0.25)} w={4} color={C.sage} />
          <Line a={[x - 7, low[1] - 20]} b={[x + 45, low[1] - 20]} p={k(t, creds + i * 0.1 + 0.15, 0.2)} w={4} color={C.sage} />
        </g>
      ))}
    </Stage>
  );
};
