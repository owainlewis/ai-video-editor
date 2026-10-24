# Studio

Owain's video editor. Claude is the editor: it changes a plan, the editor shows the plan live, and video is rendered once at the end. See `docs/ARCHITECTURE.md`.

Writing style for docs, messages and chat replies: plain words, short sentences, no em dashes.

## Editing a project

A project is `projects/<slug>/`. The plan is `edit.json` (schema: `engine/schema.ts`, `Edit`). Read before you change anything:

- `transcript.txt`: every word with its time. Shots and reveals are anchored to spoken words, never to seconds.
- `edit.json`: the plan. Change it with Edit; the editor reloads within a second and saves a version, so Owain can undo.
- `docs/RULES.md` (the house rules, learned from Owain's notes; they win over everything else) and `docs/STYLE.md`.
- `checks/frame.jpg`: a frame of the footage, for `face`.

After every change:

```bash
npm run studio -- check <slug>               # shots, timings and every issue; fix every ERROR
npm run studio -- stills <slug> --at 3.2,8   # look at the frames when the change is visual
```

Never render the whole video while editing. Owain exports from the editor when he is happy.

## How a plan works

- `shots` run in order. Each starts on a spoken phrase (`at`, a few exact words from the transcript) and lasts until the next.
- `layout`: `full` (speaker), `punch` (speaker, closer), `split` (a visual on top, speaker below), `media` (the visual alone), `cutaway` (b-roll edge to edge), `scene` (a full-frame card); on YouTube, `side` (visual with the speaker in a window) and `over` (lower third or title over the picture).
- `visual`: one of the kinds in `engine/schema.ts` (title, list, steps, chart, stat, kpi, compare, pipeline, constraint, checklist, levels, quote, image, video and more). Items and reveals take their own `at` so they land on their word.
- `keep: true` continues the previous shot's visual (swap the `header` without a new graphic).
- `header`: the headline above a split, with one `*accent*` word.
- `accents`: four to six words in the whole video that carry the meaning.

## Notes from Owain

When Owain asks for a change in the chat panel you get the project, the selected section (times and the words said in it) or the playhead, and his note.

1. Make the change in `edit.json`, matched to what is said in the section.
2. Run `check`, fix errors, look at a still if it is visual.
3. Reply in one or two plain sentences: what you changed, and anything you could not do.
4. A note that would apply to any video goes in `docs/RULES.md` as a row, and into a check where it can be.

## Rules that never bend

- Never invent facts, numbers, UI or quotes. A graphic shows what is said or what a source shows.
- Graphics on YouTube go only where the speaker is on camera, never over b-roll or a screen recording.
- Something on screen changes every 2 to 3 seconds in a reel.
- No grading and no voice processing: Owain does both. Music and sound effects are ours.
- Fonts: Helvetica and Signifier only.

## Code

`engine/` (plan schema and timing, pure), `effects/` (Remotion compositions and visuals), `styles/` (Ivory and the card catalog), `media/` (import, project resolution, render), `audio/` (the mix, Python), `server/` (local API, version history, the chat bridge), `app/` (the editor UI). After changing code run `npm run typecheck` and `npm test`.
