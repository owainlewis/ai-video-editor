// Studio as a Mac app (ENG-31 to ENG-35). The app is a shell: it runs the repo's own Studio server
// (electron/server.ts) and shows the editor in a window, so Studio's code is always the repo's and
// the preview runs on Chromium, the engine Remotion renders with. It lives in the menu bar, keeps
// working with the window closed, opens at login, tells Owain when a job finishes, and opens
// studio:// links. Run it with `npm run app`.
import { app, BrowserWindow, Menu, nativeImage, nativeTheme, Notification, screen, shell, Tray } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { trayBitmap } from "./icon.ts";
import { type Listed, notices, routeFor, summary } from "./logic.ts";
import { busy, shellEnv, StudioServer } from "./server.ts";

// The repo to run: STUDIO_REPO, else the checkout this file is in.
const REPO = resolve(process.env.STUDIO_REPO ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const server = new StudioServer(REPO);

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let projects: Listed[] = [];
let notes: string[] = [];
// Where to go once the editor is up, when a link or notification asked before it was.
let wanted: string | null = null;

app.setName("Studio");

// One Studio at a time: a second launch (or a studio:// link on another platform) goes to the first.
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
app.on("second-instance", (_e, argv) => {
  const link = argv.find((a) => a.startsWith("studio://"));
  link ? openLink(link) : show();
});

// studio:// links. In development the link has to name this app's entry, or macOS would open a bare Electron.
// Studio.app keeps Electron's executable name, so app.isPackaged (which reads that name) is false
// there. What tells the two apart: `npm run app` runs through Electron's default app.
const packaged = !process.defaultApp;
if (packaged) app.setAsDefaultProtocolClient("studio");
else app.setAsDefaultProtocolClient("studio", process.execPath, [resolve(process.argv[1] ?? ".")]);
app.on("open-url", (e, link) => (e.preventDefault(), openLink(link)));

// ---- Settings, kept beside Electron's own files in ~/Library/Application Support/Studio ----

type Settings = { openAtLogin: boolean; bounds?: Electron.Rectangle };
const settingsFile = () => join(app.getPath("userData"), "settings.json");
function settings(): Settings {
  try {
    return { openAtLogin: true, ...JSON.parse(readFileSync(settingsFile(), "utf8")) };
  } catch {
    return { openAtLogin: true };
  }
}
const saveSettings = (s: Partial<Settings>) => writeFileSync(settingsFile(), JSON.stringify({ ...settings(), ...s }, null, 2));

// Open at login applies to the copy in /Applications only: in development it would register a bare
// Electron, and a build in dist/ is about to be replaced.
const installed = () => packaged && app.getPath("exe").startsWith("/Applications/");
function applyLogin() {
  if (installed()) app.setLoginItemSettings({ openAtLogin: settings().openAtLogin });
}

// ---- The window ----

const background = () => (nativeTheme.shouldUseDarkColors ? "#161618" : "#f6f6f8");

// Saved bounds, if they still fit on a screen (a display may have been unplugged since).
function bounds(): Partial<Electron.Rectangle> {
  const b = settings().bounds;
  if (!b) return { width: 1440, height: 900 };
  const area = screen.getDisplayMatching(b).workArea;
  const fits = b.x >= area.x - 40 && b.y >= area.y - 40 && b.x + b.width <= area.x + area.width + 40 && b.y + b.height <= area.y + area.height + 40;
  return fits ? b : { width: b.width, height: b.height };
}

function createWindow() {
  win = new BrowserWindow({
    ...bounds(),
    minWidth: 960,
    minHeight: 600,
    title: "Studio",
    show: false,
    backgroundColor: background(),
    // The editor's header is the title bar: macOS draws only the traffic lights, inset into it, as
    // Final Cut and Xcode do. app/index.html marks the page so its header leaves room for them.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 19 },
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once("ready-to-show", () => win?.show());
  const keep = () => win && !win.isMinimized() && !win.isFullScreen() && saveSettings({ bounds: win.getBounds() });
  win.on("resized", keep);
  win.on("moved", keep);
  // Closing the window keeps Studio running in the menu bar; quitting is from the menu.
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    win?.hide();
    app.dock?.hide();
  });
  win.on("closed", () => (win = null));
  // The editor's own pages stay in the window; anything else opens in the browser.
  const own = (url: string) => !!server.url && url.startsWith(server.url);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (own(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url === "studio://retry") return e.preventDefault(), void server.retry();
    if (own(url) || url.startsWith("data:")) return;
    e.preventDefault();
    void shell.openExternal(url);
  });
  render();
}

function show(route?: string) {
  if (route) wanted = route;
  if (!win) createWindow();
  app.dock?.show();
  win!.show();
  win!.focus();
  go();
}

// Open the wanted page once the server is up.
function go() {
  if (!win || server.state !== "ready" || !server.url || !wanted) return;
  const target = `${server.url}/${wanted}`;
  wanted = null;
  if (win.webContents.getURL() !== target) void win.loadURL(target);
}

// Show whatever the server's state calls for: the editor, a starting page or the failure.
function render() {
  if (!win) return;
  if (server.state === "ready" && server.url) {
    const current = win.webContents.getURL();
    // Same server: the editor reloads by itself once its event stream reconnects after a restart
    // (app/main.tsx). A new address
    // (the port was taken) or a status page: load the editor, keeping the page it was on.
    if (!current.startsWith(server.url)) {
      const hash = current.startsWith("http") ? new URL(current).hash : "";
      void win.loadURL(`${server.url}/${wanted ?? hash ?? ""}`);
      wanted = null;
    } else go();
    return;
  }
  if (server.state === "failed") return void win.loadURL(page("Studio could not start", server.log.slice(-40).join("\n"), true));
  if (server.state === "starting" && !win.webContents.getURL().startsWith("http")) void win.loadURL(page("Starting Studio…", "", false));
}

// A plain status page in the editor's colours, for before the server answers or when it fails.
function page(title: string, log: string, retry: boolean) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const html = `<!doctype html><meta charset="utf-8"><title>Studio</title><style>
    :root{color-scheme:light dark;--bg:light-dark(#f6f6f8,#161618);--fg:light-dark(#1d1d20,#ececf0);--dim:light-dark(#6b6b73,#9a9aa3);--line:light-dark(#e3e3e8,#2c2c31);--accent:#2f6fed}
    body{margin:0;height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:14px/1.5 Helvetica,Arial,sans-serif}
    main{width:min(720px,90vw)} h1{font-size:18px;font-weight:600;margin:0 0 12px}
    pre{max-height:50vh;overflow:auto;padding:12px;border:1px solid var(--line);border-radius:8px;color:var(--dim);font:12px/1.5 Menlo,monospace;white-space:pre-wrap}
    a{display:inline-block;margin-top:12px;padding:6px 14px;border-radius:6px;background:var(--accent);color:#fff;text-decoration:none}
  </style><main><h1>${esc(title)}</h1>${log ? `<pre>${esc(log)}</pre>` : ""}${retry ? `<a href="studio://retry">Retry</a>` : ""}</main>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function openLink(link: string) {
  if (link === "studio://retry") return void server.retry();
  show(routeFor(link) ?? "#/");
}

// ---- The menu bar ----

function buildTray() {
  const icon = nativeImage.createFromBitmap(trayBitmap().buffer, { width: 36, height: 36, scaleFactor: 2 });
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("Studio");
  refreshMenu();
}

function refreshMenu() {
  if (!tray) return;
  const { working, week } = summary(projects, notes);
  const state =
    server.state === "ready"
      ? server.mode === "attached"
        ? "Using a server started elsewhere"
        : null
      : server.state === "failed"
        ? "The server could not start"
        : server.state === "stopped"
          ? null
          : "Starting the server…";
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Studio", click: () => show() },
      { type: "separator" },
      ...(state ? [{ label: state, enabled: false }] : []),
      ...(working.length ? working.map((w) => ({ label: w.label, click: () => show(`#/p/${w.slug}`) })) : [{ label: "Nothing running", enabled: false }]),
      { label: week, enabled: false },
      { type: "separator" },
      { label: "Open the Approved Folder", click: () => void openApproved() },
      {
        label: "Open at Login",
        type: "checkbox",
        checked: settings().openAtLogin,
        enabled: installed(),
        sublabel: installed() ? undefined : "In the app in /Applications",
        click: (item) => (saveSettings({ openAtLogin: item.checked }), applyLogin()),
      },
      { label: "Restart the Server", enabled: server.mode === "own", click: () => void server.restart("Restarting from the menu") },
      { type: "separator" },
      { label: "Quit Studio", accelerator: "Command+Q", click: () => app.quit() },
    ]),
  );
}

// The approved folder, as the server sees it (STUDIO_APPROVED). Asked of the server, so the app
// never keeps its own copy of where approved reels go.
async function openApproved() {
  if (!server.url) return;
  try {
    const r = await fetch(`${server.url}/api/approved-folder`);
    const { path } = (await r.json()) as { path: string };
    if (existsSync(path)) await shell.openPath(path);
  } catch {}
}

// ---- What is happening: the server's event stream, read here for notifications and the menu ----

let listening: AbortController | null = null;

async function listen() {
  listening?.abort();
  if (!server.url || server.state !== "ready") return;
  const ctrl = new AbortController();
  listening = ctrl;
  const base = server.url;
  await refresh(false);
  try {
    const r = await fetch(`${base}/api/events`, { signal: ctrl.signal });
    const reader = r.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const ev of events) {
        const data = ev.split("\n").find((l) => l.startsWith("data: "));
        if (data) onEvent(JSON.parse(data.slice(6)));
      }
    }
  } catch {}
  // The stream ended: the server restarted or stopped. Listen again once it is back.
  if (listening === ctrl && !ctrl.signal.aborted) setTimeout(() => void listen(), 2000);
}

let refreshing: NodeJS.Timeout | null = null;
function onEvent(ev: { type: string; slug?: string; message?: { role: string; text: string } }) {
  if (ev.type === "status") {
    if (refreshing) clearTimeout(refreshing);
    refreshing = setTimeout(() => void refresh(true), 300);
  }
  if (ev.type === "chat" && ev.message?.role === "status") void refresh(false);
  // Claude's answer to a note: worth a notification when Owain isn't looking at the editor.
  if (ev.type === "chat" && ev.message?.role === "claude" && ev.slug) {
    const title = projects.find((p) => p.slug === ev.slug)?.title ?? ev.slug;
    notify({ title: `Claude: ${title}`, body: ev.message.text.split("\n")[0].slice(0, 140), route: `#/p/${ev.slug}` });
  }
}

async function refresh(tell: boolean) {
  if (!server.url) return;
  try {
    const list = (await (await fetch(`${server.url}/api/projects`)).json()) as Listed[];
    if (tell) for (const n of notices(projects, list)) notify(n);
    projects = list;
    notes = await busy(server.url);
  } catch {}
  refreshMenu();
}

// Notifications only when the editor isn't in front: there, Owain sees it happen.
function notify(n: { title: string; body: string; route: string }) {
  if (win?.isVisible() && win.isFocused()) return;
  const note = new Notification({ title: n.title, body: n.body });
  note.on("click", () => show(n.route));
  note.show();
}

// ---- The application menu: Edit is needed for copy and paste in the editor's fields ----

function appMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { label: "Projects", accelerator: "Command+Shift+P", click: () => show("#/") },
          { label: "Gallery", accelerator: "Command+Shift+G", click: () => show("#/gallery") },
          { type: "separator" },
          { role: "reload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ]),
  );
}

// ---- Start and stop ----

server.on("state", () => {
  render();
  refreshMenu();
  if (server.state === "ready") void listen();
});

app.whenReady().then(async () => {
  if (!primary) return; // a second launch: the first one has been told, and this one is quitting
  appMenu();
  buildTray();
  applyLogin();
  // Opened at login: stay in the menu bar until asked.
  const hidden = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes("--hidden");
  if (hidden) app.dock?.hide();
  else show();
  await server.start(await shellEnv());
  setInterval(() => void refresh(false), 30_000);
});

app.on("activate", () => show());

// Ctrl-C in `npm run app`, or a kill: quit the same way, so the server is not left behind.
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => app.quit());

// Quit stops the server this app started. Imports and renders run detached and finish on their own.
app.on("before-quit", (e) => {
  if (quitting) return;
  quitting = true;
  e.preventDefault();
  listening?.abort();
  void server.stop().finally(() => app.exit(0));
});
