# Reel 8f8m4666c1a4: "CLI-Anything" (dark product-UI explainer)

Source: `~/Desktop/reels/snapgram.io_8f8m4666c1a4.mp4`. 720x1280, 29.97 fps, 41.4 s, 1241 frames, AAC 48 kHz. Loudness -14.1 LUFS integrated.

All numbers are measured on the 720x1280 frame (pixel sampling with numpy, frame diffs at native fps). Where I could not measure, I say so.

Files in this folder:

- `layout-1..8-*.png`: full-resolution stills of each layout.
- `layout-grid-window.png`, `layout-grid-graphic.png`: the same stills with the measured lines drawn on.
- `motion-1..8.jpg` (and `motion-6b.jpg`, `motion-6c.jpg`): frame-by-frame grids of each move, frame number top left.
- `motion-N/`: every native frame across each move (360 px wide).
- `transcript.txt`: words with times.

## 1. Transcript

See `transcript.txt` (Whisper small.en, word times). 163 words in 41.2 s, about 237 words per minute: fast, no pauses longer than 0.35 s.

The argument in three lines: "Claude just killed MCPs." If an app has no integration, CLI-Anything turns its open-source code into commands Claude can run. Build once, reuse forever; comment "CLI" for the guide and the link.

Structure: hook (0-6 s), what it is (6-11.7), how you use it (11.9-16.5), how it works (16.8-23), proof with three apps (23.2-29.9), the real benefit (30.2-37.6), call to action (37.8-41.2).

## 2. Layout

There are four layouts plus an end card. All share one centre line at x=360 (every caption measures centre x 357 to 360).

| Layout | Time | Share |
|---|---|---|
| A. Graphic only (cards on near-black, caption below) | 6.07-11.85, 16.72-23.16, 32.50-37.70 | 17.4 s, 42% |
| B. Split, speaker in a rounded window | 1.53-6.07, 11.85-16.72 | 9.4 s, 23% |
| C. Split, speaker full width under a gradient | 0-1.53, 23.16-30.13 | 8.5 s, 21% |
| D. Speaker full frame, caption on the TV behind him | 30.13-32.50, 37.70-41.41 | 6.1 s, 15% (3.7 s of it carries the end card) |

No b-roll at all. The speaker is visible 58% of the time; graphics are on screen 85% of the time (A + B + C + end card).

### A. Graphic only (`layout-3-graphic-only.png`, `layout-7-graphic-stack.png`, `layout-grid-graphic.png`)

- Background `#0f0f0f` to `#0f0f11`, with a static film-grain texture (pixel std 9.5 around a mean of about 17). The grain does not move between frames.
- Main column: big cards run x=47 to 675 (629 wide, margins 47 and 45). That is the same 48 px gutter the speaker window uses.
- Second level: command rows sit inset 37 px inside the card column, x=84 to 636 (552 wide).
- Stack (layout-3, 11.6 s): card 145-277, connector line, card 324-457, rows 505-583 / 595-673 / 685-763 (78 tall, 12 gap), pill 792-870 (x 204-516). Gap card to card 47 px with a 1 px `#414141` connector line on x=360.
- Graphics live in y 100 to 870. Caption sits alone at y=992 (cap top 983, bottom 1001). The bottom 280 px are empty.
- The camera moves over one big canvas, so the stack is not always centred: at 36.8 s it spans x=76 to 700 (centre 388, 28 px right of centre), and at 15.0 and 33.5 s cards run past the right edge.

### B. Split with rounded speaker window (`layout-2-split-window.png`, `layout-grid-window.png`)

- Window: x=48 to 671 (624 wide, 48 px margins), top edge y=940, bleeds off the bottom (no bottom edge, 340 px visible). Corner radius about 22 px. No border, no shadow seen.
- The speaker's head breaks out of the window: hair reaches y≈872, 68 px above the window top. So the speaker is cut out and layered over the window frame. This is the most striking detail in the reel.
- Footage in the window is scaled to roughly 0.87 (624/720), his face sits near x=360.
- Caption: centre y=842 (cap 832-852), 98 px above the window top.
- Graphics: y 109 to 559. Two app tiles 176x176 (x 74-249 and 470-645, centres 161 and 557, symmetric on 360), dashed connector between them at y≈197. Panel 616x220 (x 52-667, y 340-559). Gap tile to panel 56 px.
- Then 260 px of empty dark between the panel and the caption (y 560 to 820).

### C. Split, speaker full width under a gradient (`layout-1-split-fullwidth.png`, `layout-4-split-fullwidth-apps.png`)

- The speaker footage is the same scale as full frame, slid down 217 px (TV bottom edge moves from y=568 to y=785).
- A gradient from the background colour covers the top: solid to y≈650, fades over 150 px to clear at y≈800 (wall luma 17 at y=640, 53 at 700, 121 at 760, 148 at 820).
- Caption centre y=641 (cap 632-650), sitting on the solid part, just above the fade.
- Graphic zone y 190 to 450. App tiles 170 wide x 218 tall, 16 px gaps, x 90-259 / 275-444 / 461-630 (block 540 wide, centred on 360, 90 px margins).

### D. Speaker full frame (`layout-5-speaker-full.png`)

- No graphic. The caption is placed on the black TV on the wall behind him: centre (360, 426), white pixel font on the TV's black. It reads as if the TV is showing the caption.
- The TV spans x≈110-540, y≈318-568. The caption is not perspective-matched; the TV is flat to camera so it does not need to be.

### End card (`layout-6-end-card.png`)

- Over layout D. "COMMENT" white, letter spaced, x 265-449, cap height 20, y 133-152.
- "CLI" in black heavy sans (cap height 58) on a green pill `#31d298`, about 180x92, x≈270-450, y≈163-255.
- Two glass cards below, 192x120 each, 18 px gap, x 159-351 and 369-561 (block centred on 360), y 275-395: icon, "FULL GUIDE" / "THE LINK" bold caps (cap 14), grey subline (cap 15). Fill is a dark translucent gradient over the footage.
- The caption still runs on the TV below them (y≈426).

### Grid verdict

- One centre line (x=360) for everything: captions, cards, tiles, window, end card.
- One main gutter of 48 px (window 48, big cards 47, panel 52). Inner elements step in by about 37 px (rows) or 26 px (tiles in B).
- Not perfect: tile blocks use 74 px and 90 px margins in different scenes, and the camera drift puts stacks 20 to 30 px off centre or past the edge for a second at a time.
- Caption y changes per layout (992, 842, 641, 426), but within a layout it never moves.

## 3. Colour (sampled)

| Role | Hex |
|---|---|
| Background | `#0f0f0f` / `#0f0f11` + static grain |
| Card fill | `#1f1f1f`, `#1f1f21` |
| Raised card / row fill | `#222225` |
| Pill / active tile fill | `#252525` / `#282828` |
| Search field fill | `#313131` |
| Card border (1 px, lighter top) | `#2c2c2e` to `#49494b` |
| Connector line | `#414141` |
| Text primary | `#ffffff` |
| Text secondary (sans) | `#c8c8c8` |
| Mono label (above commands) | `#adadaf` |
| Accent green (checks, "Built once", "Reused") | `#3ad8af` |
| Success row border | `#3b645a` (green, low alpha) |
| End card green | `#31d298` |
| Code-bar decoration | dull orange `#804030`, dull green `#205040`, grey `#505050` |

- Total: one neutral ramp of about seven greys, white, one green accent. Everything else is colour that comes from real app icons (Claude orange, Shotcut blue and red, Draw.io orange, LibreOffice green) and the orange send button of the Claude chat UI.
- The green means one thing only: done. A spinner turns into a green check, a row border turns green when its command finishes, "Built once" and "Reused" are green tags. The end card reuses the same green for the call to action.
- Active state uses the app's own brand colour as a thin border (Shotcut tile border `#2c3b43` blue-tinted, Draw.io `#5f4d38` orange-tinted). Inactive tiles drop to about 50% brightness (label max 132 vs 255).

## 4. Type

| Level | Font category | Weight | Cap height (px) | Approx size | Case |
|---|---|---|---|---|---|
| Caption | pixel / bitmap mono (dot-matrix look) | regular | 19 | ~26 px, ~18 px per character | UPPER, wide tracking |
| Hero card title ("CLI-Anything") | geometric-leaning grotesk (single-storey g) | semibold | 28 | ~40 px | Title |
| Card title ("Shotcut", "Shotcut controls") | same sans | semibold | 23 | ~32 px | Title |
| Body / UI text ("Shotcut" search, "No connectors found") | same sans | medium | 20-21 | ~28 px | Sentence |
| Small label ("Claude Code" under icon, "Connectors") | same sans | semibold | 16-17 | ~22 px | Title |
| Secondary ("open-source code") | same sans | regular, `#c8c8c8` | x-height 15 | ~22 px | lower |
| Command | mono (SF Mono / Menlo style) | regular | 15 | ~21 px | lower |
| Command label ("cli-anything-shotcut") | mono, `#adadaf` | regular | 16 incl. ascenders | ~18 px | lower |
| End card "CLI" | heavy geometric sans | black | 58 | ~80 px | UPPER |
| End card "COMMENT", "FULL GUIDE" | same sans | bold | 20 / 14 | | UPPER, tracked |

- Three families: one sans for UI, one mono for commands, one pixel mono for captions. The caption font is the signature: it never appears anywhere else.
- Captions are one line, two to three words, never two lines.
- Cards carry at most a title, a subline and a tag. Most screens hold 8 to 25 words of UI text.

## 5. Motion

Overall: every graphic move is either a hard cut or a 6 to 22 frame ease. No bounce, no overshoot anywhere. Layout changes are always hard cuts. Inside a layout, a virtual camera moves over one large canvas: it zooms out to show neighbours, then drifts to the next item.

### Move 1: layout change B to C at 1.53 s (`motion-1.jpg`, frames 1.40-1.67 s)
- Hard cut on frame 46 (1.53 s). Full-width speaker becomes the rounded window in one frame.
- The graphic does not cut: the Claude Code tile and the greyed MCP tile stay in place across the cut. The caption swaps on the same frame.
- So: layouts cut, graphics persist. Continuity comes from the graphic, not from a transition.

### Move 2: camera pull back with blur (`motion-2.jpg`, 4.93-5.60 s)
- 20 frames (667 ms). The "Connectors / No connectors found" panel shrinks (about 0.9x), slides down and blurs out of focus, dropping to about half brightness. The two app tiles slide in from the top edge. A blurred CLI-Anything icon fades in between them.
- The blur makes the old element a background, not a disappearance. It is a depth-of-field move.
- Caption swaps hard on frame 10 (5.27 s) mid-move.
- Then a hard cut at 6.07 s to the graphic-only layout with the CLI-Anything card alone, big.

### Move 3: zoom out to reveal neighbours (`motion-3.jpg`, 7.20-7.93 s)
- Tracked card box: width 703 to 579 px (scale 0.82), centre y 600 to 499 (up 101 px), centre x fixed at 362.
- Per-frame speed: 1-3 px for frames 0-5, peaks at about 12 px per frame on frames 9-11, then a long tail of 1 px per frame to frame 22.
- So about 12 frames (400 ms) of real motion inside a 22 frame (730 ms) curve. Ease in-out with a long, soft end (my estimate: close to cubic-bezier 0.6, 0, 0.2, 1). No overshoot.
- During the tail the "Claude Code" pill fades up from below (frames 15-20) and the Shotcut card fades in above (8.0-8.3 s). The zoom makes room, then the new items appear in the space.

### Move 4: command rows build and complete (`motion-4.jpg`, 9.85-10.85 s)
- Three rows enter one at a time: row 1 at frame 1-3, row 2 at frame 6-9, row 3 at frame 12-14. Stagger 6 frames (200 ms).
- Each row takes 2 to 3 frames (70-100 ms) to arrive: fades in from blurred to sharp with a small upward drift.
- After the third row, the camera slowly pushes in (cards widen from frame 12 to 30).
- Then each row shows a spinner, and the spinners turn into green checks one by one at 10.9, 11.1, 11.3 s. Each check has a tick sound (see Sound).

### Move 5: active tile (`motion-5.jpg`, 26.00-26.57 s)
- Draw.io tile lights up on the word "diagrams". Starts at 26.30 s.
- 7 frames (230 ms), ease out (biggest change in the first frame). Icon saturation 41 to 65 to 79 to 92 ... 113. Label brightness 132 to 255. Tile lifts 13 px (top 207 to 194) and grows about 4% wide. Border picks up the app's orange.
- No overshoot. The previous tile (Shotcut) stays lit, the next (LibreOffice) stays dim until its word.

### Move 6: end card build (`motion-6.jpg`, `motion-6b.jpg`, `motion-6c.jpg`, 37.65-40.97 s)
- 37.70 s: hard cut to full-frame speaker. The TV caption appears one frame after the cut.
- 38.03-38.13 s: "COMMENT" fades in over 4 frames (130 ms).
- 38.67 s: "CLI" appears as white text. Over the next 3 frames a green pill wipes in left to right behind it and the text turns black. A highlighter-style mask wipe, about 100 ms.
- 39.17-39.40 s: the COMMENT + CLI group slides up about 25 px over 8 frames to make room.
- 39.80-40.00 s: "FULL GUIDE" card rises from below, about 170 px over 6 frames, ease out, settles by frame 9. On the words "full guide".
- 40.60-40.80 s: "THE LINK" card rises the same way, on "the link". Stagger between the cards 24 frames (800 ms): it follows the words, not a fixed beat.

### Move 7: typing, then the command answers (`motion-7.jpg`, 15.40-16.00 s)
- A chat input types the prompt at about 20 characters per second. Behind it the earlier Filters panel stays on screen, blurred and dimmed (background depth again).
- The camera re-centres on the input over frames 4-8 (it starts 20 px past the right edge).
- A command row then slides in below with the same 3-frame blur-in as Move 4, and its spinner turns green (ticks at 15.72, 15.92, 16.11, 16.31 s).

### Move 8: camera drift during typing (`motion-8.jpg`, 33.10-33.67 s)
- Slow continuous pan up and to the right (about 3 px per frame) while the prompt types. The "Shotcut controls" card slides partly off the top edge and the input runs past the right edge.
- This keeps the screen alive while nothing new is added, but it breaks the margins for a moment.

### Timing against speech
Measured against the Whisper word times:

- App tiles light on the first word of their phrase, 0 to 0.1 s before the noun: Shotcut 24.92 ("editing" 24.88), Draw.io 26.29 ("building" 26.28, "diagrams" 26.52), LibreOffice 28.13 ("working" 28.20).
- Command rows: first row arrives 9.90, 0.1 s before "commands" (10.00).
- End card: COMMENT 38.03 ("comment" 37.86, 0.17 s after); CLI 38.67 ("CLI" 38.14, 0.5 s late, the one loose sync); FULL GUIDE card 39.80 ("guide" 39.74); THE LINK card 40.60 ("link" 40.40, 0.2 s after).
- Layout cuts land 0 to 2 frames before the first word of a new idea: 1.53 ("If" 1.60), 6.07 ("This" 6.10), 11.85 ("So" 11.88), 16.72 ("You" 16.76), 23.16 ("The" 23.16), 30.13 ("But" 30.18), 32.50 ("Once" 32.50), 37.70 ("Just" 37.76). So each layout is one idea. Sentences inside an idea never cut.
- Captions swap on word boundaries with no fade (one frame), two to three words at a time.
- Check ticks land as the sentence ends: three ticks under "do your work" (11.08-11.54), four under "runs the commands" (15.72-16.31, every 200 ms), two under "jobs it can support" (22.22, 22.42), two under "connection again" (37.00, 37.23).

## 6. Pacing

- 8 layout cuts, so 9 segments: average 4.6 s, longest 7.0 s (23.16-30.13), shortest 1.5 s.
- About 30 graphic moves inside layouts (builds, zooms, activations, typing, checks), so a graphic change every 1.4 s on average. In the app-tile section the beats are 23.16 (cut), 23.3 (LibreOffice tile appears), 24.92 (Shotcut lights), 26.29 (Draw.io lights), 28.13 (LibreOffice lights, "69 apps in the repo"): gaps of 1.4 to 1.8 s. Longest stretch with no graphic change at all: about 2 s.
- Captions: two to three words each (163 words), about 70 swaps, roughly one every 0.6 s. The longest caption hold is about 1.4 s ("support." before the cut at 23.16).
- Something on screen changes at least every 1.4 s for the whole reel. Most of the time it is every 0.5 s.

## 7. Sound

- Speech is band-limited to about 19.5 kHz. The added sound effects are full band and show up cleanly above 20.5 kHz, which is how I separated them.
- 26 events above 20.5 kHz; 12 strong ones (40-65 dB above that band's floor): 11.08, 11.29, 11.54 (three checks), 15.72, 15.92, 16.11, 16.31 (four steps), 22.22, 22.42 (controls checks), 32.84 ("Built once" check), 37.00, 37.23 (last checks), 40.84 and 40.92 (THE LINK card lands).
- They are short ticks and clicks, 10 to 50 ms each. Every strong one lines up with a check mark or a card landing. Weaker ones at 0.37/0.44 s (opening tiles), 8.24 s (Shotcut card in), 12.55 s (cursor clicks "Crop Rectangle").
- No full-band sound on any of the 8 layout cuts: the band above 20.5 kHz is flat at every cut frame, and no sweep shows in the spectrogram there. The cuts look silent. A whoosh mixed below 19.5 kHz under the voice would slip past this test, so medium-high confidence.
- Music: in speech pauses the 60-140 Hz band drops only 3 dB while 500-4000 Hz drops 13 dB. So there is a quiet, bass-heavy bed under the voice, about -25 dBFS in pauses against voice peaks of -7 to -10 dBFS. I could not see a melody above 500 Hz. Medium confidence that this is music and not room tone or a low drone.
- I could not measure each tick's loudness against the voice without isolating it, and I did not listen. From the spectrogram they are thin, bright vertical lines, short enough that they read as a UI click rather than an effect.

## 8. What makes it work, and what is weak

Works:

1. One look, three fonts, one accent. Near-black `#0f0f0f` with frozen grain, cards `#1f1f1f` to `#282828` with a 1 px lighter border, white text, and a single green `#3ad8af` that only ever means "done". Nothing competes.
2. The graphics are real UI, not abstract cards. App icons, a connectors search with "No connectors found", a GitHub repo card with the real star count, a file tree, real CLI commands in mono with a mono label above. A tech viewer reads them as proof.
3. One canvas with a camera. The diagram grows downward (Shotcut code, then CLI-Anything, then commands, then Claude Code) and the camera zooms out (0.82x over 730 ms) to make room. The viewer always sees where the new piece sits in the whole.
4. Depth by blur. Old elements blur and dim instead of leaving (Move 2, Move 7). The past stays visible as context.
5. Status as motion. Spinner to green check with a tick sound, row border to green. Progress is shown, not said.
6. The caption has its own lane and its own font (pixel mono, caps, one line). It never collides with a card because each layout reserves a caption line: y=992, 842, 641 or on the TV at 426.
7. The head pops out of the window. Cutting the speaker out and layering his head over the window top (68 px above the edge) makes a flat split feel built for this video.
8. The TV caption. In full frame, the caption sits on the black TV behind him, so the room becomes part of the design.
9. The end card says what to comment and what you get: green pill "CLI", then two cards "FULL GUIDE" and "THE LINK", each rising on its word.

Weak:

1. Camera drift breaks the margins. At 15.0, 33.5 and 35-36 s cards run past the right edge or the top edge; at 36.8 s the stack is centred on x=388, not 360.
2. Inconsistent margins between scenes: 48 px for the window and big cards, 74 px for the two-tile row, 90 px for the three-tile row.
3. Dead space. In layout B there are 260 px of nothing between the panel (bottom 559) and the caption (842). In layout A the bottom 280 px are empty.
4. Small type. The chat-input text, the model chips and the "Chat / Cowork" buttons are 8 to 10 px tall, unreadable on a phone. They are texture, but they look like content.
5. The caption moves between four heights as layouts cut (992, 842, 641, 426), so the eye has to find it again after each cut.
6. Four layouts in 41 s with hard cuts and no sound on the cuts; the switch from rounded window to full-width gradient at 23.16 s reads as a change of template rather than a reason.

## 9. Ideas for a reel with no speaker on camera

These need no face:

1. One canvas with a camera. Build the argument as a single diagram that grows, and move a virtual camera over it: zoom out 0.8x over about 700 ms to show where the new part sits, then drift to it. This replaces the speaker as the thing that keeps the frame alive.
2. Blur the past, do not delete it. Push old elements back with blur and 50% brightness. It gives depth and memory on a flat dark stage.
3. Status changes as beats. Spinner to green check with a 10-50 ms tick, rows lighting one by one at 200 ms stagger. Each beat is a visual change and a sound, perfect for hitting the 2 s rule without a face.
4. Real UI as evidence. Repo cards with real stars, real commands in mono, real app icons, a file tree that checks itself. Voice-only reels need proof on screen; this is the proof.
5. A dedicated caption lane in a signature font. One line, two to three words, caps, at a fixed y (they use 992 when there is no speaker). With no face, the caption is the voice.
6. Active-state highlighting on the word. Dim the set to 50%, light the item when it is named (230 ms, lift 13 px, brand-colour border).
7. Typing as motion. A prompt typing at about 20 characters per second, then the system answering with commands. It shows a workflow without screen recording.
8. The end card: one word in a green pill revealed by a left-to-right wipe, then two reward cards rising on their words.

Not portable: the head breaking out of the window, and the caption on the TV, both need the speaker and his room.

## What I would take into Studio's reel style

- Fix one caption y per layout and keep it there. Prefer one caption y for the whole reel.
- 48 px gutter, one column 624 wide, centre x=360, inner elements step in by one fixed inset (about 36 px). Keep the camera inside the gutter (clamp it), unlike this reel.
- Two speeds: a 3-frame blur-in for small items, a 20-22 frame ease in-out with a soft tail for camera moves. No overshoot.
- Green only for "done".
