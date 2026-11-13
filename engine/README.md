# Engine

## Overview

The pure core of Studio: the plan schema, word-anchored timing, cut maths, and the plan and layout checks. Nothing here reads files, spawns processes or uses the network. `media/` and `server/` do that work and pass data in. `app/` imports the types and helpers from `cut.ts`, `beats.ts`, `tighten.ts` and `insert.ts` directly, and `visualAnchors` from `resolve.ts`.

## Interface

### `schema.ts`

- `Edit`: zod schema for `edit.json`. Fields: `title`, `canvas`, `style` (defaults to `clean`; every reel is a clean reel, and YouTube ignores it), `theme`, `leave`, `remove`, `captions`, `split`, `header`, `face`, `accents`, `music`, `grade`, `voiceGain`, `shots`.
- `Shot`: fields `at` and `layout` (required), plus `id` (the shot's name across versions; made from the anchor when left out), `visual`, `shift`, `sfx`, `zoom`, `header`, `keep`, `tone`, `picture`, `bg`, `hit`, `title`, `chip`, `inside`, `note`.
- `Visual`: discriminated union on `kind`. The list of kinds is in `schema.ts`.
- `Layout`: every layout either canvas takes. Reels take `CLEAN_LAYOUTS` (`split`, `full`, `card`, `diagram`, `over`, `cutaway`); there `over` is the glass overlay. YouTube takes `full`, `side`, `half`, `media`, `over` and `cutaway`. `punch` and `scene` are left from the retired Ivory reel and pass neither lint.
- `Picture`, `SfxKind`.
- `Cut`, `Segment`, `MAIN` (the id `"main"`, the clip the project was made from): schema for `cut.json`.
- Types: `EditPlan`, `VisualSpec`, `CutPlan`, `CutSegment`, `Word`, `ResolvedVisual`, `ResolvedShot`, `Chunk`, `SfxEvent`, `Resolved`.

### `resolve.ts`

- `resolveShots(plan, words, duration, fps = 30, cut = false)`: returns `{ shots, issues }`.
- `norm`, `snap`, `findPhrase(words, phrase, from = 0)`, `visualAnchors(v)`, `syncWords`, `shotLabel(s, i)`, `isGraphic(s)`, `lastKept(shots, i)`.
- `chunkWords(words, accents, cuts, fps)`: caption chunks.
- `sfxEvents(shots)`, `cleanSfx(shots)`: sound events sorted by time.
- `cameraRanges(dist, rate, threshold = 20, minRun = 2, bridge = 0.5)`: on-camera stretches from a picture scan.
- `lintWide`, `lintClean`, `lintLeave`, `lintOnCamera`: each returns `Issue[]`.
- `CUT_LEAD`, `CLEAN_LAYOUTS`, type `Issue`.

### `cut.ts`

- Reading a cut: `placed`, `cutLength`, `cutWords`, `atTime`, `mapRanges`, `mapTimes`, `joins`, `slotAt`, `wholeCut`, `nextId`.
- Editing a cut: `splitAt`, `rippleDelete`, `trimEdge`, `moveSegment`, `insertSegment`, `deleteRange`.
- Sound-aware edges: `quietest`, `snapEdge`, `clippedWords`, `loudJoins`.
- Types: `Placed`, `Levels`.

### `parts.ts`

`resolveParts(parts, words, duration, fps?, cut?)` turns the plan's `parts` into `{ name, anchor, start, end }` on the timeline. `pickPreview(parts, duration, ask)` reads what `render --part` or `--from --to` asks for. `frameWindow`, `segmentInWindow`, `sectionFrames` and `rangesInWindow` are the frame arithmetic for rendering one stretch. Types `Range`, `FrameWindow`, `Preview`.

### `qc.ts`

- `qcPlan(r, words, notes, cuts = [])`: plan checks.
- `saidTwice(words, remove = [])`: sections repeated in the transcript.
- `qcLayout(m, size, where, bg?, full = false)`: layout checks on one measured frame.
- `visualText`, `contrast`, `SAFE`, types `Box` and `Measure`.

### Other files

- `beats.ts`: `reelBeats(shots, words, duration, fps = 30)`, `beatAt(beats, t)`, type `Beat`.
- `insert.ts`: `wordAt`, `phraseAt`, `mergeShots`, `planIndex`, `stripAnchors`.
- `tighten.ts`: `tighten(words, opts)`, `wordsRange`, type `Trim`.
- `page.ts`: a captured web page's words (written by `media/capture.ts`). `findPhrase(page, phrase, nth = 1)`, `markRect`, `phraseFrame(page, { phrase, pad, block, nth })`, `closest`, `placePhrases(v, page)`, types `Page`, `PhraseFrame`, `ImageSpec`. Not the same as `findPhrase` in `resolve.ts`, which finds spoken words.
- `api.ts`: `Actions` (one zod schema per editor action), `isAction`, types `ActionName`, `ActionInput`, `ActionData`. Read by `server/index.ts` and `app/api.ts`.
- `approve.ts`: approving finished reels. `approvalState(facts)`, `exportReady(facts)`, `weekStart(now?)` (Monday, local midnight), `thisWeek(times, now?)`, `fileTitle(title, fallback?)`, `day(date)`, `WEEKLY_TARGET` (7), types `ApprovalState`, `ApprovalRecord`, `ApprovalFacts`. Read by `media/approve.ts` and `app/Home.tsx`.
- `review.ts`: review before render. `reviewItems(r, words)`, `itemHash(r, index, said)`, `reviewable(s)`, `mergeReview(review, items)`, `counts`, `noteTime(note, words)`, `openNotes`, `openChanges`, `formatFeedback(review, items, words)`, `seenPath(id, hash)`, `emptyReview`, `hash`, `stable`, types `Review`, `ItemReview`, `Past`, `Note`, `Item`, `Status`.

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

### Ids and review

- `resolveShots` sets `id` on every shot: the plan's own, else the anchor in lower case with other characters as `-`. A repeat gets `-2`, `-3`. The plain picture that fills the start of a cut is `start`.
- A review item is a shot that is not kept and is more than plain picture (`reviewable`). It runs to the end of the last shot that keeps its visual.
- `itemHash` counts times in frames from the item's start, so a re-cut earlier in the video does not change it. It covers the shots' fields, the visual, the words said and the video's look (canvas, style, theme, split, captions, face, grade).
- `mergeReview`: an item whose hash changed goes back to `waiting` and its status, comment and reply move to `history`. New items start `waiting`. Reviews of items that left the plan move to `removed` and come back if the item does. An item that returns to a version in its history (an undo) takes that decision back.
- A note's `anchor` is the phrase said from its moment (`phraseAt`); `noteTime` finds it in the words as they are now, else uses `t`.
- `openChanges` leaves out an item Claude has already answered, until Owain writes on it again.

### Which lint runs

- `media/project.ts` runs `lintWide` on YouTube and `lintClean` on every reel.
- `lintClean` errors on any layout outside `CLEAN_LAYOUTS`, so a YouTube layout on a reel is caught there.

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

### Phrases on a page

- A phrase matches words in order, ignoring punctuation at either end of each word and skipping runs with no letters or digits. A match in the same case wins; otherwise any case matches. `nth` picks a later match.
- An unknown phrase throws, naming the three closest phrases on the page.
- `markRect` pads the words by 4 x 2 CSS px and throws when the phrase wraps onto a second line.
- `phraseFrame` pads by `pad` of the page's width on every side (0.04 by default), the same pixels up and down. Rects are kept inside the image.
- `placePhrases` fills the rects in an `image` visual and the browser window's `url` when the plan leaves it out. A phrase with no page json beside the image is an error.

## Side Effects

None. The files import only `zod` and each other.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
