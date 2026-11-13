# effects/apps

## Overview

The app kit: the products Owain's videos show most, drawn to move. Each one is a visual kind in the plan, built from captures of the real product, and plays a script of steps. A step lands on its own spoken words (`at`); a step without them starts when the one before it is done, so a script with no anchors still plays at the app's own pace.

| Kind | File | What it draws | Built from |
| --- | --- | --- | --- |
| `cli` (`app: "claude-code"`) | `cli.tsx` | Claude Code in a terminal: Clawd and the welcome lines, the prompt and its `/` command menu, the working line (spinner and shimmering verb), tool calls (the dot blinks, then turns green, `⎿` output), the reply, the closing line, the input between rules and the auto mode footer | Claude Code 2.1.321 run in a virtual terminal on 2026-11-13, every cell's text and 24-bit colour read back |
| `cli` (`app: "codex"`) | `cli.tsx` | Codex CLI: the `>_ OpenAI Codex` box, `›` prompts and menu, `Working` with its shimmer, `Explored` / `Ran` rows with `└` output, the reply, `Worked for` divider, the model and folder under the input | Codex CLI 0.157.1, captured the same way |
| `claudeapp` | `claude.tsx` | The Claude desktop app, dark: sidebar (on a wide window), title, your bubble, replies streaming in (serif in `chat`, sans in `code`), folded tool rows, a checklist that ticks (`todo`), the composer. A Code session opens on "What should we build?" with Local and Select folder; a `folder` step opens the folder menu and picks one | Owain's screen recordings of the app, 2026-11-12 |
| `grokbot` | `grokbot.tsx` | Grok Bot (xAI): `chat`, `bots` (the list) and `profile` (the bot's page with its Upcoming switches), and `Blob`, the bot avatar | Owain's screenshot, `projects/a1-reel-2/assets/app/.source.webp`, colours sampled from it |

Every kind takes `backdrop: "dots"` to sit on light paper with a dot grid (Owain's reference reels, 2026-11-13) instead of the panel or the graphite stage.

The step types are in `engine/schema.ts` (`CliStep`, `ChatStep`, `GrokStep`). Text in a step takes `code` (backticks) and `**bold**`, drawn as the app draws them.

## Interface

- `Cli`, `ClaudeApp`, `GrokBot`: `{ shot, time, v }`, drawn by `../ui.tsx` (`UiVisual`) in the whole frame or in a panel's box.
- `Blob` (`grokbot.tsx`): a Grok Bot avatar, `{ color, shape?, size, time, name, lively? }`. It bobs, blinks every 3 s or so on its own beat (seeded from `name`), and bounces when `lively` is above 0. Usable in any graphic.
- `kit.tsx`: `useBox`, `BoxCtx`, `Stage`, `enter` (the window's entrance and slow push), `typed`, `Caret`, `Shimmer`, `segs`, `linesFor`, and the fonts.
- The timeline is `engine/apps.ts`: `appBeats` (each step's start and end), `appRows` (when a listed bot or task lands), `appEnd`, `typeRate`. The drawing, the keyboard sound (`cleanSfx`) and the gallery (`effects/preview.ts`) all read it.

## Invariants

- Never invent UI: layout, colours and labels match the real product. Content comes from the plan. Never copy private text from a capture (the Grok Bot screenshot's chat is private).
- The terminal is a grid: text wraps at the last column, the input is pinned to the bottom, and the oldest rows scroll off the top. No row is ever cut in half.
- The chat views keep the newest messages that fit and drop the oldest whole. The bot list and the bot page shrink their rows so every row fits.
- In a split's panel (1080 x 960, the clean reel's box is 960 x 690 at y 100) there is no stage; full frame, the window sits on flat graphite at 90% x 82% of the frame (under 85%, so QC reads text against the window).
- Text is never under 24 px at 1080p; small labels are floored at 25 px.
- Deterministic: blinks, bobs and shimmers are functions of time and the bot's name.

## Verification

- `npm run studio -- qc --library --card cli` (and `claudeapp`, `grokbot`): every card in every theme, at its sample and at its longest text.
- The gallery: `#/gallery?q=cli`, `#/gallery?q=grokbot`, `#/gallery?q=claudeapp` (reel and YouTube).
- `tests/apps.test.ts`: the timeline, the defaults, anchors and the typing sound.
