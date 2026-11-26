# electron

Studio as a Mac app. The app is a shell around the repo: it runs this checkout's own Studio server and shows the editor in a window, so there is no server to start and nothing goes stale. Linear: project "AI Video Editor", milestone 1 (ENG-31 to ENG-35).

## Run it

```bash
npm run app                          # from this checkout, in development
npm run app:build                    # dist/Studio.app
npm run app:build -- --install       # and copy it to /Applications
```

`Studio.app` holds no Studio code. Its entry sets `STUDIO_REPO` to the checkout it was built from and imports that checkout's `electron/main.ts`. A change to Studio, or to the shell, needs no rebuild; a new Electron does. It is signed ad hoc, so macOS asks once, the first time it opens.

Electron 45 runs the shell's TypeScript as it is (Node 24 strips the types), so there is no build step. Keep to erasable TypeScript here: no enums, namespaces or parameter properties, and `import type` for types.

## Files

| File | What |
|---|---|
| `main.ts` | The app: window, menu bar, application menu, notifications, `studio://` links, open at login. |
| `server.ts` | The server: `node --import tsx cli.ts serve` on the system's Node, restarted when its code changes. |
| `logic.ts` | What the app decides, apart from Electron so it is tested (`tests/electron.test.ts`). |
| `icon.ts` | The menu bar icon and the app icon, drawn in code, and a PNG encoder. |
| `build.ts` | Builds `Studio.app`. |

## How it behaves

- **The server.** It runs on port 4747 from the repo, with the PATH a terminal gets, so `node`, `claude`, `ffmpeg` and `python3` are found when the app opens from the Finder. If a Studio server already answers on 4747, the app uses that one rather than start a second, which would save every plan change twice.
- **Restarts.** A change to `engine/`, `media/`, `server/`, `styles/`, `effects/`, `cli.ts` or `package.json` restarts the server. The editor reloads by itself. Imports and renders are detached and carry on. A Claude note runs inside the server, so the restart waits until `GET /api/busy` says none is running. `app/` changes hot reload through Vite with no restart.
- **The window.** It has no title bar of its own: the editor's header is the title bar, with the traffic lights inset at its left (`titleBarStyle: "hiddenInset"`), and dragging the header moves the window. Closing it keeps Studio in the menu bar. Quit from the menu bar or with Cmd-Q, which stops the server (Ctrl-C and kill do the same).
- **The menu bar.** Lists each job running and each note Claude is working on (click one to open that reel), and the week's approvals. It also opens the approved folder and restarts the server.
- **Notifications.** Sent when an import is ready, an export finishes, any job fails, or Claude answers a note. Sent only when the editor isn't in front. Clicking one opens the reel.
- **Links.** `studio://p/<slug>`, `studio://p/<slug>/review` and `studio://gallery` open the app on that page.
- **Open at login.** On by default, for the copy in `/Applications` only. It opens hidden, in the menu bar.

Settings (window size, open at login) are in `~/Library/Application Support/Studio/settings.json`.
