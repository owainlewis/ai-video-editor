# Style library

## Overview

The house style and its catalog of cards. Ivory is the only registered style. Blueprint is the
catalog Ivory is built from, not a look you can render. The structure follows herk-edit-kit's
`style-library/`: one folder per style, a design spec, tokens, a card catalog with tiers, purposes
and typed slots, and a generated registry.

```
styles/
  catalog.ts       the shared shape: StyleTokens, Card, Slot (maxChars, minItems, maxItems), StyleDef, slot checks
  index.ts         the registered styles, and the registry an editor queries
  registry.json    every style's cards, slots and limits (no sample content)
  lab.ts           builds one-shot plans from a card's sample
  blueprint/       style 01, the card catalog Ivory is built from
    tokens.ts      palette, type, spacing, grid, motion (StyleTokens)
    style.ts       the card catalog, with sample content (StyleDef)
    style.json     style.ts as JSON
    DESIGN.md      the spec, card picking table, what not to do
    samples.ts     inline, clearly labelled stand-ins for captures, logos and thumbnails
  ivory/           style 02, the house style
    tokens.ts      palette, type, spacing, motion, look switches (StyleTokens)
    style.ts       Blueprint's cards under Ivory ids (StyleDef)
    style.json     a snapshot of style.ts, out of date
    DESIGN.md      the spec
```

## Interface

From `catalog.ts`:

- Types: `StyleTokens`, `ToneTokens`, `WindowTokens`, `StyleDef`, `Card`, `Slot`, `SlotType`, `Tier`, `Layout`.
- `MAX_SITE`: the longest site name a browser bar shows whole.
- `slotValues(visual, path)`: every value at a slot path such as `items[].text`.
- `cardFor(cards, visual)`: the card a visual uses. Charts pick by type, images by frame, and a list with a bracketed title takes the `bracket` card.
- `slotIssuesIn(cards, visual)`: messages for slots past their limits.
- `atMax(card)`: the card's sample with every text slot filled to its limit.

From `index.ts`:

- `styles`: the registered styles. It holds `ivory` only.
- `styleById(id)`: one registered style. `styleById("blueprint")` is `undefined`.
- `registry()`: every registered style and its cards, without sample content.

From `lab.ts` (used only by `tests/catalog.test.ts` in the root package):

- `labViews(card)`: the sizes and tones a card previews in.
- `labResolved(card, size, tone, text)`: a one-shot `Resolved` plan for a card.
- `LAB_FPS`, and the types `LabSize`, `LabTone`, `LabText`.

Styles:

- [Blueprint](./blueprint/README.md): the card catalog, `cards` and `slotIssues`.
- [Ivory](./ivory/README.md): the active tokens, `tokens`, `GRAPHITE` and `BLACK`.

Most callers import from the style folders directly, not from `index.ts`.

## Invariants

Set in code:

- `maxChars` does not count the asterisks that mark an accent.
- `slotIssuesIn` returns no issues when no card matches the visual.
- `atMax` clones the sample and leaves the card unchanged. It returns `undefined` for a card with no sample. Number slots with a `maxChars` fill with nines. Slots with no `maxChars` keep their sample values, and so do image, enum and anchor slots.
- `registry()` drops `sample` and `noSample` from each card and adds `preview`, true when the card has a sample.
- `labResolved` returns `null` for a card with no sample. Reveals start at 0.5 s and land 0.55 s apart. A plan lasts at least 4.5 s.
- `labViews` gives an `overlay` card one view, wide and dark. Every other card gets split and full, each light and dark.

Enforced by `tests/catalog.test.ts`:

- `registry.json` equals `registry()`.
- Every registered style's folder holds `tokens.ts`, `style.ts`, `style.json` and `DESIGN.md`.
- `effects/cards.tsx`, `effects/elements.tsx`, `effects/soft.tsx` and `effects/house.tsx` contain no literal colours.

No root command writes `registry.json` or the `style.json` files, so a catalog change must update them by other means. The test fails when `registry.json` or `blueprint/style.json` drifts. Nothing compares `ivory/style.json` with the code.

## Side Effects

None. The TypeScript files only define data and pure functions. They do no file, network or process work.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.

## Cards

A card is a visual kind (`engine/schema.ts`, drawn by `effects/Visuals.tsx`, `effects/elements.tsx`,
`effects/soft.tsx`, `effects/cards.tsx`, `effects/house.tsx`, `effects/browser.tsx` (`windows`),
`effects/ui.tsx` (`claudecode`, `search`, `tiers`, `compose`, `divisions`, `chips`, `runs`),
`effects/clean/Clean.tsx` (`beats`) or `effects/custom/`) as this style offers it: an id
`<style>.<tier>.<purpose or kind>[.<treatment>]`, a tier (`t1` full frame, `t2` beside the speaker,
`overlay` over the picture), the layouts it fits, and its slots. Slot limits are typed (`maxChars`,
`minItems`, `maxItems`), `tests/catalog.test.ts` lays out each sampled `added` card at those limits,
and `media/project.ts` warns when a plan goes past one. A custom visual is checked against
`blueprint.t1.custom`, so a plan past a stage card's `props.*` limit gets no warning.

Most components read colour, type, spacing and motion from tokens through `effects/style.ts`.
`effects/clean/kit.tsx` and `effects/ui.tsx` define literal colours, and `effects/soft.tsx` imports
`BLACK` and `GRAPHITE` straight from the Ivory tokens. `tests/catalog.test.ts` fails on a literal
colour in the four files listed under Invariants.

## Commands

These run from `reels/` and act on `reels/styles/`, a separate copy of this folder that has drifted
from it. The root package has no `reel` script and no `styles` command. `--style` defaults to
`ivory`, and only registered styles work, so `--style blueprint` fails.

```bash
npm run reel -- styles --style ivory
```

```bash
npm run reel -- styles --write
```

```bash
npm run reel -- styles stills
```

```bash
npm run reel -- styles feedback
```

```bash
npm run reel -- styles new aurora
```

The style lab is on the review board (`npm run reel -- review`, from `reels/`): every card with a
sample plays live, light and dark, split and scene, with sample text or every slot at its max.
Overlay cards get one view, wide and dark. A card with no sample shows only its `noSample` text.

In the root editor, the gallery (`#/gallery`) plays the cards that have a sample, and
`npm run studio -- qc --library` measures them. Both leave out the 11 cards with no sample. The
gallery always uses the default Ivory style, so it also leaves out the two clean-only cards, `beats`
and `list.bracket`. `qc --library` checks those two in its clean variant.

## Adding a style

`reels/` has the `styles new` command and the `_template/` folder. This folder has neither, so in
the root package make the new folder by hand from Blueprint's files.

1. `npm run reel -- styles new <id>` (in `reels/`) copies Blueprint's tokens, catalog and samples under the new id and the DESIGN.md skeleton.
2. Write `DESIGN.md` from references, then change `tokens.ts` to match it.
3. Keep, drop or add cards in `style.ts`. A new kind needs a schema entry, a component that reads tokens, anchors in `engine/resolve.ts` `visualAnchors`, and a geometry case in `cardGeom` (`effects/cards.tsx`), tested in `tests/catalog.test.ts`.
4. Register it in `styles/index.ts`, update `style.json` and `registry.json` (`styles --write` writes only `reels/styles/`), and review it in the style lab.

Rendering reads the active style from `effects/style.ts` (`reels/src/style.ts` in `reels/`), so one
style renders at a time. Point that import at the new folder to see it in the lab and in reels.
