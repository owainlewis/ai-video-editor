# App

## Overview

The React editor UI, served by Vite from `server/`. It shows the plan live and sends edits to the server. A second page, `qc.html`, runs the real compositions for the headless QC in `media/qc.ts`.

## Interface

### Pages

Routes are read from the hash in `main.tsx`:

- `#/gallery` (any hash starting with it): `Gallery`. It takes options after `?`: `tab`, `canvas`, `theme`, `q`, `text`.
- `#/p/<slug>`: `Editor`. `?shot=<id>` opens that graphic in the inspector.
- `#/p/<slug>/review`: `Review`, the review before render.
- Anything else: `Home`.

### `api.ts`

| Call | Request |
| --- | --- |
| `api.projects()` | GET `/api/projects` |
| `api.library()` | GET `/api/library` |
| `api.effects(canvas)` | GET `/api/effects` |
| `api.gallery()` | GET `/api/gallery` |
| `api.project(slug, have?)` | GET `/api/projects/<slug>`, with `?have=<wordsKey>` to leave the words out when they have not changed |
| `api.upload(file, onProgress, to?, params?)` | POST by XHR, default `/api/upload` |
| `api.post(slug, action, payload?)` | POST `/api/projects/<slug>/<action>` |
| `api.remove(slug)` | POST `/api/projects/<slug>/delete`. The caller asks first with `confirmIt` |
| `api.events(on)` | EventSource on `/api/events`, returns a close function |

Also `clock(t)` and the types `Approval`, `ApprovalState`, `Issue`, `ChatMessage`, `Status`, `Asset`, `LibraryClip`, `Suggestion`, `Effect`, `Version`, `Take`, `Variants`, `BinClip`, `ProjectSummary`, `Project`, `Event`.

The UI's `api.post` actions: `cut`, `shot`, `shot-start`, `shot-end`, `undo`, `redo`, `render`, `parts`, `drop`, `place`, `chat`, `suggest`, `decide`, `stop`, `variants`, `variant-use`, `variant-clear`, `review`, `note`, `review-send`, `qc`, `mix`, `approve`, `unapprove`, `reveal`. `api.post` is typed by `engine/api.ts`: a wrong payload does not compile.

### Components

- `Editor` (`slug`), `Review` (`slug`), `Preflight` (`slug`, `p`, `onClose`), `Home`, `NewProject` (`onClose`), `Gallery`, `Tile`, `BeatBar`, `NoteBox`, `SoundPick`, `Shell`.
- `dialog.tsx`: `ask(q)` resolves to the text typed or null, `confirmIt(q)` to true or false; `Dialogs` is mounted once in `main.tsx` and draws the one that is open. The app never calls the browser's `prompt`, `confirm` or `alert`.
- `Approval.tsx`: `ApprovalBadge` (`a`), the pill by the title; `ApprovalLine` (`slug`, `a`, `running`, `onError`), the line on the export sheet; `useApproval(slug, onError)` (`approve`, `unapprove`, `reveal`, `busy`); `explain(a)`, `LABEL`, `shortDate`.
- `ui.tsx`: `ThemeSwitch`, `KeysButton` (`keys`), `UndoIcon`, `RedoIcon`, `ago(ms)`.
- `project.ts`: `useProject(slug)` loads a project and keeps it current. `playhead.tsx`: `playhead` (`get`, `set`, `subscribe`), `usePlayhead(select?)`, `Clock`. `Preflight.tsx` also exports `preflight(p)`, the lines of the sheet.
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
| Left, Right | Step to the previous or next beat. With no beats (YouTube): a frame, or a second with Shift |
| M | Write a review note at the playhead |
| ? | Open or close the keys sheet (`KeysButton`, on `window`, in the editor and the review) |
| Cmd/Ctrl+1, 2, 3 | Show or hide the library, the timeline, or the right-hand panel (Claude and the inspector), even while typing |

### Panels

`layout.tsx`: `usePanels(kind)` keeps each panel's size and whether it shows, per reel or YouTube, in `localStorage` (`studio-panels-<kind>`). `panelStyle` puts the sizes on `.editor` as `--left`, `--right` and `--bottom`; `Splitters` are the edges a panel is dragged by (double-click for its usual size); `PanelToggles` are the three buttons in the header. Opening a graphic shows the right-hand panel.

In the Mac app (`mac-app` on `<html>`, set in `index.html`) the header is the window's title bar: it drags the window and leaves room for the traffic lights.
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

### Review keys

Handled in `Review`, on `window`:

| Key | Action |
| --- | --- |
| J, K | Next, previous item in the list |
| A | Approve, then go to the next waiting item |
| C | Ask for a change and put the cursor in the note |
| N | Next waiting item |
| W | Watch the whole video, or go back to one item |
| M | Write a note at the playhead |
| P | Phone frame on a reel |
| Escape | Leave a field |

### QC page

`qc.html` loads `qc.tsx`. `?slug=` selects a project. No slug selects library mode. It sets these on `window`:

- `qcReady`, `qcSeek(frame)`, `qcMeasure()`, `qcError`.
- `qcLoad(resolved)`: library mode only.

`qcMeasure` reads the `data-qc` attributes `ambient`, `canvas`, `mark`, `edge` and `label`.

## Invariants

- One dialog shows at a time; asking for another cancels the first. Enter takes the answer, Escape or a click outside cancels, and keys pressed in a dialog do not reach the page behind it. A dialog whose action cannot be undone opens with the focus on Cancel.
- Rejecting a suggestion asks for an optional reason; cancelling that dialog leaves the suggestion pending.
- Colours come only from the tokens at the top of `style.css`, each a `light-dark()` pair. No rule or component names a colour of its own, except things drawn on the video (the phone frame, labels on thumbnails). With no `data-theme` the page follows the system.
- `Home` shows a card per project from the summary (`thumb`, `exported`, `review`, `approval`, `modified`), filtered by a search box and a format switch. Delete is on the card, not in the editor's header. A reel's card shows its approval state (Draft, Exported, Approved, Out of date) unless a job is running or failed. With any reel, the page shows "This week: N of 7 approved", counted Monday to Sunday from each reel's approval time (`engine/approve.ts`).
- A reel's approval: the editor shows `ApprovalBadge` by the title. When the final export is current and not yet approved (Exported, or Out of date after a new export), Approve is the header's filled button and Export is not. Approved shows Show in Finder when the server can (`reveal`); otherwise the export sheet shows the path. The export sheet's Approval line sits apart from the pre-flight lines and never changes whether the export is ready. Unapprove asks first.
- A sentence on the Said track narrower than 44 px is drawn as a mark, without its words.
- The playhead's time is not React state. `Editor` writes it to the `playhead` store on every frame; only `Clock`, the playhead line, the lit sentence, the lit word in the script and the current beat subscribe. Handlers read `playhead.get()`.
- The picked graphic is a shot id, not a start time. `Inspector` saves by id, and the server writes the id into the plan when the anchor changes, so the inspector stays on the shot.
- Export always goes through `Preflight`. Export is disabled there with plan errors. "Export anyway" sends `force` only when QC is up to date and has errors.
- `Review` saves a decision with the item's hash. A 409 means the graphic changed; the page shows the error and the reload brings the new version.
- A note typed on an item is saved when the field loses focus. A note on a waiting item sets it to change (in `server/review.ts`).
- `SoundPick` shows Mix as on only when a mix exists. Picking Mix starts one when there is none or it is out of date.
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
- `Home`, `Gallery`, `Editor`, `Library` and `watchRestarts` share one singleton `EventSource` on `/api/events` through `api.events`. There is no polling of the server.
- Changes `location.hash` to navigate. `Gallery` calls `history.replaceState`.
- Adds `window` listeners for keys, hash changes and drags, and removes them on cleanup.
- Writes the `qc*` globals on `window` in QC.
- `ThemeSwitch` keeps the chosen theme in `localStorage` under `studio-theme` and sets `data-theme` on `<html>`. `index.html` applies it before the first paint. Nothing else is kept in the browser.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
