# Audio

## Overview

The Python package that makes a reel's sound. `audio.mix` puts the speaker, a music bed and sound effects into one file at platform loudness. `tools/cli.ts` (`cmdAudio`) runs it through uv, with numpy, scipy and soundfile added for that run.

## Interface

- `python -m audio.mix <project dir>` (`mix.py:main`): the entry point. `npm run reel -- audio <slug>` validates the plan and then runs it.
- `mix.py`: `library_root()` finds `sounds/` and `music/`. `loudness(path)` measures a file. `TARGET_LUFS` is -14. `TRUE_PEAK` is -1.5.
- `sfx.py`: `render(events, seconds, root_hz, library=None, synth=False)` mixes timed events into one stereo track. `thin(events)` drops automatic taps that come too close together. `MIN_GAP` and `TAP_GAIN` set that rule. `whoosh`, `pop`, `thud`, `impact`, `riser`, `key`, `blip` and `chime` are the synthesised sounds.
- `library.py`: `SoundLibrary` (`has`, `summary`, `pick`), `decode(path, cache)`, `music_files(root, mood)`, `music_bed(path, seconds, cache, crossfade)`, and the constants `KINDS` and `AUDIO`.
- `dsp.py`: `SR`, `t_axis`, `midi_hz`, `lowpass`, `highpass`, `bandpass`, `stereo`, `place`, `reverb`, `fade`, `rms_db`, `to_rms`.
- `music.py`: `render(seconds, mood, bpm, drums_in, drums_out)` and `MOODS`, a procedural music bed. Nothing imports it now.

The input is `build/audio.json`, written by `reel validate`. Its keys are `duration`, `music`, `voiceGain` and `sfx`.

## Invariants

- All audio runs at `dsp.SR`, 48000 Hz, in stereo. Voice, music and effects are padded or cut to the plan's `duration`.
- The voice gets one linear gain (`voiceGain`). It has no EQ or compressor of its own. The whole mix then goes through `alimiter` and a two-pass linear `loudnorm`.
- The music ducks under speech with a sidechain keyed from the voice. The key changes the music only.
- The loudness target is -14 LUFS and -1.5 dBTP. The docstring in `mix.py` says -1 dBTP; the constant is the truth.
- Nothing missing is synthesised in a real mix. `mix.py` calls `sfx.render` without `synth`, so a sound kind with no files is silent. With no music tracks the bed is silence. The docstrings in `mix.py` and `library.py` still say otherwise.
- `thin` keeps every event with gain 1.0 and every `key` event. A tap (gain under 1.0) plays only if no other sound except a `key` event has been kept in the last `MIN_GAP` (2.5 s), and then at `TAP_GAIN` (0.3). A `key` event does not reset that gap, so a tap can play right after one.
- Choices repeat on every run. The track comes from the sum of the project folder name's character codes. `SoundLibrary.pick` varies by event index.
- `music_files` looks in `music/<mood>/` first and falls back to `music/`. A plan's `music.track` skips both.
- `riser` is a library kind, but `SfxKind` in `src/schema.ts` does not list it, so a plan cannot ask for one.

## Side Effects

- Reads `build/audio.json` and `source/voice.wav` from the project, and audio files from `sounds/` and `music/`.
- `library_root` uses `REEL_LIBRARY` if it is set. Otherwise it runs `git rev-parse` and uses the main checkout's folders when this checkout has no sounds, as in a git worktree.
- Writes `build/audio/voice.wav`, `music.wav`, `sfx.wav` and `premaster.wav`, and the result `build/mix.wav`, in the project.
- Caches decoded audio in `reels/.cache/audio/`, keyed by path and modified time.
- Runs `ffmpeg` as a subprocess and prints a summary to stdout.

## Verification

- No automated test covers this package. `cd reels && npm test` runs the TypeScript suite only.
- Run: `cd reels && npm run reel -- audio <slug>`. It prints the measured LUFS and true peak of `build/mix.wav`.
