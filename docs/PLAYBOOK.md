# Editing playbook

What professional edits do, and which of it fits Owain. Studied 2026-10-25 from four references:
Kallaway, "8 tips for growing faster on social media" (24 min); Sam Gaudet, "10M follower personal
brand system" (22 min); a Matt D'Avella-style video on time management (12.5 min); Dan Martell,
"Copy This Strategy to 10X Your Business Fast" (26 min). Plus two 30 s product promos (Ultramock,
XFastest): pure motion design, no hard cuts. RULES.md wins over anything here.

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
| **Progress map**: all sections as numbered marks, done ones ink, current one accent, future ones faint | Gaudet 0:16, 4:26 | `chapter` with `hit: true` and `of: N`: a journey track, the marker travelling to this stop; `journey` card for the promise | done |
| **Quote card that types in sync** with Owain reading a source, ghost text behind | D'Avella 4:50 | `quote` with `sync: true`, full frame (`media`) | done |
| One flat visual metaphor per idea (two circles, a waffle week) | D'Avella 2:06, 6:15 | existing `stat.waffle`, `compare`; one per video, on camera | use |
| Myth, then truth: "the popular advice" card, then the counter-claim | Kallaway 0:50, 0:59 | a `compare` pair or two `over` titles | try |
| Act break: half a second of silence, then a low hit into section 1 | Gaudet 0:22.7, D'Avella 1:14 | a plan-level pause before the first chapter card, `impact` sound | try |
| Montage of many examples, 2 to 3 frames each ("everyone says this") | D'Avella 0:02, 3:24 | needs real captures; only with sources | later |
| Quiet music bed, changes per section | Gaudet, D'Avella | `music` on, -20 dB under voice, one track per section | ask Owain |
| Music under the hook only, dropped at the first chapter card, so the body is just voice | Martell 0:37 | `music` for the intro, stopping at chapter 01 | ask Owain |
| Thesis sentence full frame with one word in the accent | Martell 3:28, 4:04 | a full-frame `title` (Signifier, one `*accent*` word), hard cut, 2 to 4 s | try |
| Rows added to a card in the empty wall beside his head, one per spoken item, instead of cutting away | Martell 2:52 | a `list` or `checklist` over `full`, in the empty side of the frame, on camera | try |
| Kinetic type: a short line centred, words landing as said, a full stop in the accent | promos (XFastest 0:00, Ultramock 0:04) | `title` with `sync: true` on `media` | done |
| Real UI in perspective, settling flat: the screen recording enters as an object | promos (Ultramock 0:01, XFastest 0:24) | tried as `present`; Owain did not like it | rejected |
| Flat line, then a sudden spike to a value pill | XFastest 0:07 | only with real data points, never an invented shape | later |
| Colour-field wipe for the payoff (a circle floods the frame) | XFastest 0:19 | conflicts with hard cuts; ask | ask Owain |
| Strike-through for a reversal ("~~solve the problem~~, being busy") | Martell 0:55 | a word struck out in an `over` title | later |

## The motion lab (2026-10-25): all six approved, all in the library

Studied Ben's Claude Code review frame by frame (one persistent stage, two speeds, 80 ms staggers, a
second beat on the word), built six directions on real moments (`effects/Lab.tsx`), and Owain approved
all six ("I love them all"). Where each lives now:

| Direction | Use it when | Plan |
| --- | --- | --- |
| Chapter, polished | each section start | `media`, `chapter` with `hit`, `of: N`, a `*marked*` phrase in `label` |
| Stage | a graphic while Owain is on camera | `side`: he shrinks into a portrait card, the graphic builds beside him, he grows back |
| Odometer | numbers said in sequence ("from 2,500 to 30,000, a 12x increase") | `media`, `odometer` with `steps` and a `result` |
| Focus lift | he talks about a specific paragraph on a screen recording | `media`, `lift` with `region` and `mark` measured on a frame, `from`/`to` words |
| Kinetic + highlighter | his strongest line | `media`, `title` with `sync`, the key phrase `*marked*`; `//` to choose the line break |
| Flow with a traveller | a process in stages | `pipeline`: connectors draw to each stage with a dot riding the tip |

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

## Reels references (2026-10-25)

**Nick Saraev, Agency Agents.** Speaker in a rounded window under a framed graphic, two-tier hook title, real GitHub pages in browser frames with highlights, a star counter rolling over the real Star button, the agent's own email typing in a mail window, a Claude Code board of agent cards, an orchestrator pipeline with queued and running pills, a chip cloud of real agent names. Something new about every 1.5 s. Built as `compose`, `divisions`, `chips`, `runs` (our palette, not his blue); see `projects/agency-agents`.

**Google Pomelli reel (25.7 s).** About 10 cuts, but inside each shot something changes about every 1 s. The speaker appears only in the hook (0 to 2 s) and the CTA; the middle is Google's own 16:9 launch video in a letterboxed box on a flat background that flips white and dark per section. Worth borrowing:
1. Real vendor footage letterboxed on a switching background: pace from real UI without drawing any.
2. A big headline stacking word by word above the media, on the spoken words, one per section.
3. A premium hook: the brand mark (the real one, never redrawn) glowing in, a serif title typing letter by letter.
Also seen: a zoom-blur entrance on the speaker, serif words on depth layers in front of and behind a UI card, a warm gradient wipe between sections, a tilted phone with floating stickers, cards dealt into a row, one- or two-word captions in a dark rounded pill.

## Five reels studied (2026-10-25)

Agency Agents (Nick Saraev, 42 s), 5 MCP servers (faceless, 57 s), Cloudflare security-audit-skill (Prince Gupta, faceless, 48 s), 5 Claude connectors (David, 54 s), Triple Loop storytelling (coach, 82 s).

**Pacing.** Hard cuts are not the measure: shots average 3.8 to 5 s, but inside every shot something changes every 0.5 to 1.5 s (a word, a row, a pill flipping, a push-in, a tick). The longest still moment in any of them is about 2 to 3 s. Our 2 s rule matches the best of them.

**What they share.**
- One persistent idea per section with a visible state change: queued to running to passed, Connect to Connected, a bar filling, a counter climbing.
- Real proof plus a big number: a frosted stat badge over the real (blurred) page, an outline drawing round the real Star button and a badge springing out of it.
- Hubs: a centre mark with spokes drawing out to logos or agents, each getting a tick.
- Captions are small (about 4% of height) or in a dark pill; the key word switches to serif italic or a coloured accent. One shows a Figma-style selection box with corner handles round the key word.
- The ending is an Instagram mock: Follow clicks to Following, the keyword is typed into comments, a DM notification drops in with the link.
- Speaker time ranges from 0% (faceless) to 100% (split for most of it).

**Ideas worth building, best first.**
1. **Stat badge over the real page** (Agency Agents 13.5 s): blur the capture, drop a frosted card with an odometer in it. Proof and wow in one.
2. **Before and after stopwatch** (connectors 44.5 s): the slow way's timer climbs in red, then resets to a green 0:01. Fits any "tool X replaces chore Y" line.
3. **Timeline metaphor** (storytelling 25 to 58 s): a video scrubber with pins, a magnet pulling a viewer along, segments filling in colour. Carries 10+ s of change; fits latency, tokens, build steps, an agent run.
4. **Radial hub wire-up** (MCP 44 s): logos in a ring, spokes drawing out in turn, ticks popping.
5. **Persistent progress footer** (security 14.5 to 32 s): a "phase 3 of 6" card stays put while the hero card above swaps, so the viewer always knows where they are.
6. **Verifier handoff** (security 24 s): a dashed arrow draws to a new node, a checklist answers row by row, ends on a green verdict.
7. **Instagram CTA mock**: Follow click, typed keyword comment, DM notification.
8. Smaller: selection-box caption accent, hand-drawn red circle on a key number, "no API" stamp, magnifier loupe over a UI row, neon line draw-ons, grid cascade lighting outward from a centre, blur transitions between scenes, curved-screen warp on terminals, tilted poster wall.

**Watch out.** The Agency Agents reel's badges say 282 and 163k while the voice says 200 and 160k. Our rule holds: the number on screen matches what is said, or the note says why.
