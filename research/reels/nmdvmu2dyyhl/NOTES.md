# Reel nmdvmu2dyyhl: notes

Source: `~/Desktop/reels/snapgram.io_nmdvmu2dyyhl.mp4`. 720x1280, 23.976 fps, 102.2 s, AAC stereo 44.1 kHz.
All pixel numbers are on the 720x1280 frame. Multiply by 1.5 for 1080x1920.

Topic: a creator shows a Claude "skill" that sorts and trims his footage (A-roll and B-roll folders, cut points, grading, preview renders), and offers it free.

Files in this folder:
- `transcript.txt`: words with times (whisper small, local).
- `layout-*.png`: full-resolution stills of each layout. `layout-split-annotated.png` has the measured lines drawn on.
- `motion-N/`: every frame of each move at native fps. `motion-N.jpg`: the strip, with times.

## 0. What is said (structure)

405 words in 102 s (about 4 words per second). Full text with times in `transcript.txt`.

| Time | Beat | Picture |
|---|---|---|
| 0.0-3.5 | Hook claim: "Using Claude to help you manage your B-roll is an absolute game changer." | Zoom-out on speaker, then maroon card word by word, cream card on "changer" |
| 3.8-8.0 | CTA: "comment skill, and I'm going to send you the exact setup" | Full speaker, "SKILL" title behind his head |
| 8.3-10.1 | Offer: "Completely free. I'm not even going to ask for your email." | Cream card, word by word |
| 10.3-49.2 | Steps: open Finder, find a messy folder, point Claude at it, dictate the cuts | Split: Finder, Quick Look, Claude chat |
| 49.4-58.2 | Aside about his grade ("one LUT that I use for everything") | Full speaker, with one punch-in |
| 58.2-86.0 | The dictated cut list and the preview render | Split: the chat shows the exact words he says ("For 1726, let's do 10 seconds to 14 seconds"), then the preview plays |
| 86.0-102.1 | Result: trimmed files in Finder, "all of this was done in a single prompt" | Split: Finder, clips playing (hands writing, a dog) |

The CTA comes at 3.8 s, before any of the tutorial. The cards carry the two lines that sell (the claim and the offer). The 15.9 s static split at 58.4-74.3 s is the moment the chat on screen shows the exact cut list he is reading out, so the screen is the caption there.

Caption timing: comparing card swaps with whisper word starts, the caption appears 0.1-0.4 s after the word starts ("is" 1.68 vs 1.88, "absolute" 2.10 vs 2.29, "changer" 3.14 vs 3.25). Whisper word times can be off by about 0.1 s, so read this as "on the word or just after", never ahead of it.

## 1. The layouts

There are only four layouts in the whole reel, and every one is built on the same centre line (x = 360).

| Layout | Time on screen | Share |
|---|---|---|
| Stacked split (screen recording on top, speaker below) | 77.9 s | 76% |
| Full speaker | 20.4 s | 20% |
| Cream word card | 2.5 s | 2.4% |
| Maroon word card | 1.4 s | 1.3% |
| B-roll alone, full frame | 0 s | 0% |

Timeline: full 0-1.88, maroon 1.88-3.25, cream 3.25-3.80, full with "SKILL" title 3.80-8.34, cream 8.34-10.26, split 10.26-13.81, full 13.81-17.64, split 17.64-25.61, full 25.61-26.78, split 26.78-49.38, full 49.38-58.39, split 58.39-102.2.

So the reel opens with 10 s of hook (speaker, word cards, title) and then lives in the split for most of the next 92 s, dropping back to full speaker three times (3.8 s, 1.2 s, 9.0 s).

### Stacked split (`layout-split-finder.png`, `layout-split-claude.png`, `layout-split-annotated.png`)

- Seam: a hard edge between row 643 and row 644. Top panel 720x644 (50.3%), bottom panel 720x636. No border, no gap, no shadow, no rounded corners. Two rectangles butted together.
- Top panel: a fixed crop of a macOS screen recording (Claude desktop app, Finder, Quick Look, a video player). The crop never moves: the app's "Bypass permissions" status bar sits at exactly y = 616-636 in every frame where it is visible (checked over all 1,865 split frames, zero offset). The crop is about 720 logical points wide, so app text keeps its native size: body text line pitch is 19.6 px, about a 14 px font. Readable on a phone, not shrunk.
- The crop is chosen so the app's chat input bar (y = 567-607) and status bar (y = 616-636) land at the bottom of the top panel. Those are low-information strips. The big caption sits on them, so the caption never covers the content being talked about.
- When he opens a clip, the top panel shows the clip itself in Quick Look or a player (a man at a camera on a tripod, hands writing, a dog). These look like b-roll but they are part of the screen recording: the player's scrub bar is visible at y = 600-625.
- Bottom panel: the speaker, about a 1.2x crop of the full shot (his cap is 165 px wide in the full shot, 205 px in the split). Cap top at y = 705-720 (60-75 px below the seam, about 10% headroom inside the panel). Eyes at y = 830-840. Mic top at y = 950. The frame cuts at chest and desk. Face centre at x = 380-440, so 20-80 px right of centre. The warm shelf glow fills the background of the panel.
- In the split he often looks off camera at his screen (left), which reads as "doing the thing" rather than "talking to you".

### Full speaker (`layout-full.png`, `layout-full-2.png`, `layout-title-skill.png`)

- Wide framing: cap top at y = 320, eyes at y = 470, mic at y = 610-780, desk and keyboard in the bottom 250 px. Lots of room above his head (the lamp and shelves).
- Small caption, centred, baseline at y = 826 (64.5% down the frame), over his shirt and mic stand.

### Word cards (`layout-card-maroon.png`, `layout-card-cream.png`)

- Flat fill, no texture, no gradient, no vignette (pixel std 0 over the whole card).
- One word, centred, the same size as the split caption. Ascender top y = 603, baseline y = 675, so the word's centre is at y = 639, the exact frame centre.
- Note: the card word sits 20 px lower than the split caption (baseline 675 vs 655). Close, but not the same line.

### Safe area

- Split caption: y = 583-675 (46-53% of height). Well clear of the Instagram top bar and the bottom caption area, and centred so the right-side buttons (x > 640) never touch it unless a word is wider than 560 px.
- "SKILL" title: y = 272-394 (21-31%), x = 116-627. Clear of the top UI.
- Full-speaker caption: y = 795-835. Safe.
- Nothing important sits in the bottom 300 px except the speaker's chest and desk.

### One centre line

Yes. Caption centre x measured at 359.5, 361.5, 364, 350 (median 362.5 over 624 split frames). Card words at 362-364. Small captions at 360.5. The "SKILL" title box centre is 371 (its italic slant pushes it right by about 11 px). The speaker's face is the only thing off the line, 20-80 px to the right.

## 2. Colour

Sampled pixels, not guessed.

| Thing | Hex |
|---|---|
| Maroon card fill | `#38111A` (std 0) |
| Cream card fill | `#F0ECE5` (std 0) |
| Text on maroon | `#FFFFFF` |
| Text on cream | `#38111A` (the same maroon) |
| Split caption | `#FFFFFF` (anti-aliased edge pixels `#FBFBFB`) |
| Full-speaker caption | `#FFFFFF` |
| "SKILL" title | `#FAF6EF` to `#FBF6EF` (warm off-white, close to the cream) |
| Shadow or outline on any text | none (ring 1-3 px outside the glyphs is not darker than the ring at 6-9 px) |
| App UI background (screen recording) | `#161616` to `#1F1F1F`, cards `#212121` |
| Speaker wall | `#452818` |
| Shelf glow | `#9B6441` |
| White T-shirt | `#6D777E` (graded down and cooled) |

So the system is two colours plus white: maroon and cream swap roles (maroon on cream, cream-white on maroon). The title uses the warm white, which ties it to the cream.

Grade of the footage: warm orange highlights, teal-ish shadows. The white shirt sits at `#6D777E`, a cool mid grey, so the skin and shelves carry all the warmth. Blacks are crushed (5th percentile luma 8 in full shots, true 0 present). Mean luma 61 (full shots), saturation 0.32.

Screen recording vs footage: in the split, the app UI panel has mean luma 36 (median 30, saturation 0.05) against 75 for the speaker panel below it. The top half is about half as bright as the bottom and almost grey. It reads as a dark, quiet panel, and the warm speaker panel below it is where the colour is. When a video preview fills the top panel, its mean luma jumps to 94, brighter than the speaker.

## 3. Type

All text is one family: a neo-grotesque sans (Helvetica Neue style), set tight. Lowercase everywhere except the title.

| Mode | Weight | Size (720 frame) | Measured | Case | Tracking | Effects |
|---|---|---|---|---|---|---|
| Split caption | Bold | about 100-104 px (x-height 54 px, ascender 72 px) | ascender top y 583, x-height top 601, baseline 655, descender 675 | lowercase, one word | tight, about -3% to -4% (glyphs nearly touch) | none |
| Word card | Bold | same, about 100 px (ascender 72-73 px) | ascender 603, baseline 675 | lowercase, one word | same | none |
| Full-speaker caption | Bold | about 44 px (ascender 31-32 px) | ascender 795, baseline 826 | lowercase, one word | tight | none |
| "SKILL" title | Heavy or Black Italic | about 165 px (cap height about 120 px) | box x 116-627, y 272-394, 511 px wide including quotes | UPPERCASE, in straight double quotes | tight | none, but it sits behind his head (see motion) |

The split caption is 2.3x the size of the full-speaker caption. The big caption is the design element; the small one is just subtitles.

At 1080x1920: split caption about 150-155 px, small caption about 66 px, title about 250 px.

## 4. Motion

Native frame is 41.7 ms. Every strip is `motion-N.jpg`; every frame is in `motion-N/`.

### Motion 6: the opening zoom-out (0.00-0.67 s, `motion-6.jpg`)

- The first frame is a 1.44x punch on the speaker. It scales down to 1.00x over 16 frames (667 ms), centred on the frame centre.
- Measured scale per frame: 1.44, 1.38, 1.32, 1.28, 1.24, 1.20, 1.18, 1.14, 1.12, 1.10, 1.08, 1.06, 1.04, 1.04, 1.02, 1.02, 1.00.
- Ease-out: it loses 0.06 per frame at the start and 0.02 at the end. No blur, no rotation.
- First caption appears at 0.17 s (frame 4), while the zoom is still moving.

### Motion 1: the "SKILL" title in (4.80-5.17 s, `motion-1.jpg`)

- The small caption is removed at 4.80 s, and the title fades in on the next frame.
- Pure opacity fade. No scale, no slide, no blur: the letter positions are identical in every frame.
- Region brightness over the title rises 74, 84, 99, 106, 111, 115, 121, 123, 125, 125. As opacity that is 0, 0.20, 0.49, 0.63, 0.73, 0.80, 0.92, 0.96, 1.0. Duration 8-9 frames, about 340 ms, ease-out.
- The title is composited behind the speaker: his cap covers the bottom of "KILL" (see `layout-title-skill.png`). A subject mask, so the word sits in the room, not on the glass.
- It holds 3.5 s with no exit. It leaves on a hard cut to the cream card at 8.34 s.
- The small word captions come back under it at 5.26 s, so title and captions coexist.

### Motion 2: full speaker to split (17.60-17.64 s, `motion-2.jpg`)

- Hard cut, 0 frames. The layout, the camera crop and the caption size all change on one frame.
- The current word ("b-roll") carries across the cut: small at y 826 in the last full frame, big on the seam in the first split frame. The word does not restart.
- Same at 10.26 s (cream card to split) and every other layout change. No transitions anywhere in the reel.

### Motion 3: top-panel content change (37.79-37.91 s, `motion-3.jpg`)

- He presses space in Finder and macOS Quick Look opens the clip. The 3-frame zoom (diff 66, 25, 13) is Quick Look's own animation in the recording, not an editor effect.
- The editor never zooms or pans the screen recording. The crop is fixed for the whole reel (status bar at the same pixel in every split frame). All motion in the top panel is real UI: Finder selection moving with arrow keys, chat scrolling (motion 7, `motion-7.jpg`, 70.9-71.9 s), players opening.
- So the answer to "do screen recordings zoom to the part being talked about": no. They crop once, tightly, at native size, and the UI does the moving.

### Motion 4: caption word change (19.10-19.90 s, `motion-4.jpg`)

- Hard swap on one frame. The old word is gone and the new one is fully drawn in the same frame (mask change 5,700-12,900 px on the swap frame, then 0-10 px on the frames after).
- No pop, no scale, no fade, no slide, no colour highlight. Baseline locked at y 655, size locked.
- One word at a time, every word: 339 caption changes in 102 s.

### Motion 5: colour cards (1.70-3.42 s, `motion-5.jpg`)

- Hard cut from the speaker to maroon at 1.88 s. Words swap on the card one at a time: "is" (1.88), "an" (2.00), "absolute" (2.29), "game" (2.96).
- On the payoff word "changer" (3.25 s) the card hard cuts to cream with maroon text: the colours invert on the word that matters. Cream holds 0.54 s, then hard cut back to the speaker.
- The second cream card (8.34-10.26 s) carries the offer, word by word: "completely free, not even gonna ask for your email".
- No animation on the card itself. The colour flip is the motion.

### Other moves

- Punch-in on a jump cut in the full-speaker section: 52.34 s cuts to a 1.18x crop, 55.85 s cuts back. Hard cuts, no animated zoom.
- No slow push-ins: the SKILL shot (3.8-8.3 s) and the 49-52 s shot have no measurable scale change.

### Easing summary

Only two eased moves in 102 s: the 667 ms ease-out zoom at the very start, and the 340 ms ease-out fade of the title. Everything else is a hard cut. That restraint is a big part of why it looks clean.

## 5. Pacing

- Layout cuts: 11 (all in the first 58.4 s).
- Other picture changes: 19 hard changes in the top panel (clips opening, players, Quick Look), 2 punch-in jump cuts, 1 title in. Total 31 picture changes, plus the start.
- Seconds between picture changes: mean 3.2, median 1.9, max 15.9 (58.4-74.3 s, a single split shot where only the chat scrolls and the captions change), min 0.17.
- Caption swaps: 339, one per word. Median 0.21 s between words, about 3.3 words per second.
- Counting everything (picture and captions): 366 changes, mean gap 0.28 s, median 0.21 s, longest 2.29 s (6.05-8.34, the "SKILL" title hold).
- So the picture is slow and calm (a change every 3 s on average, one stretch of 16 s), and the caption is the metronome (a change every 0.2 s). The eye always has something moving, without the frame being busy.

Share of time: split 76%, full speaker 20%, colour cards 3.7%, b-roll alone 0%. The first 10 s is 38% cards and title; after 10.26 s the reel is split or full speaker only.

## 6. Sound

- Integrated loudness -14.1 LUFS. Voice peaks around -8 dBFS (10 ms RMS), median -19 dBFS.
- A music bed runs the whole reel. Evidence: the voice is mono, yet the stereo side channel never drops below about -45 dB and sits at a median of -38 dB from 0 to 101 s, then fades to -57 dB in the last second. The quietest 10 ms in most seconds is -28 to -36 dB, so pauses are never silent. Side-only loudness is -36.7 LUFS. Estimated bed level: roughly 15-20 dB under the voice.
- The bed has a strong repeat every 1.76 s (autocorrelation peak), which is one bar at about 136 BPM. Its accents are not lined up with the cuts (e.g. accent 10.12 vs cut 10.26, 17.23 vs 17.64, 74.12 vs 74.32). One accent lands on the cut to the cream card (8.37 vs 8.34), likely chance.
- No sound effects found. At every layout cut, card, title and top-panel change the 10 ms levels show no transient in the mid or side channel beyond the voice. The high-frequency bursts near 4.6-4.8 s are the "s" of "skill", not a whoosh.
- Cuts land in speech pauses: at most cuts the voice level dips to -26 to -36 dB at the cut frame.

## 7. What makes it work

1. One seam, used for everything. The split is two plain rectangles butted at y = 644, and the big caption sits on that seam (x-height 601-655, baseline 11 px below it). The eye goes to the middle of the screen and stays there: content above, face below, the word in between. Nothing else competes.
2. The crop is chosen so the seam lands on the app's input bar. The caption covers dead UI, never the chat text or the file list.
3. Screen recordings at native size. A fixed 720-point crop keeps the 14 px app text readable on a phone, so the screen recording is evidence you can actually read ("For 1728, let's do 2 seconds to 10 seconds").
4. Contrast does the hierarchy. The dark grey app panel (luma 36, almost no colour) against the warm, bright speaker panel (luma 75). The caption is pure white, bold, 100 px, with no shadow because it sits on dark UI.
5. Very few moves. Two eased moves in 102 s. Everything else is a hard cut, including captions. No wiggles, no pops, no zoom on the screen. It looks expensive because nothing is fighting.
6. A real two-colour palette. Maroon `#38111A` and cream `#F0ECE5`, plus white. The colour flip on "changer" is the only "effect" in the hook, and it lands on the meaning.
7. The title lives in the room. "SKILL" behind his head is one moment of depth that makes the opening feel produced, with zero motion beyond a fade.
8. The b-roll is the product. The clips that open in the top panel are the output of the workflow he is describing, so even the "b-roll" is proof.

## 8. What is weak

1. Long static stretch: 58.4-74.3 s (15.9 s) is one split shot. The chat scrolls a little, but the picture does not really change. Only the captions carry it.
2. Captions with no emphasis. Every word gets the same weight, including "the", "a", "to". Nothing tells you which word matters. A 100 px "of" on screen for 0.2 s is noise.
3. Two baselines that almost match. Card words sit at baseline 675, split captions at 655. A 20 px jump when cutting between them, small but visible.
4. The speaker panel is not centred: face at x 380-440, while every other element sits on x 360.
5. The top panel is cut at 644 px regardless of content. When a video preview is open, the player's scrub bar and controls sit right under the caption (`layout-split-broll.png`), so you get UI chrome, a caption and the seam fighting in a 60 px band.
6. Off-camera eye line. In the split he often looks at his screen, so the bottom half is a man looking away. Fine for "watch me do it", weak for connection.
7. The "SKILL" title has quotes around it that add width but no meaning.
8. All the craft is in the first 10 s. After 10.26 s there are no more cards or titles, only split and full speaker.

## 9. Ideas for a reel with no speaker on camera

- The seam caption works without a face. Use two stacked panels (screen recording on top, b-roll or a second recording below) and put the one-word caption on the seam. The seam gives the word a fixed home and a strong centre.
- Or replace the speaker panel with a calm "anchor" panel: a slow b-roll loop, a graded texture, or the maroon card. The top panel shows the evidence; the bottom panel holds the mood.
- Crop screen recordings once, at native size (1 point = 1 pixel), with the dead UI strip landing on the seam. No zooms. Let the real UI move.
- Maroon and cream word cards are speaker-free by nature. Use them for the hook claim and the offer, word by word, and flip the colour on the payoff word.
- A title that sits behind something in a b-roll shot (a person, a laptop, a plant) gives the same depth as "SKILL" behind his head.
- Keep the picture slow (a change every 2-4 s) and let the caption be the fast layer (every word). This keeps a voice-only reel moving without busy graphics.
- Show the output as the b-roll. Clips opening in a player or Quick Look are proof, not decoration.
- Use the music bed at 15-20 dB under the voice with no sound effects. The reel does not need whooshes to feel paced.
