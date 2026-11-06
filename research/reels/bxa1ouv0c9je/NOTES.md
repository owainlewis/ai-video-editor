# Reel bxa1ouv0c9je: notes

Source: `~/Desktop/reels/snapgram.io_bxa1ouv0c9je.mp4`. 720x1280, 29.97 fps, 52.5 s, AAC stereo 48 kHz.
Topic: Google's Harness² rewrites Claude's own skills (SKILL.md) and its grade goes from 72 to 100; then the same loop on an "ad-writer" skill. Ends on "comment AUTO".

All numbers below were measured on the frames and the audio, not guessed. Pixel values are on the 720x1280 frame.
Tools: ffmpeg, numpy, a box blur to beat the film grain. Scripts are not kept; the files in this folder are the evidence.

Files here:
- `layout-A-fade.png`, `layout-A-fade-endcard.png`: speaker full width, faded into black at the top.
- `layout-B-window.png`, `layout-B-window-ads.png`: speaker in a rounded window.
- `layout-C-graphic.png`, `layout-C-graphic-compare.png`: graphics only.
- `layout-D-fullframe.png`: speaker full frame, caption on the TV behind him.
- `layout-guides.jpg`: A, B, C, D side by side with guides. Magenta: x=360. Cyan: x=80 and 640 (card edges). Yellow: x=48 and 672 (window edges). Red: caption line. Orange: fade or window top.
- `motion-1` to `motion-8` (frames at native fps) and `motion-N.jpg` strips. Frame numbers are drawn on each cell.
- `transcript.txt`: words with times (whisper small.en).

## 1. The four layouts

Every layout shares one centre line, x=360. Cards, captions and the speaker window are all centred on it to the pixel (caption centres measured at 359.5 to 360.0 in every layout). There is no left-aligned block anywhere.

| Layout | Share of time | Speaker | Graphic zone | Caption baseline zone |
|---|---|---|---|---|
| A. Fade | 18.9 s (36%) | full width, footage pushed down ~220 px, top edge fades to black from y=650 to y=800 | y=0 to ~620 | cap top y=632, bottom y=650 |
| B. Window | 13.7 s (26%) | rounded window x=47 to 672, top y=940, runs off the bottom | y=0 to ~800 | cap top y=832, bottom y=850 |
| C. Graphic only | 18.2 s (35%) | none | y=0 to ~950 | cap top y=983, bottom y=1001 |
| D. Full frame | 1.9 s (4%) | full frame, as shot | none | cap top y=417, on the black TV on the wall |

No b-roll at all. Graphics are on screen 96% of the time. The speaker is on screen 65% of the time.

### A. Fade (`layout-A-fade.png`)
- The footage is the normal shot moved down about 220 px (the TV on the wall sits at y=320-570 in full frame, y=660-790 here) and scaled about 0.97.
- The top of the footage fades into the background. Measured luminance in a 90 px strip on the left wall: 16 at y=640, 19 at 656, 42 at 688, 77 at 720, 115 at 752, 144 at 784, 152 (the wall) at 800. So a 150 px soft fade, steepest in the middle.
- The trick: the black TV behind him sits right under the fade. The fade blends into the TV, so the seam between graphic zone and footage is invisible. The caption sits exactly on this seam (y=632-650).
- Cards: x=80 to 640 (560 wide, 80 px side margins), group between about y=180 and y=500.

### B. Window (`layout-B-window.png`)
- Window x=47 to 672 (625 wide, 47-48 px side margins). Top edge y=940. It has no bottom edge: it runs off the frame.
- Top corner radius about 22 px (left edge reaches x=47 at y=960, 20 px below the top).
- His head breaks out of the window: hair top at y=872, 68 px above the window top. So he is cut out (segmented) and laid over the window edge. This gives depth and keeps the window from feeling like a box.
- Caption 90 px above the window top (cap bottom y=850, window top y=940, head top y=872: the caption sits 22 px above his hair).
- Cards here vary from 508 to 560 px wide because the "camera" zooms the stage (see Motion).

### C. Graphic only (`layout-C-graphic.png`)
- Caption moves down to y=983-1001 (77% of the height).
- A single card sits near the optical centre: the task card in `motion-3` frame 0 spans y=500-686 (centre 593, frame centre 640).
- After zooms the group fills x=50 to 669 (620 wide, 50 px margins). That is the widest anything gets.

### D. Full frame (`layout-D-fullframe.png`)
- Used once, 29.86 to 31.73 s, on a punchy line.
- The caption is placed on the black TV screen behind him (cap y=417-435, TV spans y=320-570). Same font, same size. It reads like a sign in the room.

### Margins and safe area
- Widest text block: x=50 to 669. Usual card: x=80 to 640. Window: x=47 to 672. Nothing comes closer than 47 px to a side.
- Top: nothing above y=170 except during camera moves. Bottom: in layout C nothing below y=1001. Instagram's UI (caption, buttons) covers roughly the bottom 250 px and right 100 px; the graphics stay clear of that, the speaker footage does not need to.
- Grid: one centre line, three widths (560 card, 620 zoomed group, 625 window). Not a strict column grid. The discipline is the centre line, not the margins.

## 2. Colour (sampled)

Background: `#101013` (median `#0f0f11`), a near-black with a hint of blue. It carries a static film grain: per-pixel std 9.6 levels, range 0 to 65. The grain does not animate (consecutive frames are identical in the background) and it also sits on the cards.

| Role | Hex |
|---|---|
| Background | `#101013` + grain |
| Card fill | `#1f1f21` to `#222225` (task card dims to `#1a1a1b`) |
| Bar track | `#2f2f31` |
| Neutral card border | about 1 px, slightly lighter than fill, no colour |
| Primary text | `#fafafc` to `#ffffff` |
| Secondary text (/100, descriptions) | `#b2b2b4` to `#b8b8bb` |
| Tertiary text (source line, eyebrows) | `#828284` to `#99999b` |
| Caption | `#eaeaeb` (not pure white) |
| Orange (Claude) | text `#c67057`, logo `#d27359`, border `#6e534f`, underline `#825952` |
| Green (Harness, success) | bar `#2fc990`, title `#2dd6a6`, Keep and Sent `#37c59f`, dot `#05bb87`, border `#4b5253` tint |
| Amber (warning, "sounds like ChatGPT") | highlight fill `#694d23`, highlight text `#fff2c7`, pill text `#eecf88`, border `#6d5738` |

About 12 distinct colours in all, but only three hues: orange, green and amber, each with a strong value (text) and a weak value (border, fill). Everything else is grey.

What each accent means, used consistently:
- Orange means Claude: the Claude logo, the "Editing" tag, card borders while Claude is editing.
- Green means Harness and "good": the grade bar, the 100.0 that turns green on landing, Change B, Keep, Sent.
- Amber means "bad copy": the generic ad phrases highlighted, the "Sounds like ChatGPT" pill, "Not quite".
A card's border takes the accent of whoever owns it. You can tell who is acting from the border colour alone.

## 3. Type

Two families, plus one mono for file names.

| Level | Family | Measured height | Approx size | Case and weight |
|---|---|---|---|---|
| Hero number "72.0" | geometric grotesk (Satoshi or General Sans style) | digits 103 px | ~140 px | bold, tight |
| "/100" | same | 40 px | ~42 px | regular, grey |
| Repo name "Harness²" | same | cap 34 px | ~46 px | bold |
| Task title "Clean survey data," | same | 42 px with ascender and descender | ~44 px, 2 lines | bold |
| Card title "ad-writer", "Original" | same | 24-26 px ascender | ~32 px | bold |
| "AUTO" comment | same | cap 25 px | ~35 px | bold |
| Body line in a card | same | 16 px cap, 19-22 px with descender | ~21-23 px | regular to medium |
| Eyebrow "AD DRAFT 1", "RESULT" | same | cap 12-13 px | ~18 px | bold, uppercase, tracked, grey |
| Eyebrow "JOBBENCH · RESEARCH ASSISTANT" | same | cap 17 px | ~23 px | bold, uppercase, tracked, grey |
| File name "SKILL.md" | monospace | cap 17 px (title), 13 px (meta) | ~23 px / ~18 px | bold |
| Caption | pixel or bitmap mono (terminal style) | cap 19 px | ~26 px | uppercase, wide tracking: 17 px per character |

- Captions are always 1 line, 2 to 4 words, uppercase, 132 to 340 px wide. Example: "INSTRUCTIONS INSTEAD" is 20 characters over 341 px.
- Lines of text per screen are high: `layout-B-window-ads.png` has about 10 lines of card text, `layout-C-graphic-compare.png` about 15 small labels. It works because each item is short and the hierarchy is strict (white, light grey, dark grey).
- The caption font is the only "character" font. Everything inside the cards is plain product UI type.

## 4. Motion

The big idea: the graphics live on a stage with a virtual camera. Cards do not fly in from off screen. Items appear in place (a short fade, sometimes with blur), and the camera reframes to fit them. Old items blur and dim instead of leaving. Layout changes between speaker and graphics are hard cuts.

### Move 1: row added, group re-centres (3.94 s, `motion-1.jpg`)
- A "Grade" row appears under the SKILL.md card. Opacity 0 to 1 in 2-3 frames (67-100 ms). No slide of its own.
- The whole group then slides up 29 px (top y=212 to 183) over 16 frames (530 ms). Speed per frame: 2,2,2,3,4,3,3,2,2,1,2,1,0,1: a gentle ease in and out, no overshoot.
- The green bar fills left to right starting 9 frames after the row appears, over about 9-10 frames (300-330 ms).
- Word: the row appears at 3.94 s on "and these" (3.90-4.06); "results" is said at 4.44 and the caption "THE RESULTS." lands at 4.37. So the graphic leads the key word by about 0.4 s and the caption sits on it.

### Move 2: typing plus camera reframe (6.6 s, `motion-2.jpg`)
- Text types into the AGENT.md card at about 0.7 characters per frame (about 22 characters a second), with a caret.
- The old line is struck through in grey (`#7f7b75`) before the new one is typed.
- An "Edited by Claude Opus 5 / You" row fades in with blur over 2-3 frames.
- At the same time the camera zooms from 515 to 551 px wide (scale 1.07) and pans up 71 px, over about 20 frames (670 ms), ease in and out.
- The camera holds still the rest of the time. Measured card width over the shot: 511 px from 5.2 to 6.4 s, moves 6.6 to 7.2 s, 551 px from 7.2 to 8.4 s.

### Move 3: camera push to the new card (10.6 s, `motion-3.jpg`)
- The 72.0 grade card arrives under the task card; the camera pushes in and up to frame both.
- Group width 509 to 619 px (scale 1.22). Top edge y=495 to 171. Centre x stays at 359.5 the whole way.
- 31 frames, 1030 ms. Progress: 10% at frame 9, 50% at frame 14-15, 90% at frame 22, 100% at frame 30. Ease in and out with a long soft landing, no overshoot.
- The old task card dims as attention moves: its title is `#ffffff` at 9.0 s, `#b5b5b7` (70%) at 11.5 s, `#69696b` (41%) at 14.0 s.
- The source line "Harness² paper · Figure 19 · Claude Opus 5" fades in under the card during the move.

### Move 4: number count (12.15 s, `motion-4.jpg`)
- 72.0 counts to 100.0 over about 39 frames (1.3 s). Values per frame: 72.0, 72.2, 72.5, 72.9, 73.5, 74.3, 75.3, 76.5, 78.0, 79.7, 81.6, 83.6, 85.5 ... 99.8, 99.9, 100.0.
- Step size climbs to 2.0 per frame at frame 11 then falls slowly: short ease in (a third), long ease out (two thirds).
- The bar fills in step with the number.
- On landing the number turns from white to green over about 3 frames, then the camera pushes in a little.
- Word: the count starts at 12.21 s on "72" (said at 12.28) and lands at 13.21 s on "100" (said at 13.26). Both ends hit the word within about 70 ms. A riser SFX swells for 1.07 s and peaks at 13.21 s, the landing.

### Move 5: focus pull to the winner (34.9 s, `motion-5.jpg`)
- The A/B grid (Original, Change A, Change B) with results under each. "Keep" fades in under Change B over 3 frames.
- Then the camera pans left about 160 px so Change B lands centred on x=360 (green accent bounds x=430-610 before, about 272-450 after). Scale stays near 1.0.
- Original and Change A blur heavily and dim as they slide out. About 17 frames (570 ms).
- Word: lands on "and chooses"; caption becomes "WHAT TO KEEP." when the move settles.

### Move 6: card swap with cascade (17.5 s, `motion-6.jpg`)
- The repo card blurs (about 8-12 px) and fades while drifting up and out of the top. It does not slide sideways.
- The "Claude Opus 5" card moves up into the top slot.
- A grid of 8 setup items (System prompt, Guardrails, Memory, Tool guidance, Subagents, Skills, Scripts, Plugin) cascades in reading order, left then right, row by row, about 2 frames (67 ms) apart. Each item fades in from blurred over about 4 frames.
- Then green ticks and a counter "0 / 8 edited" to "4 / 8 edited" tick through.

### Move 7: small card in (15.9 s, `motion-7.jpg`)
- "Claude Opus 5" card appears under the repo card: faint and blurred on frame 2, full by frame 4, with a small upward settle. The group drifts up about 15 px over 20 frames.

### Move 8: focus rail (25.3 s, `motion-8.jpg`)
- The next card waits below the current one, blurred and dim. On the beat, the camera pans up 219 px (top card y=484 to 265) over about 18 frames (600 ms).
- Speed per frame peaks at 25-34 px in frames 3 to 7, then a long tail of 1-6 px: an ease out (fast start, slow end).
- The top card blurs and dims to about 40% brightness; the lower card goes from blurred to sharp.
- This is the same idea as move 5 and move 3: one item in focus, the rest out of focus.

### Rules drawn from the moves
- Two speeds: quick appear (2-4 frames, 67-130 ms) and camera move (16-31 frames, 530-1030 ms). Nothing in between.
- Easing: ease in and out for camera pushes, ease out for pans. Never an overshoot or bounce.
- Blur is the transition. In and out of focus, not in and out of frame.
- Centre x=360 is fixed through every move. The camera pans vertically far more than sideways; the one sideways pan exists to bring the chosen item back to x=360.
- Sync to words (from `transcript.txt`):
  - Every hard cut lands 0.03 to 0.2 s before the first word of a new sentence: 5.00 before "Claude rewrote" (5.22), 8.48 before "On a job" (8.50), 14.41 before "They used" (14.44), 21.22 before "Think" (21.34), 23.99 before "If the work" (24.02), 27.59 before "That's" (27.60), 31.73 before "it tries" (31.82), 35.80 before "Say" (35.98), 39.17 before "You can" (39.26), 42.94 before "Next month" (43.00), 47.51 before "If you" (47.56). One exception: 29.86, 0.16 s after "And it doesn't". So shots follow sentences: one sentence, one shot, roughly.
  - Graphic beats lead their key word by 0 to 0.4 s: grade row 0.4 s before "results", grid builds on "changed" (18.36), focus pull on "chooses" (34.82), "Sounds like ChatGPT" pill about 0.1-0.5 s before "sound like chat GPT" (38.02), "AUTO" typed on "auto" (49.22).
  - The count is the one move timed to two words: start on "72", land on "100".
  - Captions sit on the word, give or take 0.2 s. Graphics never wait for the caption.
- Layout changes (A, B, C, D) are hard cuts with a whoosh. 12 cuts in 52.5 s. Jump cuts in the speaker footage (for example 3.10 s, a punch out to a wider take) happen under an unchanged graphic, so the graphic hides the cut.

## 5. Pacing

- Hard cuts (layout changes): 12, at 5.00, 8.48, 14.41, 21.22, 23.99, 27.59, 29.86, 31.73, 35.80, 39.17, 42.94, 47.51 s. Shots last 1.9 to 6.8 s, mean 4.0 s.
- Caption swaps: about 80. Each caption holds 0.27 to 1.43 s, median about 0.6 s.
- Graphic events (reveals, camera moves, counts, focus pulls, typing starts): about 30 that are big enough to measure, plus continuous typing and cursor moves.
- Something changes on screen at least every 0.6 s on average (the caption), and the graphic itself changes about every 1.5 s. The longest stretch with no caption change is 1.43 s; the longest with no graphic change is about 2 s.
- Time share: speaker in a fade 36%, speaker in a window 26%, graphics only 35%, speaker full frame 4%, b-roll 0%.
- Rhythm of layouts: A, B, C, B, A, C, A, D, C, B, A, C, A. It never repeats the same layout twice in a row and never stays in one more than 6.8 s.

## 6. Sound

- Loudness: -14.1 LUFS integrated, loudness range 1.9 LU. Very flat, heavily compressed.
- Voice is mono. The sound effects are stereo, so the side channel (L minus R) contains almost only SFX. Side level: median -56 dBFS, peaks -27 to -29 dBFS. Every side peak lines up with a visual event.
- Voice level near each SFX: -16 to -19 dBFS RMS. So the main SFX sit about 10 dB under the voice (measured on the side channel only, so the real level may be a little higher).

Kinds of SFX found:
1. Soft whoosh on every camera move and every layout cut: 200-370 ms long, swells for 85-140 ms then falls, energy mostly 95-180 Hz (a low, soft swoosh, not a bright one), peak about -28.5 dBFS side. At 2.93, 6.86, 11.05, 16.43, 17.99, 25.44, 26.88, 28.96, 34.95, 37.95, 40.28, 42.09, 44.12, 46.75, 50.34, 50.70 s. 16 in all.
2. Typing ticks during every typing animation: 20-35 ms clicks every 100 ms exactly (a loop, not one per letter), centroid about 800 Hz, about -35 dBFS side, so about 17 dB under the voice. At 1.4-3.1, 5.3-6.7, 7.1-8.2, 26.6-27.3, 49.3-49.4 s.
3. Low pop or thump when a pill or tag lands: 85-90 ms, 95-145 Hz, about -27.5 dBFS side. At 21.86, 27.93, 49.52 s.
4. Riser: 12.22-13.29 s, 1.07 s long, rising to a peak at 13.21 s exactly when the count hits 100. Brighter (centroid 4.7 kHz).
5. Riser into a cut: 4.36-5.07 s, 710 ms, building to the 5.00 s cut.
6. Tiny high ticks (9-13 kHz, 15-30 ms) for small UI moments (28.42, 41.88 s), probably a click or a send.

Music: no clear music. The mix never drops below -40 dBFS until the last 50 ms, and in pauses there is a steady bed around -30 dBFS (about 12 dB under the voice median of -18.6 dBFS), mostly below 300 Hz. I found no beat in it (autocorrelation peaks under 0.1). It is either a very soft pad or processed room tone. Confidence: medium. Ears would settle it.

## 7. What makes it work

- One centre line. Every card, caption and the window sit on x=360. The eye never hunts for where to look.
- One thing in focus at a time. Older cards dim to 70% then 40%, or blur. The active card is the only fully white, fully sharp thing on screen.
- The camera does the work. Items appear in place with a 2-4 frame fade, and a slow (530-1030 ms) eased reframe makes room for them. This is calmer than cards flying in, and it reads as one continuous space.
- Product-real props. Every graphic is a believable UI object: a file card that types, a repo card, a grade card with a source line ("Harness² paper · Figure 19"), a comment box. The video's own nouns, shown as things.
- Colour has meaning. Orange is Claude, green is Harness and success, amber is bad copy. Three hues only, each in a strong and a weak value.
- The seams are hidden. The fade lands on the black TV; the caption sits on the seam; his head breaks out of the window; the full-frame caption sits on the TV. Layout parts feel placed in his room, not stacked on top of it.
- Sound tracks motion one to one: a soft low whoosh for every camera move, ticks for typing, a riser into the one big number. All about 10 dB under the voice, low pitched, never bright.
- The caption is a texture, not a subtitle: 2-4 words, pixel mono, one line, small (cap 19 px). It keeps rhythm without competing with the cards.

## 8. What is weak

- Card widths drift. Because the camera scales the stage, cards are 508, 551, 560 or 620 px wide depending on the moment. Across cuts the left edge jumps between x=50, 80 and 106. Only the centre line holds.
- The caption jumps between four heights (y=417, 632, 832, 983) as the layout changes. Each spot is logical, but the eye has to find it again at every cut.
- Small text. Eyebrows at cap 12-13 px and meta lines at 13 px (for example "SKILL.md v3") are too small to read on a phone at speed. Some cards hold 10 to 15 labels.
- The A/B compare (`layout-C-graphic-compare.png`) is off centre before the focus pull: x=28 to 610, centre 319. It is waiting for the pan, but as a still it looks misaligned.
- The fade layout covers his upper body area with nothing at the top of the footage: the useful picture starts at y=650. Half the screen is spent on cards that are sometimes one line long.
- Grain and dimming make the low end muddy. Dimmed cards at `#69696b` text on `#1a1a1b` are close to the grain level.
- Captions are near the bottom UI zone in layout C (y=983-1001), close to where Instagram puts its caption text.

## 9. Ideas for a reel with no speaker

These carry over directly:
- The stage and camera. Graphics only was already 35% of this reel and it held up. A no-speaker reel can be one continuous stage where the camera pushes, pans and pulls focus on the beat. That alone gives motion every 1-2 s without cutting.
- The focus rail. A vertical stack of cards where only the active one is sharp and white; the camera pans 200-ish px to the next on each point (600 ms, ease out). The previous card blurs and dims to 40%. This replaces the speaker as the "anchor".
- Props that act. Typing with a caret, a strike-through then rewrite, a cursor moving to a line, a counter ticking "0 / 8 edited", a number counting with a riser and a colour flip on landing. These carry the story the speaker would carry.
- The caption as rhythm. One line, 2-4 words, swapping about every 0.6 s, fixed on one line (use one fixed height in a no-speaker reel, since there is no layout change to justify moving it).
- Colour roles. Give each actor one hue (the tool, the result, the problem) and use it on borders and tags.
- Sound per move: soft low whoosh on camera moves, ticks on typing, one riser for the hero number, all about 10 dB under the voice.
- Hard cuts between "rooms" (different stage set-ups) every 3-7 s, with a whoosh, to reset attention.

What does not carry over: the window and fade layouts, the head breaking out of the window, and the caption on the TV. Those depend on the footage.
