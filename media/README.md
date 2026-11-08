# Media

## Overview

Everything that touches footage on disk: import, transcription, turning a plan into what the compositions render, the cut, stills, export, QC in a headless browser, the b-roll library, voice cleaning and camera scans. Plan logic lives in `engine/`, and this package feeds it files.

## Interface

- `project.ts`: `resolveProject(projects, slug, exportCut?)` returns `{ resolved?, issues }`. Also `LIBRARY`.
- `ingest.ts`: `ingest(projects, file, slug, log?, choices?)`, `addClip(projects, slug, file, id, log?, name?)`, `transcribe`, `cleanWords`, `starterPlan`, `slugFor`, `projectMeta`, `setStatus`, `liveStatus`, types `Status` and `Choices`.
- `bin.ts`: `clips(dir)` (main first), `clipDir`, `clipPath`, `loadCut(dir)`, `clipWords`, `timeline(dir)`, `cameraOnTimeline(dir, cut)`, `clipLevels(dir, id)`, type `Clip` (a bin clip).
- `render.ts`: `renderFinal(projects, slug, onProgress, log?, onStage?)`, `prepareExport(projects, slug, onStage, log?)`, `mixAudio(projects, slug, log?, flat?)`, `stills(projects, slug, times, log?)`.
- `cutrender.ts`: `renderCut(projects, slug, onStage, log?)` returns `FlatCut`. Also `hasCut`, `segmentFrames`, `XFADE`.
- `export.ts`: `exportOverOriginal(projects, slug, onStage, log?)`, `sections(r)`, `verifyExport(original, out, files, remove?)`, type `Section`.
- `qc.ts`: `runQc(projects, slug, log?, onStage?, at?)` and `runLibraryQc(opts, log?, onStage?)` return `QcResult`. Also `footageCuts`, `libraryVariants`, `LIBRARY_QC`.
- `broll.ts`: `loadLibrary`, `indexLibrary`, `describeLibrary`, `searchLibrary`, `useClip(projectDir, id)`, `BROLL`, type `Clip` (a library shot, not the same as the bin `Clip`).
- `auphonic.ts`: `cleanVoice(dir, title, log?)`, `cleanProject(projects, slug, log?)`, `ALGORITHMS`, `OUTPUTS`.
- `scan.ts`: `frameSheets(dir, every = 15, log?)`, `scanCamera(dir, refs)`.
- `tools.ts`: `run`, `ffmpeg`, `ffmpegProgress`, `hasHardwareH264`, `probeDuration`, `probeSize`, `mediaProbe(dir)`, `probeRate`, `speechEnd`, `imageSize`, `readJson`, `writeJson`, `ROOT`, `FPS` (30), type `Log`.

## Invariants

### Resolving

- `resolveProject` returns no `resolved` and writes nothing when `cut.json` is invalid, `edit.json` fails the schema, or a filmed reel has no `face`. Other error issues are returned and the build files are still written.
- `project.json` and `edit.json` must exist. A missing one throws.
- With a cut, an empty cut or a non-empty `remove` is an error.
- `exportCut` writes separate `build/edit.export.json` and `build/audio.export.json`, so the editor cannot swap the flattened cut out from under a running export.
- A `video` visual's source can be used once in a plan. Kept shots do not count.

### Export

- This package takes no export lock and does not call QC before exporting. `cli.ts` does both for `render`: it holds `build/export.lock` and refuses on QC errors unless `--force` is passed.
- `renderFinal` and `exportOverOriginal` throw on resolve errors.
- `exportOverOriginal` does not throw when verification finds a problem. It logs the issues and writes them to `checks/export-check.json`.
- `verifyExport` errors: length more than 0.15 s from the original minus removals, a different pixel size, an `over` section that looks the same as the original, or another graphic section that does not match its render. It warns when loudness is above -10 or below -18 LUFS.
- `sections` skips kept shots and `full` shots. Alpha is used only for `over`.
- `renderCut` throws if the project has no cut, if a segment's frame count is wrong, or if picture or voice drift from the timeline.

### QC

- `runQc` returns errors instead of throwing. It renders nothing to video.
- With no `resolved`, it returns early and leaves `checks/qc/` alone.
- It checks shots with a visual, not `keep`, and not `full`.

### Status and clips

- `setStatus` writes `done: false` with the pid. `ingest` and `addClip` end with `done: true`, as Ready or Failed, and rethrow on failure.
- `liveStatus` reports `Interrupted` when a job is not done and its pid is dead.
- The main clip lives at the project root and uses `project.json`. Others live in `clips/<id>/` with `clip.json`.
- `ingest` never overwrites an existing `edit.json`.
- `slugFor`: lowercase, other characters become `-`, 40 characters at most, falling back to `clip`.
- Nothing in this package checks that slugs or clip ids are unique. `server/index.ts` numbers them on upload.

### Tools and voice

- `run` throws on a non-zero exit and defaults its working directory to the repo root.
- `cleanVoice` always uploads `source/voice.original.wav`, which is created once. It throws rather than replace the voice when the cleaned length differs by more than 0.05 s.
- Auphonic is polled every 5 s with no timeout.

## Side Effects

- Child processes: `ffmpeg`, `ffprobe`, `npx remotion`, `uvx --from mlx-whisper mlx_whisper`, `uv run ... python -m audio.mix`, and `claude -p` for b-roll descriptions.
- Network: `https://auphonic.com/api`, with `AUPHONIC_API_KEY` from the environment or `.env`.
- Local server: `qc.ts` runs an HTTP server on 127.0.0.1 and opens headless Chrome through `openBrowser`.
- Writes in a project:
  - `ingest` and `addClip`: `project.json`, `edit.json`, `status.json`, `transcript.json`, `transcript.txt`, `source/`, `build/preview.*`, `build/whisper/`, `checks/frame.jpg`, and `clips/<id>/`. `ingest` also creates `renders/` and `history/`.
  - `resolveProject`: `build/edit.resolved.json` and `build/audio.json`, or the export pair. It copies b-roll into `assets/broll/`.
  - `clipLevels`: `build/level.json`. `footageCuts`: `build/cuts.json`. `scanCamera`: `build/camera.json`.
  - `mixAudio`, and so `renderFinal` and `exportOverOriginal`, through the `audio.mix` child process: `build/mix.wav` and `build/audio/`.
  - `renderFinal` and `exportOverOriginal`: `renders/final.mp4`. `exportOverOriginal` also writes `build/export/` and `checks/export-check.json`.
  - `renderCut`: clears and writes `build/cut/`.
  - `runQc`: clears and writes `checks/qc/`. `stills`: clears and writes `checks/stills/`. `frameSheets`: clears and writes `checks/frames/`, writes contact sheets to `checks/frames-<k>.jpg`, and returns their paths.
  - `cleanVoice`: replaces `source/voice.wav`, and writes `source/voice.original.wav`, `build/auphonic/` and `build/preview.m4a`.
- Writes in the library: `library/broll/index.json`, `library/broll/.clips/`, and `library/qc/` (cleared by `runLibraryQc`).

## Verification

- Run: `npm test` and `npm run typecheck` from the repo root.
