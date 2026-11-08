# AI Reel Editor

## Overview

Turn a talking head clip into an edited Instagram reel: real screen captures and logos framed on the words you say, motion graphics that land on their cue, word-timed captions, a music bed and sound design, mixed to platform loudness.

Claude Code is the editor. It researches what you talk about, captures the real pages, plans every shot against your transcript, reviews its own stills and renders. A small CLI does the mechanical work. Every note you give on a draft becomes a rule or a check, so the editor gets better with each reel.

## How it works

```
your clip ──> new ──> transcribe ──> research + capture ──> edit.json ──> validate ──> stills ──> render ──> check
                         │                  │                    │              │            │          │
                    word timings     real pages, logos     shots on spoken   timings,   one frame   cut strips,
                    (mlx-whisper)    (Chrome, logged)      phrases (Claude)  house rules per shot   loudness, words
```

- **Footage stays exact.** The speaker plays as one continuous video, so lip sync never drifts. Layouts only change its framing.
- **Everything is anchored to speech.** A shot, a list item, a logo or a highlight starts on a phrase from the transcript, not on a hand-typed time.
- **Real evidence first.** Pages are captured with Chrome and framed tight on the sentence being said. Logos come from official sources. Every capture, download and `new --broll` clip is logged with its source in `assets/ledger.json`. Clips from the b-roll library are not.
- **Checked like an editor would.** `validate` lints the house rules (shot length, readability of captures, layout variety). `check` makes frame strips across every cut, measures loudness and re-transcribes the render.

## Setup

macOS with Apple Silicon, Homebrew `ffmpeg`, Node 22+, [uv](https://docs.astral.sh/uv/) and Google Chrome.

```sh
npm install
npm test
```

Fonts are read from the machine: Helvetica Neue and [Signifier](https://klim.co.nz/retail-fonts/signifier/) (licensed, not included).
Sound effects and music go in `sounds/` and `music/` (git-ignored, see their READMEs). A sound with no file is left silent, and with no tracks the reel has no music bed.
Reels from a script use macOS `say`. The Kokoro voice (`--engine kokoro`) also needs `brew install espeak-ng`.

## Use it

Open the repo in Claude Code and ask:

> Edit ~/Desktop/IG1.mp4 into a reel.

The `edit-reel` skill (`.claude/skills/edit-reel/SKILL.md`) runs the whole process and sends you the MP4. Reply with notes in plain words; each one is fixed and written into `docs/RULES.md`.

The CLI on its own:

```sh
npm run reel -- new ig1 ~/Desktop/IG1.mp4
npm run reel -- transcribe ig1
npm run reel -- capture ig1 https://github.com/alibaba/open-code-review --name repo
npm run reel -- fetch ig1 https://example.com/logo.svg --name logo.svg
# write projects/ig1/edit.json (see examples/)
npm run reel -- validate ig1
npm run reel -- stills ig1
npm run reel -- render ig1
npm run reel -- check ig1
```

Your own b-roll goes in `broll/` (git-ignored). Clips can be stitched together; `index` splits them into shots and crops any letterboxing:

```sh
npm run reel -- index
npm run reel -- broll typing
```

Then use `{ "kind": "video", "src": "broll:1-4" }` in a plan.

Preview a project live in Remotion Studio:

```sh
npx remotion studio src/index.ts --props=projects/ig1/build/edit.resolved.json
```

Review a draft shot by shot on the review board. Every shot loops in its own player, with Approve, Change and a note. Notes save to `projects/<slug>/review.json`; tell Claude "left comments, let's amend" and it reads them with `feedback`, changes only those shots, and they come back as waiting:

```sh
npm run reel -- review ig1
npm run reel -- feedback ig1
```

## The edit plan

`edit.json` is the whole edit. The schema is `src/schema.ts`. Two complete plans for the same clip: `examples/opencodereview-react.edit.json` (the tool-drop format) and `examples/opencodereview-mixed.edit.json`.

`format` is `react` (the default, for tool drops: your face stays on screen while the top panel walks through the source), `mixed` (every layout, b-roll cutaways) or `film` (full-frame scenes that build across shots, light and dark alternating). `validate` checks the rules for each; see `docs/STYLE.md`.

```json
{
  "title": "OpenCodeReview",
  "format": "react",
  "face": { "x": 0.49, "y": 0.22, "h": 0.36 },
  "accents": ["essential", "OpenCodeReview"],
  "music": false,
  "shots": [
    { "at": "If you're building", "layout": "split",
      "visual": { "kind": "image", "src": "assets/captures/site.png", "frame": "browser",
                  "from": [0.445, 0.118, 0.47, 0.277], "to": [0.455, 0.14, 0.36, 0.2] } },
    { "at": "having a good", "layout": "full" },
    { "at": "is essential", "layout": "punch" }
  ]
}
```

Layouts: `split`, `full`, `punch`, `media`, `cutaway`, `scene`, and on YouTube (`"canvas": "youtube"`) `side` and `over`.

Visuals: `image` (with camera move and highlight), `video`, `logos`, `title`, `list`, `steps`, `compare`, `stat`, `prompt`, `cta`, `terminal`, `chart`, `constraint`, `pipeline`, `lower`, `chapter`, `flow`, `grid`, `funnel`, `windows`, `agenda`, `beforeafter`, `kpi`, `matrix`, `timeline`, `levels`, `checklist`, `quote`, `logowall`, `bento`, `ring`, `meter`, `waffle`, `type`.

## Layout

```
.claude/skills/edit-reel/   the editor's process
docs/STYLE.md               house look, pacing, captions, sound
docs/RULES.md               notes turned into rules, newest first
src/                        Remotion composition (React)
tools/                      the reel CLI and the timing resolver
audio/                      mix, music bed and sound effects from sounds/ (Python, run with uv)
review/                     the review board and style lab
styles/                     the style library and card catalog
examples/                   reference edit plans
broll/                      your b-roll library and its index (git-ignored)
projects/<slug>/            one folder per reel: source, assets, plan, renders, checks (git-ignored)
```

## Interface

- `npm run reel -- <command>`: every command and flag is listed in [tools](./tools/README.md), including `script`, `scan`, `tighten`, `export`, `audio` and `styles`, which are not shown above.
- `npm run studio`: Remotion Studio on `src/index.ts`.
- `edit.json`: the plan, validated by `Edit` in `src/schema.ts`.
- `remotion.config.ts`: JPEG frames at quality 95, h264, CRF 17 unless `REEL_PRORES` is set, and `projects/` as the public dir.
- `vitest.config.ts`: leaves `.claude/**` out of test runs, so session worktrees do not run twice.

Parts:

- [src](./src/README.md): the compositions and the plan schema.
- [tools](./tools/README.md): the CLI, resolver and b-roll library.
- [audio](./audio/README.md): the mix.
- [review](./review/README.md): the review board and style lab.
- [styles](./styles/README.md): the style library, with [ivory](./styles/ivory/README.md) and [blueprint](./styles/blueprint/README.md).

## Invariants

- Claude writes `edit.json`. `validate` turns it into `build/edit.resolved.json`, and that file is the only thing the compositions render.
- Shots and reveals anchor to spoken words, in order. An anchor not found is an error.
- A new visual kind has to touch `src/schema.ts`, `VisualView` in `src/Visuals.tsx`, `visualAnchors` in `tools/resolve.ts`, and the card catalog in `styles/blueprint/style.ts`.
- Ivory is the only style that renders. `src/style.ts` picks it.
- Reels run at 30 fps. Only `export` uses the source's frame rate.
- `projects/`, `broll/`, `sounds/`, `music/` and `references/` are git-ignored apart from their READMEs. `styles/*/checks/` and `.cache` are git-ignored too.

## Side Effects

- Files: each project reads and writes under `projects/<slug>/`. The library commands write `broll/` and `styles/`. The mix, run by `audio` and `render`, writes `.cache/audio/`. Details are in each part's contract.
- Network: `capture` and `fetch`, images with remote URLs at render, and the first run of the Kokoro voice. `uvx mlx_whisper` (`transcribe`, `script`, `check`) names a hosted model and `uv run --with` resolves packages, so both can download on first use.
- Subprocesses: `ffmpeg`, `ffprobe`, `uv`, `uvx`, `npx remotion`, macOS `say` and `open`, `mv`, `rm`, `git`, and Chrome through puppeteer-core.
- The review board serves on `127.0.0.1`, port 4317 or the next free one.

## Verification

- Run: `cd reels && npm test`
- Run: `cd reels && npm run typecheck`
- The Python in `audio/` and `tools/kokoro.py` has no automated tests.

## Licence notes

Remotion is free for individuals and companies of up to three people; larger companies need a [company licence](https://www.remotion.dev/license).
Check the licence of every sound, track and capture you publish.
