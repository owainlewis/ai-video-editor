# Pipeline

Raw footage in, a cut out, one step at a time. Each step writes a file in `pipeline/projects/<slug>/` and records itself in `status.json`.

```bash
npm run edit -- new linear --camera a-roll/C1328.MP4 --screen "a-roll/2026-10-30 13-46-42.mp4" --audio audio/Linear.mp3 --from 540 --to 840
npm run edit -- run linear
npm run edit -- status linear
```

| Step | Writes | What it does |
| --- | --- | --- |
| sync | `sync.json` | Lines the screen recording and the Auphonic audio up with the camera by their sound, and checks for drift. |
| proxy | `proxy/` | 720p working copies of the range we edit (`--from`, `--to`, camera seconds). The originals are only read again at export. |
| transcript | `transcript.json` | Every word with its time (Whisper, on the clean audio). |
| sift | `cut.json` | Cuts dead air (measured on the audio) and retakes (the last take wins), and picks camera or screen for each piece. |
| rough | `renders/rough.mp4` | Plays the cut. |

Ported from ai-reel-editor's `video-pipeline` branch (2026-10-31). Its `cut.json` (segments with a camera or screen angle) is not yet Studio's `cut.json` (segments of the project's bin); making the pipeline write Studio's project and cut is the first step of phase 2. The house templates it was built for are in `docs/TEMPLATES.md`.
