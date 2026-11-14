# xxf6D9jynFw: AI LABS, "EGM: Google's New Way To Use Claude Code Is Insane"

Sent by Owain on 2026-11-06: "For youtube specifically I really like these animations." 15:54, 1920x1080, 29.97 fps, -18.0 LUFS, LRA 3.7. Voice-over only, nobody on camera. A video about the Elephant-Goldfish Model.

Read `overview-0*.jpg` first (a frame every 6 s), then `sheet-1fps-0*.jpg` (the first five minutes at 1 fps), `sheet-later-0*.jpg` (the later graphics at 1 fps), and `mo-*.jpg` (10 fps strips). `transcript.txt` has every sentence with its time.

**How to read this.** "Measured" means a script read it off the frames or the audio (ffmpeg scene detection, per-frame pixel tracking, ebur128, band levels). "Read at 10 fps" means I read it off a strip with timestamps, so ±0.1 s. "Read at 1 fps" means ±0.5 s and is only good for what happens, not how fast. Numbers on screen were read off the frames by eye.

## Structure

- **Measured:** about 57% of the runtime is graphics on a near-black stage (541 of 954 s, by edge brightness; a rough split, dark terminals can land in either bucket). The first 288 s are 95% graphics. After that it alternates with real screen recordings.
- **Measured:** 223 scene changes at a low threshold (`cuts.txt`), 36 at a high one. Most low-threshold hits are parts arriving, not cuts.
- **Measured:** 78 black dips. In the first 288 s there are 37, so a new composition about every 7.8 s.
- **Measured: the dips sit on sentence starts.** 34 of those 37 are within 0.12 s of a sentence start (median 0.06 s), and about two sentences in three open a new composition. This is the main finding: **one sentence, one composition.** The picture is planned from the script's sentences, not the other way round.
- **Measured:** the frame changes in 51% of frames in the first 288 s. The longest still stretches are 3.2, 2.9, 2.9 and 2.8 s, and only four go past 2.4 s.

## The stage

- **Measured:** background `#0A0A0A` to `#0C0C0C`, flat, with a very faint darker shadow pool under cards (`#080808`). No grid and no vignette. Cards `#181818`, skeleton bars `#484C56` and `#747E8A`.
- **Measured:** accents: orange `#FC8A3E` (goldfish), blue `#7AAAF6` (elephant), salmon `#D07050` (Claude Code), green `#90C070` (pass), amber `#E0B878` (warning), pink `#D86870` (error). Six colours, each with one meaning. Red-ish tint on a row is "wrong", green tick is "done".
- **Read at 1 fps:** radius about 12 px, thin or no border, soft shadow. Monospace only for file names (`plan.md`), Inter-like sans for the rest. Text is small (labels about 22 to 28 px at 1080p), and there is very little of it: a file name, a one-word label, a number.
- **Measured:** composition bounds are usually about 960 to 1420 px wide and 450 to 550 px tall, centred. The frame is 75 to 90% empty background. Big empty black is part of the look.
- **Skeleton UI.** Text is drawn as grey bars, so nothing has to be read and the eye goes to whatever changes state. A file, a chat, a terminal and an app are all the same dark card with a different header.
- **Actors.** Two flat marks (elephant, goldfish) are characters. They enter, move, look at things, and reappear across sections. The salmon Claude mascot and the `agent`/`skill` chips are supporting cast.

## Motion (measured unless stated)

| What | Timing |
| --- | --- |
| Cut to a new composition | the old one goes in 1 frame (hard), median 2 frames of pure black (p90 5) |
| A part fading in | about 0.25 s (frames 7 to 15 at 130.4 s), opacity only: no rise, no blur, no scale. Read at 10 fps across a dozen entries |
| Stagger between parts of one beat | 0.1 to 0.2 s (read at 10 fps) |
| Re-layout: a card slides to make room | 406 px in 13 frames (0.43 s): 285, 283, 277, 267, 249, 217, 172, 140, 112, 94, 90, 86, 84, 83, 82 (in 960-wide pixels). Slow start, fast middle, long tail, no overshoot. **That is our MOVE (0.46 s) and our ease almost exactly.** |
| Camera | none. Card bounds are identical to the pixel through a hold (130 to 134 s, 147 to 148.6 s, 272 to 275 s). No push, no drift. Life comes from parts, not the camera |
| Wire drawing | about 0.35 to 0.5 s for one leg, ease-out (read at 10 fps) |
| Long wire with plugs | one pen travels 2 s across the frame, each plug node fading in as the pen reaches it (read at 10 fps) |
| Counter climbing | 0 to 51,384 in 2.5 s: an ease-in, about t^2.3, with a hard stop. Read off the digits: 0, 25, 135, 359, 672, 1,165 ... 44,894, 49,874, 51,384 |
| Counter falling | 72 to 0 in 1.9 s, ease in and out (70, 67, 64, 60, 53, 46, 38, 31, 25, 19, 12, 9, 7, 5, 3, 2, 1, 1, 0). Holds at 72 for 0.7 s first. Colour flips 0.4 s after it lands |

The speeds are close to ours. What differs is what they do with them: no blur, no rise, no camera, and a hold before any number moves.

## Every distinct graphic and move

Times in seconds. "In" is how it enters, "move" what happens in the hold, "out" how it leaves. Almost everything leaves the same way, so "out" is only noted when it differs: **a 1-frame hard cut to black on the next sentence.**

| # | Time | What it shows | In | Move | Hold | Tied to the word |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 to 3.7 | Sting: G logo, "New" pill, EGM mark, title | fades, title 0.5 s later | none | 2 s | "Google called the elephant goldfish model" |
| 2 | 4.3 to 7.4 | **Gate.** A line, a tall gate, dots queuing at it, Claude Code card stuck at 0% | gate, then card | dots arrive one by one and stop; gate tints; "Waiting" appears | 3 s | "catch problems before your agent builds" |
| 3 | 7.5 to 12.8 | Terminal types, page builds beside it, red tint and warnings land after | two windows fade | typing, blocks land in order, warnings last | 5 s | "only find the problems after": the warnings land on "after" |
| 4 | 12.9 to 15.7 | **Torn apart.** Page cards tilted out in a ring with pass and fail badges, Build locked at the bottom | cards fade tilted | badges pop one by one | 3 s | "torn apart first" |
| 5 | 16 to 17.5 | Title again, words colour in as said | hold | colour flip per word | 1.5 s | "elephant and the goldfish" |
| 6 | 18 to 22.5 | Two agent cards, a locked card under each | cards, then locks | none | 4 s | "two different kinds of agents" |
| 7 | 22.7 to 25.7 | **Wall.** The two marks apart, a vertical bar rises between them from the top, tints red | marks, bar grows down | small spark on the bar | 3 s | "keeps those two apart" |
| 8 | 25.9 to 29.8 | **One of many.** A row of workflow cards dims except one; an arc with a "1" links it to EGM | cards staggered | others dim; arc draws | 3 s | "only one does anything like it" |
| 9 | 45.6 to 51.9 | **Wireframe build.** Lines trace the page box by box with a Plan bar filling, then it washes to a filled page | window 0.2 s | two pens trace the outer frame in 0.6 s, each box 0.35 s, bar in step; wash 0.4 s; Build bar 0.3 s | 6 s | "planning" over the lines, "build it" on the wash |
| 10 | 52.1 to 59.9 | **Thread.** Spec rows wired through Claude Code into an empty app; each row builds its part | spec, node, window | row tints, wire draws to the node 0.3 s, on to the window 0.4 s, block fades in 0.2 s as the wire lands; wire fades, next row | about 1.4 s a row | "the agent builds the app by following that plan" |
| 11 | 60.2 to 62 | Pill: "Google engineers" alone, centred | fade | none | 1.8 s | "developed by engineers at Google" |
| 12 | 62.1 to 68.8 | Real article, the title and author marked with a pale red swipe | hard | marker left to right 0.8 s per line | 6 s | the title as he reads it |
| 13 | 72 to 80.6 | **Gaps.** `plan.md` with hatched holes, a badge "4 gaps", `agent` and `skill` chips drift around it | doc, chips staggered 0.1 s | chips orbit about 4 px a second; each docks on a hole, the hole fills, badge counts 4, 3, 2, 1, no gaps | 8 s, 1.7 s a hole | "complete without any gaps" |
| 14 | 80.7 to 89.4 | Plan rows tick as the app stacks up beside them, a "?" next to the agent is answered each time | rows, agent | row tint, tick, block slides up | 8 s | "nothing to guess" |
| 15 | 89.5 to 98.7 | Plan plus a Build and Test checklist, ticks walk down, a bar fills, "Complete" | plan, list slides in beside | ticks one by one | 9 s | "a checklist of what needs to be built" |
| 16 | 108.3 to 112.5 | Elephant, project icons orbit, then get pulled in | mark, icons pop | orbit, then absorbed one by one | 4 s | "remembers everything" |
| 17 | 113 to 117.9 | Elephant over a menu; each item opens its panel beside it | panels | rows fill on "history", "put together", "what people use it for" | 5 s | one panel per clause |
| 18 | 118.2 to 130 | Chat fills bubble by bubble and scrolls; "Might fail" lands; card **slides left** (0.43 s) as the plan files stack beside it | empty chat | re-layout, rows stack | 12 s | the parts of the sentence in turn |
| 19 | 130.3 to 134 | **Drain.** Goldfish, Context, 72%, bar | card 0.25 s | holds 0.7 s, falls to 0 in 1.9 s, colour flips 0.4 s later | 3.7 s | "doesn't remember anything" lands on 0 |
| 20 | 135.3 to 137.7 | **Deal.** One card, then three deal out beside it, each 0% | card, then 0.3 s apart | none | 2 s | "sub-agents that have zero context" |
| 21 | 137.8 to 145.7 | **Wall with a blindfold.** Goldfish, dotted lines to `plan.md` and `your app`; the chat fades in left, a bar rises between, a bubble heads for it and stops | mark, files, wires, tints; chat at 140, bar 0.3 s | dotted wires draw 0.4 s; message slides, stops; a no-entry sign on the bar | 8 s | "only see the plan and your app's code"; bar on "never see" |
| 22 | 145.8 to 151.5 | **Lens.** Agents, then four goldfish round the page, each throwing a soft cone onto a region that lights in its colour | doc, actor fades 0.2 s, cone 0.2 s, region 0.2 s | cones stack up | 5.5 s | "multiple angles" |
| 23 | 151.6 to 157.5 | **Wired plugs.** Plan, a feature, a page; a pen draws round them via empty plugs; the goldfish walks a dotted line to the feature, which tints | nodes 0.1 s apart | pen 2 s, walk 0.7 s, tint on contact, then a clean straight line replaces the tangle | 6 s | "an easier way", "already has something" |
| 24 | 157.6 to 162.2 | **Walker.** Fresh-eyes goldfish beside a doc, ticks walk down, one row "unclear" | doc | row tints as the check reaches it | 4.5 s | "someone who knows nothing" |
| 25 | 162.3 to 167.3 | **Surge.** Three-node flow, counter climbs, dots flood in from the left and run through; the last node breaks | card, nodes 0.1 s apart | counter 2.5 s ease-in, nodes warm up in turn, crack and flag on the last at 51,384 | 5 s | "a lot of people ... all use it at once" |
| 26 | 167.4 to 175 | Plan rows checked, "guesses 3, 2, 1, 0", then Build opens | card | goldfish hops row to row; counter rolls | 7 s | "without having to guess" |
| 27 | 175.3 to 183.2 | **Two lanes to one.** Elephant and goldfish lanes, a doc bounces between them, lanes curve into a Plan; agents take it | lanes draw | doc rides up and down; then the merge | 8 s | "a final plan they both agree on" |
| 28 | 189.8 to 199.7 | Three cards, "Your idea", "A few questions", `plan.md`, greyed until reached, then lit left to right | all three ghosted first | each lights and fills in turn | 10 s | one per clause. The ghost shows the road before it is walked |
| 29 | 199.9 to 205.7 | **Versions.** Doc rides a timeline v1, v2, v3, a loop arrow and a patch at each stop | doc, line | doc slides 0.5 s, row reddens, patch | 6 s | "revise it again" |
| 30 | 205.8 to 216 | **Halo.** Plan, ticks pop in a ring round it; a Live users counter 0 to 100,000 climbs with a line | doc | ticks 0.15 s apart; counter 3 s ease-in; "0 issues" stays put | 10 s | "from every angle", "no matter how many people" |
| 31 | 216.6 to 226 | Chat grows, then brackets draw down its right edge joining your messages to the check | window | brackets draw 1 s, tint | 9 s | "agrees with itself" |
| 32 | 226.2 to 229.7 | Salmon ring spins round the agent, rows tick, "Looks good" | ring | ring one turn a second | 3.5 s | same line, the punch |
| 33 | 229.9 to 239.8 | Chat and Idea side by side, red squiggles on the Idea; it tilts about 8 degrees toward "Your preference"; then the wall and goldfish flag it red | cards | tilt on "agree with what you want" | 10 s | the tilt is the whole joke |
| 34 | 243.2 to 244 | Stack of pages lands on the four goldfish | cards pile | pile falls | 1 s | "a lot of notes" |
| 35 | 245.5 to 250 | Elephant and goldfish cards, then a third slot fades up empty; You card | dealt | third slot lights | 3 s | "the third role ... which is you" |
| 36 | 247 to 255.4 | **Sort.** Notes come down from idea and check into Keep and Ignore slots, You below | notes slide 0.5 s | each settles left or right, then a tick | 8 s | "keep what's useful and ignore the rest" |
| 37 | 255.6 to 261 | Grade: a rubric and the plan side by side, goldfish hops between them, row by row, Grade 4/5 | cards | hop, tick or cross, row tints on both sides | 5 s | "a set of written rules" |
| 38 | 261.2 to 265.2 | **Tree.** Review node, a tree draws down, goldfish land on its ends two then six | node, tree | one pen, children land as it reaches them | 4 s | "starts a set of other sub-agents" |
| 39 | 265.3 to 275.4 | **Funnel.** Six goldfish, a cone into Review, sheets ride the cone in and stack; Main agent's 12% stays flat; one report goes to You | staggered | sheets 0.5 s each, staggered 0.3 s, a counter with a struck-out 84% | 10 s | "keeps the main agent's context from getting bloated" |
| 40 | 275.6 to 286 | **Drift.** Plan and app side by side; a `drift` tag steps down the gap row by row, a band runs across both cards, a tick or a warning lands; amber rows; two buttons, a cursor clicks Fix plan, then Fix app | cards | tag steps 1 s a row, band fades in 0.2 s | 10 s | "every place where they no longer match" |
| 41 | 792 to 795 | Rounds "5 6 7 8 9" as dealt digit cards | dealt | none | 2 s | "numbers them from five to nine" |
| 42 | 825 to 839 | **Green wires into a build.** Rule rows wired by three green curves into a page that builds beside them, a Build bar at 0, 20, 50, 80, 100%; then a README ladder rising step by step | rows then wires | 1 bar step a second | 6 s | "built from the plan" |
| 43 | 835 to 838 | Folder rows checked one by one, one flips to "Goes against README" | window | rows tint | 3 s | "drift report" |
| 44 | 875.5 to 887 | **Seams.** A grid of an app, a shaded column sweeps down it, dots trail in orange; counters per reviewer, the EGM one climbs fast to 11, the others to 3 and 4 | grid | column draws, dots land | 10 s | "went through the edge cases more deeply" |
| 45 | 887.4 to 897.5 | **Race.** Two lanes with clocks. The small fix finishes at 1:02, EGM crawls to 34:08 past "not worth it" | lanes, then each | runs at the same time; timer is the punch | 10 s | "isn't worth it for a small fix" |
| 46 | 898 to 900.2 | Wall of cards, each a workflow, one is EGM; then a plan with a magnifier | fan out | magnifier slides across 2 s, a "?" | 3 s | "there are a lot of others" |
| 47 | 912.2 to 915.4 | Table, a "Fresh reviewer" column lights, ticks in only a few rows, EGM's among them | table | column tints, row lights | 3 s | "only few others" |
| 48 | 915.6 to 925.2 | App grid, a scan line sweeps across, warnings land; then the grid dims except one card under a small check | grid | one pass, 2 s | 9 s | "over your whole app"; "one feature at a time" |
| 49 | 925.4 to 929 | **Scale.** Empty balance, "Longer" lands left and it tips, "EGM, Matters" lands right and it tips back | beam, then weights | tilt about 12 degrees, ease in and out | 4 s | "even though it takes longer ... worth using" |

On the screen recordings (288 to 378 s and later): a dim plus a white outlined box on the block he mentions, big zooms on the text being read, text selection used as a highlighter, and a blur over the first look at a terminal (40 to 45 s). None of that is new for us, and the outline conflicts with our rule (see below).

## Sound

- **Measured:** -18.0 LUFS, LRA 3.7. Quieter than the reels (about -14) and normal for a voice-over. Voice is very tight: only 7 gaps over 0.25 s in the whole transcript.
- **Measured:** the high band (7 kHz and up) is *lower* around a dip than in a random window (-42 dB against -35 dB). So there is no whoosh on scene changes. Graphics do not carry a sound.
- **Measured:** the level never stays under -45 dB for 0.25 s until the last second, and pauses sit around -33 dBFS, but Whisper's word times are stretched, so that pause figure is weak.
- **From spectrograms, about 70% reliable:** no risers and no clear ticks; a low steady band at about 150 Hz sits under the voice and may be a quiet bed or just room tone. I can't tell which from a spectrogram.

So: the animation does all the work, silently. It reads like a designed explainer, not an edit.

## What we can and cannot take

Take:

- **One sentence, one composition**, cut on the sentence start. Planned from the script.
- **State change as the story.** The picture barely moves; one thing changes state on the word (empty, filled, wrong, right).
- **Skeleton cards** as the shared kit: a file, a chat and an app are one card with a different header. Bars instead of text mean no fake words on screen, which fits "never invent UI".
- **Actors that come back.**
- **Re-layout**: a card slides over to make room rather than cutting.
- **A hold before a number moves**, and the colour flip after it lands.
- **Ghosted road**: all the steps visible but quiet, lit as reached (#28).
- **Near-black with big empty space**, and nothing moving that does not mean something.

Leave:

- Their six colours and their marks. We use one accent, on the thing that matters; everything else is ink and grey. Their elephant and goldfish are their property, so we use plain shapes.
- Their made-up numbers (72%, 51,384, 100,000, 34:08 are all illustration, nobody says them). Ours show a number only if it is said.
- Small text. Their 22 to 28 px is fine on a desktop and thin on a phone. Ours stay at 27 px or more on `side` and 43 px or more on `media`.
- Full-time graphics. They have no speaker; Owain does, and rules keep graphics to where he is on camera, so these become `side` and `media` moments, not a whole video.

## What we already had, and what is new

Read `effects/Wide.tsx`, `effects/Lab.tsx`, `effects/house.tsx`, `effects/frame.tsx`, `effects/custom/moves.tsx` and `effects/custom/egm*.tsx` against this list.

Already ours: the two speeds and the ease (they measure almost the same), `side` as a stage (their re-layout is the same move), `pipeline` and `map` (a dot on a wire), `hub`, `verifier`, `journey` and `phases` (the ghosted road), `timeline`, `stopwatch`, `odometer`, `lift`, the highlighter, `egm` (rings for goldfish, spawn and fold).

Not ours until now: one thing changing state in a still frame, a page as a shared object that several actors act on, the barrier as a picture, cause and effect row by row, a gauge that loses something, skeleton cards as a kit.

## Ranked: the moves worth taking

Best first, by how much meaning each carries per second, how often Owain's topics need it (agents, review, context, plans), and whether we had it.

| Rank | Move | Source | New or have | Status |
| --- | --- | --- | --- | --- |
| 1 | **One sentence, one composition.** Plan from the script's sentences, cut on the sentence start | measured | new as a method | in `docs/PLAYBOOK.md` |
| 2 | **Lens**: several readers of one page, each lighting the part it reads | #22 | new | built, `lens` |
| 3 | **Drift**: two sources, a tag walks the rows, one row marked | #40, #37, #24 | new (`verifier` is one list) | built, `drift` |
| 4 | **Wall**: a reader, its inputs, and what cannot reach it | #7, #21 | new | built, `wall` |
| 5 | **Drain**: a held number falls to nothing, then turns | #19 | new | built, `drain` |
| 6 | **Thread**: each row of a plan causes one part of the result | #10, #42 | new (`pipeline` has no cause and effect) | built, `thread` |
| 7 | **Surge**: load as a flood, a counter on an ease-in, a part gives | #25, #30 | new (`swarm` is a grid with no number) | built, `surge` |
| 8 | **Gaps**: holes filled one by one with a falling count | #13 | new for 16:9 (the reel's `egm-gaps` is line art) | built, `gaps` |
| 9 | **Scale**: a trade-off with a verdict | #49 | new | built, `scale` |
| 10 | **Re-layout**: a card slides over to make room | #18 | have the speed, not the habit | built into `wall`; the rule is in the playbook |
| 11 | Tree into funnel: agents spawn, reports ride a cone into one | #38, #39 | half have (`egm`, `map`) | next, if he likes the set |
| 12 | Sort into Keep and Ignore | #36 | new | next; needs real notes to sort |
| 13 | Wireframe build: lines trace a page, a bar in step, then it fills | #9 | new | left out, see below |

## Built

(Retired on 2026-11-14; see `docs/PLAYBOOK.md`.) Eight graphics in `effects/custom/stage.tsx`, in the library as `blueprint.t2.*`: filter the gallery with `#/gallery?q=custom`. In Ivory, Graphite and black, drawn for `side` and `media`. All of them pass `qc --library --canvas youtube`.

`projects/stage-demo` puts five on Owain's own footage and words from the `review` video (it links to that project's files and changes nothing in it). `surge` is on his real numbers, 2,500 to 30,000 changes a day, with Review giving way on "struggle to keep up". `drift` walks his risk tiers. See it at `#/gallery?tab=projects&q=stage`, or the stills in `projects/stage-demo/checks/stills/`.

In a real plan since 2026-11-06: `projects/review`, `drift` replacing the risk list at 20:17 and `lens` new at 26:06, both beside him (`side`).

Changed from the source on purpose: one accent, not six; our blur-in, not a plain fade, since Owain approved it in the motion lab; rings, not mascots; larger type; numbers only when said.

## Left out, and why

- **Wireframe build (#9).** It only says "a web page", and Owain's videos are rarely about web pages. Quick to add if a video needs it.
- **Tree into funnel (#38, #39) and sort (#36).** Good, but `map` and `egm` already spawn and fold, and sort needs real notes to be honest. Next batch.
- **Race (#45), versions (#29), ghosted road (#28), checklist (#15), halo (#30), dealt cards (#20, #41).** `stopwatch`, `timeline`, `journey`, `checklist`, `verifier` and `chips` cover them.
- **Seams grid (#44), wall of cards (#46), table (#47).** Each claims a measured result (bugs found, tools compared). Without real data they would be invented.
- **Bias tilt (#33).** A lovely joke, but it needs its own setup. Worth drawing per video.
- **The six colours and the mascots.** Off palette, and the marks are theirs.
- **Their sting (#1).** Owain has chapter cards and no logo sting.
- **White outlined box on screen recordings.** An annotation on a screen recording. `docs/PLAYBOOK.md` already lists this as Owain's call, so I did not build it.
- **Full-frame graphics for the whole video.** The source has no speaker. Rules keep ours to where he is on camera.
