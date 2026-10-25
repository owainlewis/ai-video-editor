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
- `layout`: `full` (speaker), `punch` (speaker, closer), `split` (a visual on top, speaker below), `media` (the visual alone), `cutaway` (b-roll edge to edge), `scene` (a full-frame card); on YouTube, `side` (visual with the speaker in a window) and `over` (a cinematic title over the picture).
- `visual`: one of the kinds in `engine/schema.ts` (title, list, steps, chart, stat, kpi, compare, pipeline, constraint, checklist, levels, quote, image, video and more). Items and reveals take their own `at` so they land on their word.
- `keep: true` continues the previous shot's visual (swap the `header` without a new graphic).
- `header`: the headline above a split, with one `*accent*` word.
- `accents`: four to six words in the whole video that carry the meaning.

## YouTube videos

`"canvas": "youtube"` (16:9). Owain cuts the video himself; the plan only adds graphics over it and never re-cuts it. Most of a long video is screen recording and b-roll, so:

- **Graphics go only where Owain is on camera.** If `build/camera.json` is missing, run `npm run studio -- frames <slug>`, look at the sheets, pick two or three times where he is on camera, then `npm run studio -- scan <slug> --ref <t1>,<t2>`. `check` errors on any graphic off camera.
- Layouts: `full` (the picture as cut, most of the video), `side` (a visual on the left, Owain in a window on the right), `over` (a cinematic `title`; no lower thirds, Owain does not like them, unless he asks), `media` (the visual alone, briefly). Side and media graphics hard cut in and out. No stat cards for Owain's own credentials (years, experience). No punch-ins on YouTube: they re-render the footage and change its colour. Hero moments: one full-frame hero number (`stat` with `hit: true` and `"sfx": "riser"`) and full-frame chapter cards (`chapter` with `hit: true`) at each section start; only these two may cut in over a screen recording.
- About one graphic every 20 to 60 seconds of on-camera time. Each holds 4 to 12 seconds and builds with reveals on its words, or `keep`.
- No word captions unless asked (`"captions": true`).

## B-roll

Owain's own shots live in one library for every project: `library/broll/` (shots in `.clips/`, described in `index.json`).

- Find shots with `npm run studio -- broll <words>` (searches descriptions and tags).
- Use one with `{ "kind": "video", "src": "broll:<id>" }`; it is copied into the project when the plan resolves. Each shot once per video.
- Put b-roll on human or abstract lines, never as evidence for a claim.
- New clips added in the editor are split into shots and described automatically. To describe any left blank: `npm run studio -- broll describe`.

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

`engine/` (plan schema and timing, pure), `effects/` (Remotion compositions and visuals), `styles/` (Ivory and the card catalog), `media/` (import, project resolution, render), `audio/` (the mix, Python), `server/` (local API, version history, the chat bridge), `app/` (the editor UI). After changing code run `npm run typecheck` and `npm test`. After changing a visual or the style, run `npm run studio -- effects --force` so the Effects tab shows it.
