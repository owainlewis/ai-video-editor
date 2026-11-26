import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Browser, findActionPhrase } from "../media/record.ts";
import type { Word } from "../engine/schema.ts";

describe("record action phrase bounds", () => {
  const words: Word[] = [
    { text: "intro", start: 0, end: 0.5 },
    { text: "click", start: 1, end: 1.5 },
    { text: "here", start: 1.5, end: 2 },
    { text: "next", start: 3, end: 3.5 },
    { text: "later", start: 4, end: 4.5 },
  ];

  it("bounds action phrase lookup to [fromI, toI]", () => {
    // Inside [0, 3]: finds "click here" at index 1.
    expect(findActionPhrase(words, "click here", 0, 3)).toEqual([1, 1]);
    // At boundaries fromI and toI:
    expect(findActionPhrase(words, "intro", 0, 3)).toEqual([0, 0]);
    expect(findActionPhrase(words, "next", 0, 3)).toEqual([3, 3]);
    // Outside [0, 3]: "later" is at index 4 > toI, must throw.
    expect(() => findActionPhrase(words, "later", 0, 3)).toThrow(/scene|cut/i);
    // Before fromI: "intro" is at index 0 < fromI=1, must throw.
    expect(() => findActionPhrase(words, "intro", 1, 3)).toThrow(/scene|cut/i);
  });
});

describe("record Browser lifecycle and HELPERS guards", () => {
  it("guards Browser.close() against partial initialization without throwing", async () => {
    const b = new Browser("/tmp/unused-profile");
    await expect(b.close()).resolves.toBeUndefined();
    // Sending on an uninitialized/closed Browser rejects immediately rather than hanging.
    await expect(b.send("Page.enable")).rejects.toThrow(/not open/i);
  });

  it("rejects pending Browser.send() promises when WebSocket closes or errors", async () => {
    const b = new Browser("/tmp/unused-profile");
    const fakeWs = {
      readyState: WebSocket.OPEN,
      onopen: null as (() => void) | null,
      onmessage: null as ((e: { data: string }) => void) | null,
      onclose: null as (() => void) | null,
      onerror: null as (() => void) | null,
      send: () => {},
      close: () => {},
    };
    const internals = b as unknown as { ws: typeof fakeWs; rejectAll: (e: Error) => void };
    internals.ws = fakeWs;
    fakeWs.onclose = () => internals.rejectAll(new Error("browser WebSocket closed"));

    const pending = b.send("Page.captureScreenshot");
    fakeWs.onclose();
    await expect(pending).rejects.toThrow(/closed/i);

    const pending2 = b.send("Runtime.evaluate");
    await b.close();
    await expect(pending2).rejects.toThrow(/closed/i);
  });

  it("guards tween(ms) against ms <= 0 in HELPERS", async () => {
    const src = readFileSync(join(import.meta.dirname, "../media/record.ts"), "utf8");
    const m = src.match(/const tween = [^\n]+/);
    expect(m).toBeTruthy();
    const fn = new Function(
      "ease",
      "performance",
      "requestAnimationFrame",
      `${m![0]} return tween;`,
    );
    let rafCalls = 0;
    const tween = fn(
      (t: number) => t,
      { now: () => 1000 },
      () => {
        rafCalls++;
      },
    ) as (ms: number, f: (v: number) => void) => Promise<boolean>;

    const values: number[] = [];
    expect(await tween(0, (v) => values.push(v))).toBe(true);
    expect(await tween(-50, (v) => values.push(v))).toBe(true);
    expect(await tween(Number.NaN, (v) => values.push(v))).toBe(true);
    expect(values).toEqual([1, 1, 1]);
    expect(rafCalls).toBe(0);
  });

  it("resolves Chrome via @remotion/renderer and avoids hardcoded port 9377", () => {
    const src = readFileSync(join(import.meta.dirname, "../media/record.ts"), "utf8");
    expect(src).not.toContain("mac-arm64");
    expect(src).not.toContain("9377");
    expect(src).toContain("@remotion/renderer");
  });
});
