# App

## Overview

The React editor UI, served by Vite from `server/`. It shows the plan live and sends edits to the server. A second page, `qc.html`, runs the real compositions for the headless QC in `media/qc.ts`.

## Interface

### Pages

Routes are read from the hash in `main.tsx`:

- `#/gallery` (any hash starting with it): `Gallery`. It takes options after `?`: `tab`, `canvas`, `theme`, `q`, `text`.
- `#/p/<slug>`: `Editor`.
- Anything else: `Home`.

### `api.ts`

| Call | Request |
| --- | --- |
| `api.projects()` | GET `/api/projects` |
| `api.library()` | GET `/api/library` |
| `api.effects(canvas, style?)` | GET `/api/effects` |
| `api.gallery()` | GET `/api/gallery` |
| `api.project(slug)` | GET `/api/projects/<slug>` |
| `api.upload(file, onProgress, to?, params?)` | POST by XHR, default `/api/upload` |
| `api.post(slug, action, payload?)` | POST `/api/projects/<slug>/<action>` |
| `api.remove(slug, title)` | POST `/api/projects/<slug>/delete` after a confirm dialog |
| `api.events(on)` | EventSource on `/api/events`, returns a close function |

Also `clock(t)` and the types `Issue`, `ChatMessage`, `Status`, `Asset`, `LibraryClip`, `Suggestion`, `Effect`, `Version`, `Take`, `Variants`, `BinClip`, `ProjectSummary`, `Project`, `Event`.

The UI's `api.post` actions: `cut`, `shot`, `shot-start`, `shot-end`, `undo`, `redo`, `render`, `drop`, `place`, `chat`, `suggest`, `decide`, `stop`, `variants`, `variant-use`, `variant-clear`.

### Components

- `Editor` (`slug`), `Home`, `NewProject` (`onClose`), `Gallery`, `Tile`, `BeatBar`.
- `Timeline`, `Inspector` and `Library`: props are in their files. `Editor` is the only parent.
- Helpers: `previewShot`, `gist`, `toSentences`. Types: `PlanShot`, `Range`, `Item`.
- Drag types: `CLIP` (`application/x-studio-clip`, a library or asset clip for the timeline) and `SOURCE` (`application/x-studio-source`, a bin clip for the cut).

### Keys

Handled in `Editor`, on `window`:

| Key | Action |
| --- | --- |
| Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z | Undo, redo |
| Escape | Close the open graphic |
| Delete, Backspace | Remove the picked graphic; otherwise ripple delete the selected segment, or delete the selected range |
| B | Split the cut at the playhead |
| I, O | Set in and out marks |
| Left, Right | Step to the previous or next beat |
| J, K, L | Shuttle back, stop, shuttle forward (up to 4x) |

Handled elsewhere:

| Key | Where | Action |
| --- | --- | --- |
| Cmd/Ctrl+Enter | `Editor` chat box | Send the note |
| Enter | `Inspector` takes brief | Ask Claude for takes, unless Claude is working |
| Space | Player in `Editor` and the large `Gallery` view | Play or pause |
| Escape | `NewProject`, on `window` | Close the dialog, unless an upload is running |
| Escape | Large `Gallery` view, on `window` | Close the view |
| Alt while trimming a segment edge | `Timeline` | Snap to frames instead of word edges |

### QC page

`qc.html` loads `qc.tsx`. `?slug=` selects a project. No slug selects library mode. It sets these on `window`:

- `qcReady`, `qcSeek(frame)`, `qcMeasure()`, `qcError`.
- `qcLoad(resolved)`: library mode only.

`qcMeasure` reads the `data-qc` attributes `ambient`, `canvas`, `mark`, `edge` and `label`.

## Invariants

- The editor reloads the project on mount and on `plan` or `status` events for its slug. `chat` events do not reload.
- A cut edit posts the whole cut. If the save fails, `Editor` shows the error and rethrows so the timeline can put back its live view.
- `Inspector` saves 700 ms after the last change and shows it in the player at once. A fresh plan replaces the form unless a save is pending.
- The preview draft is dropped whenever the server's resolved plan changes.
- With a graphic picked, Delete never cuts footage.
- The key handler ignores input, textarea, select and contenteditable targets.
- A range delete by key needs a selection longer than 0.04 s.
- A cut change clears the selection and the in and out marks.
- Export is disabled while rendering or with any error issue.
- While Claude works, chat send is blocked and Suggest and the Takes `Ask Claude` button are disabled. The footer `Ask Claude` button in `Inspector` stays enabled.
- Only ready bin clips can be dragged.
- `api` helpers throw `Error(data.error ?? statusText)` on a failed response. Uploads reject with the response text.
- `Gallery` reads its options once, on mount, and writes `tab`, `canvas` and `theme` back to the hash, plus `q` and `text` when they are set.
- QC: with a slug, `qcReady` is true only after the plan has rendered. In library mode it is true at page load, before any plan, and `qcLoad` clears it until the new plan has mounted. `qcSeek` waits for fonts and video, and gives up waiting on video after 1500 ms without rejecting. A graphic that throws sets `qcError`.

## Side Effects

- HTTP through `api.ts`, plus direct GETs for `build/level.json`, thumbnails, `checks/frame.jpg`, the render download, and `build/edit.resolved.json` in QC.
- `Home`, `Gallery`, `Editor` and `Library` each open their own EventSource through `api.events`. There is no polling of the server.
- Changes `location.hash` to navigate. `Gallery` calls `history.replaceState`.
- Adds `window` listeners for keys, hash changes and drags, and removes them on cleanup.
- Writes the `qc*` globals on `window` in QC.
- Uses no `localStorage` or `sessionStorage`.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
