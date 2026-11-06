# Reel 6azx03lmnx57: notes

Source: `~/Desktop/reels/snapgram.io_6azx03lmnx57.mp4`. 720x1280, 24 fps, 82.25 s, 1974 frames. AAC stereo 44.1 kHz.

A creator talks about his own Claude-built video editor ("losing creative control", "signature", "EDITOR"). Talking head in a warm studio, cut with moody b-roll, two flat colour cards and a filmed screen of his editor.

All measurements are on the 720x1280 frame, from every frame of the file (decoded with ffmpeg, measured with numpy). Frame numbers are 0-based at 24 fps.

## Files here

- `layouts-guides.jpg`: the five layouts side by side with guides. Cyan: frame centre (x 360, y 640). Magenta: big-word top and baseline (y 599 and 676). Yellow: small caption centre (y 813).
- `layout-head.png` (f10), `layout-maroon.png` (f85), `layout-cream.png` (f265), `layout-broll.png` (f360), `layout-broll2.png` (f1050), `layout-screen.png` (f1300), `layout-editor.png` (f1840), `layout-thumbs.png` (f66, the opening graphic), `layout-leak.png` (f70, the red light leak).
- `shots.jpg`: first frame of all 30 shots, with times.
- `motion-1.jpg` .. `motion-9.jpg` strips (8 frames a row, frame numbers burnt in) and `motion-N/` with every full-size frame.
- `transcript.txt`: words with times (whisper small.en).

## 1. Transcript

See `transcript.txt` (whisper base.en; small.en stalled under machine load). 345 words in 82 s: 4.2 words a second, median word 0.20 s.

The argument: "Claude can edit your videos" (hook), "but I hate losing creative control" (problem), "so I built this signature editing studio" (product), "comment EDITOR" (call to action).

What each picture carries (words matched to shots):

| Picture | Time | Words |
|---|---|---|
| Head | 0.00 to 2.96 | So you probably haven't heard this yet, but Claude can edit your videos. |
| Maroon | 2.96 to 4.71 | And to be honest, it is f***ing insane. |
| Head | 4.71 to 10.21 | I absolutely love it ... my problem with it from a creative standpoint is |
| Cream | 10.21 to 11.54 | (is) I hate the idea of |
| Maroon | 11.54 to 14.12 | losing control of what I'm creating. |
| B-roll | 14.12 to 19.96 | I'm relying on Claude to ... pick the best B-roll, to make sure the graphics are airtight, |
| Head | 19.96 to 21.92 | and then if I want to make any tweaks to the output, |
| B-roll | 21.92 to 24.38 | I have to sit and wait for an entire render because |
| Head | 24.38 to 28.67 | it f*cked up just one word. So I challenge myself to find a solution that gives me that control, that |
| Maroon | 28.67 to 31.38 | creative control that I love to have, but |
| Cream | 31.38 to 35.38 | also the benefits of using Claude to speed up the parts of the process that |
| Head | 35.38 to 37.25 | honestly just f***ing suck. |
| B-roll | 37.25 to 47.00 | Nobody wants to sit around spending hours cutting their A-roll ... sifting through hundreds of clips of B-roll ... |
| Head | 47.00 to 48.12 | (after) very few sleepless nights, |
| Cream | 48.12 to 50.12 | I built this signature editing studio and |
| Screen card | 50.12 to 67.33 | the entire purpose of this is to give you that flexibility ... open up a chat, make the tweaks that you want to make. |
| Head | 67.33 to 76.25 | Originally I built it for myself ... if you think that's something that could help you, comment |
| Cream | 76.25 to 78.17 | EDITOR and I'm going to put you on a wait list, if |
| Head | 78.17 to 82.25 | I get a few names on a wait list ... a product that you can have for yourself. |

The pattern is clear:
- Colour cards carry the key sentence of each section: the hook's punch, the problem, the turn, the product name, the call to action.
- The colour flips on the turn word: cream "the idea of" to maroon "losing control"; maroon "... but" to cream "also the benefits". (Checked on the frames: f277 is the first maroon frame and shows "of" for one frame, then "losing".)
- B-roll carries the lists of pain (what Claude does for you, the hours of cutting). Human shots, not evidence.
- The screen card carries the product description.
- The head carries the personal lines and the asides.
- Swear words are starred on screen ("f*cked").

## 2. Layout

There are only two caption positions and one screen card. Everything sits on the vertical centre line x = 360.

| Mode | Where | Text box |
|---|---|---|
| Small caption over talking head | x centre 360.5 (measured on 9 words, all 360 to 361) | ascender top y 794, baseline y 826, descender y 835. Visual centre y about 813 (63.5% down). Width 46 to 215 px |
| Big word over b-roll, colour cards, screen card | x centre 361 to 365 (glyph side bearings push it 1 to 5 px right) | ascender top y 599, x-height top y 622, baseline y 676 to 677, descender y 697. Visual centre y about 640 (frame centre) |

- Big word width: 30 px ("i") to 420 px ("creative" 193 to 532, "EDITOR" 161 to 568). The widest word leaves 150 px each side. Nothing ever wraps: always one word.
- Small to big ratio: 2.4x (ascender 32 px vs 77 px).
- Safe area in practice: all text inside x 150 to 570 and y 594 to 840. Nothing in the top 46% or the bottom 34% of the frame, so it clears the Instagram UI easily.
- Screen-recording card (f1203 to f1615, 17.2 s): x 70 to 649 (580 px wide), y 125 to 1154 (1030 px tall). Aspect 0.563, exactly 9:16, so it is the vertical clip scaled to 80.6%. Margins: 70 px left and right, 125 px top and bottom. Dead centre. Background `#F6F9F6`.
- Card corners: square (radius 0). The top row of the card is full width at y 125. A faint 1 px light edge, no shadow, no border. It does not move or scale at all for 17 s (same bbox on every sampled frame).
- What is inside the card is not a screen capture. It is a phone filming a monitor, handheld, with pans and a whip at 64.3 s. So the "screen" has real-camera motion and grade.
- Opening graphic (f36 to f69): five reel thumbnails fan out above his cap, about x 50 to 670, y 180 to 440, each roughly 110x190 px with a white edge and a slight tilt. Captions are hidden while it is up (f28 to f69).
- One centre line: yes. Small captions, big words, cards and the screen card all share x = 360. Big words and the screen card also share y = 640. The small caption sits 173 px lower, on his chest, so it does not cover the face.

## 3. Colour

Sampled modes (exact pixel values over large areas):

| Element | Hex |
|---|---|
| Maroon card | `#3B1318` (59, 19, 24). 199,988 of 200,000 sampled pixels |
| Cream card | `#F0EDE6` (240, 237, 230). 200,000 of 200,000 |
| Text on cream | `#3B1318`, the same maroon |
| Text on maroon, on b-roll, on head | white, `#FFFFFF` (reads as `#FAFAFA` to `#FBF9FA` after compression) |
| Screen card background | `#F6F9F6`. Not the cream: cooler and lighter. A small inconsistency |
| Caption shadow or stroke | none found. Luma 2 to 4 px from the glyphs vs 8 to 14 px away: 74.6 vs 77.5, 153.5 vs 156.6, 6.0 vs 6.2. At most a 3-level darkening, not visible |

So the palette is two colours that swap roles: maroon on cream, white on maroon. Plus white captions on footage.

Footage grade (luma percentiles, mean RGB):

| Shot | p1 | p50 | p95 | mean RGB | R minus B | sat |
|---|---|---|---|---|---|---|
| Talking head, wide | 1 | 43 | 195 | 79, 62, 48 | +31 | 0.51 |
| Talking head, mid | 0 | 47 | 187 | 79, 62, 48 | +31 | 0.49 |
| Talking head, close | 5 | 68 | 204 | 97, 78, 63 | +35 | 0.46 |
| B-roll, dusk window | 0 | 34 | 116 | 45, 46, 43 | +3 | 0.36 |
| B-roll, face close-up | 0 | 14 | 94 | 29, 23, 17 | +11 | 0.52 |
| B-roll, curtains | 4 | 86 | 165 | 87, 87, 83 | +4 | 0.17 |
| B-roll, hands on laptop | 4 | 140 | 218 | 128, 125, 120 | +8 | 0.15 |
| B-roll, man at desk | 8 | 63 | 168 | 86, 69, 51 | +35 | 0.41 |

- Talking head: low key and warm. Blacks crushed to 0 to 5, median luma only 43 to 68, highlights warm (215, 200, 180). Strong orange shelf light behind.
- B-roll is not one grade. Dusk and daylight shots are neutral to cool and pale (saturation 0.15 to 0.19). The warm shots match the head. What ties them is the low key and soft contrast, not the hue.
- How the cards relate: maroon `#3B1318` is the hue of the deep warm shadows pushed to red. Cream `#F0EDE6` is a warm off-white like his white T-shirt and the curtains. So the cards feel cut from the footage, not pasted on.

## 4. Type

- Category: neo-grotesk sans, Helvetica Neue / SF Pro / Inter family. Double-storey a, straight-tail y, flat terminals.
- Weight: bold (about 700) in every mode.
- Case: all lowercase, even "claude" and "premiere". The one exception is "EDITOR" (f1830), all caps, on cream, as the payoff word.
- Big word size: cap height 69 px ("EDITOR" y 608 to 676), x-height 55 px ("sure", "on" y 622 to 676), ascender 77 px. About 96 to 104 px font size. The x-height is 0.80 of the cap height, high for Helvetica (0.74), so it may be Inter or SF Pro.
- Small caption size: ascender 32 px, so about 42 px font size.
- Tracking: tight, negative. Letters in "claude" and "honest" nearly touch. Roughly -3% to -4%.
- No stroke, no shadow, no box, no highlight colour. White on footage leans only on the dark grade for contrast.
- One word at a time, always. No line of words, no karaoke colouring.

## 5. Motion

The headline: almost nothing moves. Everything is a hard cut. The motion comes from footage (handheld, him leaning in) and from the word rate.

**Motion 1, talking head to maroon card (f64 to f95, `motion-1.jpg`).** f69 head with thumbnails. f70: one frame of a red-orange light leak covering the lower 45% of the frame (y about 585 to 1280; 27% of all pixels red). f71: hard cut to maroon with "and". f71 to f79: faint red flares creep along the frame edges for about 9 frames (375 ms), then the card is flat. No scale, no fade on the card or the word.

**Motion 2, word changes on a card and cream to maroon (f240 to f287, `motion-2.jpg`).** The text bounding box is pixel-identical on every frame of a word, then jumps on the next word. So words hard cut: no pop, no scale, no fade, no slide. Word holds on cards: 1 to 20 frames, median about 5 frames (208 ms). The cream to maroon swap at f277 is a hard cut in one frame, and the word "of" carries across the colour change for one frame before "losing".

**Motion 3, screen card enters (f1196 to f1227, `motion-3.jpg`).** Cream card with "studio" until f1202. f1203: hard cut to the screen card, already full size at its final place. No scale up, no slide, no shadow growing. The word "studio" carries over the cut for one frame, then the next word.

**Motion 4, maroon card to b-roll with big word (f335 to f382, `motion-4.jpg`).** Hard cut at f339. The big word "creating" stays for two frames into the b-roll, same size and place, then words continue. The b-roll moves (slow slider or handheld drift). The big word does not move.

**Motion 5, small captions on the talking head (f120 to f167, `motion-5.jpg`).** Same as cards: hard word swaps, holds 3 to 8 frames ("absolutely" 8 f, "love" 4 f, "it" 3 f, "think" 5 f, "everybody" 7 f, "should" 4 f, "be" 4 f, "utilizing" 10 f).

**Motion 6, inside the screen card (f1536 to f1559).** The filmed monitor whips sideways with motion blur (frame diff peaks 24.5 at f1543), then settles on the chat panel. Card frame stays still.

**Motion 7 and 8, light-leak cuts (f1608 to f1631 and f1122 to f1137).** Same leak as motion 1: one hard red frame over the lower half on the first frame of the new shot (f1616 and f1128), then thin red glows on the edges for 6 to 10 frames. Used 3 times only: 2.92 s, 47.00 s, 67.33 s. Each marks a section change (hook to body, b-roll run to head, demo to wrap-up).

**Motion 9, the opening (f0 to f71).** No zoom (a scale search against f0 finds 1.00 everywhere); he leans into the lens. The thumbnail cards appear at f36 one at a time from behind his cap, fan out to three by f50 and five by f58, hold, then cut.

Colour cards against words:

| Card | Frames | Hold | Words on it |
|---|---|---|---|
| Maroon | f71 to f112 | 1.75 s | 8: "and to be honest it is f***ing insane" |
| Cream | f245 to f276 | 1.33 s | 6: "is i hate the idea of" (the last word of the head shot, "standpoint", carries on for 2 frames) |
| Maroon | f277 to f338 | 2.58 s | 6: "losing control of what i'm creating" |
| Maroon | f688 to f752 | 2.71 s | 8: "creative control that i love to have, but" |
| Cream | f753 to f848 | 4.00 s | 15: "also the benefits of using claude ... the process that" |
| Cream | f1155 to f1202 | 2.00 s | 7: "i built this signature editing studio and" |
| Cream | f1830 to f1875 | 1.92 s | 12: "EDITOR and i'm going to put you on a wait list, if" |

So a card is not one word. It is one sentence beat (1.3 to 4.0 s, mean 2.33 s) that holds while 6 to 15 words flick through it. Two cards can run back to back in the other colour (cream then maroon at 11.54 s, maroon then cream at 31.38 s), which reads as a colour flash on the sentence turn.

## 6. Pacing

- 30 shots in 82.25 s. Mean 2.74 s, median 2.67 s, shortest 0.83 s, longest 9.58 s (a filmed-screen shot inside the card). The longest gap between any picture change outside the screen card is 4.08 s (the last head shot).
- Picture changes: 29 cuts. Of those 7 to colour cards (plus 2 card-to-card swaps), 3 with a light leak.
- Word changes: one caption per spoken word, so about 345 caption swaps, 4.2 a second, one every 0.24 s on average (holds from 1 to 20 frames). Counting cuts and words, something changes on screen about every 0.22 s.
- Share of time:

| Kind | Frames | Seconds | Share |
|---|---|---|---|
| Talking head | 737 | 30.7 | 37% |
| B-roll | 433 | 18.0 | 22% |
| Screen card | 413 | 17.2 | 21% |
| Cream card | 222 | 9.3 | 11% |
| Maroon card | 169 | 7.0 | 9% |

So the speaker is on screen only 37% of the time. 63% is b-roll, cards and the screen. Big centred words run for those 63%.

## 7. Sound

- Voice: mid channel RMS about -17 dBFS when talking, peaks to -8. Jump cuts are tight; there are no pauses longer than about 0.2 s.
- Music: yes, a quiet bed. The side channel (L minus R) holds a steady stereo signal at about -44 dBFS that does not follow the voice (correlation of levels -0.04; -43.8 dB when he is quiet, -44.6 dB when loud). Its envelope repeats every 0.80 s (autocorrelation 0.46), so 75 BPM (or 150 half time), with a short drop every 1.60 s (2 beats) right through the video. Side is 19 to 24 dB under mid in every band, so the music sits about 20 dB under the voice.
- Cuts are not on the beat: only 7 of 28 cuts fall within 15% of a beat, which is chance.
- Sound effects: none I could find. No whoosh, hit or riser stands out at the card cuts or the light leaks. Side-channel peaks within 300 ms of each card cut were -32 to -42 dB, the same as the music elsewhere (median -41). High-band flux at cuts is the next spoken syllable. The light leaks are silent. I am fairly confident (about 80%): a very quiet SFX under the voice could hide, but nothing at the level of a typical pop or swoosh.

## 8. What makes it work, and what is weak

Works:
- One word, one place, one size per mode. Two text positions in the whole video (y 640 and y 813), both on x 360. The eye never hunts.
- Two flat colours lifted from the footage (deep maroon shadows, cream highlights), swapped as figure and ground. It looks branded with almost no design.
- The cards are rhythm, not information. A card is a 1.3 to 4 s sentence beat with fast words on it. The colour flip (cream to maroon) lands on a turn in the sentence.
- Speaker only 37% on screen. The big centred word is the anchor that survives every cut: it carries over the cut by 1 to 2 frames, so cuts feel stitched by the words.
- No motion graphics at all. Hard cuts only, plus 3 light leaks at section changes. The pace comes from about 3 to 4 word changes a second. It looks expensive because it is restrained.
- The screen demo is framed as an object: 9:16 clip at 80.6% on a light field with even 70 / 125 px margins, so the busy UI reads as one card and not as noise.
- The small talking-head caption sits on the chest at y 813, never on the face.

Weak:
- White words over the light screen card and bright b-roll go nearly invisible ("purpose", "to" over white UI at f1300, "suck" over a softbox). No shadow or plate to save them.
- The screen card background `#F6F9F6` does not match the cream `#F0EDE6`. Side by side (48 to 50 s) you see the shift.
- The big word is a fixed 100 px with no emphasis: "the" and "signature" get the same weight. Only "EDITOR" breaks the rule.
- The filmed-monitor demo is soft and shaky; the UI is unreadable at 580 px wide. It sells "a real editor exists" but teaches nothing.
- The light leaks are a stock filter look and a bit off-brand next to the flat cards.
- B-roll grades do not match each other (R minus B from +3 to +35).

## 9. For a reel with no speaker on camera

This reel is already 63% speaker-free, and those parts work on their own:
- Big centred word, one at a time, white, bold, lowercase, about 100 px, tight tracking, at y 640. It is the whole caption system for b-roll, cards and screens.
- Two brand colour cards as the backbone: hold each for one phrase (1.3 to 4 s), flick the words over it, flip the colour on the sentence turn. For Studio: Graphite and Ivory with the sage accent, in place of maroon and cream.
- Moody b-roll on human lines (hands on keys, curtains, a face in shadow), with the same big word on top. Keep it dark (median luma under about 90) so white type reads.
- The demo as a 9:16 card at about 80% on the light field, even margins, hard cut in and out. Better: use real screen captures, not a phone filming a monitor, and put the word on a plate or move it to the margin when the card is bright.
- Hard cuts, no animation on the words. Words change on speech, pictures change on their own clock, and the word carries across a cut by a frame or two.
- A quiet music bed about 20 dB under the voice-over. No SFX needed.
- What to add that this reel lacks: a contrast check for white words (a soft shadow or a dark plate when the picture is bright), and one emphasis rule (caps or the accent colour on four to six key words).
