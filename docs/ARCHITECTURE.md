# Architecture

## The idea

The edit is data, not pixels. A project's plan (`edit.json`) says what is on screen and when, anchored to the words spoken. The editor draws the plan live in the browser from a light preview copy of the footage. Claude edits the plan; Owain watches it change. Video is rendered once, when he exports.

That keeps feedback cheap on long videos: a note costs seconds, not a re-render.

## Flow

1. **Import** (`media/ingest.ts`). A clip becomes `projects/<slug>/`: a 30 fps working copy, the voice, a 1080p preview with a keyframe every half second (for scrubbing), a word-level transcript (mlx-whisper, cleaned of invented words), and a starter plan.
2. **Resolve** (`media/project.ts`, `engine/resolve.ts`). The plan becomes `build/edit.resolved.json`: shots with times, caption chunks and sound events, plus every house-rule check. This runs on every change.
3. **Play** (`app/`, `effects/`). The editor plays the resolved plan through the same Remotion compositions the final render uses, so the preview is the real thing.
4. **Change** (`server/`). The server watches every `edit.json`. A change, from the chat panel, from Claude Code in a terminal or by hand, is saved as a version (`history/`), resolved, and pushed to open editors.
5. **Chat** (`server/agent.ts`). A note becomes a headless `claude -p` run in this repo, with the selected section and its words. Claude follows `CLAUDE.md`, edits the plan and runs the checks. One Claude session per project, so follow-ups have context.
6. **Export** (`media/render.ts`). Mix the audio (`audio/`), render every frame with Remotion, write `renders/final.mp4`.

## Modules

| Folder | What | Depends on |
|---|---|---|
| `engine/` | Plan schema, word anchoring, shot timing, lints. Pure. | nothing |
| `effects/` | Remotion compositions (`Reel` 9:16, `Wide` 16:9) and every visual. | engine, styles |
| `styles/` | Ivory tokens and the card catalog with typed slot limits. | engine |
| `media/` | Import, project resolution, stills, render. Files and ffmpeg. | engine, effects, styles |
| `audio/` | The mix: voice untouched, music bed, sound effects, loudness. Python. | |
| `server/` | Local HTTP API, file serving, the plan watcher, versions, the chat bridge. | media |
| `app/` | The editor: projects, player, timeline, chat. | engine, effects |

`engine/`, `effects/`, `styles/` and `audio/` are ported from `ai-reel-editor` with their tests. Each carries lessons from real edits; change them deliberately. They are the only copy: the reel tools in `reels/` (CLI, review board, style lab) import them, and share `library/` for b-roll, music and sounds.

## Not yet

- Undo is one step at a time; no redo.
- No b-roll library or search yet; captures and clips are added to a project by hand.
- Export renders every frame. A segment export (graphics only, laid over the original) and FCPXML come next for long videos.
