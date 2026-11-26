// Capture a live web page for a reel: a section of it as a crisp PNG (3x, so 16px text is 48px
// and stays sharp when the camera moves in on a 1080 frame), and beside it the page's words with
// their boxes (engine/page.ts), so a plan names the words to mark instead of typing rects.
//   studio capture <slug> <url> [--name n] [--from "heading"] [--to "next heading"] [--dark] [--scale 3]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { openBrowser } from "@remotion/renderer";
import type { Box, Page } from "../engine/page.ts";
import { cookieParams, loadSession, storageScript } from "./session.ts";
import { type Log, writeJson } from "./tools.ts";

export type CaptureOptions = {
  // The file name in assets/pages/ (no extension). Defaults to the page's last path part.
  name?: string;
  // Text the section starts at (a heading, or any element whose text or image alt text starts so),
  // and the text of the first element after it. Without `from`, the capture starts at the top of the page.
  from?: string;
  to?: string;
  // Pages honour prefers-color-scheme; reels are light, so a page is captured light unless asked.
  dark?: boolean;
  scale?: number;
  // The browser window in CSS px. 900 wide gives most sites their narrow layout: big type, one column.
  width?: number;
  // Without `to`, how tall the capture is, in CSS px.
  height?: number;
  // A saved sign-in (.sessions/<name>.json, from `studio signin`) for a page behind a login.
  session?: string;
  // Text of a tab or button to click once the page has loaded, for a view with no URL of its own.
  click?: string;
};

type Cdp = { send(method: string, params?: object): Promise<{ value?: unknown } & Record<string, unknown>> };
type Rect = { x: number; y: number; width: number; height: number };
type MeasuredField = { label: string; kind: "text" | "check"; r: Rect; family: string; size: number; weight: number; color: string; bg: string; pad: number; secret: boolean };
type Measured = {
  clip: Rect;
  scrollX: number;
  scrollY: number;
  innerHeight: number;
  title: string;
  icon: string;
  runs: { text: string; r: Rect; block: number }[];
  blocks: { tag: string; r: Rect }[];
  fields: MeasuredField[];
  missing?: string;
  empty?: boolean;
};

export const pageName = (url: string) => {
  const u = new URL(url);
  const last = u.pathname.split("/").filter(Boolean).at(-1) ?? u.hostname.replace(/^www\./, "");
  return last.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "page";
};

// Sanitize a caller-supplied capture name so it stays a single safe filename inside assets/pages/.
export function sanitizePageName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[/\\\0]|\.\./.test(trimmed)) {
    throw new Error(`invalid capture name "${raw}": must be a single file name with no path separators or ".."`);
  }
  const clean = trimmed.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  if (!clean) throw new Error(`invalid capture name "${raw}"`);
  return clean;
}

function safeOutPath(dir: string, filename: string): string {
  const base = resolve(dir);
  const target = resolve(base, filename);
  if (!target.startsWith(base + sep)) {
    throw new Error(`capture output path escapes ${dir}: "${filename}"`);
  }
  return target;
}

// Clamp a focused field's ring rectangle to the captured clip and normalize its box into [0, 1].
export function clampFocusBox(f: Rect, clip: { width: number; height: number }, ring = 5): { rect: Rect; box: Box } | null {
  if (clip.width <= 0 || clip.height <= 0) return null;
  const x0 = Math.max(0, Math.min(clip.width, f.x - ring));
  const y0 = Math.max(0, Math.min(clip.height, f.y - ring));
  const x1 = Math.max(x0, Math.min(clip.width, f.x + f.width + ring));
  const y1 = Math.max(y0, Math.min(clip.height, f.y + f.height + ring));
  const rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  if (rect.width <= 0 || rect.height <= 0) return null;
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  const x = Math.max(0, Math.min(1, r4(rect.x / clip.width)));
  const y = Math.max(0, Math.min(1, r4(rect.y / clip.height)));
  const w = Math.max(0, Math.min(r4(1 - x), r4(rect.width / clip.width)));
  const h = Math.max(0, Math.min(r4(1 - y), r4(rect.height / clip.height)));
  return { rect, box: [x, y, w, h] };
}

export async function capture(projects: string, slug: string, url: string, opts: CaptureOptions = {}, log?: Log): Promise<{ png: string; json: string; page: Page }> {
  const scale = opts.scale ?? 3;
  const width = opts.width ?? 900;
  const name = opts.name !== undefined ? sanitizePageName(opts.name) : pageName(url);
  const out = join(projects, slug, "assets/pages");
  mkdirSync(out, { recursive: true });

  const browser = await openBrowser("chrome", { forceDeviceScaleFactor: scale, logLevel: "error" });
  try {
    const page = await browser.newPage({ context: () => null, logLevel: "error", indent: false, pageIndex: 0, onBrowserLog: () => {}, onLog: () => {} } as never);
    const cdp = (page as unknown as { _client(): Cdp })._client();
    let viewport = { width, height: 2400 };
    await page.setViewport({ ...viewport, deviceScaleFactor: scale });
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: opts.dark ? "dark" : "light" }] });
    // Some sites turn headless browsers away; this one says it is plain Chrome.
    const ua = String((await page.evaluate(() => navigator.userAgent)) ?? "");
    await cdp.send("Network.setUserAgentOverride", { userAgent: ua.replace(/HeadlessChrome/g, "Chrome") });
    // tsx names functions with a `__name` helper the page does not have.
    await page.evaluateOnNewDocument("globalThis.__name = (f) => f");
    if (opts.session) {
      const saved = loadSession(opts.session);
      await cdp.send("Network.setCookies", { cookies: cookieParams(saved) });
      await page.evaluateOnNewDocument(storageScript(saved));
      log?.(`signed in with the saved session "${opts.session}"`);
    }
    log?.(`opening ${url}`);
    await page.goto({ url, timeout: 60000 } as never);
    await settle(page);
    if (opts.click) {
      const clicked = await page.evaluate(clickText, opts.click);
      if (!clicked) throw new Error(`nothing on ${url} to click reads "${opts.click}"`);
      log?.(`clicked "${opts.click}"`);
      await settle(page);
    }

    const runMeasure = async (): Promise<Measured> => {
      const res = (await page.evaluate(measure, opts.from ?? null, opts.to ?? null, opts.height ?? 1400)) as Measured;
      if (res.missing) throw new Error(`no element on ${url} starts with "${res.missing}"`);
      if (res.empty || res.clip.height <= 0 || res.clip.width <= 0) {
        throw new Error(`capture section on ${url} has non-positive size (${Math.round(res.clip.width)}x${Math.round(res.clip.height)}); check --from and --to`);
      }
      return res;
    };

    let m: Measured | undefined;
    let grew = false;
    for (let pass = 0; pass < 3; pass++) {
      grew = false;
      m = await runMeasure();
      // An inner panel only paints what fits in the window, so the window grows to hold the section.
      const bottom = m.clip.y + m.clip.height;
      if (bottom <= m.innerHeight) break;
      viewport = { width, height: Math.ceil(bottom + 200) };
      log?.(`the section runs past the window; growing it to ${viewport.height}px`);
      await page.setViewport({ ...viewport, deviceScaleFactor: scale });
      await settle(page);
      grew = true;
    }
    if (grew) m = await runMeasure();
    const { clip } = m!;
    if (clip.height * scale > 16000) log?.(`warning: the capture is ${Math.round(clip.height * scale)}px tall; give --to to end it sooner`);

    // The screenshot's clip is in page coordinates: the viewport's plus how far the window scrolled.
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: clip.x + m!.scrollX, y: clip.y + m!.scrollY, width: clip.width, height: clip.height, scale: 1 }, captureBeyondViewport: false });
    const data = ((shot.value ?? shot) as { data: string }).data;
    const png = safeOutPath(out, `${name}.png`);
    writeFileSync(png, Buffer.from(data, "base64"));

    const norm = (r: Rect): Box => [r.x / clip.width, r.y / clip.height, r.width / clip.width, r.height / clip.height].map((v) => Math.round(v * 10000) / 10000) as Box;
    // Each box ticked, as the page itself draws it: the box and a little around it, saved for `check`.
    const checked = new Map<number, string>();
    for (const [i, f] of m!.fields.entries()) {
      if (f.kind !== "check") continue;
      const on = await page.evaluate((n: number) => {
        const el = document.querySelector<HTMLInputElement>(`[data-studio-field="${n}"]`);
        if (!el || el.checked) return false;
        el.checked = true;
        return true;
      }, i);
      if (!on) continue;
      await new Promise((ok) => setTimeout(ok, 120));
      const part = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: clip.x + m!.scrollX + f.r.x, y: clip.y + m!.scrollY + f.r.y, width: f.r.width, height: f.r.height, scale: 1 }, captureBeyondViewport: false });
      const file = `${name}-check-${i}.png`;
      writeFileSync(safeOutPath(out, file), Buffer.from(((part.value ?? part) as { data: string }).data, "base64"));
      checked.set(i, `assets/pages/${file}`);
      await page.evaluate((n: number) => {
        const el = document.querySelector<HTMLInputElement>(`[data-studio-field="${n}"]`);
        if (el) el.checked = false;
      }, i);
    }
    // Each field with focus, as the page draws it (its own ring or outline), with room around it for
    // the ring: shown under the typing while the agent types there.
    const focused = new Map<number, { src: string; box: Box }>();
    const RING = 5;
    for (const [i, f] of m!.fields.entries()) {
      if (f.kind !== "text") continue;
      const ok = await page.evaluate((n: number) => {
        const el = document.querySelector<HTMLElement>(`[data-studio-field="${n}"]`);
        el?.focus({ preventScroll: true });
        return !!el && document.activeElement === el;
      }, i);
      if (!ok) continue;
      await new Promise((done) => setTimeout(done, 150));
      const clamped = clampFocusBox(f.r, clip, RING);
      if (clamped) {
        const { rect: r, box } = clamped;
        const part = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: clip.x + m!.scrollX + r.x, y: clip.y + m!.scrollY + r.y, width: r.width, height: r.height, scale: 1 }, captureBeyondViewport: false });
        const file = `${name}-focus-${i}.png`;
        writeFileSync(safeOutPath(out, file), Buffer.from(((part.value ?? part) as { data: string }).data, "base64"));
        focused.set(i, { src: `assets/pages/${file}`, box });
      }
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    }
    const r4 = (v: number) => Math.round(v * 10000) / 10000;
    const icon = await saveIcon(m!.icon, out, name, log);
    const result: Page = {
      url: page.url() || url,
      title: m!.title,
      ...(icon ? { icon } : {}),
      dark: !!opts.dark,
      scale,
      size: [Math.round(clip.width), Math.round(clip.height)],
      runs: m!.runs.map((r) => ({ text: r.text, box: norm(r.r), block: r.block })),
      blocks: m!.blocks.map((b) => ({ tag: b.tag, box: norm(b.r) })),
      fields: m!.fields.map((f, i) => ({
        label: f.label,
        kind: f.kind,
        box: norm(f.r),
        ...(f.kind === "text" && { font: { family: f.family, size: r4(f.size / clip.height), weight: f.weight, color: f.color, bg: f.bg, pad: r4(f.pad / clip.width), ...(f.secret && { secret: true }) } }),
        ...(checked.has(i) && { checked: checked.get(i) }),
        ...(focused.has(i) && { focused: focused.get(i) }),
      })),
    };
    const json = safeOutPath(out, `${name}.json`);
    writeJson(json, result);
    log?.(`${Math.round(clip.width * scale)}x${Math.round(clip.height * scale)} px, ${result.runs.length} words, ${result.fields?.length ?? 0} form fields`);
    return { png, json, page: result };
  } finally {
    await browser.close({ silent: true } as never);
  }
}

// Wait for the page to finish: fonts loaded, images in, and nothing changing for most of a second.
// Clicks the smallest visible button, link or tab whose text is `text`. Runs in the page.
export function clickText(text: string): boolean {
  const want = text.trim().toLowerCase();
  const all = [...document.querySelectorAll<HTMLElement>("button, a, [role=tab], [role=button]")].filter(
    (e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true } as CheckVisibilityOptions) && (e.innerText ?? "").trim().toLowerCase() === want,
  );
  const el = all.sort((a, b) => a.innerText.length - b.innerText.length)[0];
  el?.click();
  return !!el;
}

async function settle(page: { evaluate: (f: () => unknown) => Promise<unknown> }) {
  await page.evaluate(() => document.fonts?.ready.then(() => true));
  await page.evaluate(
    () =>
      new Promise<boolean>((ok) => {
        let last = performance.now();
        const seen = new MutationObserver(() => (last = performance.now()));
        seen.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
        const start = performance.now();
        const tick = () => {
          const imgs = [...document.images].filter((i) => i.loading !== "lazy" || i.getBoundingClientRect().top < innerHeight);
          const done = imgs.every((i) => i.complete);
          if ((done && performance.now() - last > 800) || performance.now() - start > 10000) {
            seen.disconnect();
            ok(true);
          } else setTimeout(tick, 100);
        };
        tick();
      }),
  );
}

// Runs in the page: find the section, scroll it into view, hide what floats over it, and measure
// the section and every word in it, in viewport coordinates (some pages scroll an inner panel, not
// the window, so page coordinates would be wrong).
function measure(from: string | null, to: string | null, tall: number) {
  // An image's text is its alt text, so a section can start at a header drawn as a picture.
  const text = (e: Element) => (e instanceof HTMLImageElement ? e.alt : (e.textContent ?? "")).replace(/\s+/g, " ").trim();
  // The element that starts with `t`: a heading if one does, else the smallest element that does.
  const find = (t: string, after?: Element) => {
    const want = t.replace(/\s+/g, " ").trim().toLowerCase();
    const all = [...document.body.querySelectorAll("*")].filter((e) => {
      if (after && !(after.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      if (after && after.contains(e)) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && text(e).toLowerCase().startsWith(want);
    });
    const heading = all.find((e) => /^H[1-6]$/.test(e.tagName));
    return heading ?? all.find((e) => !all.some((o) => o !== e && e.contains(o)));
  };
  const start = from ? find(from) : null;
  if (from && !start) return { missing: from };
  if (start) {
    start.scrollIntoView({ block: "start" });
    // A sticky header would sit over the section's top; hide what floats, unless it holds the section.
    for (const e of document.body.querySelectorAll("*")) {
      const pos = getComputedStyle(e).position;
      if ((pos === "fixed" || pos === "sticky") && !e.contains(start)) (e as HTMLElement).style.visibility = "hidden";
    }
  } else window.scrollTo(0, 0);
  const end = to ? find(to, start ?? undefined) : null;
  if (to && !end) return { missing: to };

  const box = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
  let clip: { x: number; y: number; width: number; height: number };
  if (start) {
    // The section's column (the article or main it sits in), with a margin of page around it.
    const col = (start.closest("article, main, [role=main], .markdown-body") ?? document.body).getBoundingClientRect();
    const top = start.getBoundingClientRect().top - 24;
    const bottom = end ? end.getBoundingClientRect().top - 16 : top + tall;
    const x = Math.max(0, col.left - 24);
    clip = { x, y: Math.max(0, top), width: Math.min(innerWidth - x, col.width + 48), height: bottom - Math.max(0, top) };
  } else {
    const bottom = end ? end.getBoundingClientRect().top - 16 : Math.min(tall, document.documentElement.scrollHeight);
    clip = { x: 0, y: 0, width: innerWidth, height: bottom };
  }
  if (clip.height <= 0 || clip.width <= 0) {
    return { clip, scrollX, scrollY, innerHeight, title: document.title.trim(), icon: "", runs: [], blocks: [], fields: [], empty: true };
  }

  // Every word: its letters (punctuation at either end left out), its box and its block.
  const blocks: { tag: string; r: ReturnType<typeof box> }[] = [];
  const blockOf = new Map<Element, number>();
  const blockFor = (n: Node) => {
    let e = n.parentElement;
    while (e && e !== document.body && /^inline/.test(getComputedStyle(e).display)) e = e.parentElement;
    const el = e ?? document.body;
    if (!blockOf.has(el)) {
      blockOf.set(el, blocks.length);
      blocks.push({ tag: el.tagName.toLowerCase(), r: box(el.getBoundingClientRect()) });
    }
    return blockOf.get(el)!;
  };
  const runs: { text: string; r: ReturnType<typeof box>; block: number }[] = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const inClip = (r: DOMRect) => r.width > 0 && r.height > 0 && r.x + r.width / 2 >= clip.x && r.x + r.width / 2 <= clip.x + clip.width && r.y + r.height / 2 >= clip.y && r.y + r.height / 2 <= clip.y + clip.height;
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(parent.tagName)) continue;
    if (!parent.checkVisibility({ visibilityProperty: true, opacityProperty: true } as CheckVisibilityOptions)) continue;
    const s = n.textContent ?? "";
    for (const w of s.matchAll(/\S+/g)) {
      const lead = w[0].match(/^[^\p{L}\p{N}]*/u)![0].length;
      const trail = w[0].match(/[^\p{L}\p{N}]*$/u)![0].length;
      const word = w[0].slice(lead, w[0].length - trail);
      const range = document.createRange();
      // A word of only punctuation (an arrow, a bullet) keeps its own box.
      const a = word ? w.index! + lead : w.index!, b = word ? w.index! + w[0].length - trail : w.index! + w[0].length;
      range.setStart(n, a);
      range.setEnd(n, b);
      const r = range.getBoundingClientRect();
      if (!inClip(r)) continue;
      runs.push({ text: word || w[0], r: { x: r.x - clip.x, y: r.y - clip.y, width: r.width, height: r.height }, block: blockFor(n) });
    }
  }
  for (const b of blocks) b.r = { ...b.r, x: b.r.x - clip.x, y: b.r.y - clip.y };
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]')];
  // The sharpest icon the page offers: an SVG, else the largest.
  const size = (l: HTMLLinkElement) => (l.type === "image/svg+xml" || /\.svg($|\?)/.test(l.href) ? 1e6 : parseInt(l.sizes?.value) || 16);
  const icon = links.sort((x, y) => size(y) - size(x))[0]?.href ?? new URL("/favicon.ico", location.href).href;
  // The form's fields, for an agent typing into them. Each is tagged so the capture can tick its box.
  const fields: { label: string; kind: "text" | "check"; r: ReturnType<typeof box>; family: string; size: number; weight: number; color: string; bg: string; pad: number; secret: boolean }[] = [];
  const TEXT = /^(|text|email|password|search|tel|url|number)$/;
  const paint = (e: Element | null): string => {
    for (; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      const a = c.match(/[\d.]+/g);
      if (a && (a.length < 4 || +a[3] > 0.5)) return c;
    }
    return "rgb(255, 255, 255)";
  };
  const say = (t?: string | null) => (t ?? "").replace(/\s+/g, " ").trim().replace(/[*:]+$/, "").trim();
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")) {
    const type = el instanceof HTMLTextAreaElement ? "" : (el.getAttribute("type") ?? "").toLowerCase();
    const kind = el instanceof HTMLTextAreaElement || TEXT.test(type) ? "text" : type === "checkbox" || type === "radio" ? "check" : null;
    if (!kind || el.disabled || el.readOnly) continue;
    const named = document.getElementById(el.getAttribute("aria-labelledby") ?? "");
    const label = say(el.labels?.[0]?.textContent) || say(el.getAttribute("aria-label")) || say(named?.textContent) || say(el.getAttribute("placeholder")) || say(el.getAttribute("name"));
    // A styled box hides the real input; its label is what shows.
    let r = el.getBoundingClientRect();
    if (kind === "check" && (r.width < 4 || getComputedStyle(el).opacity === "0") && el.labels?.[0]) r = el.labels[0].getBoundingClientRect();
    if (!label || !inClip(r)) continue;
    const cs = getComputedStyle(el);
    el.setAttribute("data-studio-field", String(fields.length));
    fields.push({ label, kind, r: { x: r.x - clip.x, y: r.y - clip.y, width: r.width, height: r.height }, family: cs.fontFamily, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight) || 400, color: cs.color, bg: paint(el), pad: parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), secret: type === "password" });
  }
  return { clip, scrollX, scrollY, innerHeight, title: document.title.trim(), icon, runs, blocks, fields };
}

// The favicon, saved beside the capture for the browser window's tab. Returns its path in the project.
async function saveIcon(href: string, out: string, name: string, log?: Log): Promise<string | undefined> {
  try {
    const res = await fetch(href, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") ?? "";
    const ext = /svg/.test(type) ? "svg" : /png/.test(type) ? "png" : /icon|ico/.test(type) ? "ico" : /jpe?g/.test(type) ? "jpg" : /webp/.test(type) ? "webp" : undefined;
    if (!ext) return undefined;
    writeFileSync(safeOutPath(out, `${name}-icon.${ext}`), Buffer.from(await res.arrayBuffer()));
    return `assets/pages/${name}-icon.${ext}`;
  } catch {
    log?.(`no favicon at ${href}`);
    return undefined;
  }
}
