# Review board

## Overview

A local web app for reviewing a draft. Each shot loops in its own player with Approve, Change and a note. The style lab does the same for each card in a style. It never calls a model: Claude Code reads the notes with `reel feedback`. Start it with `npm run reel -- review [slug]`.

## Interface

Server (`server.ts`):

- `startReview(root, port = 4317)` starts Vite and the JSON API, and returns `{ url, close }`.

| Route | What it does |
|---|---|
| `/api/events` | Server-sent events. Sends `{ slug }` when a plan or render changes. |
| `/api/projects` | `listProjects`: one row per project. |
| `GET /api/reel/<slug>` | The resolved plan, shots, review and reel hash. |
| `PUT /api/reel/<slug>/notes` | Saves the whole-reel note. Body: `{ text }`. |
| `PUT /api/reel/<slug>/shot/<id>` | Saves a shot. Body: `{ hash, status?, comment? }`. |
| `GET /api/styles/<id>` | The style's review, its cards and which style is active. |
| `PUT /api/styles/<id>/notes` | Saves the whole-style note. Body: `{ text }`. |
| `PUT /api/styles/<id>/card/<card>` | Saves a card. Body: `{ hash, status?, comment? }`. |

Any other path that is a file under `projects/` is served from disk with byte ranges. The rest goes to Vite.

Pages (`main.tsx`, by hash): `#/` is `Library`, `#/reel/<slug>` is `Board`, `#/styles/<id>` is `StyleLab`. On the board the keys are `j` and `k` to move, `a` to approve, `c` to ask for a change, `n` for the next waiting shot and Escape to leave a note field.

Modules:

- `model.ts` (pure): `Status`, `Past`, `ShotReview`, `Review`, `ShotInfo`, `emptyReview`, `hash`, `stable`, `shotIds`, `shotHash`, `reelHash`, `shotWords`, `shotInfo`, `mergeReview`, `counts`, `formatFeedback`.
- `store.ts`: `reviewFile`, `saveReview`, `loadReel`, `listProjects`.
- `styles.ts`: `CardReview`, `StyleReview`, `cardHash`, `mergeStyleReview`, `styleReviewFile`, `saveStyleReview`, `loadStyleReview`, `formatStyleFeedback`.
- `shared.tsx`: `playable`, `stage`, `frames`, `Accented`, `usePlanEvents`, `ago`, `secs`.

`tools/cli.ts` calls `startReview`, `loadReel`, `formatFeedback`, `loadStyleReview` and `formatStyleFeedback`.

## Invariants

- Status is `waiting`, `approved` or `change`. The server answers 400 for anything else.
- A save carries the hash the page last saw. If the shot or card has changed, the server answers 409 and the page reloads.
- A shot's id comes from its spoken anchor, so it survives a change of look. A repeated anchor gets `-2`, `-3`.
- `mergeReview`: a shot whose hash changed goes back to `waiting`, and its old status and comment move to `history`. New shots start `waiting`. Reviews of shots that left the plan move to `removed` and come back if the shot does.
- Whole-reel notes are tied to `reelHash`. Once the reel changes they move to `notesHistory`. `reelHash` ignores `audio`, because the mix comes and goes with renders.
- `shotHash` covers anchor, layout, header, keep, sfx, visual, length in frames and words. It does not cover `tone` or `enter`, so changing only those does not reopen a shot.
- `cardHash` covers a card's sample, slots, layouts and summary.
- `hash` must give the same result in Node and the browser. `stable` sorts keys so the same plan always hashes the same.
- Writing a note on a waiting shot or card also sets it to `change`. This is done in the page, not the server.
- Slugs must match `^[\w.-]+$` and exist. Project files are only served from inside `projects/`.
- `playable` swaps in the light preview copies from `makePreviews` in `tools/cli.ts`. Renders use the originals.

## Side Effects

- `loadReel` and `loadStyleReview` write the review file whenever the merge changed it, so a GET can write to disk. `listProjects` does this through `loadReel`.
- `saveReview` and `saveStyleReview` write `projects/<slug>/review.json` and `styles/<style>/review.json` through a temp file and a rename.
- The server watches `projects/` recursively for `build/edit.resolved.json` and `renders/*.mp4`, and pushes an event after 200 ms.
- The server binds `127.0.0.1`, and tries up to 20 ports above `port` when one is taken.
- The browser fetches `/api/*`, listens on `/api/events`, and plays project media through Remotion players.

## Verification

- Run: `cd reels && npm test` (`tests/review.test.ts`)
- Run: `cd reels && npm run typecheck`
