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
import {
  isExternalUrl,
  isOwnUrl,
  type Listed,
  refreshState,
  RetryScheduler,
  routeFor,
  shouldClearFailed,
  summary,
} from "./logic.ts";
import { busy, shellEnv, StudioServer } from "./server.ts";

// The repo to run: STUDIO_REPO, else the checkout this file is in.
const REPO = resolve(process.env.STUDIO_REPO ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const server = new StudioServer(REPO);

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let windowReady = false;
let wantShow = false;
let projects: Listed[] = [];
let notes: string[] = [];
// Where to go once the editor is up, when a link or notification asked before it was.
let wanted: string | null = null;
// A studio:// link received before app.isReady() on cold launch.
let pendingLink: string | null = null;
// The last main-frame HTTP navigation status, to catch HTTP 500 error pages on did-finish-load.
let lastNav: { url: string; status: number } | null = null;
// Timer polling #root after did-finish-load to detect a blank/unmounted editor boot.
let bootTimer: NodeJS.Timeout | null = null;
// Prevent restarting a managed server in a loop if the editor itself stays broken.
let bootRestarted = false;

const own = (url: string) => isOwnUrl(url, server.url);
const openExternal = (url: string) => {
  if (isExternalUrl(url)) void shell.openExternal(url).catch(() => {});
};
const safeHash = (url: string) => {
  try {
    return new URL(url).hash;
  } catch {
    return "";
  }
};

function loadUrl(url: string) {
  if (!win || win.isDestroyed()) return;
  void win.loadURL(url).catch(() => {
    // ERR_ABORTED (-3) when superseded by a newer navigation, or load errors handled via did-fail-load.
  });
}

function clearBootCheck() {
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
}

const recovery = new RetryScheduler({
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 15_000,
  onRetry: (url) => {
    if (!win || win.isDestroyed() || server.state !== "ready" || !server.url) return;
    loadUrl(own(url) ? url : `${server.url}/`);
  },
  onExhausted: () => {
    if (!win || win.isDestroyed()) return;
    if (server.mode === "own" && !bootRestarted) {
      bootRestarted = true;
      recovery.clear();
      void server.restart("The editor failed to load; restarting");
      return;
    }
    loadUrl(page("Studio could not load", server.log.slice(-40).join("\n"), true));
  },
});

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
app.on("open-url", (e, link) => {
  e.preventDefault();
  if (app.isReady()) openLink(link);
  else pendingLink = link;
});

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
  windowReady = false;
  lastNav = null;
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
  win.once("ready-to-show", () => {
    windowReady = true;
    if (wantShow && win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  const keep = () => win && !win.isMinimized() && !win.isFullScreen() && saveSettings({ bounds: win.getBounds() });
  win.on("resized", keep);
  win.on("moved", keep);
  // Closing the window keeps Studio running in the menu bar; quitting is from the menu.
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    wantShow = false;
    win?.hide();
    app.dock?.hide();
  });
  win.on("closed", () => {
    recovery.dispose();
    clearBootCheck();
    lastNav = null;
    windowReady = false;
    win = null;
  });
  // The editor's own pages stay in the window; anything else opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (own(url)) return { action: "allow" };
    openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("did-start-loading", () => clearBootCheck());
  win.webContents.on("did-navigate", (_e, url, httpResponseCode) => {
    lastNav = { url, status: httpResponseCode };
  });
  // A blank window never stays blank (Owain, 2026-11-24: "Just a white screen", with the server
  // up). Electron shows plain white when a page fails to load (the server died or was restarting)
  // or when the page's process dies, and does not try again by itself.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, main) => {
    if (!main || code === -3) return; // -3: aborted by a newer navigation
    clearBootCheck();
    void handleLoadFailure(url);
  });
  win.webContents.on("render-process-gone", (_e, d) => {
    if (d.reason === "clean-exit") return;
    clearBootCheck();
    const url = win?.webContents.getURL() || `${server.url ?? ""}/`;
    void handleLoadFailure(url);
  });
  win.webContents.on("did-finish-load", () => {
    if (!win || win.isDestroyed()) return;
    const current = win.webContents.getURL();
    const status = lastNav && lastNav.url === current ? lastNav.status : null;
    if (!shouldClearFailed(current, server.url, status)) {
      // Never cancel retries when Chromium loads chrome-error://, data:, or an HTTP error page.
      if (own(current) && status !== null && status >= 400) void handleLoadFailure(current);
      return;
    }
    scheduleBootCheck();
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url === "studio://retry") return e.preventDefault(), void retryApp();
    if (own(url) || url.startsWith("data:")) return;
    e.preventDefault();
    openExternal(url);
  });
  render();
}

// Verify #root actually mounted after did-finish-load so a silent white page triggers recovery.
function scheduleBootCheck() {
  clearBootCheck();
  const delays = [300, 700, 1500, 2500];
  let step = 0;
  const check = async () => {
    bootTimer = null;
    if (!win || win.isDestroyed() || server.state !== "ready") return;
    const current = win.webContents.getURL();
    if (!own(current)) return;
    let mounted = false;
    try {
      mounted = Boolean(
        await win.webContents.executeJavaScript(
          "(() => { const r = document.getElementById('root'); return Boolean(r && r.childElementCount > 0); })()",
        ),
      );
    } catch {
      mounted = false;
    }
    if (mounted) {
      recovery.clear();
      bootRestarted = false;
      return;
    }
    if (step < delays.length) {
      bootTimer = setTimeout(() => void check(), delays[step++]);
    } else {
      void handleLoadFailure(current);
    }
  };
  bootTimer = setTimeout(() => void check(), delays[step++]);
}

async function handleLoadFailure(url: string) {
  recovery.markFailed(url);
  if (server.state === "ready") {
    const alive = await server.ensureAlive();
    if (!alive) return; // ensureAlive transitioned out of ready and started a restart
    recovery.schedule(url);
  }
}

async function checkWindowOnShow() {
  if (server.state !== "ready") return;
  const alive = await server.ensureAlive();
  if (!alive || !win || win.isDestroyed() || server.state !== "ready" || !server.url) return;
  if (win.webContents.isLoading()) return;
  const current = win.webContents.getURL();
  if (!own(current)) {
    render();
  } else if (lastNav && lastNav.url === current && lastNav.status >= 400) {
    void handleLoadFailure(current);
  } else {
    scheduleBootCheck();
  }
}

async function retryApp() {
  recovery.clear();
  bootRestarted = false;
  if (server.state === "failed" || server.state === "stopped") {
    await server.retry();
    return;
  }
  if (server.state === "ready") {
    const alive = await server.ensureAlive();
    if (!alive) return;
    if (server.mode === "own") {
      await server.restart("Retrying from error page");
    } else if (server.url) {
      loadUrl(`${server.url}/${wanted ?? ""}`);
      wanted = null;
    }
  }
}

function show(route?: string) {
  if (route) wanted = route;
  wantShow = true;
  if (!win) createWindow();
  app.dock?.show();
  if (windowReady && win && !win.isDestroyed()) {
    win.show();
    win.focus();
  }
  if (server.state === "ready") void checkWindowOnShow();
  go();
}

// Open the wanted page once the server is up.
function go() {
  if (!win || win.isDestroyed() || server.state !== "ready" || !server.url || !wanted) return;
  const target = `${server.url}/${wanted}`;
  wanted = null;
  if (win.webContents.getURL() !== target) loadUrl(target);
}

// Show whatever the server's state calls for: the editor, a starting page or the failure.
function render() {
  if (!win || win.isDestroyed()) return;
  const current = win.webContents.getURL();
  if (server.state === "ready" && server.url) {
    const failedUrl = recovery.retryNow();
    if (failedUrl) {
      const target = wanted ? `${server.url}/${wanted}` : own(failedUrl) ? failedUrl : `${server.url}/`;
      wanted = null;
      loadUrl(target);
      return;
    }
    // Same server: the editor reloads by itself once its event stream reconnects after a restart
    // (app/main.tsx). A new address (the port was taken) or a status page: load the editor,
    // keeping the page it was on.
    if (!own(current)) {
      const hash = current.startsWith("http") ? safeHash(current) : "";
      loadUrl(`${server.url}/${wanted ?? hash}`);
      wanted = null;
    } else go();
    return;
  }
  if (server.state === "failed") {
    clearBootCheck();
    loadUrl(page("Studio could not start", server.log.slice(-40).join("\n"), true));
    return;
  }
  if ((server.state === "starting" || (server.state === "stopped" && !quitting)) && (!server.url || !own(current))) {
    clearBootCheck();
    if (!wanted && current.startsWith("http")) {
      const hash = safeHash(current);
      if (hash) wanted = hash;
    }
    if (!current.startsWith("data:")) loadUrl(page("Starting Studio…", "", false));
  }
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
  if (link === "studio://retry") return void retryApp();
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
    if (!r.ok) return;
    const { path } = (await r.json()) as { path?: string };
    if (path && existsSync(path)) await shell.openPath(path);
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
    if (!r.ok || !r.body) throw new Error("event stream unavailable");
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
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
  if (listening === ctrl && !ctrl.signal.aborted && server.state === "ready") setTimeout(() => void listen(), 2000);
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
  const result = await refreshState(server.url, projects, tell, { busy });
  if (result.ok) {
    for (const n of result.alerts) notify(n);
    projects = result.projects;
    if (result.notes) notes = result.notes;
  }
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
  else listening?.abort();
});

app.whenReady().then(async () => {
  if (!primary) return; // a second launch: the first one has been told, and this one is quitting
  appMenu();
  buildTray();
  applyLogin();
  // Opened at login: stay in the menu bar until asked.
  const hidden = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes("--hidden");
  if (pendingLink) {
    const link = pendingLink;
    pendingLink = null;
    openLink(link);
  } else if (hidden) {
    app.dock?.hide();
  } else {
    show();
  }
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
  clearBootCheck();
  recovery.dispose();
  listening?.abort();
  void server.stop().finally(() => app.exit(0));
});
