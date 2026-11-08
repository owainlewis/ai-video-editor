# Blueprint

## Overview

The shared card catalog. Blueprint was the first style and is no longer a look you can render in. `styles/index.ts` calls it Ivory's card catalog base. Its 37 cards are the source of truth for Ivory's cards and for every plan's slot limits.

## Interface

- `style.ts`: `blueprint` (the `StyleDef`), `cards`, `cardsFor(kind)`, `slotIssues(v)`. Re-exports `atMax`, `slotValues`, and types `Card`, `Slot`.
- `tokens.ts`: `tokens`, `ACCENT`, types `Tokens` and `ToneTokens`. Read only by `style.ts` in this folder. Components render with Ivory's tokens.
- `samples.ts`: `samplePage`, `sampleLogo`, `sampleThumb`, `sampleArticle`, `sampleRepo`, and `SAMPLE_PAGE_SIZE`, `SAMPLE_ARTICLE_SIZE`, `SAMPLE_REPO_SIZE`. Inline SVG stand-ins for real captures.
- `style.json`: the `StyleDef` as committed JSON.
- `review.json`: older style lab state for 33 cards. Every entry is `waiting` and it holds no notes.
- `DESIGN.md`: the spec. It predates Ivory: it still calls Blueprint the house look and points to a Blueprint style lab, which the board no longer lists.

Callers: `styles/ivory/style.ts` maps `blueprint.cards`. `tools/cli.ts` uses `slotIssues`. `reel styles new` reads `tokens.ts`, `style.ts` and `samples.ts` as text templates.

## Invariants

- Card ids are `blueprint.<tier>.<purpose or kind>[.<treatment>]`, unique, and the second part equals the card's tier. The three `blueprint.t2.capture.*` cards use `capture` in the third part, which is neither their purpose (`evidence`) nor their kind (`image`).
- Every kind in the `Visual` schema has at least one card.
- Every card has at least one slot. Text, richtext and url slots need `maxChars`. List slots need `maxItems`.
- Every card has a `sample` or a `noSample` reason. A sample must parse as `Visual`, match the card's kind, fill every required non-anchor slot and stay under every limit.
- `chart` and `kpi` samples must have the source `Illustration`.
- Cards marked `added` must cover at least eight kinds and fit every panel size the tests check, at sample and at slot maxes.
- `DURATION` gives default seconds on screen by tier: t1 2.5 to 7, t2 1.5 to 5, overlay 2.5 to 6.
- Sample pages, articles, repos and thumbnails say they are samples on their face. A sample logo is a neutral letter monogram with no label, never a real mark.
- `style.json` must equal `blueprint`, or `tests/catalog.test.ts` fails. `reel styles --write` does not rewrite it, because that command covers registered styles and Blueprint is not one. A change to the cards needs another way to update this file.
- A card change also changes Ivory's cards, so run `npm run reel -- styles --write` to regenerate `styles/ivory/style.json` and `styles/registry.json`.
- `reel styles new` replaces exact strings. Keep `id: "blueprint"` and `name: "Blueprint"` in `tokens.ts`, and the `"blueprint.` card prefixes, `export const blueprint: StyleDef` and `number: "01"` in `style.ts`.
- `tokens` must satisfy `StyleTokens`.

## Side Effects

None. `review.json` is not read by any code path now: the server and `reel styles feedback` go through `styleById`, which does not return Blueprint.

## Verification

- Run: `cd reels && npm test` (`tests/catalog.test.ts`)
- Run: `cd reels && npm run typecheck`
