# CLI capture

How the terminal apps in `effects/apps/cli.tsx` are matched to the real thing: run the real CLI in a virtual terminal, drive it with a script of keys, and read back every cell's text and 24-bit colour. Claude Code 2.1.323 was captured this way on 2026-11-14 (permission boxes, diffs, plan mode, subagents, the mode footers).

## Set up (once, outside the repo)

```bash
mkdir -p /tmp/cli-capture && cd /tmp/cli-capture && npm init -y
npm install node-pty@1.1.0 @xterm/headless@6.0.0
chmod +x node_modules/node-pty/prebuilds/darwin-*/spawn-helper   # node-pty ships it without the bit
cp <repo>/research/cli-capture/capture.mjs .
```

## Run

```bash
node capture.mjs script.json out/
```

A script names a folder (`cwd`, a fresh temp folder by default), files to put in it, the permission `mode` (`default` for the permission boxes, `plan`, `acceptEdits`, `auto`), the `model` (haiku is cheap), and steps: `{ "send": "text" }`, `{ "key": "enter|down|esc|shift-tab|1" }`, `{ "wait": ms }`, `{ "until": "regex", "timeout": ms }`, `{ "snap": "name" }`. Each snap writes `name.txt`, `name.json` (every run's colours, bold and dim) and `name.html` to look at.

- A new folder asks whether you trust it, with "No, exit" selected: wait `until` "trust this folder", press `down`, then `enter`.
- The status line is switched off and the session markers of a parent Claude Code are removed, so the screen is what a user sees.
- It runs with your own login and settings (`tui: fullscreen`), so capture in a scratch folder, never on private work, and copy only the UI, never the content.
