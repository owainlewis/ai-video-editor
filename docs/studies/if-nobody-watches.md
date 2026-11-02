# Study: "If nobody watches your videos do this"

A 5:17 YouTube video (about 1M views, known for its editing), from George Alexander's channel (his channel page shows at 4:27). Studied 2026-11-02 for planning Owain's graphics. RULES.md and the house style still win over anything here.

How it was measured: word times from Whisper (large-v3-turbo); cuts from ffmpeg's per-frame scene score (local peaks, each one checked on a before and after frame); one frame a second read on contact sheets, plus frames every 0.2 s around each graphic; loudness with ebur128 and 50 ms levels. Everything below was seen or measured unless it says "guess".

## The short version

- **The face comes late.** The first shot of him talking to camera is at 1:08.6. The whole hook is acted b-roll, real screens and voice-over.
- **About 130 cuts in 5:17**: a median shot of 2.2 s. Fast at the start (33 cuts a minute in the hook), slower later (18 a minute in part 3).
- **Half talking head, half b-roll.** Talking head 41%, b-roll 42%, screens 10%, full-frame cards and text 5%, other creators' clips 2%.
- **The graphics are few and each one carries a key line**: about 15 text moments in 5 minutes, all on the words being said.
- **Three ideas carry it, and each gets a picture**: the doubts (kinetic text), "create like an artist, study like a scientist" (paper words), "change the story you tell yourself" (two of him side by side).

## The numbers

| Measure | Value |
| --- | --- |
| Length | 5:17.2, 3840x2160, 25 fps |
| Cuts | about 131 (detector count, checked by eye; a few are steps in a screen move, a few soft cuts may be missed) |
| Shot length | mean 2.4 s, median 2.2 s |
| First 30 s | 16 cuts, 32 a minute, median shot 1.8 s |
| After 30 s | 115 cuts, 24 a minute, median shot 2.2 s |
| Talking-head shots | 34 shots, median 3.2 s, longest 9.8 s |
| First face to camera | 1:08.6 |
| Chapters | 0:53 "part 1 / the Switch", 2:18 "part 2 / the Story", 3:35 "part 3 / Finding your North Star" |

Cuts a minute by section:

| Section | Time | Cuts a minute | Median shot |
| --- | --- | --- | --- |
| Hook | 0:00 to 0:53 | 32.7 | 1.7 s |
| Part 1, the Switch | 0:53 to 2:18 | 29.5 | 1.9 s |
| Part 2, the Story | 2:18 to 3:35 | 22.0 | 2.7 s |
| Part 3, North Star, and the close | 3:35 to 5:14 | 18.2 | 2.6 s |

Share of time (by shot, from the contact sheets):

| What is on screen | Seconds | Share |
| --- | --- | --- |
| Talking head to camera | 130 | 41% |
| B-roll (acted scenes, hands, room, desk) | 132 | 42% |
| Screens (YouTube Studio, search, Photoshop, his channel) | 31 | 10% |
| Full-frame cards and full-frame text | 17 | 5% |
| Other creators' clips | 7 | 2% |

## The hook (0:00 to 0:53)

No talking head at all. The first 16 s have no voice: only music under pictures.

| Time | On screen | Said | Why it holds |
| --- | --- | --- | --- |
| 0:00.0 | Black, silent for 0.5 s | nothing | A clean start; the music enters at 0:00.5. |
| 0:00.5 | A ceiling fan's shadow on a concrete wall, a small label "2:37am" in the centre ([frame](if-nobody-watches/01-cold-open-0m01.jpg)) | nothing | Sets the feeling (up late, can't sleep) with one prop and three characters of text. |
| 0:03.0 | Top-down: him slumped on a sofa; at 0:05.7 a cut to him at a laptop | nothing | A person and a mood before any claim. |
| 0:07.5 | Close-ups of real screens: typing "youtube", opening YouTube Studio, then "Your channel has had 7 views so far", 0 hours, 1 subscriber, $0 ([frame](if-nobody-watches/02-real-analytics-0m09.jpg)) | nothing | A real, painful number. The viewer recognises their own dashboard. Three cuts in 4.5 s. |
| 0:12.0 | His face in the dark, lit by the screen | nothing | The reaction to the number. |
| 0:14.9 | Typing "why am i getting no views" into YouTube search, the autocomplete below ([frame](if-nobody-watches/03-search-typing-0m15.jpg)) | nothing | The viewer's own search, probably how many of them found this video (guess). |
| 0:16.6 | Clips of other YouTubers, then a 3D YouTube logo over a collage of thumbnails, about 1.1 s each | the others repeat that the algorithm has changed | The noise the viewer has been hearing. Loudest moment so far (about -11 dBFS). |
| 0:21.2 | Back to him on the sofa | 0:24.3, his first words: one bad upload and you question everything | The narrator names the feeling. Small serif captions start here ([frame](if-nobody-watches/04-hook-caption-0m26.jpg)). |
| 0:29.9 | The fan shadow again | "questioning everything" | A callback to the first shot, 29 s later. |
| 0:30.0 to 0:37.9 | Four "Maybe ..." doubts, each in a new place (balcony, mirror, kitchen, cereal bowl from above). Three of the four cuts land about 0.1 s before the word "Maybe" (the other 0.2 s after, by Whisper's times). Words fade up from a blur one at a time; the key word is big and red ([frame](if-nobody-watches/05-doubt-saturated-0m31.jpg), [frame](if-nobody-watches/06-doubt-stack-0m36.jpg)) | the four doubts: too saturated, the algorithm hates me, not talented, wasting my time | A rhythm (four lines, same shape, about 1.9 s each) and the viewer's private thoughts said out loud. |
| 0:37.9 to 0:52.4 | Him at a dark window, the analytics again (0:42.2), head in hand, packing up the camera, walking out of the door | doubts start making decisions; you judge the whole journey by the first steps | A small story of quitting, then the promise of the reframe. |
| 0:53.2 | Chapter card, "part 1" then "the Switch" | nothing (music only) | A break and a map: the video has parts. |

Why it works, in short: it opens on the viewer's situation, not the speaker. Every beat is a concrete object (a time, a number, a search query) and the first claim comes after 24 s of recognition.

## Every graphic and edit move

Words are paraphrased. "Hold" is how long it is on screen.

| Time | Words said (paraphrase) | What appears | In and out | Hold | Job |
| --- | --- | --- | --- | --- | --- |
| 0:00.5 | none | "2:37am", small cream sans, centre | with the shot, out on the cut | 2.5 s | set the scene |
| 0:07.5 | none | real YouTube Studio close-ups, soft and grainy, pushed in on the number | hard cuts | 4.5 s | prove the problem |
| 0:14.9 | none | the search box typing the question | typing, hard cut out | 1.7 s | relate |
| 0:16.6 | others: the algorithm changed | other creators' clips, a 3D YouTube logo on a thumbnail collage | hard cuts every ~1.1 s | 4.6 s | pace, the noise |
| 0:24 to 0:52 | the hook's voice-over | captions: one short phrase at a time, small serif, cream, low centre (cap height about 3% of the frame) | phrase swaps | whole hook | readability over b-roll |
| 0:30.0 to 0:37.9 | the four doubts | white wide caps fading up word by word, key word in big red script, partly hidden behind him; last one stacks one word per line beside a cereal bowl | cut on "Maybe", words on their own word | ~1.9 s each | emphasise |
| 0:42.2 | when nobody watches | the "7 views" screen again | hard cut | 1.6 s | prove, callback |
| 0:53.2 | none | "part 1" (small) on flat green, then "the Switch" (big serif, a small script "the" above) | "part 1" hard in, swaps to the title at 0:54.3, film burn out at 0:55.4 | 2.4 s | structure |
| 0:55.5 | I get invested in every video | camera viewfinder frame (REC, 4K, FPS 60) over b-roll of him setting up | hard cuts | 5 s | decoration |
| 1:00.8 to 1:08.6 | hours on the script; moving the camera 20 times; hours on the edit | one shot per clause: writing from above; the room with five copies of him and his camera ([frame](if-nobody-watches/09-clones-1m05.jpg)); an editing timeline laid over his face | hard cuts on each clause | ~2 to 3.5 s each | explain, joke |
| 1:08.6 | (first talking head) | light leak into his face | light leak | | |
| 1:13 to 1:18 | then you have to upload | upload screen, "Uploading 91% ... 100%" | hard cuts | 3 s | show |
| 1:20.6 | reduced to numbers on a screen | real channel and video analytics (45 subscribers, 23 views, 4.7% CTR) | hard cuts | 3 s | prove |
| 1:29 to 1:39 | create things you're proud of | hands write words on paper, cut them out, lay them on a green cutting mat, top-down | stop-motion of real paper | 10 s | emphasise, craft |
| 1:39 to 1:41 | the second it is uploaded | the "Save" click | film burn in | 2 s | show |
| 1:47.1 | create like an artist, study like a scientist | paper strips placed by hand, one word as each is said; "artist" in coloured letters, "scientist" underlined ([frame](if-nobody-watches/10-paper-words-1m50.jpg)) | each strip lands on its word | 4.6 s | the thesis |
| 1:51.7 | look at it like data | his own video on the YouTube watch page | light leak in | 2.3 s | show |
| 2:00.5 to 2:06.4 | you test an idea, a title and thumbnail, a style | one shot per item: the room relights teal and "THE DEAD ZONE" sweeps in behind him; Photoshop with a real thumbnail; a walking vlog in a viewfinder frame | hard cuts on each item | ~2 s each | explain |
| 2:18.5 | what about 20, 30, 40 videos | "part 2" on teal, then "the Story" | film burn in, light leak out | 2.8 s | structure |
| 2:29.4 | I've been through that myself | his analytics, 101 views, the cursor moving across days | film burn in | 2.9 s | prove |
| 2:35.4 | change the story you tell yourself | paper strips again, "story" underlined in green | strips on their words | 3.8 s | emphasise |
| 2:39.2 to 3:05 | two creators, same situation, two stories | two of him at one counter (one sad, one writing), then alternating scenes of each | hard cuts per sentence | ~25 s run | explain |
| 3:09.0 | which one grows? | the same twin shot with a "Subs:" pill over each head: left creeps 3 to 7, right counts 14,620 to 59,064 ([frame](if-nobody-watches/11-two-creators-3m10.jpg)) | pills present on the cut, numbers tick | 3.7 s | answer the question (numbers never said) |
| 3:23 | not believing in your own work | him seen through a round hole in a bookshelf | hard cut | 3 s | mood |
| 3:28 to 3:33 | learning, experimenting, improving | behind the scenes: light, camera, a viewfinder frame over his talking head | hard cuts | 5 s | light joke |
| 3:35 | one final question | "part 3" on oxblood, then "Finding your North Star" | light leak, film burn | 3.9 s (with voice over it) | structure |
| 3:38.8 | the question itself | his talking head blurred hard; the question types on in a handwriting font, word by word with the voice, "one thing" in mint ([frame](if-nobody-watches/12-typed-question-3m42.jpg)) | each word on its word, film burn out | 4.7 s | emphasise the turn |
| 3:54.7 | money or clout | him scrolling a phone on the sofa | hard cut | 3.3 s | show |
| 4:05.5 | when the views are not there yet | the hook's "7 views" screens again | hard cuts | 2.8 s | callback |
| 4:10.6 | your North Star | "Your" writes on in white script, "north star" in a big serif behind his head ([frame](if-nobody-watches/13-north-star-4m11.jpg)) | writes on with the word | 1.4 s | name the idea |
| 4:15.7 | creators where I was | three webcam clips of other people in a window on flat green, about 0.7 s each (guess: his community or students) | film burn in | 2.1 s | show who it is for |
| 4:27.3 | why this channel is where it is | his channel page, then his thumbnail grid scrolling | hard cuts | 5.5 s | proof |
| 4:41 to 4:49.5 | write down one question | b-roll of him writing; an insert of the question in handwriting, written as it is said | hard cuts | 8.5 s | action |
| 5:10.2 | the CTA | the talking head pushed left as black comes in from the right | slide | 3.6 s | end screen space |
| 5:13.8 | (music only) | "watch this video next :)" in handwriting with an arrow, dark teal ([frame](if-nobody-watches/14-end-card-5m15.jpg)) | light leak in, fades | 3.3 s | CTA |

## Camera

- **One main talking-head set-up**: medium shot, him centred, a deep living room behind (plants, framed prints, warm lamps), shallow depth of field.
- **Jump cuts between framings.** Inside talking-head runs the shot changes size or position every few seconds (median talking-head shot 3.2 s). By eye there are two or three sizes, about 1.1x to 1.3x apart (guess; not measured). There is no slow zoom inside a shot.
- **B-roll angles change on every cut**: top-down (sofa, desk, cutting mat), wide room, over the shoulder onto the laptop, close hands, a porthole frame, a mirror. Five distinct rooms appear.
- **Visual tricks done in camera**: two of him in one frame (2:39, 3:09), five of him in one room (1:05), a room relit from warm to teal in one shot (2:00).
- No talking-head shot runs over 10 s.

## Text on screen

| Use | Font (described) | Size | Colour | Motion |
| --- | --- | --- | --- | --- |
| Hook captions (0:24 to 0:52 only) | a book serif, upright and italic | small, cap height about 3% of the frame, low centre | cream | phrase swaps |
| Doubt lines (0:30) | wide geometric caps (Montserrat-like) with a soft glow; the key word in a bold red script | caps about 5% of height, key word about 17% | white, red | each word fades up from a blur on its word; key word partly behind him |
| Chapter cards | a soft, chunky retro display serif; a small handwritten script word above | "part N" about 5%, title about 11% | cream on flat green, teal and oxblood | hard swap from "part N" to the title, film burn or light leak out |
| Paper words (1:47, 2:35) | real handwriting on paper strips | about 5% | black ink, one word in colour | placed by hand on each word |
| The question (3:38) | a handwriting-style font, monospaced feel | about 4.5% | white, two words in mint | types on word by word with the voice |
| "Subs:" pills (3:09) | plain sans, bold label | small | white on a grey rounded pill | numbers tick |
| "Your north star" (4:10) | white script plus a high-contrast serif | about 18% | white | the script writes on |
| End card | handwriting with a drawn arrow | small | white on dark teal | fades |

No captions after 0:53. No lower thirds. No name title. Every text moment except the captions is on a key line, not on every sentence.

## Transitions

- **Hard cuts are the default**: about 105 of 131.
- **Light leaks and film burns on about 25 cuts**, almost all where the kind of picture changes: b-roll back to his face, into and out of chapter cards, into a screen. Inside a run of one kind the cuts are hard.
- One push: the talking head slides off to the left for the end screen (5:10).
- Cuts tend to land just before the first word of a sentence (three of the four "Maybe" cuts sit about 0.1 s before the word).

## Sound (as far as measurable)

- **Loudness**: -17.0 LUFS integrated, loudness range 3.2 LU (very even). This is a YouTube download, so the original master may differ.
- **A music bed runs the whole video** (inferred: between words the level never falls below about -48 dBFS, and in the hook not below -30; a dry voice track would drop much lower).
- **Music only for the first 16 s.** Silence for 0.5 s, then music at about -28 dBFS, rising to about -16 by 0:10.
- **The bed is loud in the hook and low in the body**: in the hook the floor between words sits about 8 to 12 dB under the voice; in the talking-head body about 20 to 30 dB under (voice median about -17 dBFS, floor -35 to -48).
- **A drop, then a hit, at every chapter card**: the level dips for about 0.3 s just before the card (0:52.1 to 0:52.8 at -30 dBFS, 2:18.2 at -36, 3:34.6 at -44), then jumps to about -11 dBFS on the card.
- Whooshes on the light-leak cuts could not be measured over the voice (no clear difference from hard cuts).
- The music fades over the last 3.3 s, from -19 to -53 dBFS.

## Pacing patterns

1. **Recognise, then reframe.** 53 s of the viewer's situation before any advice.
2. **One picture per clause in a list.** Three examples said, three shots, each cut on its clause (1:00, 2:00).
3. **Parallel lines get the same shape.** Four doubts, four shots of the same length, the same type treatment.
4. **Each section's idea gets one big text moment**: the doubts, the paper thesis, the paper story line, the typed question, the North Star name.
5. **Receipts on the claim line.** Real analytics appear exactly when he claims he has been there (1:20, 2:29, 4:05, 4:27).
6. **Callbacks.** The fan shadow (0:00.5 and 0:29.9) and the "7 views" screen (0:09, 0:42, 4:05).
7. **Sections slow down.** 33 cuts a minute in the hook, 18 in the last part. The talk carries more as trust builds.
8. **Chapters every 80 to 100 s** (0:53, 2:18, 3:35), each with a dip and a hit.

## What Owain can take

Owain's videos are mostly screen recording with stretches on camera, and Studio only adds graphics where he is on camera (plus full-frame `media` cards). So the moves below are the ones that work as graphics, not as shot b-roll.

1. **Open on the viewer's problem as a real object (0:07 to 0:16).** Before his first claim, show the thing the viewer has seen: the real error, the real search, the real number. In Studio: a first `media` card of 2 to 4 s, a `search` typing the viewer's question (built for reels; check it on the youtube canvas), or a `lift` on the real number in his own screen recording. Only real artefacts.

2. **The doubt stack: parallel lines land as one card (0:30 to 0:37).** When Owain says three or four lines of the same shape (myths, objections, "you might think"), each line lands on its first word, the key word in the accent. In Studio: one `side` card that stacks the lines (`list` with each item `at` its first word), or one custom graphic, key word in Signifier italic sage. One card that grows, not four full-frame cards in a row (RULES: no cards back to back). About 2 s a line.

3. **One picture per clause in a spoken list (1:00 to 1:08, 2:00 to 2:06).** Three examples said, three things arrive, each on its clause. In Studio: `side` with `steps` or `list`, items `at` each clause. Draw each item as a small picture of the thing (a script page, a camera, a timeline) in a custom graphic rather than a text row, per "Design per video".

4. **The thesis built word by word, twice per video at most (1:47, 2:35).** The line that names the idea, set as he says it, one word marked. In Studio: `media`, `title` with `sync: true`, the key word `*marked*`. A custom "label strips" graphic (white paper chips on Graphite, each with a slight hand-set tilt, landing on its word) would be a bold experiment in the house look.

5. **Receipts on the claim line (1:20, 2:29, 4:27).** When he claims a result or a past struggle, show the real screen for 2.5 to 3 s, cut exactly on the claim. In Studio: his own capture as an `image` in `side`, or `media` with `lift` on the number. Never credentials for their own sake (RULES); a receipt backs a claim in the argument.

6. **Call back the hook's object near the end (4:05 returns to 0:09).** The last section shows the hook's graphic again, now meaning something else. In Studio: repeat the hook visual (same kind and props) on the line that closes the loop. Cheap and it ties the video together.

7. **Two stories from the same start (2:39 to 3:12).** Same input, two readings, then the outcomes diverge on the question. In Studio: a custom `side` graphic: one input box with his own said numbers (for example "30 videos"), two lanes whose thoughts land on their sentences, then one line flat and one climbing on "which one grows". No counts he does not say; mark it "Illustration" if the lines are only a shape.

8. **The question card (3:38.8).** The one question the video turns on, word by word as he asks it, over his own picture blurred, two words in the accent, 4 to 5 s. In Studio: `over` with `title` `cine: true` (Signifier, words fading up as said, the picture dimmed), or the black theme's blurred panel. Use once.

9. **Chapter cards in two beats, with a dip before the hit (0:53, 2:18, 3:35).** "Part N" for about 1 s, then the chapter name for 1 to 2.5 s; the music drops for 0.3 s before the card and hits on it; his voice may run on over the card. In Studio: `chapter` with `hit: true` and `of: N` already does the card; add the 0.3 s duck before the `impact` sound (the playbook's "act break"), and let the name arrive as a second reveal on its word.

10. **Slow down as the video goes on.** Dense graphics in the first minute, then fewer and longer ones. In Studio: in the first 60 s aim for something new every 3 to 5 s while he is on camera; after that the usual one graphic every 20 to 60 s.

11. **End card that points at the next video (5:10 to 5:17).** The picture makes room and a short line points at the end-screen slot. In Studio: a last `media` card in Graphite, one Helvetica line with one Signifier word, an arrow drawn to where YouTube puts the end-screen element. Only if Owain uses an end screen there.

## What not to copy

- **Text behind the speaker** (0:31, 0:33, 2:01, 4:10). Owain removed the `behind` layout; do not suggest it.
- **Light leaks and film burns** on about 25 cuts. RULES: 16:9 graphics hard cut in and out; the playbook lists light-leak wipes as "does not fit".
- **A new colour per chapter** (green, teal, oxblood), the retro display serif, red script and handwriting fonts. The house look is Graphite or Ivory, Helvetica and Signifier, the sage accent.
- **The camera viewfinder frame** (REC, 4K, FPS 60) used as decoration (0:55, 2:04, 3:31). It is fake UI with no meaning.
- **Counters with numbers nobody said** (the "Subs:" pills at 3:09). RULES: a number on screen is a number that is said.
- **Other creators' clips** (0:16, 4:15) as a hook montage. Stock and other people's footage do not fit, and the rights are unclear.
- **Captions over the hook.** No word captions unless Owain asks.
- **Re-rendered punch-ins.** The jump cuts between framings are a big part of this video's pace, but Studio must not punch in on YouTube (colour shift). If Owain wants them, they belong in his Final Cut edit.
- **A 68 s hook with no face.** It needs acted b-roll that Owain does not shoot. The idea (open on the viewer's situation) transfers; the method does not.

## Key frames

All in `docs/studies/if-nobody-watches/`, 960 wide.

| File | Time | What |
| --- | --- | --- |
| [01-cold-open-0m01.jpg](if-nobody-watches/01-cold-open-0m01.jpg) | 0:01.5 | fan shadow, "2:37am" |
| [02-real-analytics-0m09.jpg](if-nobody-watches/02-real-analytics-0m09.jpg) | 0:09.6 | the real "7 views" screen |
| [03-search-typing-0m15.jpg](if-nobody-watches/03-search-typing-0m15.jpg) | 0:15.8 | the viewer's search |
| [04-hook-caption-0m26.jpg](if-nobody-watches/04-hook-caption-0m26.jpg) | 0:26.0 | hook caption style |
| [05-doubt-saturated-0m31.jpg](if-nobody-watches/05-doubt-saturated-0m31.jpg) | 0:31.2 | doubt line, key word behind him |
| [06-doubt-stack-0m36.jpg](if-nobody-watches/06-doubt-stack-0m36.jpg) | 0:36.9 | doubt words stacking |
| [07-chapter-part1-0m53.jpg](if-nobody-watches/07-chapter-part1-0m53.jpg) | 0:53.5 | chapter card, first beat |
| [08-chapter-title-0m54.jpg](if-nobody-watches/08-chapter-title-0m54.jpg) | 0:54.6 | chapter card, second beat |
| [09-clones-1m05.jpg](if-nobody-watches/09-clones-1m05.jpg) | 1:05.0 | five of him in one room |
| [10-paper-words-1m50.jpg](if-nobody-watches/10-paper-words-1m50.jpg) | 1:50.5 | the thesis in paper strips |
| [11-two-creators-3m10.jpg](if-nobody-watches/11-two-creators-3m10.jpg) | 3:10.0 | two of him with counters |
| [12-typed-question-3m42.jpg](if-nobody-watches/12-typed-question-3m42.jpg) | 3:42.5 | the question over his blurred frame |
| [13-north-star-4m11.jpg](if-nobody-watches/13-north-star-4m11.jpg) | 4:11.6 | "Your north star" behind his head |
| [14-end-card-5m15.jpg](if-nobody-watches/14-end-card-5m15.jpg) | 5:15.5 | end card |
