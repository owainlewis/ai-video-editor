# Audio

## Overview

The Python mix. It takes a finished voice track, a music bed and sound effects, and writes one master, `build/mix.wav`. `media/render.ts` runs it during renders and exports.

## Interface

### Entry point

```bash
uv run --quiet --with numpy --with scipy --with soundfile python -m audio.mix <project_dir> [config] [out]
```

`config` is relative to the project and defaults to `build/audio.json`. `media/project.ts` writes that file. `out` defaults to `build/mix.wav`; with any other path (the editor's preview mix) the working files go in `build/audio-preview/` instead of `build/audio/`.

### Config keys

- `duration` (required): seconds.
- `voiceGain`: dB, default 0.
- `voice`: path in the project, default `source/voice.wav`.
- `canvas`: the value `youtube` selects YouTube sound thinning.
- `music`: object with `track`, `mood` (default `focus`), `start`, `level` (dB, default -20) and `under` (LU below the voice, replaces `level`).
- `sfx`: list of events with `kind` and `t`, plus optional `gain`, `exact`, `step`, `dur` and `seed`.

### Modules

- `mix.py`: `main(project, config, out_path)` (a config's `voiceEnd` silences the voice from there, for the reel without its call to action), `library_root()`, `ffmpeg(args)`, `loudness(path)`, `duck_graph(gain, music_db)`.
- `sfx.py`: `render(events, seconds, root_hz, library=None, synth=False, youtube=False)`, `thin(events, min_gap, tap_gain)`.
- `library.py`: `SoundLibrary(root, cache)`, `decode(path, cache)`, `music_files(root, mood)`, `music_bed(path, seconds, cache, crossfade=2.0, start=0.0)`.
- `dsp.py`: `SR` and helpers (`lowpass`, `highpass`, `bandpass`, `stereo`, `place`, `reverb`, `fade`, `rms_db`, `to_rms`, `t_axis`, `midi_hz`).
- `music.py`: `render(seconds, mood, bpm, drums_in, drums_out)`, a procedural music bed. Nothing in `mix.py` calls it.

## Invariants

- The sample rate is 48000 Hz (`SR`).
- The master targets -14 LUFS, LRA 11, and -1.5 dBTP, using two-pass `loudnorm`.
- A comment in `mix.py` says the voice arrives finished and gets only one linear gain here. It still passes through the bus limiter with the other stems.
- Every stem is cut or padded to exactly `duration`.
- Music ducks under the voice with `sidechaincompress`.
- Music picks `music.track` if set, then files in `music/<mood>/`, then files directly in `music/`. The pick is deterministic per project. With no track, the music stem is silent.
- A sound kind with no library files is silent. `mix.py` never sets `synth`, so missing kinds are not synthesised. Some docstrings in this folder still say they are.
- Automatic sounds (`gain` below 1) are thinned: at least 2.5 s apart at gain 0.3 by default, and 0.5 s apart at gain 0.6 on YouTube. `exact` and `key` events are always kept.
- Library samples are chosen by index modulo the file count, so results repeat.
- A failure in `mix.ffmpeg` raises `RuntimeError` with the end of stderr. A failure in `library.decode` raises `CalledProcessError`.

## Side Effects

- Reads the config file, the voice file, and `sounds/<kind>/` and `music/` under `library_root()`.
- `library_root()` uses `STUDIO_LIBRARY` if set. Otherwise it uses `<repo>/library`, or the main checkout's library when the repo's has no sounds, found through `git rev-parse`.
- Writes `build/audio/` (`voice.wav`, `music.wav`, `sfx.wav`, `premaster.wav`, and `ducked.wav` when `under` is set) and the final `build/mix.wav`, 24-bit at 48000 Hz.
- Caches decoded audio in `<repo>/.cache/audio/`. Nothing evicts it.
- Runs `ffmpeg` for decoding, loudness measurement, ducking, mixing and the final encode.
- Prints progress to stdout.

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
