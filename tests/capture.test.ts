import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const openBrowserMock = vi.fn();
vi.mock("@remotion/renderer", () => ({
  openBrowser: (...args: unknown[]) => openBrowserMock(...args),
}));

import { capture, clampFocusBox, clickText, pageName, sanitizePageName } from "../media/capture.ts";

const tempDirs: string[] = [];
const makeTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  openBrowserMock.mockReset();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("capture name sanitization", () => {
  it("keeps valid names and normalizes harmless punctuation", () => {
    expect(sanitizePageName("email")).toBe("email");
    expect(sanitizePageName("hero-2")).toBe("hero-2");
    expect(sanitizePageName("my_page")).toBe("my_page");
    expect(sanitizePageName("Pricing Page")).toBe("Pricing-Page");
  });

  it("rejects path traversal and unsafe names before spawning Chrome", async () => {
    for (const bad of ["../evil", "../../etc/passwd", "sub/dir", "sub\\dir", "..", ".", "", "   ", "foo\0bar", "a..b", "/abs"]) {
      expect(() => sanitizePageName(bad), bad).toThrow();
      await expect(capture("/tmp/nonexistent-projects", "slug", "https://example.com", { name: bad })).rejects.toThrow();
    }
    expect(openBrowserMock).not.toHaveBeenCalled();
  });

  it("derives safe default names from URLs", () => {
    expect(pageName("https://docs.example.com/guide/email")).toBe("email");
    expect(pageName("https://www.example.com/")).toBe("example-com");
  });
});

describe("capture focused box clamping", () => {
  it("clamps focus ring boxes to [0, 1] inside clip bounds", () => {
    // Field right at the bottom-right corner so +RING would overflow clip bounds.
    const res = clampFocusBox({ x: 896, y: 996, width: 4, height: 4 }, { width: 900, height: 1000 }, 5);
    expect(res).not.toBeNull();
    expect(res!.rect.x).toBe(891);
    expect(res!.rect.y).toBe(991);
    expect(res!.rect.x + res!.rect.width).toBeLessThanOrEqual(900);
    expect(res!.rect.y + res!.rect.height).toBeLessThanOrEqual(1000);
    const [x, y, w, h] = res!.box;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(1);
    expect(y + h).toBeLessThanOrEqual(1);

    // Field near top-left edge: x - RING < 0 must not expand past clip width.
    const tl = clampFocusBox({ x: 1, y: 1, width: 900, height: 1000 }, { width: 900, height: 1000 }, 5);
    expect(tl).not.toBeNull();
    expect(tl!.box).toEqual([0, 0, 1, 1]);

    // Non-positive clip returns null.
    expect(clampFocusBox({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 100 })).toBeNull();
  });
});

describe("capture clickText visibility", () => {
  it("clicks position:fixed elements where offsetParent is null using checkVisibility()", () => {
    let clicked = false;
    const fixedBtn = {
      offsetParent: null,
      innerText: "Sign in",
      checkVisibility: () => true,
      click: () => {
        clicked = true;
      },
    };
    const hiddenBtn = {
      offsetParent: null,
      innerText: "Sign in",
      checkVisibility: () => false,
      click: () => {
        throw new Error("should not click hidden button");
      },
    };
    const origDoc = globalThis.document;
    (globalThis as unknown as { document: unknown }).document = {
      querySelectorAll: () => [hiddenBtn, fixedBtn],
    };
    try {
      expect(clickText("Sign in")).toBe(true);
      expect(clicked).toBe(true);
    } finally {
      (globalThis as unknown as { document: unknown }).document = origDoc;
    }
  });
});

describe("capture viewport growth and empty clip guards", () => {
  it("re-runs measure() after the 3rd viewport growth pass so screenshot uses updated clip", async () => {
    const projects = makeTempDir("studio-cap-");
    let measureCalls = 0;
    const shotClips: { x: number; y: number; width: number; height: number }[] = [];
    const browserClose = vi.fn(async () => {});

    openBrowserMock.mockResolvedValue({
      newPage: async () => ({
        setViewport: async () => {},
        evaluateOnNewDocument: async () => {},
        goto: async () => {},
        url: () => "https://example.com/tall",
        evaluate: async (fn: (...args: unknown[]) => unknown) => {
          const src = String(fn);
          if (src.includes("navigator.userAgent")) return "HeadlessChrome/120";
          if (src.includes("document.fonts") || src.includes("MutationObserver")) return true;
          if (src.includes("scrollIntoView")) {
            measureCalls++;
            // First 3 passes still exceed innerHeight so all 3 viewport growths happen.
            // Pass 4 (the post-3rd-growth re-measure) returns the settled clip/scrollY.
            if (measureCalls <= 3) {
              return {
                clip: { x: 0, y: 0, width: 900, height: 3000 + measureCalls * 100 },
                scrollX: 0,
                scrollY: 100 * measureCalls,
                innerHeight: 2400,
                title: "Tall",
                icon: "",
                runs: [],
                blocks: [],
                fields: [],
              };
            }
            return {
              clip: { x: 0, y: 0, width: 900, height: 3500 },
              scrollX: 0,
              scrollY: 0,
              innerHeight: 3700,
              title: "Tall",
              icon: "",
              runs: [],
              blocks: [],
              fields: [],
            };
          }
          return true;
        },
        _client: () => ({
          send: async (method: string, params?: { clip?: { x: number; y: number; width: number; height: number } }) => {
            if (method === "Page.captureScreenshot" && params?.clip) {
              shotClips.push(params.clip);
              return { data: Buffer.from("png").toString("base64") };
            }
            return {};
          },
        }),
      }),
      close: browserClose,
    });

    const res = await capture(projects, "demo", "https://example.com/tall", { name: "tall" });
    expect(measureCalls).toBe(4);
    expect(shotClips[0]).toEqual({ x: 0, y: 0, width: 900, height: 3500, scale: 1 });
    expect(res.page.size).toEqual([900, 3500]);
    expect(browserClose).toHaveBeenCalledTimes(1);
  });

  it("throws and closes Chrome when measured clip has height <= 0", async () => {
    const projects = makeTempDir("studio-cap-empty-");
    const browserClose = vi.fn(async () => {});

    openBrowserMock.mockResolvedValue({
      newPage: async () => ({
        setViewport: async () => {},
        evaluateOnNewDocument: async () => {},
        goto: async () => {},
        url: () => "https://example.com/empty",
        evaluate: async (fn: (...args: unknown[]) => unknown) => {
          const src = String(fn);
          if (src.includes("navigator.userAgent")) return "HeadlessChrome/120";
          if (src.includes("document.fonts") || src.includes("MutationObserver")) return true;
          if (src.includes("scrollIntoView")) {
            return {
              clip: { x: 0, y: 100, width: 900, height: 0 },
              scrollX: 0,
              scrollY: 0,
              innerHeight: 2400,
              title: "Empty",
              icon: "",
              runs: [],
              blocks: [],
              fields: [],
              empty: true,
            };
          }
          return true;
        },
        _client: () => ({ send: async () => ({}) }),
      }),
      close: browserClose,
    });

    await expect(capture(projects, "demo", "https://example.com/empty", { name: "empty" })).rejects.toThrow(/non-positive/i);
    expect(browserClose).toHaveBeenCalledTimes(1);
  });
});
