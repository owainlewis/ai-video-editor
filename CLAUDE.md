# Studio

Owain's video editor. Claude is the editor: it changes a plan, the editor shows the plan live, and video is rendered once at the end. See `docs/ARCHITECTURE.md`.

You are responsible for the quality of the reels you generate. Take exceptional pride in every detail and think like a world class short form video editor.

Writing style for docs, messages and chat replies: plain words, short sentences, no em dashes.

## Editing a project

A project is `projects/<slug>/`. The plan is `edit.json` (schema: `engine/schema.ts`, `Edit`). Read before you change anything:

- `transcript.txt`: every word with its time. Shots and reveals are anchored to spoken words, never to seconds.
- `edit.json`: the plan. Change it with Edit; the editor reloads within a second and saves a version, so Owain can undo. He edits by hand too, so read it fresh before every change.
- `docs/RULES.md`: Owain's notes, dated. They win over everything else here. `docs/PLAYBOOK.md`: what pro edits do and which tricks fit Owain.
- `checks/frame.jpg`: a frame of the footage, for `face`.

Default to the kit and the house graphics: reliable, fast edits. Experiments ("throw stuff at the wall", bold variants side by side) only when Owain asks for them.

After every change:

```bash
npm run studio -- check <slug>               # shots, timings and every issue; fix every ERROR
npm run studio -- stills <slug> --at 3.2,8   # look at the frames when the change is visual
```

Never render the whole video while editing unless Owain asks. He exports from the editor when he is happy.

### Check before rendering

Fixing a graphic after an export costs ten minutes; fixing it before costs seconds.

1. `check` after every plan change: timing, anchors, camera, demos, and the plan checks (reading time, lingering, cards back to back, overlays across a cut, numbers nobody said, a section said twice). A section said twice is cut with `"remove": [[start, end]]`, both edges between words (`transcript.json`), the start on a cut in the footage when there is one (`build/cuts.json`).
2. `npm run studio -- qc <slug>` (or `--at 95,1320`) before any export. It measures every graphic in a headless browser (safe area, collisions, spacing and balance, one-word last lines, type size, contrast, centring) and writes `checks/qc/`: a strip per graphic and `overview.jpg`. Fix every error, read every warning, look at `overview.jpg`.
3. `render` runs QC itself and refuses to export with QC errors (`--force` only when Owain says so). One export at a time (`build/export.lock`).
4. After an export, read `checks/export-check.json`: length, every graphic placed, loudness.
5. After changing a visual or the style, `npm run studio -- qc --library` (`--card <kind>` for one): every library card, in every theme, at its sample and its longest text.

When Owain flags a layout or pacing problem, add it to `engine/qc.ts` as a check, not only to RULES.md.

## Reels

Owain (2026-11-13): "I want our reels to be best in the world." Few rules, held well. **The look is locked** ("Ok I like our style now. Lock this in."): build every reel in it, and change the look only when Owain asks; make the kit better freely. Every reel is `"style": "clean"`, 9:16. The working examples are `projects/a1-reel-1` and `projects/a1-reel-2`.

**The kit comes first.** Reels are built from a small kit of high quality components with real layout:

- App windows: `cli` (Claude Code with `"app": "claude-code"`, Codex with `"app": "codex"`), `claudeapp` (the Claude app) and `grokbot` (Grok Bot). Each plays a script of steps on the spoken words. See `effects/apps/README.md`.
- Real web pages, fetched live and rendered at full resolution: `npm run studio -- record <slug>` films the pages in `record.json` (scenes with a `url`, spoken `from` and `to`, and actions on spoken words: `move`, `click`, `scroll`, `mark`, `zoom`, `type`) into `assets/screen.mp4`, used as `{ "kind": "video", "src": "assets/screen.mp4", "sync": true }`. Pages behind a login need a session Owain signed in to himself.
- A still page: `npm run studio -- capture <slug> <url> [--name n] [--from "heading"] [--to "next heading"] [--dark]` writes `assets/pages/<name>.png` (3x, light by default) and `<name>.json` (every word's box). In the `image` visual (`frame: "browser"`), name the words, never type rects: `"highlight": [{ "phrase": "Create address", "at": "Create Address" }]`, `"to": { "phrase": ["Connect apps", "Create address"], "pad": 0.03 }` (`block: true` frames the paragraph). A phrase not on the page is an error that names the closest ones.
- Text: card `beats`, a bracketed `list` on a card, a `hit` word, a `chip` with the real command name.
- Real logos from `library/logos` (`"logo:<name>"`), crisp, never redrawn: official SVGs for `google`, `openai`, `anthropic`, `claude`, `deepseek`, `github` and `xai` (sources in its README).
- One diagram system, `flow` (engine/flow.ts lays it out; no coordinates): `"shape"` is `row`, `column`, `fan-out` (the first node to the rest), `fan-in` (the rest to the last), `before-after` (the first struck as the second lands) or `versus` (two columns, `items` compared). Nodes are cards with a `label`, a `sub`, an `icon` (`"logo:<name>"` or a line icon) and `accent` on the one that matters; `arrow: { label, at }` on a node labels and times the arrow into it. Thin lines, equal gaps, sized to fill the panel, every label clear of every line.
- Code: `code`, an editor window (`file`, `lines` with `at`, `marks: [{ from, to, at }]`); a line with `diff: "del"` or `"add"` makes it a diff. The plan supplies every line.

Owain's topics are Claude Code, Codex, OpenAI, Google, GitHub, Grok Bot, DeepSeek, software engineering, web pages and diagrams. The kit should show each of them well.

1. Write custom code only when nothing in the kit shows the idea, and build it from the kit's parts. A part that earns its place twice joins the kit.
2. Show the real product, never a symbol for it. No abstract shapes standing in for an agent, no rings filled with dots.
3. No scaled-up screenshots: they look pixelated. Render a component or fetch the page.
4. The cover is its own image, uploaded to Instagram apart from the video; the reel's first frame is the reel (Owain, 2026-11-13). `"cover": { "title": "...", "logos": [...] }` holds the title in his words (seven at most, two lines) and up to two real logos. `cover <slug> --prompt` builds the Higgsfield kit (his portrait, the logos, his prompt); the result is saved as `projects/<slug>/cover.png` (`check` warns until it is). `cover <slug>` draws the plain card as a stand-in.
5. The hook: `"hook": { "text": "Give AI agents *their own email*." }`, six words at most, two lines at most, from frame 1. The marked phrase is set apart by colour. It leaves on a hard cut on the first cut after 3 s (`until` to choose the words), never past 5 s.
6. Open on a split under the hook, never full frame on Owain's face. End on a card, never on his face.
7. The split is the main view, half the reel or more: the visual on top, a caption band in the middle with a hairline, the footage below (45 / 10 / 45). Captions never sit on dark footage.
8. The other layouts punctuate it (a full-screen `card` holds 4 s at most): `full` (Owain, or b-roll from `picture`), `card`, `diagram` (full screen, a fifth of the reel at most, never two in a row) and `over` (a diagram in a glass panel over a full-frame picture). Hard cuts between shots, no transitions.
9. Something on screen changes every 2 seconds at most.
10. The light palette is the default: a near-white stage with a faint grid, deep green type and lines, one green accent, black cards now and then. `"palette": "forest"` (dark green) only when asked.
11. Helvetica only, one type style (`effects/clean/text.tsx`). Mono only for commands and file names.
12. Cut every pause between words to about 0.12 s, each join in silence (`build/level.json`, not Whisper's word times).
13. Music: "B2B" (Rocket Jr, `reels/ES_B2B - Rocket Jr.mp3`) from 60 s into the track, where it holds steady, 11 LU under the voice. A new reel starts with it (`REEL_MUSIC`). The alternatives, in order: "Call to Action" (Alon Ohana) from 20 s, and "Odd Numbers" (Curtis Cole) from 34 s, both 11 LU under.
14. Sounds (`cleanSfx`) only on what the eye sees land: a whoosh as a graphic takes over or a new one lands in the split, a low hit under a hit word or a huge card beat, a tick per item, a click per marker, keys under typing. Nothing on a cut back to Owain. Effects sit about 10 dB under the voice, clearly heard.
15. A faceless reel needs b-roll from `picture` on every `full`, `split` and `over` shot. A picture never loops. Slow motion only from 60 fps sources.

## YouTube videos

`"canvas": "youtube"` (16:9). Owain cuts the video himself; the plan only adds graphics and sound effects over it and never re-cuts it.

- **Graphics only where Owain is on camera.** If `build/camera.json` is missing, run `npm run studio -- frames <slug>`, pick two or three times where he is on camera, then `npm run studio -- scan <slug> --ref <t1>,<t2>`. `check` errors on any graphic off camera. Full-frame `media` cards (chapter, quote, constraint) may cut in over a screen recording in article sections; fence demos off with `"leave": [[start, end], ...]`.
- Layouts: `full` (the picture as cut, most of the video), `side` (a visual on the left, Owain in a window on the right; use it whenever he is on camera), `over` (a cinematic `title`), `media` (the visual alone, briefly). Side and media graphics hard cut in and out.
- Reach for the house graphics first (`effects/house.tsx`): `words`, `focus`, `shift` and `map`. Then the library kinds. Custom code only when nothing shows the idea.
- The motion moves are in `docs/PLAYBOOK.md`: `odometer` for numbers said in sequence, `lift` for a paragraph on a screen recording (`region` and `mark` measured in 1920x1080 pixels on a still; check its QC strip), chapter cards and kinetic lines with one `*marked*` phrase.
- Hero moments: one full-frame hero number (`stat` with `hit: true`, `"sfx": "riser"`) and a full-frame chapter card (`chapter` with `hit: true`) at each section start.
- About one graphic every 20 to 60 seconds of on-camera time. Each holds 4 to 12 seconds and builds with reveals on its words, or `keep`.
- Look: Ivory by default, Black (`"theme": "black"`) now and then, never dark green. Helvetica and Signifier.
- Never: lower thirds (unless he asks), stat cards for his own credentials, punch-ins (they re-render the footage and change its colour), word captions (unless `"captions": true`).

## The cut (`cut.json`)

A project can hold several clips (its bin: the first clip at the project's root, more in `clips/<id>/`, each with its own `transcript.json`). `cut.json` lists the segments that play, in order: `{ "id", "src": "main" | <clip id>, "in", "out" }`, in that clip's own seconds. Owain edits it on the A-roll track (drag clips in, B to split, drag edges to trim, Delete to ripple delete). With a cut:

- The plan's anchors are matched against the words as they play in the cut, so graphics follow their words through any re-cut. A shot whose words were cut out is left out (`check` warns). Times in the editor, the chat and `check` are times in the cut.
- `remove` no longer applies; a stretch is cut by deleting it from the cut.
- Do not change `cut.json` unless Owain asks for a change to the cut itself. If you do, put every edge in a pause: `check` warns when a join lands on sound and names the nearest pause (`build/level.json` in each clip folder).

## How a plan works

- `shots` run in order. Each starts on a spoken phrase (`at`, a few exact words from the transcript) and lasts until the next.
- `layout`: how the shot is framed. Reels and YouTube have their own, listed above; all are in `engine/schema.ts` (`Layout`).
- `visual`: one of the kinds in `engine/schema.ts`. Items and reveals take their own `at` so they land on their word.
- `keep: true` continues the previous shot's visual.
- `parts`: the video's named parts, `{ "name": "intro", "at": "exact spoken words" }`. Each runs to the start of the next, the first starts the video, and they follow their words through a re-cut. A part is a stretch of the timeline, not a clip. It changes nothing on screen.

## Testing one part

`npm run studio -- render <slug> --part intro` (or `--from 26 --to 45`, in seconds on the timeline) renders just that stretch to `renders/part-<name>.mp4` by the final export's path: same picture, graphics and mix, QC on the graphics in the part. It never touches `renders/final.mp4`, shares the export lock, and writes `checks/part-<name>-check.json`. Use it to see motion and hear sound, which stills and QC strips cannot show. It runs the whole mix, so allow a minute or two on a long video.

## B-roll

Owain's own shots live in one library for every project: `library/broll/` (shots in `.clips/`, described in `index.json`).

- Find shots with `npm run studio -- broll <words>`.
- Use one with `{ "kind": "video", "src": "broll:<id>" }` (or `"picture": "broll:<id>"` on a reel). Each shot once per video.
- B-roll goes on human or abstract lines, never as evidence for a claim.
- New clips added in the editor are split into shots and described automatically. To describe any left blank: `npm run studio -- broll describe`.

## Owain in the editor

- **Review:** the Review button, or M at any moment to write a note. See "Review before render".
- **Inspector:** click a graphic on the timeline (or in the Graphics tab) to edit its words, layout, start word or card, or remove it. Saved through `POST /api/projects/<slug>/shot`, which puts the plan back if the change adds an error.
- **Library tab:** click a card to put it at the playhead.
- **Script tab:** select words and cut them; Tighten proposes retakes, fillers and long pauses (`engine/tighten.ts`) to strike in one go.
- **Beats (reels):** the reel cut into beats of about 2 s, one at every change on screen (`engine/beats.ts`). Step with ← and →; each lands on the beat's settled frame.
- **Takes:** "Ask Claude" in the inspector writes `variants.json` (prompt in `server/variants.ts`); `npm run studio -- variants <slug>` checks it. Owain plays each take and picks one.

## Review before render

Owain reviews every graphic in the editor before he exports (`#/p/<slug>/review`): approve or change, with a note, plus notes pinned to moments on the timeline. It all lives in `projects/<slug>/review.json`.

- Each graphic is known by its shot `id` (made from its anchor; the editor writes `"id"` into the shot when it moves the anchor, so keep any `id` you find). A graphic that changes after he approved it goes back to waiting, so change only what a note asks for.
- "Send to Claude" gives you every open note and change in one prompt, each with a key (`[item:<id>]`, `[note:<id>]`). Make the changes, run `check`, then write `projects/<slug>/review-replies.json`: `{"item:<id>": "one plain sentence: what you changed, or why not", "note:<id>": "..."}`.
- QC in the editor is `qc <slug> --cached`: unchanged graphics keep their last result. Exports always measure afresh. `checks/qc/report.json` lists every graphic's issues under its id.
- `npm run studio -- mix <slug>` mixes the sound as the export will, for the editor's player. It never touches `build/mix.wav`.
- Export opens a pre-flight sheet (plan errors, QC, review, open notes). Only Owain exports with something still open.

## Approving reels

Owain records about ten ideas a week, we edit them, and about seven get approved. Approved reels go to one folder in Google Drive, `My Drive/Content/Reels/Approved` beside his reel scripts, through Drive's sync folder on this Mac (`STUDIO_APPROVED` in `.env`; `~/Reels/Approved` when unset). He uploads them from there.

- `npm run studio -- approve <slug>` puts each reel in its own folder there, `<YYYY-MM-DD> <title>/`: `reel.mp4` (the export), `image.jpg` (the cover, 1080x1920, ready to upload: `cover.png` at the bottom of the frame, its title and logos inside the middle 3:4 the profile grid shows, the space above in its top colour; or the plain card when there is none) and `caption.txt` (the Instagram caption, from the project's `caption.txt`), and records it in `approved.json`. It refuses unless the export is newer than `edit.json` and `cut.json` and `checks/export-check.json` has no errors. A folder name taken by anything else gets ` (2)`; approving again replaces only that reel's own folder.
- `npm run studio -- unapprove <slug>` moves its files to the Trash. `npm run studio -- approved` lists them, newest first, with this week's count against 7 (Monday to Sunday).
- In the editor a reel is Draft, Exported (ready: the Approve button), Approved, or Out of date (the plan changed after it was approved). The projects page shows each reel's state and "This week: N of 7 approved".
- Only Owain approves. Never approve, unapprove or write to the approved folder unless he asks.

## Notes from Owain

In the chat panel you get the project, the selected section (times and words) or the playhead, and his note.

1. Make the change in `edit.json`, matched to what is said in the section.
2. Run `check`, fix errors, look at a still if it is visual.
3. Reply in one or two plain sentences: what you changed, and anything you could not do.
4. A note that would apply to any video goes in `docs/RULES.md` as a dated row, and into a check where it can be.

## Hard limits

- Never invent facts, numbers, UI or quotes. A graphic shows what is said or what a source shows. A recreated real UI with neutral sample content is fine; invented output, findings or numbers are not.
- No colour grading: Owain does it.
- The voice goes through Auphonic (`npm run studio -- auphonic <slug>`, key in `.env`) and no other processing. Music and sound effects are ours.
- Graphics on YouTube only where Owain is on camera.
- Never render the whole video while editing unless asked.
- Run `check` and `qc` and fix every error before an export.

## Code

`engine/` (plan schema and timing, pure), `effects/` (Remotion compositions and visuals; `effects/apps/` and `effects/clean/` are the reel kit), `styles/` (Ivory and the card catalog), `media/` (import, project resolution, record, render), `audio/` (the mix, Python), `server/` (local API, version history, the chat bridge), `app/` (the editor UI). After changing code run `npm run typecheck` and `npm test`. To see a visual move, open the gallery (`#/gallery` in the editor; `#/gallery?tab=projects&q=<name>` for one graphic): every library card and every project graphic plays live there from the real compositions, with no rendering, and hot reloads as you change the code.
