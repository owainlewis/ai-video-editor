# effects/apps

## Overview

The app kit: the products Owain's videos show most, drawn to move. Each one is a visual kind in the plan, built from captures of the real product, and plays a script of steps. A step lands on its own spoken words (`at`); a step without them starts when the one before it is done, so a script with no anchors still plays at the app's own pace.

| Kind | File | What it draws | Built from |
| --- | --- | --- | --- |
| `cli` (`app: "claude-code"`) | `cli.tsx` | Claude Code in a terminal: Clawd (who blinks) and the welcome lines, the prompt and its `/` command menu, the working line (spinner and shimmering verb), tool calls (the dot blinks, then turns green, `⎿` output), the reply, the closing line, the input between rules and the auto mode footer | Claude Code 2.1.321 run in a virtual terminal on 2026-11-13, every cell's text and 24-bit colour read back; Clawd's glyphs and blink from the 2.1.321 binary |
| `cli` (`app: "codex"`) | `cli.tsx` | Codex CLI: the `>_ OpenAI Codex` box, `›` prompts and menu, `Working` with its shimmer, `Explored` / `Ran` rows with `└` output, the reply, `Worked for` divider, the model and folder under the input | Codex CLI 0.157.1, captured the same way |
| `claudeapp` | `claude.tsx` | The Claude desktop app, dark: sidebar (on a wide window), title, your bubble, replies streaming in (serif in `chat`, sans in `code`), folded tool rows, a checklist that ticks (`todo`), the composer (a mic until you type, then the send button). A Code session opens on "What should we build?" with Local and Select folder; a `folder` step opens the folder menu and picks one | Owain's screen recordings of the app, 2026-11-12; the Code session in `research/reels/nmdvmu2dyyhl/layout-split-claude.png` |
| `grokbot` | `grokbot.tsx` | Grok Bot (xAI): `chat`, `bots` (the list) and `profile` (the bot's page with its Upcoming switches), and `Blob`, the bot avatar in vector | Owain's screenshot, `projects/a1-reel-2/assets/app/.source.webp`, colours sampled and avatars traced from it |

Every kind takes `backdrop: "dots"` to sit on light paper with a dot grid (Owain's reference reels, 2026-11-13) instead of the panel or the graphite stage.

The step types are in `engine/schema.ts` (`CliStep`, `ChatStep`, `GrokStep`). Text in a step takes `code` (backticks) and `**bold**`, drawn as the app draws them.

## The camera

A window is framed as a camera frames a screen: large, on the part that matters.

- **Where it sits.** On a split the window is the panel's box, edge to edge (960 x 724 below Instagram's bar, 960 x 494 under the text hook); on the dots it keeps a narrow paper margin; full frame it floats on graphite at 90% x 84%.
- **How big.** One body size for the whole shot: the largest at which the shot's fullest moment fits the window (`fit`, from `bodyRange`). Never under 30 px; at most about 46 px on a reel's panel and 38 px on YouTube, so it still reads as the app. A terminal keeps 36 px on a tall panel and lets its history scroll; a chat keeps 33 px; a page (the bot list, a bot's page) shrinks to 30 px to show whole. The terminal's columns follow from its font, as a terminal resized to it would wrap.
- **What it follows.** When the content outgrows the window, it pans (`pan`) to keep the newest part in frame: the latest message, the bot that just arrived, the task being switched on. List pans land on a row's top (`snap`). A row the window's edges would cut fades out (`inView`), so no line is ever seen cut in half.
- **One-line fields.** A composer is one line: a long prompt shows its end as it types (`tail`), a long label ends in an ellipsis (`clip`).

Sizes are worked out from the browser's own text metrics (`wrapLines`, `textWidth`), so the fit matches what is drawn.

## Interface

- `Cli`, `ClaudeApp`, `GrokBot`: `{ shot, time, v }`, drawn by `../ui.tsx` (`UiVisual`) in the whole frame or in a panel's box.
- `Blob` (`grokbot.tsx`): a Grok Bot avatar in vector, `{ color, shape?, size, time, name, lively? }`: Owain's white round "Gradient Bot", the green, orange and purple beans and the red egg, traced from the screenshot at 6x. It bobs, blinks every 3 s or so on its own beat (seeded from `name`; each eye squashes along its length), and bounces with a little squash and stretch when `lively` is above 0. Usable at any size in any graphic, in place of the raster `library/logos/gradient-bot.png`.
- `Clawd` (`cli.tsx`): Claude Code's mascot from his block characters, snapped to whole pixels so no seam shows; he blinks every 4 s.
- `kit.tsx`: `useBox`, `BoxCtx`, `Stage`, `Window`, `Lights`, `windowSize`, `bodyRange`, `fit`, `pan`, `snap`, `inView`, `wrapLines`, `textWidth`, `tail`, `clip`, `enter`, `typed`, `Caret`, `Shimmer`, `segs`, and the fonts.
- The timeline is `engine/apps.ts`: `appBeats` (each step's start and end), `appRows` (when a listed bot or task lands), `appEnd`, `typeRate`. The drawing, the keyboard sound (`cleanSfx`) and the gallery (`effects/preview.ts`) all read it. A chat reply streams in whole within 0.75 s.

## Invariants

- Never invent UI: layout, colours and labels match the real product. Content comes from the plan. Never copy private text from a capture (the Grok Bot screenshot's chat is private).
- A window's own colours are the product's, on any palette. Its shadow is soft enough for the light stage and the dark one.
- The terminal is a grid: text wraps at the last column, the input is pinned to the bottom, and the oldest rows scroll off the top. The welcome lines leave whole, never half a header, and the history never starts on a blank row.
- Body text is never under 30 px at 1080p; secondary labels (a preview line, a time, the footer) are never under 26 px.
- All vector and live text: no raster scaled up. The window's push ends at full size, so a window that fills its box never spills past it.
- `Shimmer` is one inline run, so a flex row around it never spaces its letters apart.
- Deterministic: blinks, bobs, shimmers and pans are functions of time and the bot's name.

## Verification

- `npm run studio -- qc --library --card cli` (and `claudeapp`, `grokbot`): every card in every theme, at its sample and at its longest text, on a split and under the hook, with the balance check.
- The gallery: `#/gallery?q=cli`, `#/gallery?q=grokbot`, `#/gallery?q=claudeapp` (reel and YouTube).
- `tests/apps.test.ts`: the timeline, the defaults, anchors, the typing sound, and the camera (`fit`, `pan`, `snap`, `inView`, `tail`, `clip`, the size range).
