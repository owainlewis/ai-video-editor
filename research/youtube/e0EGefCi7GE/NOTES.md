# "It's Boring But These 8 AI Plugins Save You 10 Hours a Week" (studied 2026-11-26)

Jeff Su, 15:05, 16:9, 24 fps. Talking head plus screen recordings plus diagrams. Owain loves the graphics.

Frames: `sheet_*.jpg` (every 3 s, time stamped), `pan1.jpg` (0:19 to 0:33 at 2 fps), `pan2.jpg` (8:22 to 8:36), full frames `f_*.jpg`.

## Measured

- 204 picture changes in 905 s, median gap 2.6 s (scene detection, so builds inside a diagram count). 64 under 1 s, 47 of 1 to 3 s, 42 of 3 to 6 s, 50 over 6 s.
- Face alone on screen: roughly a quarter of the run. The rest is screen, diagram or his face in a corner.
- Eight items, each opened by a black title card: product icon, "PLUGIN: DATA" in condensed caps, "ITEM #1" in blue, about 2.5 s, with a 3D page-turn in.

## The four things that make it

1. **One canvas, a moving camera.** Each diagram is one wide white stage with a soft pink-lilac glow along the top. The camera drifts sideways from node to node as he talks, cards entering cut off at the frame edge, then pulls back to show the whole flow (pan1 0:03 to 0:10, pan2 0:03 to 0:13). Whip moves carry motion blur. Nothing cuts inside a diagram.
2. **Skeleton product cards with real logos.** Every card is a quiet white card with a hairline border: a small coloured pill label ("PLUGIN", "SKILL"), a title, grey bars for text, and the real logos (OpenAI, Claude, Gemini, Supadata, Google Meet, Zoom). One blue accent; red for failure (an X on a dashed line, red tags). Lines are thin grey elbows. A scanning blue bar sweeps a table, then the table becomes a chart.
3. **Screen recordings that are edited, not played.** Every screen shot is a framed window on a dark starfield with his face in a portrait card on the left. When he names a part, the page blurs and dims and that part lifts out with a thick yellow border and the key words in yellow marker (0:39, 1:51, 3:42, 13:21). Prompts type in and the important phrase is marked yellow. Long waits are a big fast-forward glyph.
4. **Mixed in, constantly.** Face, diagram, screen, b-roll of him at a desk, a meme, a phone mockup: no source holds more than about 10 s.

## Against our kit and rules

| His move | What we have | Verdict |
| --- | --- | --- |
| Skeleton cards, real logos, thin lines | `flow` nodes with `logo:` icons; skeleton cards already in PLAYBOOK (EGM study) | We have the parts. Missing: skeleton content inside a node (a doc, a table, a chat) |
| Camera travels one canvas, then pulls back | `flow` fits the whole graphic in the panel at once; RULES 2026-11-25 bans pans on reel pages | New. Fits YouTube diagrams, not reel pages. Needs Owain's call |
| Lift a paragraph off a blurred screen | `lift` (YouTube), `mark` | Have it. His is louder (yellow border, yellow marker); ours is calmer. Keep ours |
| Face in a portrait card over a framed screen | `side` puts the graphic left, Owain right | Close. His face is over the screen recording, which our "graphics only where Owain is on camera" rule allows since he is on camera |
| Black item cards with icon and "ITEM #N" | `chapter` with `hit: true` | Have it. Add the real product icon to the chapter card |
| Typed prompt, phrase marked | `claudeapp`, `cli` steps | Have it |
| Pink-lilac glow, blue accent | Ivory, light reel palette (green) | Do not copy. The look is locked |
| Memes, phone mockups, 3D page turns, fast-forward glyph | none | Does not fit (PLAYBOOK "Does not fit") |
