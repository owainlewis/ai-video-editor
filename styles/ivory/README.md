# Ivory

## Overview

Ivory is the house style. `effects/style.ts` reads its tokens as the active style. It is warm off-white and pine green, with a Graphite dark theme for YouTube and a Black theme. `DESIGN.md` holds the spec.

Ivory has no cards of its own. It reuses Blueprint's catalog, and `tokens.ts` and the `look` switches restyle it.

## Interface

From `tokens.ts`:

- `tokens`: Ivory's `StyleTokens`, including `look` (keyword captions, stack chapters, bare charts).
- `GRAPHITE`, `BLACK`: `ToneTokens` for the dark themes. Used by `effects/soft.tsx` and `media/qc.ts`.
- `Tokens`: the type of `tokens`.

## Invariants

Set in code:

- `ivory.cards` are Blueprint's cards with the id prefix `blueprint.` changed to `ivory.`. Slots, kinds and tiers are the same, so a plan can switch style without a rewrite.
- `font.code` is the only monospace token. The comment in `tokens.ts` limits it to text that is literally code.

Enforced by `tests/catalog.test.ts`:

- On the active `style` from `effects/style.ts`: `type.display.family` equals `font.sans`, `type.display.weight` is 700, and `type.accent` is `"italic"`.
- `t` in `effects/theme.ts` has Ivory's canvas, ink, accent and highlight values.

## Side Effects

None. The TypeScript files only define data.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
