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
When Owain flags a layout or pacing problem, add it to `engine/qc.ts` as a check, not only to RULES.md.

## Design per video

Owain (2026-10-26): "I'd ideally like you to edit per video rather than rely on just a few stock presets." Every video and reel gets graphics designed for its own argument.

1. Read the whole transcript, then write `projects/<slug>/DESIGN.md`: the argument in three lines, and the four to eight moments that carry it. For each moment: what the viewer must understand, the picture that shows it (structure, cause, flow, before and after), and how it moves. Diagrams first: they are what Owain's tech audience values most.
2. Draw each moment for this video: a custom graphic in `effects/custom/` (Remotion, used from the plan as `custom`) or a scene in `hyperframes/<slug>/` (HyperFrames). Use the video's own nouns and the source's real words.
3. Library kinds and registry blocks are parts (the look, the speeds, a counter, a code window), not presets. Use one as it is only when it is exactly the right picture; never pick from the menu first and fit the words to it.
4. No two videos should look like the same template: vary the stage, the camera and the transitions, keep the house look (Graphite or Ivory, Helvetica and Signifier, sage accent, the two speeds).
5. A bespoke graphic that keeps earning its place graduates into the library.

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

## B-roll

Owain's own shots live in one library for every project: `library/broll/` (shots in `.clips/`, described in `index.json`).

- Find shots with `npm run studio -- broll <words>` (searches descriptions and tags).
- Use one with `{ "kind": "video", "src": "broll:<id>" }`; it is copied into the project when the plan resolves. Each shot once per video.
- Put b-roll on human or abstract lines, never as evidence for a claim.
- New clips added in the editor are split into shots and described automatically. To describe any left blank: `npm run studio -- broll describe`.

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
- No grading and no voice processing: Owain does both. Music and sound effects are ours.
- Fonts: Helvetica and Signifier only.

## Code

`engine/` (plan schema and timing, pure), `effects/` (Remotion compositions and visuals), `styles/` (Ivory and the card catalog), `media/` (import, project resolution, render), `audio/` (the mix, Python), `server/` (local API, version history, the chat bridge), `app/` (the editor UI). After changing code run `npm run typecheck` and `npm test`. After changing a visual or the style, run `npm run studio -- effects --force` so the Effects tab shows it.

## Reels and mock-ups (`reels/`)

The reel editor lives in `reels/` (moved in from ai-reel-editor, 2026-10-25, history kept): script-first reel mock-ups narrated with the Kokoro voice (am_michael) before anything is filmed, the review board, carousels, and the Airtable push (new pushes go to "Idea"). Work on reels from that folder: `cd reels && npm run reel -- <command>`; its own `CLAUDE.md`, `docs/RULES.md` and the `edit-reel` skill apply there. Its b-roll, music and sounds are local (git-ignored), copied from the old folder; older reel projects are still in `~/Code/github/owainlewis/ai-reel-editor/projects`. Folding these tools into Studio's editor is the next step; until then both halves share this repo, and `npm test` at the root runs both test suites.
