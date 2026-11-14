# effects

## Overview

The Remotion compositions and every visual. The editor plays a resolved plan through these same components, and exports render them, so the preview is the real thing. `Reel` draws 9:16 reels (always in the clean style, `clean/Clean.tsx`), `Wide` draws 16:9 YouTube videos, and both take a `Resolved` plan (`engine/schema.ts`) as props.

## Interface

**Subdirectories**

- [clean](./clean/README.md): the clean reel style renderer and its drawing and text kits.
- [custom](./custom/README.md): the registry of one-off graphics drawn per video.

**Entry and compositions**

- `index.ts`: calls `registerRoot(Root)`. It is the entry point for `remotion.config.ts` and for `media/render.ts` and `media/export.ts`.
- `Root` (`Root.tsx`): registers the compositions `Reel` and `Wide`.
- `compositionFor(canvas)` (`canvas.ts`): the composition id and size for a plan.
- `Reel` (`Reel.tsx`): renders `Clean` for every reel.
- `Wide`, `WW`, `WH`, `SIDE`, `MEDIA` (`Wide.tsx`): lays graphics over the footage. This `MEDIA` is a box in 16:9 pixels, not the one in `theme.ts`.

**Footage and words**

- `Speaker`, `speakerPlace`, `faceRect` (`Speaker.tsx`): the speaker's video on reels, framed per layout. `Clean` and `clean/hook.tsx` use it.
- `CutVideo`, `Soundtrack` (`cut.tsx`): a project's cut, segment by segment, in the editor, and the video's sound.
- `Footage` (`frame.tsx`): footage from a shot's own start.

**Visuals**

- `VisualView` (`Visuals.tsx`): draws one `ResolvedVisual`, switching on its `kind`. Also `Accented` and `Journey`.
- `FrameVisual`, `isFrame`, `FRAME_KINDS`, `Digits`, and a re-export of `FAST` (`frame.tsx`): full-frame graphics that skip the scaled panel. `isFrame(shot)` is true for a `media` shot with a kind in `FRAME_KINDS`, or a `chapter` with `hit`.
- `UiVisual`, `UI_KINDS` (`ui.tsx`): the app kinds (`cli`, `claudeapp`, `grokbot`) and the `custom` kind.
- `Cli`, `ClaudeApp`, `GrokBot`, `Blob` (`apps/`): the app kit, the real products drawn to move (`cli`, `claudeapp`, `grokbot`). See `apps/README.md`.
- `WordsVisual`, `WordsOver`, `FocusVisual`, `MapVisual`, `mapLayout`, `ShiftVisual` (`house.tsx`): the house graphics.
- `cardGeom`, `Geom`, `Box`, `Fit`, `fit`, and the `*Card` components and `*Geom` functions per card kind (`cards.tsx`): cards laid out by geometry functions. `tests/catalog.test.ts` checks `cardGeom`.
- `ChartVisual`, `PipelineVisual`, `ConstraintVisual` (`elements.tsx`).
- `GridVisual`, `FunnelVisual`, `TypeVisual`, `Blueprint`, `SceneCanvas`, `SoftAccented`, `pal`, `darkIsGraphite`, `isBlack`, `Tone`, `Pal`, `Box`, `odometerColumns`, `funnelLayout`, and a re-export of `ACCENT` (`soft.tsx`).
- `BrowserChrome`, `WindowsVisual`, `browserGeom`, `windowsGeom`, `chromeHeight`, `stackChromeHeight`, `addressRoom`, `splitUrl` (`browser.tsx`).
- `PageActions` (`pageactions.tsx`): an agent at work on a captured page, inside the image card's camera frame: the cursor (the same arrow `record` films) travels to each target and clicks with a sage ring; a field shows its captured focus look and types in the page's font over its own background (dots for a password; it scrolls when the text outgrows it); a box shows its captured tick.

**Design tokens and motion**

- `style`, `look`, `ACCENT`, and a re-export of the type `ToneTokens` (`style.ts`): the house style tokens.
- `t`, `W`, `H`, `splitGeom`, `SplitMode`, `Box`, `HEADER`, `MEDIA`, `ease`, `clamp` (`theme.ts`).
- `FAST` (0.18), `MOVE` (0.46), `STAG` (0.08), `easeOut`, `easeInOut`, `prog`, `lerp`, `In`, `Mark`, `markColor`, `runs` (`motion.tsx`). The clean style has its own speeds in `clean/kit.tsx`.
- `frameRect`, `Rect`, `TRANSITION`, `cameraEase`, `cameraProgress` (`camera.ts`).

**Plans for preview (`preview.ts`)**

- `effectList(canvas, library)`, `offBrand`, `Canvas`: the library cards a canvas can show, from `styles/library.json` as `media/cardlibrary.ts` reads it.
- `cardPlan`: a one-shot plan for a library card sample. `cardLayout`: the layout a card is placed in.
- `shotPlan`: one shot of a project, alone and silent. `settledTime`: the time a graphic has settled.

Used by `app/` (editor, gallery, library, inspector, QC) and `server/` and `media/`. `media/project.ts` also uses `frameRect`, `HEADER`, `MEDIA` and `splitGeom`.

## Invariants

- `Wide` and `Clean` compute `time = useCurrentFrame() / r.fps` once and pass it down, including into `Sequence`s. Visuals therefore compare it to timeline seconds such as `shot.start`.
- A shot with `keep` draws no new visual. The shot it continues is drawn with `end` extended to the last kept shot.
- `Speaker` stays mounted for a reel's whole length so playback never seeks between shots. Hidden layouts set its opacity to 0. `Wide` has its own local `Speaker`, which returns null on `media`, `cutaway` and `half`.
- On a `punch` layout the head is never more than 40% of the frame's height (`Speaker.tsx`).
- In `Wide` and `Footage`, exports read frames with `OffthreadVideo` and the editor plays `Video`. The comment records that the browser decoder shifted the colour.
- `Wide` lays shared visuals out at `DESIGN_W` (900 px) and scales them up to fill the panel. Frame visuals are not scaled this way.
- `lower` visuals return null from `VisualView`. `Wide` draws them over the picture, and it draws `over` titles and `words` too.
- `prog` in `motion.tsx`, `cards.tsx` and `elements.tsx` returns 0 for a non-finite `at`, so an element that never arrives stays hidden.
- `times` is positional and each visual has its own order. For example, `FlowVisual` reads nodes then edges, and the app kinds read their steps first (`engine/apps.ts`).
- `FrameVisual` and `UiVisual` read `shot.visual!`, so the shot must have a visual.
- `Chapter`, `Odometer` and `ui.tsx:useBox` call `useVideoConfig`, so they need a Remotion composition around them.
- Camera moves within a shot run on `cameraProgress`, one per shot (`camera.ts`, `Visuals.tsx:ImageCard`).
- `VideoVisual` converts seconds to frames at a fixed 30 fps.
- Card geometry functions are pure. A card's height comes from the numbers that lay out its content, every text is sized so its longest line fits its room, and sizes, colours and motion come from the style's tokens (`cards.tsx` header).
- `chromeHeight` stays between 66 and 80 px so the address is never under the 24 px label floor; a stack's bars are at least 74 px, since its windows are narrower and the ones behind step back. The browser frame is ours, and the page inside is always the real capture (`browser.tsx`).
- Logos always sit on white tiles, in either tone (`cards.tsx:LogowallCard`).
- Charts say where their numbers come from, or "Illustration" when they are only a shape (`elements.tsx:ChartVisual`).
- Every dot in `ConstraintVisual` is a pure function of time, so frames render the same every time.
- House graphics land each part on `v.times[n]`, else on a steady walk from `shot.start`. Things not yet said stay away (`house.tsx`).
- `soft.tsx` states no glow and no gradient backgrounds.
- App mock-ups use words from the real source (`apps/README.md`).
- `Placeholder` in `Speaker.tsx` is drawn to match `PLACEHOLDER_FACE` in `media/project.ts`.
- `app/qc.tsx` reads `data-qc` attributes in the drawn graphics. It skips anything inside `canvas` or `ambient`, and measures `mark` and `edge`, and `label` text. `SceneCanvas` carries `canvas`, and an odometer column between digits carries `ambient`, so QC measures it once it lands.

## Side Effects

- `index.ts` registers the Remotion root on import.
- `soft.tsx` holds module state (`graphite`, `black`), set by `darkIsGraphite` and read by `pal`, `isBlack` and `SceneCanvas`. `Wide` sets it at the top of each render. `Clean` does not set it.
- Media loads through `staticFile`, from the `projects` public folder (`remotion.config.ts`): `r.video`, `r.audio`, and cut segments.
- Images, captures, logos, favicons and video clips go through a local `src(slug, path)` in `Visuals.tsx`, `browser.tsx`, `cards.tsx` and `soft.tsx`. A path becomes `<slug>/<path>` through `staticFile`. Paths that start with `http` or `https` load from the network, and `data:` paths load inline.
- `Clean` and `Wide` play `Soundtrack`: `r.audio` and, with a cut, what is said. It plays nothing when `r.alpha` is set.
- `ui.tsx:Custom` throws when a graphic is not in `CUSTOM`.
- No file writes, storage access or `fetch` calls.

## Verification

- Run from the repo root: `npm test` and `npm run typecheck`.
- After a visual or style change: `npm run studio -- qc --library`.
- To see a visual live: the gallery at `#/gallery` in the editor.
