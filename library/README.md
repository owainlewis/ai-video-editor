# Library

Shared by every video, reel or YouTube. Licensed or personal media, so everything here except this file is git-ignored; copy it in by hand. A git worktree has an empty copy, so the mixer uses the main checkout's.

## `music/`

Tracks in `music/<mood>/` (`focus`, `uplift`, `dark`) or in `music/`; Owain's reel picks are in `music/reels/`. A video picks a track by mood, loops it with a crossfade, fades it out and ducks it under the voice. Pin one with `"music": { "track": "focus/my-track.mp3" }`. With no tracks there is no bed. Check the licence covers the platform.

## `sounds/`

One folder per kind. Any format ffmpeg reads. A kind with no files stays silent.

| Folder | Plays when |
| --- | --- |
| `pop/` | a logo, list item or step lands |
| `blip/` | a highlight sweeps over a capture |
| `key/` | a terminal line types |
| `whoosh/` | a shot sets `"sfx": "whoosh"` (use rarely) |
| `impact/`, `thud/`, `chime/`, `riser/` | a shot sets that `sfx` |

Prefer soft taps, dry clicks and air over zaps and plops. Trim silence from the start of each file.

## `broll/`

Owain's own cinematic shots: typing, working, desk and setup details, walking. 3 to 15 seconds each, steady, in focus, one continuous shot. `npm run studio -- broll index` splits new files into shots in `broll/.clips/`, crops letterboxing and describes each one in `broll/index.json`; `npm run studio -- broll <words>` searches. Plans use a shot as `broll:<id>`, at most once per video.
