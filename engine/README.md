# Engine

## Overview

The pure core of Studio: the plan schema, word-anchored timing, cut maths, and the plan and layout checks. Nothing here reads files, spawns processes or uses the network. `media/` and `server/` do that work and pass data in. `app/` imports the types and helpers from `cut.ts`, `beats.ts`, `tighten.ts` and `insert.ts` directly, and `visualAnchors` from `resolve.ts`.

## Interface

### `schema.ts`

- `Edit`: zod schema for `edit.json`. Fields: `title`, `canvas`, `style`, `theme`, `leave`, `remove`, `captions`, `format`, `split`, `header`, `face`, `accents`, `music`, `grade`, `voiceGain`, `shots`.
- `Shot`: fields `at` and `layout` (required), plus `visual`, `shift`, `sfx`, `zoom`, `header`, `keep`, `tone`, `enter`, `picture`, `bg`, `hit`, `title`, `chip`, `inside`, `note`.
- `Visual`: discriminated union on `kind`. The list of kinds is in `schema.ts`.
- `Layout`: `full`, `punch`, `split`, `media`, `cutaway`, `scene`. YouTube only: `side`, `half`, `over`. Clean style only: `card`, `diagram`. On clean reels, `over` is the glass overlay.
- `Picture`, `SfxKind`.
- `Cut`, `Segment`, `MAIN` (the id `"main"`, the clip the project was made from): schema for `cut.json`.
- Types: `EditPlan`, `VisualSpec`, `CutPlan`, `CutSegment`, `Word`, `ResolvedItem`, `ResolvedVisual`, `ResolvedShot`, `Chunk`, `SfxEvent`, `Resolved`.

### `resolve.ts`

- `resolveShots(plan, words, duration, fps = 30, cut = false)`: returns `{ shots, issues }`.
- `norm`, `findPhrase(words, phrase, from = 0)`, `visualAnchors(v)`, `syncWords`.
- `chunkWords(words, accents, cuts, fps)`: caption chunks.
- `estimateWords(script, wpm = 165)`: word timings for a script with no recording.
- `sfxEvents(shots)`, `cleanSfx(shots)`: sound events sorted by time.
- `cameraRanges(dist, rate, threshold = 20, minRun = 2, bridge = 0.5)`: on-camera stretches from a picture scan.
- `lintShots`, `lintWide`, `lintClean`, `lintLeave`, `lintOnCamera`: each returns `Issue[]`.
- `CUT_LEAD`, `CLEAN_LAYOUTS`, types `Issue` and `Format`.

### `cut.ts`

- Reading a cut: `placed`, `cutLength`, `cutWords`, `atTime`, `mapRanges`, `mapTimes`, `joins`, `slotAt`, `wholeCut`, `nextId`.
- Editing a cut: `splitAt`, `rippleDelete`, `trimEdge`, `moveSegment`, `insertSegment`, `deleteRange`.
- Sound-aware edges: `quietest`, `snapEdge`, `clippedWords`, `loudJoins`.
- Types: `Placed`, `Levels`.

### `qc.ts`

- `qcPlan(r, words, notes, cuts = [])`: plan checks.
- `saidTwice(words, remove = [])`: sections repeated in the transcript.
- `qcLayout(m, size, where, bg?, full = false)`: layout checks on one measured frame.
- `visualText`, `contrast`, `SAFE`, types `Box` and `Measure`.

### Other files

- `beats.ts`: `reelBeats(shots, words, duration, fps = 30)`, `beatAt(beats, t)`, type `Beat`.
- `insert.ts`: `wordAt`, `phraseAt`, `mergeShots`, `planIndex`, `stripAnchors`.
- `tighten.ts`: `tighten(words, opts)`, `wordsRange`, type `Trim`.
- `reviewmd.ts`: `REVIEW_MD`, `reviewLine`, the example file the `reviewmd` visual shows.

## Invariants

### Anchors and timing

- `norm` lowercases a word and strips everything except Unicode letters, numbers and straight apostrophes.
- `findPhrase` needs exact consecutive normalised words, searches forward from `from`, and returns the first match or -1.
- Each shot's anchor is searched from the word after the previous shot's anchor.
- A shot anchor that is not found is an error and drops the shot. With `cut = true` the search retries from the first word for an occurrence not already used. If there is none, it warns and leaves the shot out.
- With `cut = true`, found shots are sorted by word, and a plain `full` shot is added at the front when the first shot does not start on the first word.
- The first shot starts at 0. Others start `CUT_LEAD` (0.05 s) before their word, plus `shift`, snapped to the frame. Each shot ends where the next starts, and the last ends at the duration.
- `keep` is an error unless the previous shot has a visual or is kept, the layouts match, and the shot has no visual of its own.
- Reveal anchors search forward from the shot's word. A miss falls back to the shot's start: an error normally, a warning with `cut = true`.
- `Edit.shots` needs at least one shot. `Segment` needs `out` greater than `in`.
- A `reviewmd` mark's `line` must exactly match a line in `REVIEW_MD`.

### Which lint runs

- `lintShots` hands over to `lintWide` when the canvas is `youtube`.
- `lintClean` replaces `lintShots` for `style: "clean"` on reels. `media/project.ts` makes that choice.
- `lintShots`, `lintWide` and `lintClean` each error if the shots stop more than 0.05 s before the duration.

### Cuts

- Cut edits never change the input. They return a new `CutPlan`, except that `splitAt` and `moveSegment` return the input itself when they do nothing.
- The shortest segment `splitAt` will make is 2/30 s. `trimEdge` holds that gap, then clamps to the clip's bounds, so the clip bounds win.
- Timeline sums are rounded to the microsecond.
- A word stays in a segment when its midpoint is inside it.

### Checks

- Issue levels are `error` and `warn`. A comment in `qc.ts` says errors stop an export. The refusal itself is in `cli.ts`.
- `qcLayout`: text must sit inside `SAFE` (5% each side, 5% top, 8.5% bottom). Type under 20 px is an error, and under 24 px a warning. Contrast under 2:1 is an error and under 3:1 a warning, checked only when a background is known.
- `saidTwice` finds matching 4-word runs that start 20 to 300 s apart and counts each pair against the two 30 s windows they fall in, floored to multiples of 30 s. It warns when a pair of windows reaches 10. The two windows can be the same one.
- `reelBeats` splits any span over 2.5 s into parts of about 2 s. Changes within 0.35 s share a beat, except a new shot.
- `tighten` defaults: `pause` 0.6 s, `keep` 0.25 s, `reach` 24 words. Its comment says proposals never overlap.

## Side Effects

None. The files import only `zod` and each other.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
