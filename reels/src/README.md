# Remotion composition

## Overview

The React code that draws a reel. `Root` registers two compositions, and each renders one `Resolved` plan from `build/edit.resolved.json`. `schema.ts` defines the plan that Claude writes and the resolved form that `reel validate` produces.

## Interface

Entry and compositions:

- `index.ts` registers `Root`.
- `Root.tsx:Root`: compositions `Reel` (1080x1920) and `Wide` (1920x1080). Length and fps come from the props.
- `canvas.ts:compositionFor(canvas)`: the composition id and size for a plan.
- `Reel.tsx`: `Reel`, `PANEL_X`. Draws visuals on `split`, `media`, `scene` and `cutaway` shots.
- `Wide.tsx`: `Wide`, `WW`, `WH`, `SIDE`, `MEDIA`. Draws visuals on `side`, `media` and `cutaway` shots, and a `lower` or `title` visual on `over` shots.

Plan (`schema.ts`):

- Zod: `Edit`, `Shot`, `Layout`, `Visual`, `SfxKind`.
- Types: `EditPlan`, `VisualSpec`, `Word`, `ResolvedItem`, `ResolvedVisual`, `ResolvedShot`, `Chunk`, `SfxEvent`, `Resolved`.

Drawing:

- `Visuals.tsx:VisualView`: draws one visual by `kind`. `Accented` sets text with one `*accent*`. `lower` returns null here; `Wide` draws it.
- `Speaker.tsx:Speaker`: the speaker footage, or a placeholder for script projects.
- `Captions.tsx`: `Captions`, `isKeyword`.
- `cards.tsx`: `cardGeom(v, w, h)` is the layout of a card for tests. It handles constraint, agenda, checklist, beforeafter, kpi, matrix, timeline, levels, quote, logowall, bento, ring, meter, waffle, windows, and image with a browser frame. Also the `*Geom` functions, the `*Card` components (agenda, checklist, beforeafter, kpi, matrix, timeline, levels, quote, logowall, bento, ring, meter, waffle), `fit`, and types `Box`, `Fit`, `Geom`.
- `elements.tsx`: `ChartVisual`, `PipelineVisual`, `ConstraintVisual`.
- `soft.tsx`: `pal`, `SCENE`, `headlineSize`, `Blueprint`, `SceneCanvas`, `SoftAccented`, `odometerColumns`, `GridVisual`, `FunnelVisual`, `TypeVisual`, and the boxes used by shared-element transitions: `gridTileBox`, `funnelCardBox`, `typeInputBox`. `funnelLayout` is used only by `tests/style.test.ts`. Types `Tone`, `Pal`, `Box`. Re-exports `ACCENT`.
- `browser.tsx`: `BrowserChrome`, `WindowsVisual`, `chromeHeight`, `addressRoom`, `splitUrl`, `windowsGeom`, `browserGeom`.

Shared values:

- `style.ts`: `style`, `look`, `ACCENT`, `STYLE_IDS`, and type `ToneTokens`. It is the one place that picks the active tokens.
- `theme.ts`: `t`, `W`, `H`, `HEADER`, `MEDIA`, `splitGeom`, `ease`, `clamp`, and types `SplitMode`, `Box`.
- `camera.ts`: `frameRect`, `cameraProgress`, `cameraEase`, `TRANSITION`, and type `Rect`.

## Invariants

- Components render `Resolved`, never a raw plan. `reel validate` builds it for a project. `labResolved` builds one for the style lab, and `Root` holds an empty default.
- `Edit.style` is kept so old plans parse. Rendering always uses the tokens in `style.ts`, which is Ivory.
- Motion is a function of time. Only `Reel` and `Wide` read the frame, and they pass `time` down. No component in this folder uses `Math.random` or `Date`, so frames render the same every time.
- The speaker is one continuous video that is never unmounted. Layouts only change its box and framing, so lip sync never drifts.
- A `punch` shot caps its target head height at 40% of the frame height. The scale is the larger of the cover scale and that target, times a push-in of up to 3.5%, so the head can reach about 41.4%, and more on tight footage.
- Camera moves use `cameraEase`, except the speaker's box and crop between layouts in `Wide`, which run on the theme's `ease`. A shot that enters through a shared element holds its own camera for `TRANSITION` (0.7 s), so two moves never overlap.
- A new `Visual` kind needs a case in `VisualView`, which has no default branch; anchors in `visualAnchors` (`tools/resolve.ts`); and a card in `styles/blueprint/style.ts`, because a test requires one for every kind.
- A visual reads `v.times` by index, in the order `visualAnchors` returns. For example, flow is nodes then edges, and funnel is items, the flow, then target lines.
- Each `*Card` draws from its own `*Geom`, and `ConstraintVisual` from `constraintGeom`. The pair must change together. Transitions rely on the same geometry for grid, funnel and type.
- Tests hold every card marked `added` inside its panel at split, inset, scene and side sizes, with its sample and at slot maxes. Padding must be even, and type stays at or above `font.minSize` and `font.labelMin`.
- `cards.tsx`, `elements.tsx` and `soft.tsx` may hold no literal colours. Colours come from `pal` or `style.color`, except the `Blueprint` layer in `soft.tsx`, which builds its colours from `style.grid.ink`. A test enforces this for those three files only. `Visuals.tsx`, `Wide.tsx`, `Speaker.tsx` and `Reel.tsx` do use some literals.
- `soft.tsx` may not use `gradient(`. A test enforces it.
- A test fails on an inline italic `fontStyle` in `Reel.tsx` or `Captions.tsx`. Accent italics come from the accent helpers. `Visuals.tsx`, `soft.tsx` and `cards.tsx` also set italic inline, outside those helpers.
- `chart`, `kpi`, `ring`, `meter`, `waffle` and `quote` require `source` in the schema. The schema comments say to use "Illustration" when numbers only show a shape, and never to invent them.
- `VideoVisual` trims with a fixed 30 fps (`v.start * 30`), so that start offset assumes 30 fps.
- Some comments are out of date. `soft.tsx` calls the accent blue, while tests assert sage. `cards.tsx` names `tests/cards.test.ts`, while the checks are in `tests/catalog.test.ts`, and it says each waffle dot turns blue. `Captions.tsx` says an accent word is set in Signifier italic, while the code changes colour only. `Reel.tsx` says 90 px and 60 px margins, while Ivory's tokens are 110 and 80.

## Side Effects

- `staticFile` lookups for project files under `projects/`, the Remotion public dir set in `remotion.config.ts`.
- `http`, `https` and `data` image or video sources pass through unchanged, so remote files load at render.
- `Reel` and `Wide` play `r.audio` when it is set, except that `Wide` does not play it when `r.alpha` is true. The footage is muted when there is a mix.
- Fonts are referenced by family name and never loaded here, so Helvetica Neue and Signifier must be installed.
- `SceneCanvas` emits an SVG filter with the page-global id `grain-<tone>`. The speaker placeholder emits SVG gradients with the page-global ids `room` and `body`.
- No disk access and no writes to global state.

## Verification

- Run: `cd reels && npm test` (`tests/catalog.test.ts`, `tests/style.test.ts`, `tests/camera.test.ts`)
- Run: `cd reels && npm run typecheck`
- Look at the result: `cd reels && npm run reel -- stills <slug>`
