# Style library

## Overview

Named looks for the reel editor, each with a catalog of cards. The structure follows
herk-edit-kit's `style-library/`: one folder per style, a design spec, tokens, a card catalog with
tiers, purposes and typed slots, a generated registry, and a review loop.

Ivory is the only registered style and the one that renders. Blueprint stays as the card catalog
that Ivory's cards are built from; it is no longer a look.

```
styles/
  catalog.ts       the shared shape: StyleTokens, Card, Slot (maxChars, minItems, maxItems), StyleDef, slot checks
  index.ts         the registered styles, and the registry an editor queries
  registry.json    generated: every registered style's cards, slots and limits (no sample content)
  lab.ts           builds the one-shot plans the style lab and contact sheets play
  _template/       DESIGN.md skeleton for a new style
  ivory/           style 02, the house look
    tokens.ts      palette, type, spacing, grid, motion (StyleTokens)
    style.ts       Blueprint's cards under ivory.* ids (StyleDef)
    style.json     generated from style.ts
    DESIGN.md      the spec
    review.json    Owain's Approve / Change and notes per card, made by the style lab on first load or by `styles feedback`
    checks/        contact sheets (git-ignored)
  blueprint/       style 01, now the card catalog behind Ivory
    tokens.ts      palette, type, spacing, grid, motion (StyleTokens); not rendered
    style.ts       the card catalog, with sample content (StyleDef)
    style.json     committed copy of style.ts; `styles --write` no longer updates it
    DESIGN.md      the spec, card picking table, what not to do
    samples.ts     inline, clearly labelled stand-ins for captures, logos and thumbnails
    review.json    older style lab state, all waiting, no notes; nothing reads it now
```

## Cards

A card is a visual kind (`src/schema.ts`, drawn by `src/Visuals.tsx`, `src/elements.tsx`,
`src/soft.tsx`, `src/cards.tsx`, `src/browser.tsx` (`windows`) or `src/Wide.tsx` (`lower`)) as this
style offers it: an id `<style>.<tier>.<purpose or kind>[.<treatment>]` (the three `t2.capture.*`
cards use `capture` in the third place, which is neither their purpose nor their kind), a tier
(`t1` full frame, `t2` beside the speaker, `overlay` over the picture), the layouts it fits, and
its slots. Slot limits are typed
(`maxChars`, `minItems`, `maxItems`). Cards marked `added` are sized and tested for them, and
`validate` warns when a plan goes past one. Card, element and scene components take their colours
from tokens: `tests/catalog.test.ts` fails on a literal colour in `src/cards.tsx`, `src/elements.tsx`
or `src/soft.tsx`. Other components still hold some literals, and many sizes and durations are
literals too.

## Commands

List a style's cards. `--style <id>` picks one; the default is `ivory`, and only registered styles work:

```bash
npm run reel -- styles
```

Regenerate each registered style's `style.json` and `registry.json`:

```bash
npm run reel -- styles --write
```

Render contact sheets to `styles/<id>/checks/` (`--sample` or `--max` for one text length):

```bash
npm run reel -- styles stills
```

Print the style lab's open notes:

```bash
npm run reel -- styles feedback
```

Start a new style folder from Blueprint:

```bash
npm run reel -- styles new aurora
```

The style lab is on the review board (`npm run reel -- review`): every card with a sample plays
live, light and dark, split and scene, with sample text or every slot at its max. Overlay cards get
one view, wide and dark. A card with no sample shows only its `noSample` text.

## Adding a style

1. `npm run reel -- styles new <id>` copies Blueprint's tokens, catalog and samples under the new id and the DESIGN.md skeleton.
2. Write `DESIGN.md` from references, then change `tokens.ts` to match it.
3. Keep, drop or add cards in `style.ts`. A new kind needs a schema entry, a component that reads tokens, a case in `VisualView` (`src/Visuals.tsx`), anchors in `tools/resolve.ts` `visualAnchors`, and a geometry function tested in `tests/catalog.test.ts`.
4. Register it in `styles/index.ts`, run `styles --write`, and review it in the style lab.

Rendering reads the active style from `src/style.ts`, so one style renders at a time. Point that
import at the new folder to see it in the lab and in reels. `tests/catalog.test.ts` and
`tests/style.test.ts` pin Ivory's palette and type, so they fail while another style is active.

## Interface

- `catalog.ts`: types `StyleTokens`, `ToneTokens`, `WindowTokens`, `Card`, `Slot`, `SlotType`, `Tier`, `Layout`, `StyleDef`. Also `MAX_SITE`, `slotValues(v, path)`, `cardFor(cards, v)`, `slotIssuesIn(cards, v)` and `atMax(card)`.
- `index.ts`: `styles`, `styleById(id)`, `registry()`.
- `lab.ts`: `labViews(card)`, `labResolved(card, size, tone, text)`, `LAB_FPS`, and types `LabSize`, `LabTone`, `LabText`.
- `registry.json`: the generated output of `registry()`.
- [ivory](./ivory/README.md): the house style and its tokens.
- [blueprint](./blueprint/README.md): the card catalog behind Ivory.

## Invariants

- `styles` holds Ivory alone, so `styleById("blueprint")` returns nothing, and the server answers 404 for it.
- `registry.json` must equal `registry()`, or `tests/catalog.test.ts` fails. Run `styles --write` after a card change.
- Every registered style needs `tokens.ts`, `style.ts`, `style.json` and `DESIGN.md` in its folder.
- `maxChars` does not count the asterisks around an accent word.
- A `url` slot's site may be at most `MAX_SITE` (28) characters, so it shows whole in a browser bar.
- `cardFor` picks a chart's card by `type` and an image's card by `frame`.
- `atMax` fills slots with ordinary English words, because a limit is a promise about real copy.
- `labResolved` returns null for a card with no sample. Reveals land every 0.55 s, and a preview lasts at least 4.5 s.
- `lab.ts` depends on `visualAnchors` in `tools/resolve.ts`.

## Side Effects

None. These modules only build data. The commands that write files are in [tools](../tools/README.md).

## Verification

- Run: `cd reels && npm test` (`tests/catalog.test.ts`, `tests/style.test.ts`)
- Run: `cd reels && npm run typecheck`
