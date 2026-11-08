# Tools

## Overview

The mechanical half of the editor. `cli.ts` is the `reel` command. `resolve.ts` turns a plan and a word-timed transcript into exact times and lints the result. `broll.ts` runs the b-roll library, `stylesheet.ts` renders card contact sheets, and `kokoro.py` speaks a script.

## Interface

`npm run reel -- <command>` (`cli.ts:main`). Positional arguments come before any `--flag`.

| Command | Flags | What it does |
|---|---|---|
| `new <slug> <video>` | `--broll a.mp4 b.mp4` | Makes a project and normalises the footage to 30 fps. |
| `script <slug> <file>` | `--silent`, `--engine kokoro`, `--voice`, `--speed`, `--rate` | Makes a project from a script, with no footage. |
| `transcribe <slug>` | `--prompt` | Word timings from mlx-whisper. |
| `tighten <slug>` | `--gap`, `--speed`, `--cut a-b` (repeatable) | Trims pauses and cuts ranges. Transcribe again after. |
| `scan <slug>` | `--ref t1,t2` (required) | Finds where the speaker is on camera (YouTube). |
| `capture <slug> <url>` | `--name` (required), `--width`, `--height`, `--dark`, `--wait`, `--selector`, `--full` | Screenshots a page in headless Chrome. |
| `fetch <slug> <url>` | `--name` (required), `--dir` | Downloads a file. `--dir` defaults to `logos`. |
| `validate <slug>` | | Resolves the plan and reports every issue. |
| `audio <slug>` | | Validates, then runs the mix. |
| `stills <slug>` | | One still per shot, and a contact sheet. |
| `render <slug>` | `--draft` | Validates, mixes, validates again, then renders. |
| `export <slug>` | `--scale` | YouTube: each graphic as a ProRes clip, plus timecodes and FCPXML. |
| `check <slug>` | | Cut strips, black edges, loudness, and a re-transcription of the render. |
| `review [slug]` | `--port`, `--no-open` | Starts the review board. |
| `feedback <slug>` | | Prints the board's open notes. Saves `review.json` first if the merge changed it. |
| `styles` | `--style`, `--write` | Lists a style's cards. `--write` regenerates `style.json` and `registry.json`. |
| `styles stills` | `--style`, `--max`, `--sample` | Card contact sheets. |
| `styles new <id>` | | Starts a new style folder from Blueprint. |
| `styles feedback` | `--style` | Prints the style lab's open notes. Creates or rewrites `styles/<id>/review.json` first if the merge changed it. |
| `index` | | Splits `broll/` files into shots and updates the index. |
| `broll [words...]` | | Lists library clips, best matches first. |

`resolve.ts` (pure):

- `norm`, `findPhrase`, `CUT_LEAD`, `visualAnchors`, `resolveShots`, `chunkWords`, `estimateWords`, `sfxEvents`.
- `cameraRanges`, `lintOnCamera`, `lintWide`, `lintShots`.
- Types `Issue` and `Format`.

`broll.ts`: `Clip`, `indexLibrary(root)`, `listLibrary(root, query)`, `useClip(root, projectDir, id)`.

`stylesheet.ts`: `renderCardSheet(root, def, out, texts)`.

`kokoro.py`: `python tools/kokoro.py <script.txt> <out.wav> [voice] [speed]`.

## Invariants

- Shot anchors are searched in order, each after the last one found. An anchor that is not found is an error, and that shot is dropped.
- The first shot starts at 0. Every other shot starts `CUT_LEAD` (0.05 s) before its word, snapped to a frame. Each shot ends where the next starts, and the last ends at the duration.
- `visualAnchors` sets the order of a visual's `times`. Components read `times` by index, so a change here must match the component. A kind with no case gets no reveal times.
- A `keep` shot needs the same layout as the shot before it, a previous visual, and no visual of its own.
- `lintShots` applies per `format` rules (`react`, `mixed`, `film`) and hands YouTube plans to `lintWide`. `split` and `scene` are errors on YouTube. `side` and `over` are errors on a reel.
- `validate` fails on a schema error, a missing anchor or asset, a b-roll clip used twice, a non-looping clip shorter than its shot, an unknown `broll:` id, or a footage reel with no `face`. Warnings do not stop it.
- Slot limit warnings always come from Blueprint's `slotIssues`, because Ivory's cards are Blueprint's.
- Reels resolve and render at a fixed 30 fps (`FPS`). `export` renders clips at the source file's frame rate.
- `tighten` caps `--speed` at 1.05 and keeps the first originals as `source/*.orig.*`, so it can be rerun.
- `transcribe` drops words Whisper invents after speech ends, and joins numbers it split.
- `render` validates twice around the mix, so the resolved plan picks up `build/mix.wav`.
- `index` skips a source file whose `name@mtime` stamp is already in the index.
- `useClip` copies a clip but does not add it to `assets/ledger.json`, despite its comment. Only `new --broll`, `capture` and `fetch` write the ledger.
- `styles` defaults to the `ivory` style. The comment in `cli.ts` says Blueprint, but Blueprint is not registered, so `--style blueprint` fails.
- With no command the CLI prints the first 21 lines of `cli.ts` as help. That cuts off the last two lines of the header comment (`index` and `broll`).
- `stylesheet.ts` imports `@remotion/bundler`, which `package.json` does not list. It resolves only through other Remotion packages.

## Side Effects

- Every project command reads and writes under `projects/<slug>/`.
- `new` and `script` create the project folders, `source/*`, `project.json`, and `checks/frame.jpg` (`new` only).
- `transcribe` writes `transcript.json`, `transcript.txt` and Whisper's raw output in `build/whisper/`, and runs `uvx mlx_whisper`. `script` runs it too unless `--silent`, which writes the two transcript files from estimated timings instead.
- `script` writes `script.txt` in the project folder. It uses macOS `say` by default, through `build/say.aiff`. With `--engine kokoro` it writes `build/kokoro.wav` and `build/script.txt`, and runs `kokoro.py`, which downloads its model to `~/.cache/reel/kokoro` on first use and needs Homebrew's `espeak-ng`.
- `tighten` moves the originals aside, rewrites `source/talking.mp4` and `source/voice.wav`, writes `build/tighten*`, and updates `project.json`.
- `scan` writes `build/camera.json`.
- `capture` and `fetch` use the network. They write under `assets/` and to `assets/ledger.json`.
- `validate` writes `build/edit.resolved.json` and `build/audio.json`, builds `build/preview.mp4` and `build/preview.m4a` when stale, and copies library clips into `assets/broll/`. `stills`, `render`, `export`, `audio` and `review <slug>` all run it.
- `render` writes `renders/final.mp4`, or `renders/draft.mp4` with `--draft`.
- `export` first deletes `.mov`, `.md`, `.json` and `.fcpxml` files in `export/`, then writes new ones. It sets `REEL_PRORES=1` for Remotion.
- `stills` deletes old `checks/stills/*.jpg`, writes one new `checks/stills/NN.jpg` per shot, and writes `checks/stills.jpg`.
- `check` writes `checks/cuts/`, `checks/cuts.jpg`, `checks/opening.jpg` and `build/check-whisper/`.
- `review` opens the browser with `open` unless `--no-open`.
- `index` writes `broll/.clips/`, `broll/index.json` and `broll/sheet.jpg`.
- `styles --write` writes each registered style's `style.json` and `styles/registry.json`. `styles new` creates a folder under `styles/`. `styles stills` deletes old stills in `styles/<id>/checks/stills/` for the text modes it renders, then writes `styles/<id>/checks/`.
- Subprocesses: `ffmpeg`, `ffprobe`, `uv`, `uvx`, `npx remotion`, `say`, `open`, `mv` and `rm`. Chrome runs through puppeteer-core.

## Verification

- Run: `cd reels && npm test` (`tests/resolve.test.ts` covers `resolve.ts`)
- Run: `cd reels && npm run typecheck`
