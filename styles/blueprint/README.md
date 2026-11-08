# Blueprint

## Overview

Blueprint is the card catalog that Ivory is built from. It is not a look you can render: `effects/style.ts` uses Ivory's tokens only, and `styles/index.ts` does not register Blueprint.

The catalog lists every visual kind the editor can put on screen. Each card has an id, a tier, a purpose, its layouts, typed slots, and sample content or a reason it has none. `DESIGN.md` holds the spec and the table for picking a card. Its opening still calls Blueprint the house look. That is out of date: Ivory replaced it.

## Interface

From `style.ts`:

- `cards: Card[]`: the full catalog. Used by `effects/preview.ts`, `app/Inspector.tsx`, `server/insert.ts` and `media/project.ts`.
- `blueprint: StyleDef`: the catalog with its name, palette, fonts and motion notes.
- `cardsFor(kind)`: the cards for one visual kind.
- `slotIssues(visual)`: messages for slots past their limits. `media/project.ts` turns each one into a warning.
- Re-exports from `../catalog`: `atMax`, `slotValues`, `Card`, `Slot`.

From `tokens.ts`:

- `tokens`: Blueprint's `StyleTokens`.
- `ACCENT`: the blue accent colour.
- `Tokens`, and a re-export of `ToneTokens`.

From `samples.ts` (used by `style.ts` only):

- `samplePage`, `sampleArticle`, `sampleRepo`, `sampleLogo`, `sampleThumb`: inline SVG data URLs that stand in for real assets.
- `SAMPLE_PAGE_SIZE`, `SAMPLE_ARTICLE_SIZE`, `SAMPLE_REPO_SIZE`: their sizes.

Data:

- `style.json`: `blueprint` as JSON.

## Invariants

Set in code:

- A card with no `duration` takes its tier's default from `DURATION` in `style.ts`.
- `samplePage`, `sampleArticle`, `sampleRepo` and `sampleThumb` label themselves as samples. `sampleLogo` is a neutral monogram, never a real mark.

Enforced by `tests/catalog.test.ts`:

- Every visual kind in `engine/schema.ts` has a card.
- Card ids are unique and match `blueprint.<tier>.<purpose or kind>[.<treatment>]`. The tier in the id equals `tier`. The test checks the shape only: the three `blueprint.t2.capture.*` cards use `capture` in the third part, which is neither their purpose (`evidence`) nor their kind (`image`).
- Every card has at least one slot. Every `text`, `richtext` and `url` slot has a `maxChars`. Every `list` slot has a `maxItems`.
- Every card has a `sample` or a `noSample` reason.
- Samples parse as a `Visual`, match the card's kind, fill every required slot and pass `slotIssues`. That checks the card `cardFor` picks, not the card under test. So the eight `blueprint.t2` custom cards are checked against `blueprint.t1.custom` and their `props.*` limits are never tested, and `blueprint.t2.capture.repo` is checked against `blueprint.t2.capture.browser`.
- `chart` and `kpi` samples give `Illustration` as their source.
- Cards marked `added` that have a sample fit four panel sizes, with their sample and with `atMax`.
- `style.json` equals `blueprint`.

## Side Effects

None. The TypeScript files only define data and pure functions.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root. The catalog rules are in `tests/catalog.test.ts`.
