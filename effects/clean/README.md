# effects/clean

## Overview

The clean reel style, the only reel style. `Clean.tsx` draws every resolved reel plan: split, card, diagram, over and full layouts, with one text treatment at a time. `kit.tsx` and `text.tsx` are the parts it is built from, and the parts that custom diagrams in `../custom` draw with.

## Interface

**Renderer (`Clean.tsx`)**

- `Clean: React.FC<Resolved>`: `../Reel.tsx` renders it for every reel.
- `SEAM` (960), `CHIP_Y` (120), `GLASS` (the glass panel box).
- `box(layout)`: the box a layout draws its visual in, in frame pixels.

**Drawing kit (`kit.tsx`)**

- Frame and look: `W`, `H`, `CX`, `C` (palette), `SANS`, `SERIF`.
- Speeds and timing: `REVEAL` (0.12), `MOVE` (0.6), `k`, `move`, `lerp`, `live`, and `at(times, i, fallback)` (the time of a diagram's nth word, or the fallback when the plan names fewer).
- `Word` (re-exported from the schema).
- SVG parts that draw on as `p` goes 0 to 1: `Line`, `Ring`, `Rect`, `Doc`, `Dots`. Also `Stage` (the svg a diagram draws in), `Label` (text placed by its centre) and `rand(seed)` (seeded noise).

**Laid-out kinds (`flow.tsx`, `code.tsx`)**

- `FlowView` draws a `flow` from `layoutFlow` (`../../engine/flow.ts`): card outlines and arrows carry `data-qc="edge"`, so QC measures every label's clearance. `cardTone(palette)`, `Glyph` (the line icons).
- `CodeView` draws a `code` visual from `codeLayout`, `codeBeats` and `tokenize` (`../../engine/code.ts`), in GitHub Light's colours whatever the palette.
- Both size themselves to the box `Clean.tsx` gives them: the safe panel on a split, the glass's inside on `over` (in the forest palette), the middle of the frame otherwise. `../Visuals.tsx` draws them on YouTube in the shot's tone.

**Text kit (`text.tsx`)**

- Colours and type: `WHITE`, `GREEN`, `MONO`, `display(size)`.
- Parts: `Typed`, `blurIn`, `Center`, `Chip`.
- Captions: `CleanChunk`, `chunkClean(words)`.

`media/qc.ts` imports `C` and `GREEN`.

## Invariants

- This file set must not contain a `Kit.tsx`. macOS file names ignore case, so it would clash with `kit.tsx` (comment in `kit.tsx`).
- `Clean` treats a plan as faceless when `!r.video && !r.cut && !r.standIn`. Otherwise it keeps one `Speaker` mounted for the whole reel and only changes its layout. It always passes `split: "half"`.
- A shot with `keep` draws no new visual. The shot it continues runs to the end of the last kept shot.
- On a `card` layout no visual is drawn in a box. Cards show `beats` and `list` as text instead.
- The caption is hidden while a `hit`, a card beat or a card list is on screen. Caption text is set in lower case.
- A `custom` visual gets the whole layout box and keeps its own margins, with `panel` false only on `diagram`. Other kinds on a split sit in a panel from y 100 to y 790, below Instagram's top bar and above the seam caption.
- `Clean` calls `CUSTOM[v.name]` directly, so `STILL` and the slow push in `../ui.tsx` do not apply here. A name that is not in `CUSTOM` falls through to `VisualView`, which throws.
- `Picture` trims `picture.start` at a fixed 30 fps, not `r.fps`.
- Shots hard cut. Easing lives only inside a graphic, plus the opening push on the first picture, 1.3x to 1x (`Clean.tsx`).
- A caption ends at the next chunk's start or 0.5 s after its last word, whichever comes first (`Clean.tsx`).
- `Line`, `Ring` and `Rect` carry `data-qc="edge"` and `Label` carries `data-qc="label"`. `app/qc.tsx` reads these attributes to check diagrams.
- `Chip` is drawn on a solid colour so QC reads the colour the text really sits on (comment in `text.tsx`).

## Side Effects

- `Clean` plays `Soundtrack`. It loads `<slug>/<picture.src>` through `staticFile` for each shot with a `picture`. The public folder is `projects` (`remotion.config.ts`).
- No file writes, network calls or storage.

## Verification

- Run from the repo root: `npm test` and `npm run typecheck`.
- After a visual change: `npm run studio -- qc --library`.
