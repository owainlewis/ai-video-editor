# Drift report, 2026-11-08

Checks the 20 EGM contracts against the code on disk, including uncommitted work. Each entry gives the doc line, then the code location. Every item below was checked against the code and fixed in its README on 2026-11-08, so the line numbers refer to the versions before the fix. Code problems found along the way were left alone.

## README.md

- Says `hyperframes` holds no code of its own. It holds HTML compositions with inline GSAP scripts. (doc line 81; hyperframes/spawn-flow/index.html:100, hyperframes/diagram-lab/compositions/fan-out.html:42)
- Says a missing anchor is an error and drops the shot, in a sentence about shots and reveals. A missing reveal anchor keeps the shot and falls back to its start. With a cut, a missing shot or reveal anchor is only a warning. (doc line 86; engine/resolve.ts:98, engine/resolve.ts:183-187)
- The Files bullet omits writes outside `projects/<slug>/`. `server/` also writes uploads to `projects/.uploads/` and moves deleted projects to `projects/.trash/`. (doc line 93; server/index.ts:144-146, server/index.ts:256-258, server/trash.ts:14-16)
- The child process list omits `npx tsx cli.ts`, which the server spawns detached for long jobs. (doc line 94; server/index.ts:122, server/index.ts:165)
- The child process list omits the reel tool's macOS `say` and `open`, `uv run` of `tools/kokoro.py`, and Chrome through puppeteer for `capture`. (doc line 94; reels/tools/cli.ts:157, reels/tools/cli.ts:163, reels/tools/cli.ts:335, reels/tools/cli.ts:709)
- The Network bullet omits the reel tool's `fetch` and `capture` commands. (doc line 95; reels/tools/cli.ts:376, reels/tools/cli.ts:335)

## engine/README.md

- Lists the cut, beat and tighten helpers as what `app/` imports. `app/` also imports `phraseAt`, `planIndex`, `stripAnchors` and `wordAt` from `insert.ts`, and `visualAnchors` from `resolve.ts`. (doc line 5; app/Inspector.tsx:2-3)
- Says cut edits return a new `CutPlan`. `splitAt` and `moveSegment` return the input object itself when they do nothing. (doc line 74; engine/cut.ts:89, engine/cut.ts:114)
- Says the 30 s windows are 20 to 300 s apart. That limit applies to each pair of matching 4-word runs. The windows are floored to multiples of 30 s and can be the same window. (doc line 83; engine/qc.ts:98-100)

## app/README.md

- Says `Ask Claude` is disabled while Claude works. Only the Takes button is. The footer `Ask Claude` button in `Inspector` has no disabled state. (doc line 76; app/Inspector.tsx:188, app/Inspector.tsx:266)
- Says `Gallery` writes `tab`, `canvas` and `theme` back to the hash. It also writes `q` and `text` when they are set. (doc line 79; app/Gallery.tsx:34)
- Says `qcReady` is true only after the plan has rendered. In library mode it is set true at page load, before any plan is rendered. (doc line 80; app/qc.tsx:229)
- The Keys section omits Cmd/Ctrl+Enter, which sends the chat note. (doc line 44; app/Editor.tsx:448)
- The Keys section omits Enter in the takes brief field, which asks Claude for takes. (doc line 44; app/Inspector.tsx:265)
- The Keys section omits Space, which plays or pauses the player in the editor and in the large gallery view. (doc line 44; app/Editor.tsx:273, app/Gallery.tsx:212)
- The Keys section omits Escape in `NewProject`, a `window` listener that closes the dialog. (doc line 44; app/NewProject.tsx:16)
- The Keys section omits Escape in the large gallery view. (doc line 44; app/Gallery.tsx:191)
- The Keys section omits Alt while trimming a segment edge, which snaps to frames instead of word edges. (doc line 44; app/Timeline.tsx:101)

## server/README.md

- The list of what `GET /api/projects/<slug>` can write omits `build/level.json`. The route calls `clipLevels` for every ready clip, which runs ffmpeg and writes that file. (doc line 99; server/index.ts:222, media/bin.ts:101)
- The list of files written in a project omits `clips/<id>/status.json`, which `POST clips` writes. (doc line 98; server/index.ts:259)
- Says `listAssets` caches thumbnails in `assets/.thumbs/`. It also writes clip durations to `assets/.thumbs/meta.json`. (doc line 101; server/assets.ts:32, server/assets.ts:37)

## media/README.md

- The `frameSheets` entry lists only `checks/frames/`. It also writes contact sheets to `checks/frames-<k>.jpg`, outside that folder, and returns those paths. (doc line 72; media/scan.ts:23)
- The `ingest` and `addClip` write list omits `build/whisper/`. `transcribe` creates that folder and mlx_whisper writes `voice.json` there. (doc line 67; media/ingest.ts:108-111)
- The `ingest` write list omits the `renders/` and `history/` folders, which `ingest` creates. (doc line 67; media/ingest.ts:42)
- The project write list has no entry for `build/mix.wav` or `build/audio/`. `mixAudio`, and so `renderFinal` and `exportOverOriginal`, produce both through the `audio.mix` child process. (doc lines 66-73; media/render.ts:13, audio/mix.py:71-72, audio/mix.py:129)

## audio/README.md

No drift detected

## effects/README.md

- Says every camera move runs on `cameraProgress`. The shared-element transition does not. `Reel` calls `cameraEase` directly, and `camera.ts` names that transition as one of its cameras. (doc line 69; effects/Reel.tsx:235, effects/camera.ts:31)
- The `soft.tsx` export list omits the type `Box` and the re-export `ACCENT`. (doc line 38; effects/soft.tsx:39, effects/soft.tsx:19)
- The `style.ts` export list omits the re-exported type `ToneTokens`. (doc line 43; effects/style.ts:11)
- The `frame.tsx` export list omits the re-export `FAST`. (doc line 33; effects/frame.tsx:266)

## effects/clean/README.md

- The drawing kit list omits two public exports of `kit.tsx`: `Stage` and `at`. `egmnatural.tsx` imports both. (doc lines 15-20; effects/clean/kit.tsx:145, effects/clean/kit.tsx:150)

## effects/custom/README.md

- The table has no row for `egmnatural.tsx`, so `nat-two`, `nat-full`, `nat-goldfish` and `nat-angles` are undocumented. The file lists on lines 23 and 58 leave it out too. The file is uncommitted and appeared while the contracts were being written. (doc lines 25-41, 23, 58; effects/custom/index.ts:19, effects/custom/index.ts:79-82, effects/custom/egmnatural.tsx:1-3)

## styles/README.md

- Says "Number slots fill with nines". `atMax` skips any slot with no `maxChars`, so number slots without one keep their sample values: `journey.of`, `ring.value`, `meter.value`, `meter.max`, `waffle.value`, `agenda.active`. (doc line 65; styles/catalog.ts:166, styles/blueprint/style.ts:43,715,728-729,747,846)
- Says `media/project.ts` warns when a plan goes past a slot limit. For a custom visual, `slotIssues` uses `blueprint.t1.custom`, so a plan past a stage card's `props.*` limit gets no warning. (doc lines 92-93; media/project.ts:117, styles/catalog.ts:125-126)
- The list of files that draw cards omits `effects/clean/Clean.tsx` (the only place `beats` is drawn), `effects/browser.tsx` (`windows`) and `effects/ui.tsx` (`claudecode`, `search`, `tiers`, `compose`, `divisions`, `chips`, `runs`). (doc lines 88-89; effects/clean/Clean.tsx:89, effects/Visuals.tsx:996,1032, effects/ui.tsx:477-484)
- Says components read colour from tokens through `effects/style.ts`. `effects/clean/kit.tsx` and `effects/ui.tsx` define literal colours, and `effects/soft.tsx` imports `BLACK` and `GRAPHITE` straight from the Ivory tokens. (doc lines 93-94; effects/clean/kit.tsx:14-21, effects/ui.tsx:18-21, effects/soft.tsx:5)
- Says every card plays live in the style lab, light and dark, split and scene. Cards with no sample show only their `noSample` text. Overlay cards get one view, wide and dark, as the doc's own line 68 says. (doc lines 123-124; reels/review/StyleLab.tsx:197-205, reels/styles/lab.ts:16-19)
- Says the gallery plays every card and `qc --library` measures them. `effectList` drops the 11 cards with no sample, so neither shows them. With the default Ivory style it also drops the two clean-only cards, `beats` and `list.bracket`. The gallery always uses that default, while `qc --library` does check those two in its clean variant. (doc lines 124-126; effects/preview.ts:25-28, app/Gallery.tsx:39, media/qc.ts:232)

## styles/blueprint/README.md

- Says the test makes samples "stay inside every limit". The test calls `slotIssues(v)`, which checks the card `cardFor` picks, not the card under test. The eight `blueprint.t2` custom cards (drain, lens, wall, thread, gaps, drift, surge, scale) are checked against `blueprint.t1.custom`, so their `props.*` limits are never tested. `blueprint.t2.capture.repo` is checked against `blueprint.t2.capture.browser`. (doc line 47; tests/catalog.test.ts:44, styles/catalog.ts:125-126)

## styles/ivory/README.md

No drift detected

## reels/README.md

- The layout list describes `audio/` as "sound effect synthesis". The real mix never synthesises: `mix.py` calls `sfx.render` without `synth`, so a kind with no files is skipped. (doc line 115; reels/audio/mix.py:91, reels/audio/sfx.py:137-138)
- Says "the library commands" write `.cache/audio/`. No library command does. The only writer is `decode`, run by the mix through the project commands `audio` and `render`. (doc line 150; reels/audio/mix.py:61,70, reels/audio/library.py:43-48, reels/tools/cli.ts:532-535,543)
- The Network list omits the `uvx mlx_whisper` runs in `transcribe`, `script` and `check`, which name a hosted model, and the packages `uv run --with` resolves. The downloads are inferred from these arguments, not read in the mlx-whisper or uv code. (doc line 151; reels/tools/cli.ts:157,297,534,689)
- The Subprocesses list omits `mv`, `rm` and `git`. (doc line 152; reels/tools/cli.ts:196-197,561,589,642, reels/audio/mix.py:35)

## reels/audio/README.md

- Says a tap plays only if nothing has sounded for `MIN_GAP`. In `thin`, a `key` event is kept but does not reset `last`, so a tap can play right after a key event. (doc line 25; reels/audio/sfx.py:108-109,113)

## reels/review/README.md

- The board keys list omits Escape, which leaves a note field. (doc line 26; reels/review/Board.tsx:85,182)

## reels/src/README.md

- Says only `reel validate` builds `Resolved`. `labResolved` also builds one for the style lab, and `Root` builds an empty default. (doc line 40; reels/styles/lab.ts:21,40, reels/src/Root.tsx:9)
- Says a punch shot never lets the head pass 40% of the frame. The code caps only the target `faceH`. The scale is `max(cover, faceScale)` times a push-in of up to 3.5%, so the head can reach about 41.4%, and more on tight footage. (doc line 44; reels/src/Speaker.tsx:20,66,69)
- Says every camera move uses `cameraEase`. The speaker's box and crop move between layouts in `Wide` on `ease` from the theme. (doc line 45; reels/src/Wide.tsx:51-55)
- Says italic is applied only through the accent helpers. Inline italic `fontStyle` is set outside those helpers in `Visuals.tsx`, `soft.tsx` and `cards.tsx`. (doc line 52; reels/src/Visuals.tsx:216,302,337,361,505, reels/src/soft.tsx:152, reels/src/cards.tsx:652,797,840,890)
- Says colours come from `pal` or `style.color`. The `Blueprint` layer in `soft.tsx` builds its colours from `style.grid.ink`. (doc line 50; reels/src/soft.tsx:39-46)
- Says two comments are out of date. There are more. `Captions.tsx` says an accent word is set in Signifier italic, but the code changes colour only. `cards.tsx` says each waffle dot turns blue. `Reel.tsx` says 90 px and 60 px margins, but Ivory's tokens are 110 and 80. (doc line 55; reels/src/Captions.tsx:48,58-60, reels/src/cards.tsx:897, reels/src/Reel.tsx:24, reels/styles/ivory/tokens.ts:81-83)
- Lists `funnelLayout` among the boxes used by shared-element transitions. Only `tests/style.test.ts` uses it. `Reel` uses `funnelCardBox`. (doc line 29; reels/src/soft.tsx:283, reels/tests/style.test.ts:41, reels/src/Reel.tsx:189)
- Says `Reel` and `Wide` play `r.audio` when it is set. `Wide` does not play it when `r.alpha` is true. (doc line 61; reels/src/Wide.tsx:182)
- The `style.ts` entry omits the exported type `ToneTokens`. (doc line 34; reels/src/style.ts:11)
- Side Effects names only `grain-<tone>` as a page-global SVG id. The speaker placeholder also emits page-global ids `room` and `body`. (doc line 63; reels/src/Speaker.tsx:35,39)

## reels/tools/README.md

- `transcribe` also writes Whisper's raw output to `build/whisper/`. Side Effects omits it. (doc line 70; reels/tools/cli.ts:293,298)
- `script` also writes `script.txt` in the project folder. Side Effects omits it. (doc line 69; reels/tools/cli.ts:145)
- `script` also writes `build/say.aiff`, or `build/kokoro.wav` and `build/script.txt` with `--engine kokoro`. Side Effects omits these. (doc line 71; reels/tools/cli.ts:155-156,162-163)
- `script --silent` skips transcribe but still writes `transcript.json` and `transcript.txt` from estimated timings. The doc names only transcribe as the writer. (doc line 70; reels/tools/cli.ts:149,152)
- `stills` also writes one new `checks/stills/NN.jpg` per shot. The doc lists only the delete and the contact sheet. (doc line 78; reels/tools/cli.ts:646)
- `feedback` can write `projects/<slug>/review.json`, because it calls `loadReel`, which saves when the merge changed anything. The doc says it only prints. (doc line 27; reels/tools/cli.ts:713, reels/review/store.ts:27)
- `styles feedback` can write `styles/<id>/review.json` through `loadStyleReview`. The doc says it only prints. (doc line 31; reels/tools/cli.ts:732, reels/review/styles.ts:43)
- `styles stills` also deletes old stills in `styles/<id>/checks/stills/` that match the text modes it renders. The doc says only that it writes there. (doc line 82; reels/tools/stylesheet.ts:23)

## reels/styles/README.md

- Says card ids use `<style>.<tier>.<purpose or kind>[.<treatment>]`. The `capture` part of the three `blueprint.t2.capture.*` ids, and their `ivory.` copies, is neither the purpose nor the kind. (doc line 39; reels/styles/blueprint/style.ts:221-224,241-244,264-267, reels/styles/ivory/style.ts:20)
- Says visual kinds are drawn by `Visuals.tsx`, `elements.tsx`, `soft.tsx` or `cards.tsx`. `windows` is drawn in `browser.tsx`, and `lower` in `Wide.tsx`. (doc lines 37-38; reels/src/browser.tsx:98, reels/src/Visuals.tsx:778,792, reels/src/Wide.tsx:84,179)
- Says every card plays live, light and dark, split and scene. Overlay cards get one wide dark view only. `blueprint.t2.video` has no sample, so the lab shows only its `noSample` text. (doc lines 79-80; reels/styles/lab.ts:16-19, reels/review/StyleLab.tsx:197-205, reels/styles/blueprint/style.ts:323)
- Says `review.json` is made by the style lab on first load. `reel styles feedback` also creates or rewrites it. (doc line 24; reels/tools/cli.ts:732, reels/review/styles.ts:38-43)

## reels/styles/blueprint/README.md

- Says card ids use `blueprint.<tier>.<purpose or kind>[.<treatment>]`. The three `blueprint.t2.capture.*` cards have purpose `evidence` and kind `image`, so `capture` is neither. (doc line 20; reels/styles/blueprint/style.ts:221-224,241-244,264-267)
- Says sample assets say they are samples on their face. `sampleLogo` draws only a letter monogram, with no sample label. (doc line 27; reels/styles/blueprint/samples.ts:27-33)

## reels/styles/ivory/README.md

- Says the style lab creates `review.json` here on first load. `reel styles feedback` also creates or rewrites it. (doc line 29; reels/tools/cli.ts:732, reels/review/styles.ts:38-43)
