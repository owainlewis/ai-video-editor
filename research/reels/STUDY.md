# What makes these reels work

Five reference reels from `~/Desktop/reels`, studied frame by frame on 2026-11-06. Each has its own folder here with `NOTES.md`, a transcript, layout stills with guides and motion strips. Numbers are on the 720x1280 frame; times 1.5 for our 1080x1920.

| Reel | Style | Read first |
|---|---|---|
| `6azx03lmnx57` | Cinematic: footage, maroon and cream word cards, one big word | `layouts-guides.jpg`, `shots.jpg` |
| `nmdvmu2dyyhl` | Split: screen recording on top, speaker below, word on the seam | `layout-split-annotated.png` |
| `8f8m4666c1a4` | Dark product UI cards over a speaker window, virtual camera | `layout-grid-window.png`, `motion-3.jpg` |
| `bxa1ouv0c9je` | Same creator as 8f8m: grade card, A/B, focus rail | `layout-guides.jpg`, `motion-8.jpg` |
| `oefqa6zc8wtk` | Light/black stages, red headline block, phone mock-ups | `layout-split-annotated.png` |

Owain's direction (2026-11-06): one consistent style, made of **split screen, text cards and cinematic shots**. The first two reels are that style. The other three add the graphics stage.

## What all five do

1. **One centre line.** Every caption, card and window is centred on x=360, to within 2 px, in all five reels. Nothing is placed by eye.
2. **Few layouts, fixed geometry.** Each reel uses three or four layouts. Inside a layout nothing moves house: the seam, the window and the caption stay put for the whole reel. The speaker window is the same in three reels from two creators: x 47 to 675, top at y 937 to 940, radius 22 to 30, running off the bottom.
3. **Two colours and one accent.** The cinematic reels use maroon `#3B1318` / `#38111A`, cream `#F0EDE6` and white, and nothing else. The UI reels use one near-black `#0F0F0F`, one card grey and one accent with one meaning (green means done). Nothing sits between light and dark.
4. **Hard cuts between layouts.** 17 of 18 layout changes in one reel, and all of them in the cinematic two, are one-frame cuts. They land 0 to 3 frames before a new sentence. Eased motion lives only inside a graphic.
5. **One caption, in one place, with nothing behind it.** No pills, no boxes, no shadows, no strokes. In the cinematic reels the caption is one word at a time, swapped with a hard cut every 0.21 to 0.27 s.
6. **Real things as proof.** Real screen recordings at native size, real repo pages, real numbers counting on the word that says them.
7. **Quiet sound.** All measured at about -14 LUFS. A music bed 15 to 20 dB under the voice. The cinematic reels have no sound effects at all. The UI reels put short ticks (10 to 50 ms) on status changes and a soft low whoosh (95 to 180 Hz, about 10 dB under the voice) on camera moves. No reel puts a sound on a cut.

## Why ours looks muddy, by the same measures

- **Middle tones everywhere.** A grey-brown speaker gradient, a black panel and grey pills behind words. The references never put a mid grey behind text.
- **Four layers at once.** A header, a graphic, a caption chip and the speaker. The references show at most two: the picture and one caption.
- **No fixed grid.** Each graphic picks its own margins and size, and the caption moves around. The references fix the seam and caption home once per reel.
- **Small graphics in big boxes.** The EGM diagram is a thin band in a large panel. The references fill the panel or crop in tight.
- **Too much easing.** Our graphics fade, scale and slide. The cinematic references cut.

## The three parts, measured

### Split screen (`nmdvmu2dyyhl`, 76% of that reel)

- Two panels with a hard edge, no border or gap. The seam is at y=644: the top panel is 720x644 and the bottom 720x636.
- Top: a screen recording at one fixed crop for the whole reel, at native size (UI text about 14 px), never zoomed. The crop puts empty UI (the app's input bar) under the caption.
- Bottom: the speaker, about a 1.2x crop of the full shot.
- Caption: one word, white Helvetica-style Bold, about 100 px, lowercase, tight tracking. It sits on the seam with its baseline 11 px below it. No shadow.

### Text cards (`6azx03lmnx57`, 20% of that reel)

- A flat full-frame card in one of the two colours: white on maroon, or maroon on cream.
- A card holds one key sentence (1.3 to 4.0 s, mean 2.3 s) while its words flick over it one at a time at the frame centre, about 100 px.
- Cards carry the hook, the problem, the product and the ask. The colour flips on the turn word ("but", the payoff).

### Cinematic shots (`6azx03lmnx57`, 59% speaker and b-roll)

- Full-frame graded footage, hard cuts, a shot every 2.7 s on average.
- Two caption sizes: about 42 px on his chest (baseline y 826) over the talking head, about 100 px at the centre (y 640) over b-roll and cards.
- B-roll goes on human lines (hands, a window, a second person at a desk), never as proof.

### The graphics stage (the dark UI reels)

- Graphics build on one canvas, and a virtual camera moves to each new part. Old parts dim to 70% then 40% and blur, rather than leaving.
- Two speeds only: reveals in 2 to 4 frames (67 to 130 ms), camera moves in 16 to 31 frames (530 to 1030 ms), ease in and out, never an overshoot.
- Things land on their word: 0 to 5 frames after it starts, never before.
- The caption lane sits at a fixed height that no card ever enters.

## Weak spots worth not copying

- No emphasis rule in the cinematic reels: every word gets the same weight.
- White words vanish over bright frames (6azx over UI).
- Card text sits 20 px lower than the split caption in nmdv (baseline 675 vs 655).
- UI reels: meta text 8 to 13 px tall, unreadable on a phone. Margins jump between 48, 74 and 90 px across cuts.
- Grades that do not match across b-roll.

## Without Owain on camera

Every part works without a face:
- **Split:** b-roll, a texture or a second recording in the bottom panel, the word still on the seam.
- **Text cards:** need nothing but the voice.
- **Cinematic:** b-roll with the big centre word.
- **Graphics stage:** the camera over a canvas carries a whole section alone.

Studio already voices scripts (Kokoro) and has a b-roll library, so a faceless reel is the same system with the speaker panel swapped out.

## Sound: the Real SFX skill

`clipwing.pro/skills/real-sfx`: a free Claude Code skill. It places recordings from your own licensed library on exact frames, from a cue list or a HyperFrames timeline, and ducks them under the voice. It scores sync and loudness and flags five moments for a human listen. Our plans already know every beat's time, so we can hand it a cue list. The references say how to use it: nothing on cuts, ticks on status changes, soft low whooshes on camera moves, about 10 dB under the voice.

## Proposed system (v1, for review)

On 1080x1920: centre x=540, gutter 72 px.

- **Colours:** paper `#F0EDE6`, one deep ink, white. One accent with one meaning: the word that matters. Recommendation: keep sage `#B7CDBF` as that accent and pick an ink that suits it (a deep green-black), so the reels stay ours and not a copy of the maroon. Open question for Owain.
- **Type:** Helvetica Bold only for captions and cards, lowercase, tight. Two caption sizes: 150 px (seam, centre) and 64 px (over a face). Signifier italic only for the one emphasised word.
- **Layouts:**
  - Split: seam at y=966, hard edge. Top is a screen recording, b-roll or graphics stage; bottom is Owain or b-roll. Word on the seam, baseline 16 px below it.
  - Card: full frame, paper or ink, one sentence, words at y=960. The colour flips on the turn word.
  - Cinematic: full-frame footage. 150 px word at y=960 over b-roll, 64 px word at y=1240 over Owain.
- **Motion:** hard cuts between layouts, on sentence starts, in a pause. Words swap with a hard cut. Inside the graphics stage, two speeds: reveal 100 ms, camera 600 ms ease in and out, no overshoot; old parts dim to 40%. One eased move allowed per reel: the opening push (1.44x to 1.0x over about 670 ms).
- **No headers** above the split, no pills, no gradients, no shadows.
- **Sound:** music bed 15 to 20 dB under the voice, -14 LUFS. Sound effects only on graphic beats, never on cuts.
- **QC enforces it:** everything on x=540, caption at its layout's home, no fill behind text, nothing between 25% and 75% grey behind a word, cuts in pauses.

## Decision (2026-11-06, after two samples)

Two samples of the same EGM script were rendered from `effects/clean/` (`projects/egm-clean/renders/`): `Minimal` (full-screen line diagrams on black, after the faceless reference `gufijccw0vuv`) and `House` (split, cards and cinematic, faceless with b-roll).

Owain: the split, cards and cinematic sample "was the best" and is directionally correct. The style is:

- **Base:** split, text cards and cinematic shots, as in `House`.
- **A-roll first.** Most reels have Owain talking. He takes the place of the b-roll: the bottom panel of a split, and the full-frame cinematic shots (small word low on his chest). B-roll fills the cinematic shots on human lines, and a faceless reel uses b-roll throughout.
- **A full-screen diagram, occasionally.** From `Minimal`: thin white line diagrams on black that build on their words, with a bold header and the quiet Signifier word caption. Only where a picture of the structure adds value, not as the default.
- Keep from `Minimal`: lines that draw on, labels in the speaker's words, sage on the one thing that matters.
- **Graphic b-roll overlay**, now and then to mix it up: the diagram over full-frame b-roll, in a dark glass panel (`overlay` in `House`). Needs a strong, sharp b-roll angle.
- **Footage:** full-frame vertical b-roll needs 4K landscape or vertical source, and slow motion needs 60 fps. The test clips were 1080p, cropped and slowed, which is why they looked soft.

Owain (2026-11-06): "I think we now have our styles locked in."

## From `yvtgllzkevm3` (studied 2026-11-06): what to add to the library

A top creator's reel: talking head plus rebuilt product UI. Notes in `yvtgllzkevm3/NOTES.md`. In order of value:

1. **Terminal and browser windows, rebuilt crisp** in the house look, from real output only. Text types in with a cursor, the next letters pale just before they land, with key clicks.
2. **Rolling counter:** digits roll with motion blur and land on the word that says the number; a few bars grow beside it. Our YouTube `odometer`, brought to reels.
3. **Marker swipe:** a sage marker draws left to right under or over real words in about 0.35 s.
4. **Command chip:** a small monospace label naming the command or skill (`/egm-review`) above the window it drives, and a status chip with a spinner for a running step. A label for a UI, never a caption pill.
5. **Stacked emphasis**, once or twice a reel (the key phrase, the call to action): a small Signifier italic line, then a big Helvetica bold word that rises out of a blur. Sage, no glow.
6. **Blur-in text:** words and labels arrive with a 120 ms blur and rise, not a fade.
7. **Sound kit** (with the Real SFX skill): a riser of about 0.6 s that ends on a cut into a full-screen graphic, a soft glint as a counter or check lands, a tick per checklist item, clicks under typing. Not on every cut.
8. **Two caption voices:** Helvetica bold over footage and A-roll; Signifier over full-screen graphics and diagrams (as in `Minimal`), so the screen and the person read differently.

## The text kit (from Tom Noske, `lvxbaftr9bji`, 2026-11-06)

Owain: our text was "very one dimensional". Tom Noske, his style inspiration, uses a small set of text treatments and reuses them. Ours, in Helvetica and Signifier:

1. **Caption:** one or two words, Helvetica bold lowercase, warm cream `#EADCCB` over footage (not white). Connective words at 60% size.
2. **Hit:** a key word or number in Helvetica bold caps, about 1.6x, typed on letter by letter in about 0.4 s, with an optional Signifier italic tag typed in under it, offset right.
3. **Title:** a concept's name in Signifier italic, two lines, the second indented right, typed on above a line diagram that draws on as it types.
4. **Caption inside the diagram:** once a diagram is drawn, the caption sits in its centre.
5. **List:** a bracketed caps header, then items stacking under it on their words, held.
6. **Card beat:** one huge caps word on a flat card, hard swapped on the beat, with size contrast (huge, then small, then huge).

Use only these. A new treatment needs a reason.

Still to add to the toolkit (Owain, same day): beautiful browser windows and Claude Code terminal windows in this style, with typing that fills a search bar or a terminal prompt in time with real keyboard sounds.

## Built into Studio (2026-11-06)

Owain approved sample 3 ("Yes, build it in"), with one change: "the split screen should be the primary view". A reel plan with `"style": "clean"` is drawn by `effects/clean/Clean.tsx` in the editor, the gallery, stills, QC and the export. `projects/egm-clean/edit.json` is the first plan in it: split about half the reel, three cards, two cinematic shots, one overlay and one full-screen diagram. How to write one is in `CLAUDE.md`, "Clean reels".
