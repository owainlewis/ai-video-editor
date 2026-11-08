# Studio

An AI-native video editor. Drop in a clip, then edit it by talking to Claude: select a section on the timeline and say what should change. Claude edits the plan, the editor shows it live, and the video is rendered once when you export.

```bash
npm install
npm run dev        # http://localhost:4747
```

Needs ffmpeg, [uv](https://docs.astral.sh/uv/) (for mlx-whisper and the audio mix) and the `claude` CLI, signed in. Put music and sound effects in `library/` (see `library/README.md`).

- `CLAUDE.md`: how Claude edits a project.
- `docs/ARCHITECTURE.md`: how it fits together.
- `docs/RULES.md`: the house rules, learned from notes.

## System Overview

One file drives everything: the plan, `projects/<slug>/edit.json`. Claude or the editor changes it. `resolveProject` in `media/project.ts` joins the plan to the transcript and writes `build/edit.resolved.json`, which is what the compositions render. The editor plays those compositions live. An export renders the same ones to a file.

The packages sit in layers:

- `engine/` is pure logic: the schema, timing and checks.
- `effects/` and `styles/` draw the picture.
- `media/` and `audio/` do the work on disk.
- `server/` and `app/` are the editor.
- `reels/` is a second tool with its own code. It shares no imports with the rest.

## Local Interface & Invariants

`cli.ts` is the command line. Run it with `npm run studio -- <command>`. `npm run dev` runs `serve`.

| Command | Arguments and flags | Calls |
| --- | --- | --- |
| `serve` | `--port` (default 4747) | `startServer` |
| `ingest` | `<file>`, `--slug`, `--canvas reel\|youtube`, `--title` | `ingest` |
| `clip` | `<slug> <file>`, `--id`, `--name` | `addClip` |
| `auphonic` | `<slug>` | `cleanProject` |
| `check` | `<slug>` | `resolveProject` |
| `qc` | `<slug>`, `--at` | `runQc` |
| `qc --library` | `--canvas`, `--card` | `runLibraryQc` |
| `stills` | `<slug>`, `--at` | `stills` |
| `frames` | `<slug>`, `--every` (default 15) | `frameSheets` |
| `scan` | `<slug>`, `--ref` | `scanCamera` |
| `variants` | `<slug>` | `resolveVariants` |
| `suggestions` | `<slug>` | `checkSuggestions` |
| `broll index` | none | `indexLibrary`, then `describeLibrary` |
| `broll describe` | none | `describeLibrary` |
| `broll` | `[words]` | `searchLibrary` |
| `render` | `<slug>`, `--force` | `runQc`, then `exportOverOriginal` or `renderFinal` |

Invariants in `cli.ts`:

- `need` throws unless `projects/<slug>/project.json` exists. `auphonic` and `ingest` do not call it.
- `render` allows one export per project. It throws if `build/export.lock` holds the pid of a live process. A lock with a dead pid is replaced.
- `render` runs QC first. Any error stops it unless `--force` is set.
- `render` uses `exportOverOriginal` only when the plan's `canvas` is `youtube`. Everything else uses `renderFinal`.
- `check`, `qc`, `variants` and `suggestions` set exit code 1 when they find errors. An unknown command prints usage and does not fail.

Side effects in `cli.ts`:

- `render` writes and removes `build/export.lock`, and writes `status.json` in the project.
- The other file, process and network effects are in the packages it calls.

`remotion.config.ts` sets global Remotion config when it loads:

- JPEG frames at quality 95 and the `h264` codec.
- CRF 17, unless `REEL_PRORES` is set.
- Public dir `projects`, entry point `effects/index.ts`.

## Subdirectories & System Boundaries

- `app`: [./app/README.md](./app/README.md) - The React editor UI, and the page headless QC measures.
- `audio`: [./audio/README.md](./audio/README.md) - The Python mix of voice, music and sound effects into `build/mix.wav`.
- `effects`: [./effects/README.md](./effects/README.md) - The Remotion compositions and every visual.
- `engine`: [./engine/README.md](./engine/README.md) - The plan schema, word-anchored timing, cut maths and checks. No side effects.
- `media`: [./media/README.md](./media/README.md) - Import, transcription, plan resolution, stills, export, QC, the b-roll library and Auphonic.
- `reels`: [./reels/README.md](./reels/README.md) - The separate reel tool: mock-ups, review board and styles.
- `server`: [./server/README.md](./server/README.md) - The local API: project files, plan watching, versions, jobs and headless Claude.
- `styles`: [./styles/README.md](./styles/README.md) - The style tokens and card catalog.

Not covered by a contract: `docs`, `research`, `library` and `projects`, which hold no code of their own, and `hyperframes`, whose only code is GSAP scripts inside its HTML compositions. The tests are in `tests` and `reels/tests`.

## Global Invariants

- `Edit` in `engine/schema.ts` defines the plan. When `edit.json` fails it, `resolveProject` returns no resolved plan and writes nothing.
- Shots and reveals anchor to spoken words, not seconds (`engine/resolve.ts:resolveShots`). A missing shot anchor is an error and drops the shot. A missing reveal anchor is an error, keeps the shot and shows the reveal at the shot's start. With a cut, both are warnings: the shot is left out, or the reveal shows at the start.
- `engine/` imports only `zod` and its own files, so it stays free of disk and process access.
- The editor and the export use the same compositions in `effects/`.
- `reels/` and the root packages do not import each other. A change to one's schema, resolver or styles does not reach the other.

## Global Side Effects

- Files: `media/` and `server/` read and write under `projects/<slug>/`. They also write `library/broll/` and `library/qc/`. `server/` also writes uploads to `projects/.uploads/` and moves deleted projects to `projects/.trash/`.
- Child processes: `ffmpeg`, `ffprobe`, `npx remotion`, `npx tsx cli.ts` (the server's long jobs, run detached), `uvx mlx_whisper`, `uv run python -m audio.mix`, `claude -p`, and headless Chrome for QC. The reel tool adds macOS `say` and `open`, `uv run` of `tools/kokoro.py`, and Chrome through puppeteer for `capture`.
- Network: Auphonic, at `https://auphonic.com/api`, with `AUPHONIC_API_KEY`. Render can also load image paths that start with `http` or `https`. The reel tool's `fetch` and `capture` commands use the network too.
- Local servers, all on `127.0.0.1`: the editor on 4747 or one of the next 20 ports, a QC server on a random port during QC, and the reels review board on 4317 or one of the next 20 ports.

## System Verification

- Run: `npm test` (runs `tests/` and `reels/tests/`)
- Run: `npm run typecheck` (root packages), and `cd reels && npm run typecheck` for the reel tool
