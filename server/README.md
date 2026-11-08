# Server

## Overview

The local API behind the editor. It serves the UI through Vite, serves project files, watches plans, saves versions, starts long jobs as detached CLI processes, and runs headless Claude for chat notes, suggestions and takes.

## Interface

### Modules

- `index.ts`: `startServer(port = 4747)` returns `{ url, close }`. `serveFile(root, req, res, prefix = "")` serves a file with byte ranges and returns false if it did not. `media/qc.ts` uses it too.
- `agent.ts`: `ask(projects, slug, note, selection, playhead, emit, onDone?, prompt?)`, `stop`, `isRunning`, `loadChat`, `promptFor`, types `ChatMessage` and `Selection`.
- `history.ts`: `snapshot(project, by)`, `undo`, `redo`, `versions`, `redoable`, type `Version`.
- `insert.ts`: plan edits that roll back on new errors: `insertAt`, `placeOver`, `dropBroll`, `moveShotStart`, `moveShotEnd`, `editShot`, `placeCard`.
- `assets.ts`: `listAssets(dir, slug)`, `saveAsset(dir, name, req)`, type `Asset`.
- `suggest.ts`: `loadSuggestions`, `checkSuggestions`, `decide`, `SUGGEST`, type `Suggestion`.
- `variants.ts`: `loadVariants`, `saveVariants`, `clearVariants`, `resolveVariants`, `VARIANTS`, types `Variant`, `Variants`, `ResolvedVariant`.
- `trash.ts`: `trashProject(projects, slug, busy)`.

### Request order

1. A URL starting `/api/` goes to the API.
2. `/library/<path>` serves files from `library/broll/.clips`.
3. `/<path>` serves files from `projects/`.
4. Anything else goes to Vite (`appType: "spa"`, root `app/`).

### Routes

API paths are split on `/` and compared by position. Extra trailing segments are not rejected.

| Method | Path | What it does |
| --- | --- | --- |
| any | `/api/events` | Server-sent events: `plan`, `status`, `library`, `chat`. |
| POST | `/api/upload?name&title&canvas` | Saves a source video, starts an ingest job, returns `{ slug }`. |
| POST | `/api/library?name` | Saves a b-roll clip, starts `broll index`, returns `{ ok }`. |
| any other | `/api/library` | Returns `{ busy, clips }`. |
| any | `/api/effects?canvas&style` | Returns the library cards from `effectList`. |
| any | `/api/gallery` | Projects with a resolved plan and at least one visual, newest first, captions emptied. |
| any | `/api/projects` | Project summaries, newest first. |
| POST | `/api/projects/<slug>/delete` | Moves the project to `projects/.trash/`. |
| GET | `/api/projects/<slug>` | `{ slug, status }` until ready, then the full project state. |
| GET | `/api/projects/<slug>/clips` | The project's bin. |
| POST | `/api/projects/<slug>/clips?name` | Saves a clip to the bin, starts a clip job, returns `{ id }`. |
| POST | `/api/projects/<slug>/assets?name` | Saves an asset, returns `{ path }`. |
| POST | `/api/projects/<slug>/chat` | `{ note, selection?, playhead? }`. Starts Claude. Returns before it finishes. |
| POST | `/api/projects/<slug>/suggest` | Starts Claude with the suggestions prompt. |
| POST | `/api/projects/<slug>/decide` | `{ id, accept, note }`. Accepts or rejects a suggestion. |
| POST | `/api/projects/<slug>/drop` | `{ ref, at = 0, length = 3 }`. Places a b-roll cutaway. |
| POST | `/api/projects/<slug>/shot-start` | `{ from, to }`. Re-anchors a shot's start. |
| POST | `/api/projects/<slug>/shot-end` | `{ start, to }`. Ends a graphic on a word. |
| POST | `/api/projects/<slug>/shot` | `{ start, shot?, remove? }`. Replaces or removes a graphic. |
| POST | `/api/projects/<slug>/place` | `{ card, at = 0 }`. Places a library card, returns `{ start }`. |
| POST | `/api/projects/<slug>/variants` | `{ start, note? }`. Resets takes and starts Claude. |
| POST | `/api/projects/<slug>/variant-use` | `{ id }`. Applies a take and clears the takes. |
| POST | `/api/projects/<slug>/variant-clear` | Clears the takes. |
| POST | `/api/projects/<slug>/stop` | Stops the Claude run. |
| POST | `/api/projects/<slug>/undo` | Returns `{ ok }`, false when there is nothing to undo. |
| POST | `/api/projects/<slug>/redo` | Returns `{ ok }`, false when there is nothing to redo. |
| POST | `/api/projects/<slug>/cut` | `{ cut }`. Validates and saves `cut.json`. |
| POST | `/api/projects/<slug>/render` | Starts a render job. |

## Invariants

### Requests

- Errors reply `{ error }`. A numeric `code` on the error becomes the HTTP status. Anything else is 500.
- Project routes other than delete need a slug matching `/^[\w.-]+$/` and an existing `project.json`, or they return 404.
- Other methods on a project route return 405. Unknown actions return 404.
- A project is ready only when `edit.json` and `transcript.json` both exist.
- `serveFile` refuses paths that leave its root.
- The server binds to 127.0.0.1 and tries up to 20 ports above the one asked for.

### Plans and versions

- `insertAt`, `moveShotStart`, `editShot` and `moveShotEnd` put back the earlier `edit.json` and throw 409 if the change adds an error that was not there before.
- Plan edits throw 409 with "the plan has errors; fix them first" when the plan does not resolve.
- Video is never slowed below 0.65x to fit a shot.
- Plan changes are debounced 150 ms per project. No version is saved from the watcher while Claude runs. A chat note becomes one version when it finishes.
- `snapshot` writes only when `edit.json` or `cut.json` differs from the newest version. There is no limit on versions.
- A new version clears redo. Those versions move to `history/undone/`.
- Undo needs at least two versions.
- `POST cut` returns 400 when the schema fails, a segment's clip is not ready, or a segment runs more than 0.05 s past its clip.

### Jobs and Claude

- One Claude run per project. A second `ask` throws, which the API returns as 500. `POST variants` resets `variants.json` before that check.
- Claude's tools are limited to Read, Edit, Write, Glob, Grep, and Bash for the studio, typecheck and test commands.
- `POST render` returns 409 while a job is running.
- `POST delete` returns 409 while Claude is working or a job is running. Nothing is erased.
- Bin and b-roll uploads must be mp4, mov, m4v, mkv or webm. Assets accept mp4, mov, m4v and webm video, or png, jpg, jpeg, webp, svg and gif images. `POST /api/upload` has no extension check.

## Side Effects

- Watches `projects/` recursively and `library/broll/` for `index.json`.
- Holds in memory: event clients, debounce timers, the library busy flag and running Claude processes. A restart loses them.
- Spawns `npx tsx cli.ts` detached for `ingest`, `clip`, `render` and `broll index`. Output goes to `<project>/job.log` or `library/broll/job.log`. Restarting the server does not stop them.
- Spawns `claude -p --output-format stream-json --verbose --permission-mode acceptEdits` in the repo root, with `--resume` when a session exists.
- Reads and writes in a project: `edit.json`, `cut.json`, `chat.json`, `suggestions.json`, `variants.json`, `history/`, `assets/`, and `clips/<id>/status.json` (`POST clips`).
- `GET /api/projects/<slug>` can write: the first version, asset thumbnails, `build/level.json` for each ready clip, and everything `resolveProject` writes. It is not read-only.
- Uploads go to `projects/.uploads/`, the project's `assets/`, or `library/broll/`.
- `listAssets` runs ffmpeg for thumbnails and caches them in `assets/.thumbs/`. It also writes clip durations to `assets/.thumbs/meta.json`.
- `trashProject` renames the project into `projects/.trash/<slug>-<stamp>` and moves its upload with it. Bin clip uploads named `<slug>-<id>.<ext>` stay in `.uploads/`.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
