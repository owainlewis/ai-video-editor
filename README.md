# Studio

An AI-native video editor. Drop in a clip, then edit it by talking to Claude: select a section on the timeline and say what should change. Claude edits the plan, the editor shows it live, and the video is rendered once when you export.

```bash
npm install
npm run dev        # http://localhost:4747
```

Needs ffmpeg, [uv](https://docs.astral.sh/uv/) (for mlx-whisper and the audio mix) and the `claude` CLI, signed in. Put music and sound effects in `library/` (see `library/README.md`).

- `CLAUDE.md`: how Claude edits a project.
- `docs/ARCHITECTURE.md`: how it fits together.
- `docs/RULES.md`: the house rules, learned from notes.
