# AI Reel Editor

To edit a reel, use the `edit-reel` skill (`.claude/skills/edit-reel/SKILL.md`). It is the process; follow it.

- Read `reels/docs/STYLE.md` and `reels/docs/RULES.md` before planning any edit. RULES.md wins over everything else.
- When the user gives a note on a draft, fix it, then record it in `reels/docs/RULES.md` and, where possible, enforce it in code or a check.
- Never invent facts, numbers, UI or quotes. Never redraw a logo. Check claims against the primary source.
- Design graphics per reel, not from stock presets (Owain, 2026-10-26): follow "Design per video" in the root `CLAUDE.md` before planning shots.
- Reels use Studio's one engine, effects, styles, audio mixer and library at the repo root (`engine/`, `effects/`, `styles/`, `audio/`, `library/`). There is no reel-only copy; a change there changes YouTube videos too, so run both test suites.
- Projects live in `reels/projects/<slug>/` and are git-ignored. Reusable examples go in `reels/examples/`.
- After changing code, run `npm run typecheck` and `npm test` (from the repo root or here), and look at `reel stills` output before a full render.
- Writing style for docs and messages: plain words, short sentences, no em dashes.
