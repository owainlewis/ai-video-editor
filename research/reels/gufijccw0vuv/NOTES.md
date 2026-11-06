# gufijccw0vuv: minimal and faceless

Owain sent it on 2026-11-06 as "overly minimal but powerful because it's completely faceless with audio voiceover". 163 s, 720x1280, -14.2 LUFS (LRA 3.5).

Read `overview-01.jpg` (a frame every 2 s), `f47.png` (one frame at full size) and `motion-20.jpg` (10 fps for 2 s).

## What it is

- **Pure black, white lines, nothing else.** No colour at all. Thin white outlines (circles, boxes, doc pages), white dots, small sans labels. A faint field of dots drifts behind everything.
- **No cuts.** Scene detection finds none, even at a low threshold. The picture is one diagram that keeps changing: the same circle (the audience) holds for about 40 s while dots, rings and labels come and go in it. A new idea grows from the last one rather than replacing it.
- **Three kinds of text, each in one place:**
  - a bold sans header at the top (y 245 on 720x1280, about 36 px), centred, which changes per beat with a short fade;
  - small sans labels (about 22 px) inside the diagram, naming its parts in the speaker's words ("Everyone who might buy", "Who your ads convert");
  - one spoken word at a time in a serif (about 30 px, lowercase as said) low in the frame (y 970). Small, calm, not a shouting caption.
- **Motion is slow and quiet.** Labels fade in over about 0.3 s, dots appear in waves, rings scale, lines draw on. Nothing bounces.
- **Numbers count on the word that says them**, with a line chart drawing under them.
- A small brand mark above the header on every beat.

## Why it works

- The diagram is the argument. Each beat adds one part to a picture the viewer already understands, so the viewer never has to re-read the frame.
- With no face and no footage, there is nothing to look at but the idea, and the voice carries the pace.
- The serif word caption is quiet enough to sit under the diagram without competing with it.

## What we take

Helvetica bold header, Signifier word caption, line diagrams on black, one diagram that builds per beat. Sage is our one addition, for the part that matters. Built as sample 1 in `effects/clean/Minimal.tsx`.
