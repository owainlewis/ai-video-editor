import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cdpCall, hasSessionData, saveSession, type Session, sessionFile, signin, validateSessionUrl } from "../media/session.ts";

const tempDirs: string[] = [];
const makeTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("session name validation", () => {
  it("accepts valid lowercase alphanumeric names with dashes", () => {
    expect(sessionFile("machinist")).toMatch(/\.sessions\/machinist\.json$/);
    expect(sessionFile("a")).toMatch(/\.sessions\/a\.json$/);
    expect(sessionFile("my-app-123")).toMatch(/\.sessions\/my-app-123\.json$/);
  });

  it("rejects path traversal, slashes, uppercase, empty, and overly long names", () => {
    for (const bad of ["", "../secret", "..", ".", "a/b", "a\\b", "MyApp", "-leading", "space name", "a".repeat(41), "foo.bar"]) {
      expect(() => sessionFile(bad), bad).toThrow();
    }
  });
});

describe("session URL validation", () => {
  it("accepts http:// and https:// URLs", () => {
    expect(validateSessionUrl("https://app.example.com/login")).toBe("https://app.example.com/login");
    expect(validateSessionUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects non-http(s) URLs before spawning Chrome", async () => {
    for (const badUrl of [
      "",
      "not-a-url",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "chrome://settings",
      "ftp://example.com",
      "--remote-debugging-port=1234",
    ]) {
      expect(() => validateSessionUrl(badUrl), badUrl).toThrow(/http/i);
      await expect(signin("test-app", badUrl)).rejects.toThrow(/http/i);
    }
  });
});

describe("session persistence and permissions", () => {
  it("writes session atomically with 0o700 dir and 0o600 file permissions and leaves no temp files", () => {
    const root = makeTempDir("studio-sess-");
    const dir = join(root, ".sessions");
    mkdirSync(dir, { mode: 0o755 });
    chmodSync(dir, 0o755);
    const file = join(dir, "app.json");
    const data: Session = {
      url: "https://example.com",
      at: "2026-11-26T00:00:00.000Z",
      cookies: [{ name: "sid", value: "secret", domain: "example.com", path: "/" }],
      storage: { "https://example.com": { token: "abc" } },
    };
    saveSession(file, data);
    expect(existsSync(file)).toBe(true);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(data);
    expect(readdirSync(dir)).toEqual(["app.json"]);
  });

  it("identifies empty vs captured sessions so existing files are not overwritten before capture", () => {
    expect(hasSessionData({ url: "https://a.com", at: "", cookies: [], storage: {} })).toBe(false);
    expect(
      hasSessionData({
        url: "https://a.com",
        at: "",
        cookies: [{ name: "a", value: "1", domain: "a.com", path: "/" }],
        storage: {},
      }),
    ).toBe(true);
    expect(
      hasSessionData({
        url: "https://a.com",
        at: "",
        cookies: [],
        storage: { "https://a.com": { k: "v" } },
      }),
    ).toBe(true);
  });

  it("atomically replaces existing session files with 0o600 permissions", () => {
    const root = makeTempDir("studio-atomic-");
    const file = join(root, "existing.json");
    writeFileSync(file, JSON.stringify({ old: true }), { mode: 0o644 });
    const next: Session = {
      url: "https://example.com",
      at: "2026-11-26T00:00:00.000Z",
      cookies: [{ name: "s", value: "2", domain: "example.com", path: "/" }],
      storage: {},
    };
    saveSession(file, next);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(next);
  });
});

describe("session CDP call resilience", () => {
  const origWs = globalThis.WebSocket;

  afterEach(() => {
    globalThis.WebSocket = origWs;
  });

  it("resolves on a normal CDP response", async () => {
    class OkWs {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = 0;
      onopen: ((e?: unknown) => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      onclose: ((e?: unknown) => void) | null = null;
      constructor(_url: string) {
        queueMicrotask(() => {
          this.readyState = 1;
          this.onopen?.();
        });
      }
      send() {
        queueMicrotask(() => {
          this.onmessage?.({ data: JSON.stringify({ id: 1, result: { cookies: [{ name: "a" }] } }) });
        });
      }
      close() {
        this.readyState = 3;
      }
    }
    globalThis.WebSocket = OkWs as unknown as typeof WebSocket;

    const res = await cdpCall<{ cookies: { name: string }[] }>("ws://127.0.0.1:1/test", "Storage.getCookies", {}, 500);
    expect(res).toEqual({ cookies: [{ name: "a" }] });
  });

  it("rejects promptly when WebSocket closes mid-call instead of hanging", async () => {
    class ClosingWs {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = 0;
      onopen: ((e?: unknown) => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      onclose: ((e?: unknown) => void) | null = null;
      constructor(_url: string) {
        queueMicrotask(() => {
          this.readyState = 1;
          this.onopen?.();
        });
      }
      send() {
        queueMicrotask(() => {
          this.readyState = 3;
          this.onclose?.();
        });
      }
      close() {
        this.readyState = 3;
      }
    }
    globalThis.WebSocket = ClosingWs as unknown as typeof WebSocket;

    await expect(cdpCall("ws://127.0.0.1:1/test", "Storage.getCookies", {}, 500)).rejects.toThrow(/closed|browser/i);
  });

  it("rejects promptly when WebSocket errors mid-call instead of hanging", async () => {
    class ErrorWs {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = 0;
      onopen: ((e?: unknown) => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      onclose: ((e?: unknown) => void) | null = null;
      constructor(_url: string) {
        queueMicrotask(() => {
          this.readyState = 1;
          this.onopen?.();
        });
      }
      send() {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }
      close() {
        this.readyState = 3;
      }
    }
    globalThis.WebSocket = ErrorWs as unknown as typeof WebSocket;

    await expect(cdpCall("ws://127.0.0.1:1/test", "Storage.getCookies", {}, 500)).rejects.toThrow(/reach the browser/i);
  });

  it("rejects promptly on WebSocket timeout instead of hanging", async () => {
    let closed = false;
    class HangingWs {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = 0;
      onopen: ((e?: unknown) => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      onclose: ((e?: unknown) => void) | null = null;
      constructor(_url: string) {
        queueMicrotask(() => {
          this.readyState = 1;
          this.onopen?.();
        });
      }
      send() {
        // Never responds.
      }
      close() {
        closed = true;
        this.readyState = 3;
      }
    }
    globalThis.WebSocket = HangingWs as unknown as typeof WebSocket;

    await expect(cdpCall("ws://127.0.0.1:1/test", "Storage.getCookies", {}, 50)).rejects.toThrow(/timed out/i);
    expect(closed).toBe(true);
  });
});
