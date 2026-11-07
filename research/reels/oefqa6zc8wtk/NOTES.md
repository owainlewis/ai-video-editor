# Reel oefqa6zc8wtk: "2 algorithms" talking head with split graphics

720x1280, 23.976 fps, 97.5 s, 2337 frames. Talking head in a dark room. All numbers below are measured on the 720x1280 frame unless marked "approx".

Files in this folder:

- `layout-split-annotated.png`, `layout-split-annotated-2.png`: the split layout with measured boxes drawn on.
- `layout-*.png`: one full-resolution still per layout (split light, split dark, full speaker, graphic only dark and light, CTA).
- `motion-1.jpg` .. `motion-6.jpg`: every frame across six moves (frames in `motion-N/`).
- `transcript.txt`: segments and every word with its time.
- `s_*.png`: full-resolution stills at the time in the name.

## 1. Transcript

See `transcript.txt` (mlx_whisper large-v3-turbo, word times). 371 words in 97.5 s: 3.8 words a second. The longest gap between words is 0.30 s (at 42.4 s): the delivery is jump-cut tight, wall to wall. Summary of the argument: Instagram has two algorithms, one for "connected" viewers (followers) and one for "unconnected" viewers (non-followers). Three metrics decide reach: watch time, likes per view, sends per view. Pick a priority: depth with existing followers (watch time, likes) or new followers (watch time, sends). Sends need "multiplayer" content: contrarian, surprising, shareable. CTA: comment "Hooks" for a database of 60 hook formats.

## 2. Layout

Four layouts. The reel never uses more than these.

| Layout | Time | Share |
|---|---|---|
| Split: graphic on top, speaker window at bottom | 55.9 s in 8 blocks | 57% |
| Full-frame speaker with one-word caption | 30.6 s in 8 blocks | 31% |
| Graphic only (phone mock-up, no speaker) | 10.9 s in 2 blocks | 11% |
| CTA (full speaker, two-line caption with serif word) | last 1.5 s | (inside full) |

### Split (the main layout)

Measured on `layout-split-light.png` (37 s), `layout-split-light-diagram.png` (11 s), `layout-split-dark.png` (25 s). The window is pixel-identical in every split shot.

- **Speaker window**: x 47 to 675 (629 px wide), top edge y 937, runs off the bottom of the frame (bottom corners only just show, so the box ends about 12 px below the frame). Left margin 47, right margin 44. Corner radius about 30 px. No border, no shadow. It holds about 343 px of visible height, so 27% of the frame.
- **Head break-out**: the speaker is cut out and his head and cap rise above the window top by about 75 px (to y about 862). The window is a frame he leans out of. This happens in every split shot.
- **Caption**: one word (sometimes two), centred on x 359 to 360, sitting just above his head. Split caption ink y 818 to 852 (x-height 20 px, so about 36 px type). Black #000000 on light stages, white #FFFFFF on black stages. No box, no stroke, no shadow.
- **Stage**: everything above y 800. Headline block plus the graphic sit inside it, centred on x 360 (measured centres 354 to 361).
- **Headline**: top of line 1 floats between y 72 and y 181 depending on how tall the graphic is. It is not pinned to one baseline. Line 1 is a small black (or white on black) line; line 2 is the big phrase on a red block.
  - red block examples: "Algorithms" 306x60 at y 124; "Viral Videos" 410x70 at y 152; "Choose Your Priority" 528x69 at y 181; "Short-Form Hook Formats" 472x44 at y 108.
  - gap from line 1 to red block: about 8 to 10 px. Gap from red block to graphic: about 15 to 55 px.
- **Graphic width**: varies by graphic, all centred.
  - network card: x 92 to 627 (536 wide), y 198 to 764.
  - two cards: x 76 to 338 and 384 to 646 (262 wide each, 46 gap, 570 total), y 303 to 550.
  - connected/unconnected boxes: x 69 to 344 and 378 to 652 (583 total).
  - document screenshot: x 82 to 638 (556 wide), y 162 to 801.
  - tree and pills: x 165 to 548 (pills 362 wide).
- **Vertical rhythm** (split): 0 to about 90 empty, headline about 90 to 250, graphic about 200 to 770, caption 818 to 852, head 862 to 937, window 937 to 1280.

Grid and centre line: everything shares one centre line (x 360, within 2 px for window, headline, caption, cards, phone). It does not share one column. Window margin is 47, card margin 76, pill margin 165, headline margin 96. The visual column is "centred, not aligned left/right". The only fixed things are the window box, the caption line and the centre line. The headline and graphic float vertically, so the split between graphic and speaker is not a hard line: the graphic area is everything above the caption.

Weak spot: when the graphic is short (two cards at 37 s end at y 550) there is a 268 px empty band down to the caption. The stage looks top-heavy there.

### Full-frame speaker

`layout-full.png`. Plain camera, no graphics. Caption is one word, white #FFFFFF, centred on x 359, ink y 829 to 866 (x-height 28, ascender 39, so about 52 px type). It sits on his chest. Caption is 1.4x bigger than in the split.

### Graphic only

`layout-graphic-dark.png` (54.5 s), `layout-graphic-light.png` (67 s). A phone mock-up playing his own past reel, no speaker window.

- Phone at rest: 445 px wide (x 137 to 581, centred at 359), top y 259. Bezel #111519.
- The camera then pushes in so the phone fills and overflows the frame (see motion 3).
- A big glowing caption word sits under the phone: "existing" is 453 px wide, x-height 71 (about 130 px type), white with a soft white outer glow.
- On light: headline "It's usually / Contrarian" above a 360 px wide phone (x 180 to 540).

### CTA

`layout-full-cta.png`. Full speaker. "comment" in the sans (x-height 25, about 46 px) over "Hooks" in a serif italic with curly quotes (cap 67 px, about 95 px type), centred, y 776 to 887. The only serif in the reel.

## 3. Colour

Sampled pixels, not guessed.

| Role | Hex |
|---|---|
| Light stage | #DFDFDD to #E1E1DF (warm light grey) with a faint graph-paper grid (lines about 8 px darker, #D8D8D3) and a fine dot texture |
| Black stage | #000000 |
| Light card fill | #DBDBDB to #DEDEDE (almost the stage colour) |
| Light card edge | 1 px highlight #F3F5F9 on top of a soft shadow #D1D1D3 below: a "glass" card |
| Red highlight block | #BB0000 (all four headlines) |
| Red underline under card titles | #A9060A |
| Headline and caption text | #000000 or #FFFFFF, pure |
| Card label grey | #7A7A7A (person icon), #CBCDD1 (label "Followers") |
| Network card | #000000 fill, 6 px bezel #4A4653 with a light inner rim |
| Network dots | red #BB0001, green #06BC60 |
| Green "Connected" box | vertical gradient #004521 at top to #000D08 at bottom |
| Red "Un-connected" box | #9B0000 at top to #0B0000 at bottom |
| Dark stat card | #600000 at top to #0F0102 at bottom |
| Red icon tiles | black at top-left to #7D0000 at bottom-right |
| Dark pills | #2D2D2D to #3D3B3C with a lighter top edge |
| Red pills | #220000 at left to #810000 at right |
| Like-count tag | #BC1E1E behind white numbers |

Count: two stages (light grey, black), black and white text, one accent red (#BB0000) and its dark gradients, plus green used only for "Connected". About six colours in total. Red means "the key phrase" (headline block, underlines), "un-connected / non-followers", and "the metric that went up" (the like or send count gets a red tag when it is the one being discussed). Green appears only in the first diagram as the opposite of red.

The stage flips between light and black about every section: light (0 to 1 s), black (1 to 5), light (8.5 to 17), black (22 to 31), light (34 to 49), black (51 to 66), light (66 to 76), light (86 to 94). The flip itself is the section marker.

## 4. Type

- Category: a tight neo-grotesk (Helvetica Now Display / Inter Display class) in Bold to Black, with negative tracking (letters nearly touching in "Choose Your Priority", about -3% to -4%). Card labels in the same family at Regular. One serif italic (didone style) only in the CTA.
- Case: Title Case for headlines and card titles ("Choose Your Priority", "Depth With Existing Followers"). Lower case for captions.

| Level | Measured | Approx size |
|---|---|---|
| Headline line 2 (white on red) | cap height 39 to 48 px | 54 to 67 px |
| Headline line 1 (black) | cap height 23 to 24 px | 33 px |
| Hero glow word (graphic only) | x-height 71 px | 130 px |
| Full-frame caption | x-height 28, ascender 39 | 52 px |
| Split caption | x-height 20 | 36 px |
| Pill label ("Connected", "Watch Time") | cap 23 to 24 px | 32 px |
| Big number ("381K") | cap 27 px | 38 px |
| Card title ("Depth With") | cap 14 px | 20 px |
| Card label ("Comments") | cap 11 px | 15 px |
| CTA serif "Hooks" | cap 67 px | 95 px |

Lines per screen: headline is always two lines (small line plus red block) or one red block. Captions are one line, almost always one word. Cards hold a two-line title and two to four one-word labels. Most screens carry 6 to 12 words in total including the caption.

The small type (15 to 20 px card labels) is too small for a phone; it reads as texture, not text.

## 5. Motion

Six moves measured frame by frame. One frame = 41.7 ms.

### Motion 1: headline builds word by word, red block wipes, card rises, stage flips (0.0 to 1.4 s) `motion-1.jpg`

- Card rise: the "CEO of Instagram" video card moves up from top y 510 to y 276 (234 px) between frames 2 and 18 (667 ms). Steps per frame: 49, 35, 40, 21, 18, 14, 12, 10, 9, 7, 6, 4, 4, 3, 1, 1. Strong ease-out (cubic or expo), 90% of travel in the first 9 frames (375 ms), no overshoot. Slight scale up (332 to 356 px wide, 1.07x) at the start.
- Headline words fade in one at a time, on the spoken word: "The" at frame 3, "CEO" at frame 4, "of" at frame 10, "Instagram" at frame 12. Each word goes from grey to full black in 3 to 4 frames (125 to 170 ms). No movement, opacity only.
- Red block wipe behind "Instagram": left edge fixed at x 137, right edge per frame 345, 451, 501, 529, 547, 561, 571, 575, 579, 581 (about 583 final, 446 px wide). 47% of the width lands in the first frame, 90% in 4 frames (167 ms), settled in 10 frames (417 ms). Expo ease-out, no overshoot. The white word is drawn first and the block slides in behind it.
- Exit and stage flip: at frame 22 (0.92 s) the headline vanishes in one frame (hard cut out). The stage colour then crossfades from grey 222 to black over 9 frames: 212, 195, 174, 145, 109, 69, 30, 6, 0 (375 ms, S-curve, fastest in the middle). During the fade the video card shrinks to a 110 px thumbnail at top-left and a dark stat card rises in under it. The stat card's "Accounts reached" number counts up linearly (+1792 per frame).

### Motion 2: network diagram builds after a hard cut (8.40 to 9.57 s) `motion-2.jpg`

- The split stage and headline arrive by hard cut at 8.467 s, complete. The diagram inside builds from frame 1 after the cut.
- Avatar ring diameter per frame: 7, 20, 64, 81, 86, 90, 92, 95, 98, 100, 101, 102, 104, 104, 106, 106, 107, 108 px. 60% of the size in 3 frames, settled in about 18 frames (750 ms). Ease-out, no overshoot.
- Green ring dots fill around the avatar like a progress ring over 10 frames (420 ms). Green pixel count overshoots (2888 at frame 13) and settles to about 2400: the dots pop slightly larger and shrink back (about 20% overshoot).
- Red dots fade and scale in staggered across 19 frames (790 ms).
- Later (11.4 s, on "connected") the ring glows green and a "Connected" pill tag snaps on; at 14.3 s (on "unconnected") the glow turns red and an "Un-connected" tag appears. Each of these is 1 to 3 frames: near-instant.

### Motion 3: phone mock-up push-in (51.13 to 53.64 s) `motion-3.jpg`

- Hard cut at 51.134 to black with the phone low in frame (top y 439, 445 px wide).
- Phase 1 (frames 2 to 12, 420 ms): the phone slides up 180 px at constant size. Steps 13, 34, 31, 23, 20, 15, 13, 11, 11, 9: ease-out.
- Phase 2 (frames 12 to 40, 1.17 s): a camera push toward the like button. The phone grows past the frame (width 447 to more than 542 and clipped), and its centre drifts left (359 to 242). Speed builds then falls off: steps in width 2, 2, 2, 5, 6, 7, 11, 15, 22 (peak at frame 22, 52.0 s), then decelerates to 0 by frame 40. One smooth ease-in-out over about 1.6 s total, no overshoot.
- Phase 3 (frames 40 to 58): slow drift up (phone bottom 1014 to 760) to make room for the big glowing caption "resonates" under it.
- The like count on the mock-up counts up the whole time (88K to 171K, about 2K per frame) and gets a red #BC1E1E tag.
- Same move again at 59.98 s (motion 4, `motion-4.jpg`): phone enters small and centred, grows and slides left over about 12 frames, then holds while red pills slide in beside it.

### Motion 5: card content builds with a stagger (33.90 to 35.07 s) `motion-5.jpg`

- Hard cut to the split at 33.95 s with the headline "Choose Your Priority" already complete and an empty glass card.
- Card title builds one word per frame: "Depth With" frame 1, "Existing" frame 2, "Followers" frames 3 to 4. Red underline appears with "Existing" at frame 2.
- Icons fade in by row: row 1 (Comments, Saves) from frame 5 to 11, row 2 (Watchtime, DM Count) from frame 9 to 15. Opacity is a straight linear ramp (grey value 217, 181, 143, 111, 83, 49, 17, 0: steps of 33 to 36). Each fade 7 frames (290 ms). Row stagger 4 frames (167 ms). Items in a row move together.
- The second card ("Getting New Followers") appears 1.6 s later on the word "getting". Its follower count then counts up continuously from 304K to 584K for 4 s (to 40 s).

### Motion 6: pill slides in, line draws, label decodes from pixels (42.55 to 43.13 s) `motion-6.jpg`

- A connector line draws left to right in 4 frames (167 ms) from the card above.
- The "Watch Time" pill appears at full opacity 37 px below its final spot and rises: top y 639, 637, 627, 613, 610, 606, 604, 602 (8 frames, 330 ms, ease-out, no overshoot).
- Its label is pixelated (mosaic blocks) for 5 frames (208 ms), then snaps to sharp text in one frame on the spoken word "watch time". No blur ramp: a hard switch from mosaic to text.
- As each new pill is added the whole stack eases up to stay centred (pill 1 top moves from 602 at 43 s to 552 at 44 s).
- The same mosaic-then-sharp reveal is used for every metric name (23.9 s, 26.8 s, 42.7 s, 44.9 s, 47.6 s). Labels sit pixelated until they are said.

### Motion rules that hold across the reel

- Layout changes (split to full, full to split, light to dark) are hard cuts. 17 of 18 are one-frame cuts. The only soft one is the 375 ms stage colour crossfade at 0.92 s.
- Entrances inside a graphic: ease-out, 250 to 420 ms, no overshoot, except the network dots (small pop).
- Items: rise 30 to 40 px plus fade, or scale from near zero, or wipe. Never slide in from off-screen sideways.
- Opacity fades for icons are linear; position moves are eased.
- Stagger: 1 frame (42 ms) between title words, 4 frames (167 ms) between rows, one item per spoken word for lists.
- Exits: almost none. Graphics leave by hard cut to the speaker, at a sentence end. Inside a graphic, old items are replaced or pushed up, not animated out.
- Counters run all the time (accounts reached, followers, likes): there is always something ticking.
- Timing to speech (checked against the word times):
  - Layout cuts land on the first word of a sentence. 15 of 17 cuts are within 3 frames of a sentence start: 17.31 ("These are" 17.26), 22.40 (22.38), 31.57 (31.58), 40.37 (40.36), 48.84 (48.84), 51.13 (51.14), 59.98 (60.02), 66.19 (66.16), 71.57 (71.60), 76.03 (76.04), 85.84 (85.84), 93.76 (93.76).
  - Headlines arrive complete at the cut, so they show the whole sentence while its first words are said ("There Are 2 Different Algorithms" lands on "there" at 8.47; "algorithms" is said at 9.5).
  - Items land on their own word, 0 to 5 frames after the word starts, never before: red wipe starts at 0.501 s, "Instagram" is said at 0.50; "Watch Time" pill at 42.72, word at 42.70; second card at 35.6 on "getting" (35.66); "Contrarian" block 4 frames after the word (66.70).
  - Mosaic labels snap sharp during their phrase ("Watch Time" sharp 5 frames after "watch"; "Likes Per View" sharp on "per view", about 0.6 s after "likes").
  - Diagram state changes start on the clause, not the label word: the green "Connected" glow comes at 11.4 s on "one for the people that already follow you"; the word "connected" is said at 13.04.

## 6. Pacing

- Layout blocks: 18 (17 hard cuts plus the stage flip). One layout change every 5.4 s on average.
  - split blocks: 5.0, 8.8, 9.2, 6.4, 7.9, 6.2, 4.5, 7.9 s (mean 7.0 s).
  - full speaker blocks: 3.5, 5.1, 2.4, 0.6, 2.3, 3.3, 9.8, 3.7 s (mean 3.8 s).
  - graphic only: 5.5, 5.4 s.
- Graphic reveals inside graphic blocks: about 70 counted by eye at 4 fps (words, items, tags, pills, decodes, stickers, swaps) across 66.8 s of graphic time: one new thing every 0.95 s.
- Captions: one word per change (a few two-word pairs). 371 words, so about 350 caption swaps: 3.6 a second, one every 0.27 s. The caption is the metronome of the reel.
- Cuts plus reveals (not counting captions): about 88 changes in 97.5 s, one every 1.1 s.
- Longest stretch with no graphic or cut: 9.8 s of full-frame speaker (76.0 to 85.8 s), only captions change. Next longest: the document screenshot (85.8 to 93.8 s), one slow pan for 7.9 s.
- Rhythm: speaker full frame to set up a point (2 to 5 s), split to explain it (5 to 9 s), back to speaker.

## 7. Sound

- Loudness: -14.4 LUFS integrated, loudness range 3.5 LU (heavily levelled voice). Voice RMS median -20.5 dBFS.
- Music: no clear melodic bed in the mids. There is a sub-bass layer (26 to 58 Hz) that is not the voice (correlation with the voice envelope 0.13). It is present in some sections and silent in others (absent 4 to 8 s, 56 to 71 s, 74 to 85 s). Typical level -36 to -45 dB in that band, so about 15 to 25 dB under the voice.
- That sub layer often kicks in on a graphic entry: at 8.467 s it jumps from -75 to -33 dB within 100 ms of the cut; at 33.95 s from -57 to -34; at 85.84 s from -64 to -37; at 22.40 s it swells to -17. It tends to drop when the cut goes back to the speaker (17.31, 31.57). Reading: a low boom or drone under each graphic section, felt more than heard. Confidence medium: it could also be a bass-heavy music track that is ducked in and out.
- One loud low swell at 88 to 89 s (up to -10 dB under 60 Hz), during the document pan.
- No clear whooshes, clicks or pops at cuts: high-frequency peaks near cuts all line up with speech sibilants. If there are UI clicks they sit under the voice. Confidence medium.

Measured again 2026-11-07, with the voice split from the backing (demucs): voice -14.6 LUFS, backing -30.8 LUFS, so 16 LU apart. The backing's low notes repeat every 3.69 s from 33 s to 55 s, so it is a music track, mostly sub-bass, and not separate booms. Some notes land on graphic cuts (8.4, 22.5, 85.9 s), which may be luck.

## 8. What makes it work, and what is weak

Works:

1. **One fixed frame for the speaker.** The window is the same 629 px box at y 937 in every split, with the head breaking out 75 px above it. The eye never re-finds him. The break-out keeps him "in the room" with the graphic instead of boxed below it.
2. **One accent with one job.** #BB0000 marks the phrase to remember (the red block) and the "bad / non-follower / the number that moved" side. Everything else is black, white or grey.
3. **Two stages that alternate.** Light grey #E0E0DF and pure black swap each section, so a new section is visible before any word is read.
4. **The headline wipe.** Small line plus one phrase on a red block that wipes on in 167 ms. It is the strongest repeated brand element.
5. **Things land on words.** Metric labels sit as mosaic until they are said, then snap sharp. Card words, pills and tags each appear on their own spoken word. Every reveal answers what he just said.
6. **Constant small motion.** A new graphic thing about every second, counters always ticking, captions changing per word. There is no dead frame inside a split.
7. **Proof as picture.** Phone mock-ups of his real reels with the like or send count ticking up and tagged red: the claim and the evidence on one screen.
8. **Hard cuts between layouts, eased moves inside.** Layout changes never animate; only content does. That keeps it crisp.

Weak:

1. **No vertical grid in the stage.** Headline top floats from y 72 to 181, graphic bottom from 550 to 801. Short graphics leave a 268 px empty band above the caption.
2. **No shared column.** Margins are 47 (window), 69 to 96 (headline, cards), 165 (pills). Only the centre line is shared.
3. **Tiny labels.** Card labels at about 15 px and card titles at about 20 px are unreadable on a phone.
4. **Gradient and glow overload on black.** Glossy pills, gradient cards, glows and a 6 px device bezel compete. The light-stage graphics are cleaner.
5. **Two caption sizes** (36 px in split, 52 px full frame) and a third 130 px glow word. The caption jumps size at each cut.
6. **The document screenshot** (86 to 94 s) is a blurry slow pan with nothing to read: the weakest 8 seconds.
7. **Headline preview before speech** sometimes gives the line away before he says it.

## 9. Ideas for a reel with no speaker on camera

- **The fixed frame survives without a face.** Keep a fixed bottom box (x 47 to 675, y 937 to bottom, radius 30) and fill it with b-roll or a screen recording instead of the speaker. The top stage carries the argument, the box carries the "proof" footage. Same eye path.
- **Headline plus red block wipe** works on its own: one small line, one phrase on the accent block, 167 ms expo wipe. It is the anchor of each section.
- **Stage flip as chapter marker**: alternate light grey and black per section, with a 375 ms crossfade or a hard cut.
- **Words that decode on the voice**: show list items as mosaic placeholders and snap each one sharp on its word. It needs only the transcript, not a face.
- **Phone mock-up push-in**: a past post or a screen recording inside a phone, then a 1.6 s ease-in-out camera push to the one number that matters, with the number counting up and tagged in the accent. This is the strongest no-face move in the reel.
- **Running counters** give constant motion when there is no speaker gesture to watch.
- **One big glowing word** under the picture (about 130 px, white with glow on black) to carry the voice when there is no face to read.
- **Network diagram**: you at the centre, followers as a ring, non-followers as scattered dots; ring glows green or red on the word. A clean "structure" picture that needs no speaker.
- **Captions**: one word at a time at one size, centred on x 360, above the bottom box. With no face, the caption becomes the main reading line, so give it one fixed spot.
- Avoid copying: tiny card labels, glossy gradient pills, blurry document pans.
