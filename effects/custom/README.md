# effects/custom

## Overview

One-off motion graphics, each drawn for one video's argument. A plan uses one as `{ "kind": "custom", "name": "<key>", "props": {...}, "at": ["spoken", "beats"] }`. `index.ts` is the registry. A graphic that keeps earning its place can graduate into the schema as a kind of its own.

## Interface

From `index.ts`:

- `CUSTOM: Record<string, React.FC<CustomProps>>`: the registry, plan name to component. Read by `../ui.tsx` and `../clean/Clean.tsx`.
- `STILL: Set<string>`: graphics drawn to hold still, so they get no slow push.
- `CustomProps`: what every graphic receives.
  - `shot`: the resolved shot.
  - `time`: the current time in timeline seconds.
  - `props`: the plan's `props`.
  - `times`: the spoken times of the `at` beats.
  - `width`, `height`: the box it is drawn in.
  - `panel`: true inside a panel, where the speaker stays.

To add a graphic: export a `React.FC<CustomProps>` from a file here, then import it in `index.ts` and add a key to `CUSTOM`. Draw from `../clean/kit` (clean style) or `../motion`, `../soft` and `../theme` (house style).

The props and beats each graphic reads are in its source.

The registry is empty today. The stage moves drawn for one YouTube study (`stage.tsx`) were deleted on 2026-11-14 with the old library cards; git history has them.

## Invariants

- A plan name that is not in `CUSTOM` throws: `no custom graphic "<name>" in effects/custom/index.ts` (`../ui.tsx`).
- Every name in `STILL` must be in `CUSTOM`.
- `times` holds one entry per `at` beat, and can be empty or short. Read it by index with a fallback, such as `shot.start` (`at` from `../clean/kit`).
- `time` and `times` are timeline seconds, not seconds from the start of the shot.
- Anything random is seeded, so every render is identical. No file here uses `Math.random`.
- Decorative motion that is not layout carries `data-qc="ambient"`, so QC does not read it.
- Through `../ui.tsx`, a graphic not in `STILL` is pushed slowly to 1.06x across its shot. `../clean/Clean.tsx` calls graphics directly, with no push.
- A split's panel is 1080 x 864 (lower under the hook); QC warns when a graphic fills under 45% of it or sits off its middle.
- Real marks only: draw logos and avatars from `props` (`logo:<name>`, inlined when the plan resolves), never redrawn.

## Side Effects

- None. Graphics draw from their props and the clock. Logos arrive in `props` as data URLs (`media/project.ts` turns `logo:<name>` into one). No file writes, network calls or storage.

## Verification

- Run from the repo root: `npm test` and `npm run typecheck`.
- To see one graphic live: the gallery at `#/gallery?tab=projects&q=<name>` in the editor.
