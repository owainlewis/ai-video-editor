# Editing playbook

What professional edits do, and which of it fits Owain. Studied 2026-10-25 from four references:
Kallaway, "8 tips for growing faster on social media" (24 min); Sam Gaudet, "10M follower personal
brand system" (22 min); a Matt D'Avella-style video on time management (12.5 min); Dan Martell,
"Copy This Strategy to 10X Your Business Fast" (26 min). RULES.md wins over anything here.

## What all four do

1. **A visible spine.** One recurring device marks every section, so the viewer always knows where
   they are and what is left. Kallaway spins a branded carousel to the next tip; Gaudet returns to a
   map of 8 folders (done ones lit, the current one active, future ones greyed and pixelated);
   Martell refocuses a map of 5 numbered cards on the current one at each "Step N".
2. **Every graphic lands on its words.** Text builds word by word as it is said; list items, nodes
   and stats arrive on their phrase. Nothing appears early.
3. **Graphics on the key line only.** Kinetic text appears on the payoff phrase of a sentence, not on
   every sentence. None of them caption the whole talk.
4. **One family of looks.** Each video has one palette and one or two fonts used everywhere
   (Kallaway purple glass; Gaudet blue/red caps; D'Avella small lowercase monospace on paper).
5. **Sound sits under the voice.** Effects land on graphic entries and cuts, 5 to 10 dB under the
   voice, never louder: about one per graphic beat (Martell: one soft swish per node or row). Music
   changes at section boundaries; Martell runs it under the hook only and drops it at chapter 1.
6. **Act breaks.** A moment of silence or black, then a low hit, before the first section or a
   montage (Gaudet 0:22.7, D'Avella 1:14).

## Fits Owain (calm, Ivory, hard cuts)

| Trick | Seen in | How it would work here | Status |
| --- | --- | --- | --- |
| Chapter card at each section | all three | `chapter` with `hit: true` | done |
| Hero number full frame with a riser | Gaudet 0:01 (counter + tick + riser) | `stat` with `hit: true`, `"sfx": "riser"` | done |
| **Progress map**: all sections as numbered marks, done ones ink, current one accent, future ones faint | Gaudet 0:16, 4:26 | `chapter` with `hit: true` and `of: N` | done |
| **Quote card that types in sync** with Owain reading a source, ghost text behind | D'Avella 4:50 | `quote` with `sync: true`, full frame (`media`) | done |
| One flat visual metaphor per idea (two circles, a waffle week) | D'Avella 2:06, 6:15 | existing `stat.waffle`, `compare`; one per video, on camera | use |
| Myth, then truth: "the popular advice" card, then the counter-claim | Kallaway 0:50, 0:59 | a `compare` pair or two `over` titles | try |
| Act break: half a second of silence, then a low hit into section 1 | Gaudet 0:22.7, D'Avella 1:14 | a plan-level pause before the first chapter card, `impact` sound | try |
| Montage of many examples, 2 to 3 frames each ("everyone says this") | D'Avella 0:02, 3:24 | needs real captures; only with sources | later |
| Quiet music bed, changes per section | Gaudet, D'Avella | `music` on, -20 dB under voice, one track per section | ask Owain |
| Music under the hook only, dropped at the first chapter card, so the body is just voice | Martell 0:37 | `music` for the intro, stopping at chapter 01 | ask Owain |
| Thesis sentence full frame with one word in the accent | Martell 3:28, 4:04 | a full-frame `title` (Signifier, one `*accent*` word), hard cut, 2 to 4 s | try |
| Rows added to a card in the empty wall beside his head, one per spoken item, instead of cutting away | Martell 2:52 | a `list` or `checklist` over `full`, in the empty side of the frame, on camera | try |
| Strike-through for a reversal ("~~solve the problem~~, being busy") | Martell 0:55 | a word struck out in an `over` title | later |

## Needs Owain's call (conflicts with a rule)

- **Annotate the screen recording**: a hand-drawn circle or highlight on the exact word in the article
  or app, with a small push-in (Gaudet 0:56, 3:44). Strong for proof, and Owain's videos are half
  screen recording, but RULES.md keeps graphics off screen recordings. An annotation is not an
  infographic, so ask.
- **Proof in the first 10 seconds** (Gaudet's counter, Kallaway's morphing badge). Owain does not want
  credential stats. The source's own number (the 12x) already does this job.
- **Punch-ins every few seconds** (Kallaway reframes on every cut). Studio's punch-ins changed the colour;
  they would need cropping the original with ffmpeg, not re-rendering it.

## Does not fit

Glowing 3D carousels, navy glow backgrounds, stock founder cut-outs, phone mockups of posts, two-tier glowing caps captions, light-leak and smoke
wipes, blur dissolves, stock and TV clips. Loud, branded and busy; Owain's notes all point the other way.

## Numbers to aim for (YouTube, talking head plus screen)

- Something changes every 10 to 20 s in the body (cut, graphic, card); every 2 to 4 s in the first 30 s.
  The references run 3 to 20 changes a minute in the body; their intros 5 to 42.
- Sound effects: one per graphic entry at most, about -8 dB under the voice. No effect on every cut.
- A graphic holds for its clause: 2 to 8 s.
