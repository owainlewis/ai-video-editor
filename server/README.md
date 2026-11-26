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
- `review.ts`: the review file (`review.json`): `loadReview(dir, r, words)`, `setItem(dir, r, words, id, hash, change)`, `saveNote(dir, words, change)`, `startSend(dir, slug, r, words)`, `finishSend(dir)`, `REVIEW`, type `ReviewState`. The rules are in `engine/review.ts`.

### Request order

1. A URL starting `/api/` goes to the API.
2. `/library/<path>` serves files from `library/broll/.clips`.
3. `/<path>` serves files from `projects/`.
4. Anything else goes to Vite (`appType: "spa"`, root `app/`).

### Routes

API paths are split on `/` and compared by position. Extra trailing segments are not rejected.

| Method | Path | What it does |
| --- | --- | --- |
| any | `/api/events` | Server-sent events: `hello` (with process `boot` ID), `plan`, `status`, `library`, `cards`, `chat`. |
| POST | `/api/upload?name&title&canvas` | Saves a source video, starts an ingest job, returns `{ slug }`. |
| POST | `/api/library?name` | Saves a b-roll clip, starts `broll index`, returns `{ ok }`. |
| any other | `/api/library` | Returns `{ busy, clips }`. |
| any | `/api/effects?canvas[&removed=1]` | Returns the library cards from `effectList` (`styles/library.json`), or with `removed=1` the ones taken out of it. |
| POST | `/api/cards` | `{ id, inLibrary }`: takes a card out of the library or adds it back (`media/cardlibrary.ts`), and tells the editors (`cards` event). |
| any | `/api/gallery` | Projects with a resolved plan and at least one visual, newest first, captions emptied. |
| any | `/api/projects` | Project summaries, newest first: `slug`, `title`, `canvas`, `duration`, `status`, `modified`, `thumb`, `exported`, `review` (`approved` and `total` from `review.json` as it is), `approval` (reels only: `state` and `at`, else null). |
| POST | `/api/projects/<slug>/delete` | Moves the project to `projects/.trash/`. |
| GET | `/api/projects/<slug>?have` | `{ slug, status }` until ready, then the full project state, with `review`, `qc`, `mix`, `exportCheck` and `approval` (reels only: `state`, `ready`, `reason`, `record`, `folder`, `reveal`). |
| GET | `/api/projects/<slug>/clips` | The project's bin. |
| POST | `/api/projects/<slug>/clips?name` | Saves a clip to the bin, starts a clip job, returns `{ id }`. |
| POST | `/api/projects/<slug>/assets?name` | Saves an asset, returns `{ path }`. |
| POST | `/api/projects/<slug>/chat` | `{ note, selection?, playhead? }`. Starts Claude. Returns before it finishes. |
| POST | `/api/projects/<slug>/suggest` | Starts Claude with the suggestions prompt. |
| POST | `/api/projects/<slug>/decide` | `{ id, accept, note }`. Accepts or rejects a suggestion. |
| POST | `/api/projects/<slug>/drop` | `{ ref, at, length = 3 }`. Places a b-roll cutaway. |
| POST | `/api/projects/<slug>/shot-start` | `{ from, to }`. Re-anchors a shot's start. |
| POST | `/api/projects/<slug>/shot-end` | `{ id or start, to }`. Ends a graphic on a word. |
| POST | `/api/projects/<slug>/shot` | `{ id or start, shot?, remove? }`. Replaces or removes a graphic. |
| POST | `/api/projects/<slug>/place` | `{ card, at }`. Places a library card, returns `{ start, id }`. |
| POST | `/api/projects/<slug>/variants` | `{ start, note? }`. Resets takes and starts Claude. |
| POST | `/api/projects/<slug>/variant-use` | `{ id }`. Applies a take and clears the takes. |
| POST | `/api/projects/<slug>/variant-clear` | Clears the takes. |
| POST | `/api/projects/<slug>/stop` | Stops the Claude run. |
| POST | `/api/projects/<slug>/undo` | Returns `{ ok }`, false when there is nothing to undo. |
| POST | `/api/projects/<slug>/redo` | Returns `{ ok }`, false when there is nothing to redo. |
| POST | `/api/projects/<slug>/cut` | `{ cut }`. Validates and saves `cut.json`. |
| POST | `/api/projects/<slug>/render` | `{ part?, from?, to?, force? }`. Starts a render job. |
| POST | `/api/projects/<slug>/qc` | Starts a QC job that keeps unchanged graphics' results. |
| POST | `/api/projects/<slug>/mix` | Starts a preview mix job. |
| POST | `/api/projects/<slug>/review` | `{ id, hash, status?, comment? }`. Saves a decision on one review item. |
| POST | `/api/projects/<slug>/note` | `{ t, text }` adds a timeline note; `{ id, text?, status?, remove? }` changes one. |
| POST | `/api/projects/<slug>/review-send` | Starts Claude with every open note and change. |
| POST | `/api/projects/<slug>/approve` | Copies a reel's current export and cover to the approved folder (`media/approve.ts`). Waits for the cover; returns `{ ok, record }`. |
| POST | `/api/projects/<slug>/unapprove` | Moves the reel's approved files to the Trash and drops `approved.json`. |
| POST | `/api/projects/<slug>/reveal` | Shows the approved video in Finder (`open -R`), or the folder when the file has moved on. |

## Invariants

### Requests

- Every `POST /api/projects/<slug>/<action>` body is parsed with that action's schema in `engine/api.ts`. An unknown action is 404; a body that fails its schema is 400 with the path and reason.
- `GET /api/projects/<slug>?have=<wordsKey>` leaves out `words` and `clipWords` when the key still matches (the cut and transcripts have not changed).
- A shot is addressed by its `id`. `start` (its time on the timeline) still works for `shot` and `shot-end`.
- `review` returns 409 when `hash` is not the item's current hash, and 404 for an id that is not a review item.
- `review-send` returns 400 with nothing open and 409 while Claude is working. It marks open notes `sent` before Claude starts.
- `qc`, `mix` and `render` return 409 while a job is running. `render` passes `--force` only when asked.
- `approve` returns 409 while a job is running, and 409 with the reason when the export is not current, its check failed, or the project is not a reel. `unapprove` returns 404 for a reel that is not approved. `reveal` returns 501 off macOS (the editor shows the path instead) and 404 when neither the file nor the folder exists.
- `approve` and `unapprove` send a `status` event, so the projects page and the editor reload.

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

- `GET /api/projects/<slug>` also writes `review.json` when the plan's items changed since the last read.
- `setItem` writes `build/review/<id>-<hash>.json` (the item's resolved shots) the first time a decision is made on that version.
- `finishSend` reads and deletes `review-replies.json`, which Claude writes.
- `qc` and `mix` start detached jobs (`cli.ts qc <slug> --status --cached`, `cli.ts mix <slug> --status`) that report in `status.json`.

- Watches `projects/` recursively and `library/broll/` for `index.json`. A change to a project's `status.json` or `approved.json` sends a `status` event.
- Holds in memory: event clients, debounce timers, the library busy flag and running Claude processes. A restart loses them.
- Spawns `npx tsx cli.ts` detached for `ingest`, `clip`, `render` and `broll index`. Output goes to `<project>/job.log` or `library/broll/job.log`. Restarting the server does not stop them.
- `approve` writes to the approved folder (`STUDIO_APPROVED`, else `~/Reels/Approved`; the editor shows it through `folderLabel`) and `unapprove` moves files to the Trash. `reveal` spawns `open`.
- Spawns `claude -p --output-format stream-json --verbose --permission-mode acceptEdits` in the repo root, with `--resume` when a session exists.
- Reads and writes in a project: `edit.json`, `cut.json`, `chat.json`, `suggestions.json`, `variants.json`, `history/`, `assets/`, and `clips/<id>/status.json` (`POST clips`).
- `GET /api/projects/<slug>` can write: the first version, asset thumbnails, `build/level.json` for each ready clip, and everything `resolveProject` writes. It is not read-only.
- Uploads go to `projects/.uploads/`, the project's `assets/`, or `library/broll/`.
- `listAssets` runs ffmpeg for thumbnails and caches them in `assets/.thumbs/`. It also writes clip durations to `assets/.thumbs/meta.json`.
- `trashProject` renames the project into `projects/.trash/<slug>-<stamp>` and moves its upload with it. Bin clip uploads named `<slug>-<id>.<ext>` stay in `.uploads/`.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
