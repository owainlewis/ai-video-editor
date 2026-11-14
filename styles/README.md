# Style library

## Overview

The house style and its catalog of cards. Ivory is the house style. Blueprint is the
catalog Ivory is built from, not a look you can render. The structure follows herk-edit-kit's
`style-library/`: one folder per style, a design spec, tokens, a card catalog with tiers, purposes
and typed slots.

```
styles/
  catalog.ts       the shared shape: StyleTokens, Card, Slot (maxChars, minItems, maxItems), StyleDef, slot checks
  library.json     the library: the catalog cards the gallery and the Library tab show ("cards"), and the ones
                   taken out, to add back ("removed"). Owain edits it from the gallery (media/cardlibrary.ts).
  blueprint/       style 01, the card catalog Ivory is built from
    tokens.ts      palette, type, spacing, grid, motion (StyleTokens)
    style.ts       the card catalog, with sample content (StyleDef)
    DESIGN.md      the spec, card picking table, what not to do
    samples.ts     inline, clearly labelled stand-ins for captures, logos and thumbnails
  ivory/           style 02, the house style
    tokens.ts      palette, type, spacing, motion, look switches (StyleTokens)
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

Styles:

- [Blueprint](./blueprint/README.md): the card catalog, `cards` and `slotIssues`.
- [Ivory](./ivory/README.md): the active tokens, `tokens`, `GRAPHITE` and `BLACK`.

## Invariants

Set in code:

- `maxChars` does not count the asterisks that mark an accent.
- `slotIssuesIn` returns no issues when no card matches the visual.
- `atMax` clones the sample and leaves the card unchanged. It returns `undefined` for a card with no sample. Number slots with a `maxChars` fill with nines. Slots with no `maxChars` keep their sample values, and so do image, enum and anchor slots.

Enforced by `tests/catalog.test.ts`:

- `effects/cards.tsx`, `effects/elements.tsx`, `effects/soft.tsx` and `effects/house.tsx` contain no literal colours.


## Side Effects

None. The TypeScript files only define data and pure functions. They do no file, network or process work.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.

## Cards

A card is a visual kind (`engine/schema.ts`, drawn by `effects/Visuals.tsx`, `effects/elements.tsx`,
`effects/soft.tsx`, `effects/cards.tsx`, `effects/house.tsx`, `effects/browser.tsx` (`windows`),
`effects/apps/` (`cli`, `claudeapp`, `grokbot`; cards in `blueprint/apps.ts`),
`effects/clean/Clean.tsx` (`beats`) or `effects/custom/`) as this style offers it: an id
`<style>.<tier>.<purpose or kind>[.<treatment>]`, a tier (`t1` full frame, `t2` beside the speaker,
`overlay` over the picture), the layouts it fits, and its slots. Slot limits are typed (`maxChars`,
`minItems`, `maxItems`), `tests/catalog.test.ts` lays out each sampled `added` card at those limits,
and `media/project.ts` warns when a plan goes past one. A custom visual is checked against
`blueprint.t1.custom`, so a plan past a custom card's `props.*` limit gets no warning.

Most components read colour, type, spacing and motion from tokens through `effects/style.ts`.
`effects/clean/kit.tsx` and `effects/apps/` define literal colours, and `effects/soft.tsx` imports
`BLACK` and `GRAPHITE` straight from the Ivory tokens. `tests/catalog.test.ts` fails on a literal
colour in the four files listed under Invariants.

## Commands

There is no `styles` command. In the editor, the gallery (`#/gallery`) plays the cards that have a
sample, and `npm run studio -- qc --library` measures them. Both leave out the 3 cards with no sample
(`lift`, `custom`, `video`). On YouTube both show the house look in each theme. On reels both show
only the clean kit, since every reel is a clean reel: the clean-only cards (`beats`,
`list.bracket`), the house graphics, real captures and the app kinds.

## Adding a style

There is no `styles new` command or template folder, so make the new folder by hand from Blueprint's files.

1. Copy Blueprint's `tokens.ts`, `style.ts`, `samples.ts` and `DESIGN.md` under the new id.
2. Write `DESIGN.md` from references, then change `tokens.ts` to match it.
3. Keep, drop or add cards in `style.ts`. A new kind needs a schema entry, a component that reads tokens, anchors in `engine/resolve.ts` `visualAnchors`, and a geometry case in `cardGeom` (`effects/cards.tsx`), tested in `tests/catalog.test.ts`.
4. Review it in the gallery and with `npm run studio -- qc --library`.

Rendering reads the active style from `effects/style.ts`, so one style renders at a time. Point
that import at the new folder to see it.
