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

The props and beats each graphic reads are in its source. In `egmclean.tsx`, `ccreview.tsx`, `effort.tsx`, `subtasks.tsx`, `reviewmd.tsx`, `egmnatural.tsx`, `egmslow.tsx` and `automations.tsx`, graphics read only `times`, with these exceptions: `RmdRepo` reads `label` and `agentsOnly`, `NatFull` reads `rows` and `label`, `SlowGoldfish` reads `first`, and `SlowFeedback` reads `primary` and `label`.

| File | Keys in `CUSTOM` | Drawn for |
| --- | --- | --- |
| `moves.tsx` | `statbadge`, `stopwatch`, `timeline`, `hub`, `phases`, `verifier`, `igcta` | Moves from the five-reel study |
| `ax.tsx` | `swarm`, `analogy` | Google AX reel |
| `migrate.tsx` | `migrate` | Google AX reel |
| `orgchart.tsx` | `orgchart` | Agency Agents reel |
| `skills.tsx` | `skills` | Skills reel |
| `points.tsx` | `points` | Points on a paper panel (layout `half`) |
| `threethings.tsx` | `three`, `blueprint`, `swap`, `commits` | Three things reel |
| `tools.tsx` | `tools` | Tool logos landing as they are said |
| `egm.tsx` | `egm` | EGM, as one diagram |
| `egmclean.tsx` | `egm-agents`, `egm-one-agent`, `egm-handoff`, `egm-gaps`, `egm-brainstorm`, `egm-draft`, `egm-reviewers`, `egm-pick`, `egm-drift` | EGM reel, clean style |
| `ccreview.tsx` | `ccr-flood`, `ccr-rounds`, `ccr-fifty`, `ccr-drop` | Claude Code review reel, clean style |
| `effort.tsx` | `eff-assume`, `eff-bench`, `eff-cost`, `eff-turns` | Max effort reel, clean style |
| `subtasks.tsx` | `sub-alive`, `sub-life`, `sub-zero`, `sub-reopen`, `sub-same` | Subagent tasks reel, clean style |
| `reviewmd.tsx` | `rmd-file`, `rmd-repo`, `rmd-rules`, `rmd-loop` | REVIEW.md, clean style |
| `egmnatural.tsx` | `nat-two`, `nat-full`, `nat-goldfish`, `nat-angles` | EGM, the natural take, clean style |
| `egmslow.tsx` | `slow-two`, `slow-deep`, `slow-goldfish`, `slow-feedback`, `slow-eager`, `slow-tradeoffs` | EGM, "it forces you to slow down", clean style |
| `automations.tsx` | `auto-flood`, `auto-morning` | ChatGPT scheduled automations, clean style |
| `stage.tsx` | `drain`, `lens`, `wall`, `thread`, `gaps`, `drift`, `surge`, `scale` | The stage moves, 16:9 for YouTube |

## Invariants

- A plan name that is not in `CUSTOM` throws: `no custom graphic "<name>" in effects/custom/index.ts` (`../ui.tsx`).
- Every name in `STILL` must be in `CUSTOM`. Every library card with a `custom` sample must name a graphic in `CUSTOM` and in `STILL` (`tests/stage.test.ts`).
- `times` holds one entry per `at` beat, and can be empty or short. Read it by index with a fallback. The fallback differs by graphic: `shot.start` (`ccreview.tsx:at`, `egmclean.tsx:at`, and `at` from `../clean/kit` in `egmnatural.tsx`, `egmslow.tsx` and `automations.tsx`), a steady walk on (`stage.tsx:beats`, `egm.tsx:at`, `Tools`, `Points`), or `Infinity`, so that part never appears (`Migrate` tags, `Swap` names).
- `time` and `times` are timeline seconds, not seconds from the start of the shot.
- `stage.tsx` drops extra items: `Lens` and `Thread` keep 4, `Gaps` 4 holes, `Drift` 5 rows, `Surge` 3 nodes, `Wall` 2 inputs.
- `stage.tsx` draws for 16:9, for `side` and `media`. Bars stand for text so nothing is made up, a number shows only when it is said, and there is one accent (header comment).
- `moves.tsx` graphics keep changing: something lands every second or so (header comment).
- `egmclean.tsx`: a chip takes y 120 to 190, and the overlay draws in the glass, 960 x 880 (header comment).
- Scatter and jitter are deterministic, so every render is identical (`ax.tsx:jitter`, `stage.tsx:seeded`, `skills.tsx:jitter`). No file here uses `Math.random`.
- `Surge` flood dots carry `data-qc="ambient"`, so QC does not read them as layout.
- `Points` is always on paper, with its own colours, and is inset so the slow push never crops its left edge.
- `Tools` shows real logos from `library/logos` only, never redrawn. `effort.tsx` hard-codes the numbers said in that video.
- Through `../ui.tsx`, a graphic not in `STILL` is pushed slowly to 1.06x across its shot. `../clean/Clean.tsx` calls graphics directly, with no push.
- In `ccreview.tsx`, `egmclean.tsx`, `effort.tsx`, `subtasks.tsx`, `reviewmd.tsx`, `egmnatural.tsx`, `egmslow.tsx` and `automations.tsx`, split diagrams stay above y 830 (their header comments). Their full-screen diagrams stay above the caption: y 1520 in `ccreview.tsx`, y 1400 in `effort.tsx`, `subtasks.tsx`, `reviewmd.tsx`, `egmnatural.tsx`, `egmslow.tsx` and `automations.tsx`.

## Side Effects

- `StatBadge` (`moves.tsx`) loads `props.src` through `staticFile`.
- `Tools` (`tools.tsx`) loads `props.tools[].logo` in an `Img`. A plan gives it as `logo:<name>`, and `media/project.ts` turns that into a data URL before it gets here.
- All other graphics draw from their props and the clock. No file writes, network calls or storage.

## Verification

- Run from the repo root: `npm test` (includes `tests/stage.test.ts`) and `npm run typecheck`.
- To see one graphic live: the gallery at `#/gallery?tab=projects&q=<name>` in the editor.
