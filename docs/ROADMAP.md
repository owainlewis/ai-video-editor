# Roadmap: from prototype to a serious editor

Written 2026-11-10 after a review of the code and the running app. Every claim in "Where it stands" points at the file that showed it then; that section describes the app before Phase 0 and 1.

## Next: the reel component kit (2026-11-13)

Owain: "I want our reels to be best in the world." Reels are to be built from a small kit of high quality components with real layout, so a reel is reliable and fast to make and custom code is the exception. This comes before the rest of Phase 2.

1. **App windows.** `cli` (Claude Code and Codex), `claudeapp` and `grokbot` exist (`effects/apps/`). Make each one hold up full frame and in the split's panel, with the steps Owain's topics need.
2. **Real web pages.** Fetch the page live and render it at full resolution (`studio record` today), for GitHub repos, docs, blog posts and product pages. Never a scaled-up screenshot.
3. **Text cards.** Card beats, the bracketed list, the hit word and the command chip, set in Helvetica only.
4. **Logos.** Crisp real logos for every topic. `library/logos` has Claude Code, Google and OpenAI; Codex, GitHub, Grok Bot and DeepSeek are still to add.
5. **One diagram system.** Thin lines that draw on their words, one accent, built from `effects/clean/kit.tsx`, in place of one-off diagrams per reel.
6. **The frame.** The light palette as the default, and the 45 / 10 / 45 split: visual, caption band with a hairline, footage.
7. **Checks.** Spacing and balance in QC (`engine/qc.ts`), so a layout problem is caught before Owain sees it. Every component runs in the gallery and in `qc --library` at its sample and its longest text.

Done when a new reel on any of Owain's topics (Claude Code, Codex, OpenAI, Google, GitHub, Grok Bot, DeepSeek, software engineering, web pages, diagrams) can be planned from the kit alone, with no new code, and passes `check` and `qc` first time.

## Status, 2026-11-10

Phase 0 and Phase 1 are built, except the parts listed here.

**Done**

- Stable shot ids, the playhead store, typed actions (`engine/api.ts`), lighter reloads.
- Review mode at `#/p/<slug>/review`: approve or change per graphic, old version beside the new one, keys J K A C N W M P.
- Timeline notes (M), a Notes track, one "Send to Claude" run with Claude's answer on each note.
- QC from the app, per graphic, with strips, kept for graphics that have not changed.
- Voice or Mix in the player: the export's own mix of the plan as it is.
- Watch all, the phone frame for reels, the pre-flight sheet on Export, the export check and file in the Export tab.

**Not done, or different from the plan below**

- No Playwright smoke tests. The review rules, the server's review file and the action schemas have unit tests (`tests/review.test.ts`); the pages were checked by hand in a browser.
- A reel's review items are its shots, not its beats. Beats are still stepped in the editor.
- QC and the mix run when asked (a button, or picking Mix), not after every plan change.
- The mix takes about 17 s on a 76 s reel. On a 20 minute video expect minutes, not seconds.
- A full "Send to Claude" round trip has not been run against a live Claude session; the prompt, the note states and the reply file are tested without it.
- The phone frame is drawn by hand, roughly where Instagram's interface sits. It is not Instagram's own safe-zone numbers.

## Where it stands

The engine is strong. The app around it is thin.

**Strong, keep as is**

- The plan is data, anchored to spoken words, and the preview plays the same compositions as the export. This is the right core and nothing below changes it.
- Checks, QC, the export check and RULES.md turn each note into a rule. 394 tests pass and typecheck is clean.
- YouTube export lays graphics over the original, so a 20 minute 4K video exports in minutes.
- Versions on every change, with undo and redo.

**Weak**

- The whole editor UI is about 2,400 lines (`app/`). It is a viewer with a few edit actions, not yet an editor.
- Review is scattered. Plan checks are a collapsed text list in the chat panel (`app/Editor.tsx:420`). QC runs only from the CLI or inside an export, and its strips are JPGs in `checks/qc/` that the app never shows (no `qc` call anywhere in `app/`). Part renders open in a new tab. The export check is a JSON file.
- The live player plays the voice only (`effects/cut.tsx:42`). Music and sound effects are heard only in a render.
- Graphics cannot be moved or trimmed on the timeline, only b-roll edges (`app/Timeline.tsx:285`). No waveform, no thumbnails, no markers, no multi-select, no copy and paste, no frame step. On YouTube the arrow keys do nothing, because they step beats and only reels have beats (`app/Editor.tsx:93`).
- The inspector replaces the chat, so you cannot edit a graphic and talk to Claude at once (`app/Editor.tsx:278`).
- Claude runs one note at a time, shows tool lines and a closing sentence, and never shows what it changed (`server/agent.ts`). It gets the selection and playhead, not the picked graphic, the frame or the open issues.
- A shot has no id. Everything finds it by start time within 0.05 s (`server/index.ts:304`, `app/Editor.tsx:84`). Review state, notes, drags and Claude's changes all need a stable id.
- The playhead time lives in the root component, so every frame re-renders the library tiles, the whole timeline and the chat (`app/Editor.tsx:24`, nothing is memoised). This will drag on long videos as the UI grows.
- Home is a flat list of 43 projects with no thumbnails, no stage and test projects mixed in (`app/Home.tsx`).
- Jobs are detached processes with a status file. No queue, no job panel, no cancel, logs not shown.
- No UI tests.

## The plan

Six phases. Each ships on its own and is useful on its own. Sizes are rough: S is a day or two, M is about a week, L is two or more.

### Phase 0: Foundations (M)

Nothing here is visible, but phases 1 to 3 depend on it.

1. **Stable shot ids.** Each shot in `edit.json` gets an `id` (made from its anchor, then kept). The API, inspector, variants and suggestions address shots by id. Start times stay for display only.
2. **Playhead store.** Move `time` out of React state into a small store that components subscribe to. Only the playhead line and the "now" highlights update per frame.
3. **Typed API.** One zod schema per action, shared by `server/` and `app/api.ts`. Replace the string-matched handler and the `Number(input.x)` casts.
4. **Lighter reloads.** A plan change sends the resolved plan and issues, not the transcripts and clip words again.
5. **UI smoke tests.** Playwright: open a project, pick a graphic, edit it, undo, approve it in review.

### Phase 1: Review before render (L)

The goal: you never export to find a problem. One screen tells you the video is ready, and why.

1. **Review mode** (`#/p/<slug>/review`). A queue of every moment that changes: each graphic on YouTube, each beat on a reel. Each item loops live with the footage and shows its words, its checks and its QC result. Approve or Change with a note. Keys: J and K to move, A approve, C change, N next waiting. An item that changes after approval goes back to waiting, with its old note kept.
2. **Notes on the timeline.** M drops a marker at the playhead with a note, while playing or paused. Notes show on a Notes track and in a list.
3. **Send notes to Claude.** One button sends every open note as one run. Claude answers each note, and each changed item returns to the queue with before and after side by side.
4. **QC in the app.** A Run QC button and a live issues panel. Each issue seeks to its moment and shows its strip. QC caches by shot hash, so only changed graphics are measured again and it can run after every change.
5. **Hear the mix.** Mix music and sound effects into a preview track after each plan change (the mix is fast; it is the picture that is slow), and play that in the editor. Review then covers sound, not only picture.
6. **Watch-through.** Full screen, 1x, notes on M without pausing. For reels, a phone frame with the Instagram interface drawn over it, so nothing important sits under the buttons or caption.
7. **Pre-flight on Export.** Export opens a sheet: plan errors, QC errors, items not approved, open notes. Green means go. You can override; Claude cannot.
8. **After export.** The export check shows in the app (length, graphics placed, loudness), with the file playing beside it.

### Phase 2: A real editor (L)

The goal: any small change is quicker by hand than by asking.

1. **Timeline.** Drag a graphic to move it (it snaps to words and re-anchors), drag its edges to trim, drag its reveal ticks onto other words. Waveform on the A-roll (the levels are already in `build/level.json`). Thumbnails on segments. Multi-select, copy, paste, duplicate. Arrow keys step a frame, Shift steps a second, beats move to Alt. Zoom to the cursor with pinch or Cmd-scroll. Snap line shown while dragging.
2. **Layout.** Chat and inspector side by side, panels resizable, sizes remembered. A command palette (Cmd-K) and a shortcuts sheet (?).
3. **Player.** Click a graphic in the picture to pick it. Guides for safe areas. Loop the selection. Custom transport in place of the stock controls.
4. **Inspector.** Kept small (Owain, 2026-11-26: "too much fuss on editing text and details"): the big words on screen, start and end, layout. Small print and style details go through Claude, not more controls.
5. **Captions, music, sound.** Fix a transcript word and it fixes captions and anchors. Move, add and remove a sound effect on its track. Set music level and in and out points on the Music track.
6. **Versions panel.** The list of versions with who made each (the data is already saved), restore any, name a checkpoint, compare two side by side.
7. **Real dialogs.** Replace every `prompt()` and `confirm()`.

### Phase 3: Claude as a co-editor (M)

1. **Show what changed.** Each reply lists the graphics added, changed and removed. Click one to see it. One click reverts that note alone.
2. **Give Claude what you see.** The picked graphic, the current frame, open QC issues and review notes go with every note.
3. **Stream and queue.** Show Claude's words as it works. Queue a second note while the first runs. This likely means moving from `claude -p` to the Agent SDK, with `check`, `stills` and `qc` as typed tools.
4. **Quick asks on a graphic.** Buttons for the common ones: three takes, simpler, bolder, fix this QC issue.
5. **First pass on import.** A new project arrives with DESIGN.md, a first plan and a QC run, so the first thing you do is review, not brief.

### Phase 4: Scale (L)

1. **Pipeline board on Home.** Columns by stage: script, filmed, editing, in review, approved, exported, published. Thumbnails, format filter, archive. Test and lab projects in their own space.
2. **Job queue.** One panel for imports, QC, part renders and exports across all projects: progress, logs, cancel. Queue several exports and leave them overnight.
3. **One app.** Done another way (2026-11-13): `reels/` was removed, and its script mock-ups, Kokoro voice, carousels and Airtable push went with it. Studio is the one app.
4. **Reels from a YouTube video.** Claude proposes the strongest 30 to 60 second stretches, reframes to 9:16 and opens each as a reel project linked to its source.
5. **Publish kit.** Thumbnail frame picker, title, description and chapters from the plan's parts, pushed to Airtable.

### Phase 5: Quality that scales (M)

1. **Motion QC.** Sample frames through every entrance and exit and flag jumps. Today QC only looks at settled frames (RULES.md, 2026-11-08).
2. **Sound QC before render.** Music under voice, clipping, sound effect density, checked on the preview mix.
3. **Golden frames.** A saved frame per library card per theme, diffed in tests, so a style change cannot quietly break an old card.
4. **Numbers.** Per video: notes given, QC errors caught before export, time from import to approved. A note that repeats means a rule is missing.

## Order, and how sure I am

Do 0, then 1, then 2. I am confident in that order: stable ids and the playhead store are needed by everything after, and review is where an export costs you ten minutes per miss today.

I am less sure how deep Phase 2 should go. If you mostly edit by talking, Phase 3 items 1 and 2 (see what Claude changed, give it what you see) are worth more than drag handles, and I would move them ahead of Phase 2. Two weeks of using review mode would settle it: count how many fixes you made by hand against by note.

Not in the plan, on purpose: a packaged desktop app, accounts or cloud sync, and a new render engine. None of them makes the videos better or faster to make.
