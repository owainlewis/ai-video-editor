# Architecture

## The idea

The edit is data, not pixels. A project's plan (`edit.json`) says what is on screen and when, anchored to the words spoken. The editor draws the plan live in the browser from a light preview copy of the footage. Claude edits the plan; Owain watches it change. Video is rendered once, when he exports.

That keeps feedback cheap on long videos: a note costs seconds, not a re-render.

## Flow

1. **Import** (`media/ingest.ts`). A clip becomes `projects/<slug>/`: a 30 fps working copy, the voice, a 1080p preview with a keyframe every half second (for scrubbing), a word-level transcript (mlx-whisper, cleaned of invented words), and a starter plan. More clips (other takes, a screen recording) join the project's bin in `clips/<id>/` with the same import (`studio clip <slug> <file>`, or the Clips tab).
2. **Cut** (`cut.json`, `engine/cut.ts`, `media/bin.ts`). What of the footage plays, in order: segments of the bin's clips, each from an in point to an out point in its own clip. The A-roll track edits it. A project with no `cut.json` plays its first clip whole, as before.
3. **Resolve** (`media/project.ts`, `engine/resolve.ts`). The plan becomes `build/edit.resolved.json`: shots with times, caption chunks and sound events, plus every house-rule check. With a cut, each clip's words are moved to where they play first, so shots anchored to spoken words follow them through any re-cut. This runs on every change.
4. **Play** (`app/`, `effects/`). The editor plays the resolved plan through the same Remotion compositions the final render uses, so the preview is the real thing. A cut plays segment by segment from the clips' previews (`effects/cut.tsx`). The gallery (`app/Gallery.tsx`) plays one graphic at a time the same way: each library card's sample, and each shot of every project on its own (`effects/preview.ts`). That is where graphics are designed and checked; nothing is rendered to a file.
5. **Change** (`server/`). The server watches every `edit.json` and `cut.json`. A change, from the chat panel, from Claude Code in a terminal, from the timeline or by hand, is saved as a version (`history/`), resolved, and pushed to open editors. Undo and redo step through the versions.
6. **Chat** (`server/agent.ts`). A note becomes a headless `claude -p` run in this repo, with the selected section and its words. Claude follows `CLAUDE.md`, edits the plan and runs the checks. One Claude session per project, so follow-ups have context.
7. **Export** (`media/export.ts`, `media/render.ts`). A cut is first flattened from the original files with ffmpeg (`media/cutrender.ts`: frame-exact trims, joined without encoding again, the voice crossfaded 5 ms at each join). Then mix the audio (`audio/`) and lay the graphics over the picture: YouTube renders only the graphic sections over the original, reels render every frame with the picture as footage. The picture never goes through Remotion on its own.

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

`engine/`, `effects/`, `styles/` and `audio/` are ported from `ai-reel-editor` with their tests. Each carries lessons from real edits; change them deliberately.

## Not yet

- No b-roll library or search yet; captures and clips are added to a project by hand.
- Export renders every frame. A segment export (graphics only, laid over the original) and FCPXML come next for long videos.
