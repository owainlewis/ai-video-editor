# Studio

Owain's video editor. Claude is the editor: it changes a plan, the editor shows the plan live, and video is rendered once at the end. See `docs/ARCHITECTURE.md`.

Writing style for docs, messages and chat replies: plain words, short sentences, no em dashes.

## Editing a project

A project is `projects/<slug>/`. The plan is `edit.json` (schema: `engine/schema.ts`, `Edit`). Read before you change anything:

- `transcript.txt`: every word with its time. Shots and reveals are anchored to spoken words, never to seconds.
- `edit.json`: the plan. Change it with Edit; the editor reloads within a second and saves a version, so Owain can undo.
- Owain wants experiments (2026-10-25): "throw stuff at the wall - push boundaries and settle on a style we like." Propose bold variants and show them side by side; he prunes. The hard limits in RULES.md still hold.
- `docs/RULES.md` (the house rules, learned from Owain's notes; they win over everything else) and `docs/STYLE.md`. `docs/PLAYBOOK.md`: what pro edits do and which tricks fit Owain; check it when planning graphics.
- `checks/frame.jpg`: a frame of the footage, for `face`.

After every change:

```bash
npm run studio -- check <slug>               # shots, timings and every issue; fix every ERROR
npm run studio -- stills <slug> --at 3.2,8   # look at the frames when the change is visual
```

Never render the whole video while editing. Owain exports from the editor when he is happy.

### Check before rendering

Fixing a graphic after an export costs ten minutes; fixing it before costs seconds (Owain, 2026-10-25).
1. `npm run studio -- check <slug>` after every plan change: timing, anchors, camera, demos, and the plan checks (reading time, lingering, cards back to back, overlays across a cut, numbers nobody said, a section said twice). A section said twice is cut with `"remove": [[start, end]]`, both edges between words: find the edges in `transcript.json`, and land the start on a cut in the footage when there is one (`build/cuts.json`).
2. `npm run studio -- qc <slug>` (or `--at 95,1320` for one or two moments) before any export: it measures every graphic in a headless browser (safe area, collisions, one-word last lines, type size, contrast, centring) and writes `checks/qc/`: a strip per graphic (before, first frame, reveals, settled, after) and `overview.jpg`. Fix every error, read every warning, and look at `overview.jpg` before exporting.
3. `render` runs QC itself and refuses to export with QC errors (`--force` overrides, only when Owain says so). One export at a time: it holds `build/export.lock`.
4. After an export, read `checks/export-check.json`: length, every graphic placed, loudness.
5. After changing a visual or the style, `npm run studio -- qc --library` (`--card <kind>` for one): the same checks on every library card, in every theme, at its sample and at its longest text. Fix every error; a card that breaks there breaks in any video that uses it.
When Owain flags a layout or pacing problem, add it to `engine/qc.ts` as a check, not only to RULES.md.

## Design per video

Owain (2026-10-26): "I'd ideally like you to edit per video rather than rely on just a few stock presets." Every video and reel gets graphics designed for its own argument.

1. Read the whole transcript, then write `projects/<slug>/DESIGN.md`: the argument in three lines, and the four to eight moments that carry it. For each moment: what the viewer must understand, the picture that shows it (structure, cause, flow, before and after), and how it moves. Diagrams first: they are what Owain's tech audience values most.
2. Draw each moment for this video: a custom graphic in `effects/custom/` (Remotion, used from the plan as `custom`) or a scene in `hyperframes/<slug>/` (HyperFrames). Use the video's own nouns and the source's real words.
3. Reach for the house graphics first (`effects/house.tsx`): `words` (big lines beside Owain, `over` on YouTube), `focus` (one item huge at a time), `shift` (the old way struck through as the new one lands) and `map` (a diagram drawn large). They replace the card-with-a-small-label look. Library kinds and registry blocks are parts (the look, the speeds, a counter, a code window), not presets. Use one as it is only when it is exactly the right picture; never pick from the menu first and fit the words to it.
4. No two videos should look like the same template: vary the stage, the camera and the transitions, keep the house look (Graphite or Ivory, Helvetica and Signifier, sage accent, the two speeds).
5. A bespoke graphic that keeps earning its place graduates into the library.

## The cut (`cut.json`)

A project can hold several clips (its bin: the first clip at the project's root, more in `clips/<id>/`, each with its own `transcript.json`). `cut.json` lists the segments that play, in order: `{ "id", "src": "main" | <clip id>, "in", "out" }`, in that clip's own seconds. Owain edits it on the A-roll track (drag clips in, B to split, drag edges to trim, Delete to ripple delete). With a cut:

- The plan's anchors are matched against the words as they play in the cut, so graphics follow their words through any re-cut. A shot whose words were cut out is left out (`check` warns). Times in the editor, the chat and `check` are times in the cut.
- `remove` no longer applies; a stretch is cut by deleting it from the cut.
- Do not change `cut.json` unless Owain asks for a change to the cut itself. If you do, put every edge in a pause: `check` warns when a join lands on sound and names the nearest pause (`build/level.json` in each clip folder has the levels).

## How a plan works

- `shots` run in order. Each starts on a spoken phrase (`at`, a few exact words from the transcript) and lasts until the next.
- `layout`: `full` (speaker), `punch` (speaker, closer), `split` (a visual on top, speaker below), `media` (the visual alone), `cutaway` (b-roll edge to edge), `scene` (a full-frame card); on YouTube, `side` (visual with the speaker in a window) and `over` (a cinematic title over the picture).
- `visual`: one of the kinds in `engine/schema.ts` (title, list, steps, chart, stat, kpi, compare, pipeline, constraint, checklist, levels, quote, image, video and more). Items and reveals take their own `at` so they land on their word.
- `keep: true` continues the previous shot's visual (swap the `header` without a new graphic).
- `header`: the headline above a split, with one `*accent*` word.
- `accents`: four to six words in the whole video that carry the meaning.

## YouTube videos

`"canvas": "youtube"` (16:9). Owain cuts the video himself; the plan only adds graphics over it and never re-cuts it. Most of a long video is screen recording and b-roll, so:

- **Graphics go only where Owain is on camera.** If `build/camera.json` is missing, run `npm run studio -- frames <slug>`, look at the sheets, pick two or three times where he is on camera, then `npm run studio -- scan <slug> --ref <t1>,<t2>`. `check` errors on any graphic off camera.
- Layouts: `full` (the picture as cut, most of the video), `side` (a visual on the left, Owain in a window on the right), `over` (a cinematic `title`; no lower thirds, Owain does not like them, unless he asks), `media` (the visual alone, briefly). Set `"theme": "dark"` for Graphite graphics. The motion lab moves (see `docs/PLAYBOOK.md`, "The motion lab"): `side` is the stage (Owain shrinks into a card and grows back; use it whenever he is on camera); `odometer` for numbers said in sequence; `lift` when he talks about a paragraph on a screen recording (measure `region` and `mark` in 1920x1080 pixels on a frame from `npm run studio -- stills`, then check the lift's QC strip that the mark sits on the right words); chapter cards and kinetic lines take one `*marked*` phrase for the highlighter. In article sections, full-frame `media` cards may cut in over the screen recording; fence demos off with `"leave": [[start, end], ...]`. Side and media graphics hard cut in and out. No stat cards for Owain's own credentials (years, experience). No punch-ins on YouTube: they re-render the footage and change its colour. Hero moments: one full-frame hero number (`stat` with `hit: true` and `"sfx": "riser"`) and full-frame chapter cards (`chapter` with `hit: true`) at each section start.
- About one graphic every 20 to 60 seconds of on-camera time. Each holds 4 to 12 seconds and builds with reveals on its words, or `keep`.
- No word captions unless asked (`"captions": true`).

## Clean reels (`"style": "clean"`)

The reel style locked on 2026-11-06 (`research/reels/STUDY.md`), drawn by `effects/clean/Clean.tsx`. Example: `projects/egm-clean/edit.json`.

- **Split is the main view**: half the reel or more (`check` warns under 45%). The visual on top (y 0 to 960), Owain or b-roll below, the caption on the seam (on a recorded screen, which runs right down to the seam, just under it). Diagrams in the top panel stay above y 830; a chip takes y 120 to 190.
- Layouts: `split`; `full` (cinematic: Owain, or b-roll from `picture`); `card` (`bg`: `ink`, `paper` or `green`); `diagram` (full-screen line diagram on green, now and then, a fifth of the reel at most); `over` (the diagram in a glass panel, 960 x 880, over a full-frame `picture`).
- `picture`: `"broll:<id>"` or `{ "src", "start", "rate" }`, the footage instead of Owain. A faceless reel (a voiced script) needs one on every `full`, `split` and `over` shot. Slow motion only from 60 fps sources.
- The text kit, one treatment at a time: the caption (automatic, sized by weight); `hit` (one lower-case word, 10 letters at most, optional `tag`, `at`, `until`); `title` (two `lines`, on a diagram); `chip` (the real skill or command name); `beats` on a card (huge, small, huge); `list` on a card with a bracketed `title` like `"[REVIEW]"`; `inside: true` puts the caption in a diagram's centre.
- Diagrams are `custom` visuals drawn for each video in `effects/custom/` with the parts in `effects/clean/kit.tsx` (Line, Ring, Rect, Doc, Dots, Label): thin white lines that draw on their words, sage on the one thing that matters.
- Show the thing: anything named gets the real thing, a diagram or its real logo. Repos and docs are real captures in a browser window (`frame: "browser"`, `dark: true`) with markers on the spoken words. A skill or command runs in a Claude Code mock-up (`claudecode`, the real command), then a diagram explains it.
- Recorded screens: `npm run studio -- record <slug>` films the real pages in `record.json` (scenes with a `url`, spoken `from` and `to`, and actions on spoken words: `move`, `click`, `scroll`, `mark`, `zoom`, `reset`, `clear`, `type`). It writes `assets/screen.mp4`, as long as the cut, for `{ "kind": "video", "src": "assets/screen.mp4", "sync": true }`, and `assets/screen.json` (zooms and click sounds). Marks go only on words that are on the page. Example: `projects/egm-live`. Pages behind a login need a session Owain signed in to himself, which the recorder does not do yet.
- Sounds (`cleanSfx`): only what the eye sees land: a low whoosh as a graphic takes over, a sub hit under a hit word, a ring for a logo, a tick per item, a click per marker, keys under typing, one tick for a diagram, and `"sfx": "riser"` into a diagram. Nothing on a cut back to the speaker.

## B-roll

Owain's own shots live in one library for every project: `library/broll/` (shots in `.clips/`, described in `index.json`).

- Find shots with `npm run studio -- broll <words>` (searches descriptions and tags).
- Use one with `{ "kind": "video", "src": "broll:<id>" }`; it is copied into the project when the plan resolves. Each shot once per video.
- Put b-roll on human or abstract lines, never as evidence for a claim.
- New clips added in the editor are split into shots and described automatically. To describe any left blank: `npm run studio -- broll describe`.

## Owain in the editor

He edits by hand now, so expect plans to change under you; read edit.json fresh before every change.
- **Inspector:** click a graphic on the timeline (or in the Graphics tab) to edit its words, layout, start word or card, live, or remove it (Delete). Saved through `POST /api/projects/<slug>/shot`, which puts the plan back if the change adds an error.
- **Library tab:** click a card to put it at the playhead (`place`).
- **Script tab:** select words and cut them; Tighten proposes retakes, fillers and long pauses (`engine/tighten.ts`) to strike in one go. Each is a cut edit.
- **Beats (reels):** the reel cut into beats of about 2 s, one at every change on screen (`engine/beats.ts`). Step with ← and → or the bar under the player, or click a marker on the Beats track; each lands on the beat's settled frame, to check every graphic before an export.
- **Takes:** "Ask Claude" in the inspector writes `variants.json` (see `server/variants.ts` for the prompt); `npm run studio -- variants <slug>` checks it. Owain plays each take in the player and picks one.

## Notes from Owain

When Owain asks for a change in the chat panel you get the project, the selected section (times and the words said in it) or the playhead, and his note.

1. Make the change in `edit.json`, matched to what is said in the section.
2. Run `check`, fix errors, look at a still if it is visual.
3. Reply in one or two plain sentences: what you changed, and anything you could not do.
4. A note that would apply to any video goes in `docs/RULES.md` as a row, and into a check where it can be.

## Rules that never bend

- Never invent facts, numbers, UI or quotes. A graphic shows what is said or what a source shows.
- Graphics on YouTube go only where the speaker is on camera, never over b-roll or a screen recording.
- Something on screen changes every 2 seconds at most in a reel.
- No grading: Owain does it. The voice goes through Auphonic (`npm run studio -- auphonic <slug>`, key in `.env`) and no other processing. Music and sound effects are ours.
- Fonts: Helvetica and Signifier only.

## Code

`engine/` (plan schema and timing, pure), `effects/` (Remotion compositions and visuals), `styles/` (Ivory and the card catalog), `media/` (import, project resolution, render), `audio/` (the mix, Python), `server/` (local API, version history, the chat bridge), `app/` (the editor UI). After changing code run `npm run typecheck` and `npm test`. To see a visual move, open the gallery (`#/gallery` in the editor; `#/gallery?tab=projects&q=<name>` for one graphic): every library card and every graphic in every project plays live there from the real compositions, with no rendering, and hot reloads as you change the code.

## Reels and mock-ups (`reels/`)

The reel editor lives in `reels/` (moved in from ai-reel-editor, 2026-10-25, history kept): script-first reel mock-ups narrated with the Kokoro voice (am_michael) before anything is filmed, the review board, carousels, and the Airtable push (new pushes go to "Idea"). Work on reels from that folder: `cd reels && npm run reel -- <command>`; its own `CLAUDE.md`, `docs/RULES.md` and the `edit-reel` skill apply there. Its b-roll, music and sounds are local (git-ignored), copied from the old folder; older reel projects are still in `~/Code/github/owainlewis/ai-reel-editor/projects`. Folding these tools into Studio's editor is the next step; until then both halves share this repo, and `npm test` at the root runs both test suites.
