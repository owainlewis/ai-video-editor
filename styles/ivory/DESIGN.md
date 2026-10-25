# Ivory: design spec

The house style, and the only one (Owain, 2026-10-22). Warm off-white and pine green, after Tom Noske's reels but deliberately not a copy (see `references/reels/noske-*`), with Kallaway's bare curve charts. It shares Blueprint's card catalog; `tokens.ts` and the `look` switches restyle it.

## Palette

- Paper `#F4F1EA`: a warm off-white, a touch brighter than Noske's, never pure white.
- Pine `#213B34`: the accent on paper. Deeper and cooler than Noske's teal-green.
- Forest `#192E28`: dark scenes. Darker than the pine, so scenes read deeper than Noske's.
- Graphite `#1B1B1A`: the dark theme on YouTube (2026-10-25). A warm near-black a little darker than Owain's wall; the accent stays sage.
- Ink `#1A2622` (green-black) on paper.
- Text on green and on footage is a near-white warm `#F7F3EC` (Owain: "a bit more white"). Accent words on green are `#E9EFEA`.
- The splash on green (dots, lines, chips) is a soft sage `#B7CDBF`, where Noske uses a peach.
- No blue, no orange, no glow, no gradients.

## Type

Helvetica and Signifier, always (Owain, 2026-10-22).

- **Headlines, headers and titles:** bold Helvetica Neue, set tight, with one Signifier italic accent word.
- **Keyword captions and chapter words:** Helvetica Neue 800, lowercase, tight. A caption's accent word changes colour only.
- **Signifier italic:** the one phrase that matters, in a stacked emphasis (about once a section) or an accent word.
- **Labels, axes and numbers:** small Helvetica, tracked when uppercase. No mono.
- **Big numbers** (hero stat, chapter cards, stat cards): Helvetica bold, set very tight. The line under a big number is Signifier italic, muted (Owain, 2026-10-25).
- **The accent word** in a bold Helvetica title is set about 1.2x larger, so it does not read small and light.
- **Quotes:** Signifier upright; they are someone's voice.

## Layout

- One big thing per beat. If a graphic needs a card, a list of five rows and a header, it is two beats.
- No card chrome. Cards are the paper with a hairline, no white box and no shadow.
- No grid. The space is the design: wider margins (110 px) and more padding (56 px) than Blueprint.

## Signature moves

- **Keyword captions:** one heavy lowercase word at a time on the speaker's chest, up to 170 px, fitted to the width. An accent word is set in Signifier italic.
- **Focus-stack chapters:** a huge Signifier italic numeral held soft and blurred, high and right, bleeding off the frame. One sharp heavy word sits left on the margin under a short sage rule. Both drift slowly at different speeds. Off-centre on purpose: Noske centres his.
- **Bare charts:** two thin axes, a smooth curve that draws itself, dots landing on the spoken points. Real numbers with a source, or "Illustration".

## Motion

The motion system (2026-10-25, from Ben's edit and the motion lab; code in `effects/motion.tsx`):
- **Two speeds.** Content arrives in about 180-250 ms out of an 8 px blur with a small rise, on the expo-out curve (quick start, long soft settle). Anything that moves through space (the speaker card, a lifted paragraph) takes 460 ms on a slow-fast-slow curve with a long tail. Nothing bounces or overshoots.
- **Tight staggers.** Elements that arrive together land 80 ms apart: label, title, rule.
- **A second beat.** After a card settles, or as the words are said, one small thing happens on the spoken word: a sage highlighter sweeps behind the key phrase, a connector draws to the next stage with a dot riding its tip, digits roll.
- **No jumps inside the stage.** The speaker shrinks into a portrait card and grows back rather than cutting to a window; a paragraph lifts off the page and settles back.
- **A living background.** The graphite canvas drifts about a pixel a second.
- Sound follows motion: a soft whoosh on a move, a click on a highlight, ticks while digits roll, a riser into a result.

## What not to do

- No glow, gradients, neon, particles or 3D.
- No fonts other than Helvetica and Signifier.
- No white cards with shadows: that is Blueprint's look.
- No extreme close-ups. Nothing touching a card edge.
- No colour grading or voice processing: Owain does both in Final Cut.
