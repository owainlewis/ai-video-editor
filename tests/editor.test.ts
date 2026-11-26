import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { clock, createEventBus, type Event, type EventSourceLike, watchRestarts } from "../app/api.ts";
import { mixPlanKey } from "../app/Editor.tsx";
import { Fields } from "../app/Inspector.tsx";
import { clamp, DEFAULTS, dragSize, LIMITS, panelStyle, parsePanels } from "../app/layout.tsx";
import { mergeProject } from "../app/project.ts";

describe("clock formatting", () => {
  it("carries tenths rounding into the next minute instead of formatting 60.0s", () => {
    expect(clock(0)).toBe("0:00.0");
    expect(clock(5.23)).toBe("0:05.2");
    expect(clock(59.94)).toBe("0:59.9");
    expect(clock(59.95)).toBe("1:00.0");
    expect(clock(59.96)).toBe("1:00.0");
    expect(clock(59.99)).toBe("1:00.0");
    expect(clock(60)).toBe("1:00.0");
    expect(clock(119.96)).toBe("2:00.0");
    expect(clock(3599.96)).toBe("60:00.0");
  });

  it("clamps negative and non-finite inputs to 0:00.0", () => {
    expect(clock(-0.1)).toBe("0:00.0");
    expect(clock(-120)).toBe("0:00.0");
    expect(clock(NaN)).toBe("0:00.0");
    expect(clock(Infinity)).toBe("0:00.0");
  });
});

describe("panel parsing and clamping", () => {
  it("clamps numbers to limits and falls back on non-finite values", () => {
    expect(clamp(100, LIMITS.left, 280)).toBe(240);
    expect(clamp(900, LIMITS.left, 280)).toBe(480);
    expect(clamp(300.6, LIMITS.left, 280)).toBe(301);
    expect(clamp(NaN, LIMITS.left, 280)).toBe(280);
    expect(clamp(Infinity, LIMITS.left, 280)).toBe(280);
  });

  it("guards parsePanels against NaN, non-numeric values, arrays, and invalid JSON", () => {
    expect(parsePanels(null, "reel")).toEqual(DEFAULTS.reel);
    expect(parsePanels("{broken", "youtube")).toEqual(DEFAULTS.youtube);
    expect(parsePanels("null", "reel")).toEqual(DEFAULTS.reel);
    expect(parsePanels("42", "reel")).toEqual(DEFAULTS.reel);
    expect(parsePanels("[]", "reel")).toEqual(DEFAULTS.reel);
    expect(
      parsePanels(
        JSON.stringify({ left: "300", right: null, bottom: 9999, showLeft: "no", showRight: false, showBottom: 0 }),
        "youtube",
      ),
    ).toEqual({
      left: DEFAULTS.youtube.left,
      right: DEFAULTS.youtube.right,
      bottom: LIMITS.bottom[1],
      showLeft: true,
      showRight: false,
      showBottom: true,
    });
    expect(
      parsePanels(JSON.stringify({ left: 100, right: 420.4, bottom: 50, showLeft: false }), "reel"),
    ).toEqual({
      left: LIMITS.left[0],
      right: 420,
      bottom: LIMITS.bottom[0],
      showLeft: false,
      showRight: true,
      showBottom: true,
    });
  });

  it("clamps splitter drag sizes to limits while preserving minimum viewer room", () => {
    const rect = { left: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
    const panels = { left: 280, right: 400, bottom: 300, showLeft: true, showRight: true, showBottom: true };
    // Viewer needs 280px, right takes 400px -> max room for left is 320px even if cursor is at 450px.
    expect(dragSize("left", { x: 450, y: 0 }, rect, panels)).toBe(320);
    // When right panel is hidden, left can reach its full max limit (480px).
    expect(dragSize("left", { x: 600, y: 0 }, rect, { ...panels, showRight: false })).toBe(480);
    // Right panel respects viewer room and clamps to min 280px.
    expect(dragSize("right", { x: 950, y: 0 }, rect, panels)).toBe(280);
    // Bottom panel keeps 220px for viewer height (800 - 220 = 580, clamped by LIMITS.bottom[1] = 560).
    expect(dragSize("bottom", { x: 0, y: 100 }, rect, panels)).toBe(560);
    expect(dragSize("bottom", { x: 0, y: 750 }, rect, panels)).toBe(150);
  });

  it("sets hidden panels to 0px in panelStyle", () => {
    expect(panelStyle({ left: 300, right: 350, bottom: 250, showLeft: false, showRight: true, showBottom: false })).toEqual({
      "--left": "0px",
      "--right": "350px",
      "--bottom": "0px",
    });
  });
});

describe("shared SSE multiplexer and boot-ID restart watcher", () => {
  const makeFakeSource = () => {
    const sources: (EventSourceLike & { closed: boolean; emit: (data: string) => void })[] = [];
    const connect = () => {
      const es = {
        onmessage: null as ((m: MessageEvent) => unknown) | null,
        closed: false,
        close() {
          this.closed = true;
        },
        emit(data: string) {
          this.onmessage?.({ data } as MessageEvent);
        },
      };
      sources.push(es);
      return es;
    };
    return { sources, connect };
  };

  it("shares one EventSource across subscribers and closes only when the last unsubscribes", () => {
    const { sources, connect } = makeFakeSource();
    const subscribe = createEventBus(connect);
    const a: Event[] = [];
    const b: Event[] = [];

    const offA = subscribe((e) => a.push(e));
    const offB = subscribe((e) => b.push(e));
    expect(sources).toHaveLength(1);

    sources[0].emit(JSON.stringify({ type: "plan", slug: "demo" }));
    sources[0].emit("{not json");
    expect(a).toEqual([{ type: "plan", slug: "demo" }]);
    expect(b).toEqual([{ type: "plan", slug: "demo" }]);

    offA();
    expect(sources[0].closed).toBe(false);
    sources[0].emit(JSON.stringify({ type: "cards" }));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);

    offB();
    expect(sources[0].closed).toBe(true);

    const offC = subscribe(() => {});
    expect(sources).toHaveLength(2);
    offC();
    expect(sources[1].closed).toBe(true);
  });

  it("reloads only when a server boot ID actually changes", () => {
    const { sources, connect } = makeFakeSource();
    const subscribe = createEventBus(connect);
    const reload = vi.fn();

    const stop = watchRestarts(subscribe, reload);
    // Initial connect: records boot ID, does not reload.
    sources[0].emit(JSON.stringify({ type: "hello", boot: "boot-1" }));
    expect(reload).not.toHaveBeenCalled();

    // Transient SSE drop / sleep-wake reconnecting to the same server: same boot ID, no reload.
    sources[0].emit(JSON.stringify({ type: "status", slug: "demo" }));
    sources[0].emit(JSON.stringify({ type: "hello", boot: "boot-1" }));
    expect(reload).not.toHaveBeenCalled();

    // Real server restart: new boot ID triggers reload.
    sources[0].emit(JSON.stringify({ type: "hello", boot: "boot-2" }));
    expect(reload).toHaveBeenCalledTimes(1);

    stop();
  });
});

describe("project reload merging and mix retry key", () => {
  const baseResolved = {
    slug: "demo",
    title: "Demo",
    duration: 10,
    fps: 30,
    video: "demo/v.mp4",
    videoSize: [1080, 1920] as [number, number],
    audio: null,
    face: { x: 0.5, y: 0.3, h: 0.2 },
    grade: { brightness: 1, contrast: 1, saturate: 1 },
    split: "half" as const,
    canvas: "reel" as const,
    captions: false,
    shots: [],
    chunks: [],
    sfx: [],
  };

  it("preserves resolved and cut object identity on status reloads with unchanged plan", () => {
    const old = {
      slug: "demo",
      status: { stage: "Mixing", done: false },
      resolved: { ...baseResolved },
      cut: { segments: [{ id: "s1", src: "main", in: 0, out: 10 }] },
      words: [{ text: "hello", start: 0, end: 0.5 }],
      wordsKey: "wk1",
      plan: '{"title":"Demo"}',
    };
    const next = {
      slug: "demo",
      status: { stage: "Failed", done: true, error: "mix failed" },
      resolved: { ...baseResolved },
      cut: { segments: [{ id: "s1", src: "main", in: 0, out: 10 }] },
      wordsKey: "wk1",
      plan: '{"title":"Demo"}',
    };
    const merged = mergeProject(old, next);
    expect(merged.resolved).toBe(old.resolved);
    expect(merged.cut).toBe(old.cut);
    expect(merged.words).toBe(old.words);
    expect(merged.status?.error).toBe("mix failed");
    expect(mixPlanKey(merged)).toBe(mixPlanKey(old));
  });

  it("replaces resolved and cut identity and mixPlanKey when plan or cut changes", () => {
    const old = {
      slug: "demo",
      status: null,
      resolved: { ...baseResolved },
      cut: { segments: [{ id: "s1", src: "main", in: 0, out: 10 }] },
      wordsKey: "wk1",
      plan: '{"title":"Demo"}',
    };
    const next = {
      slug: "demo",
      status: null,
      resolved: { ...baseResolved, title: "Updated" },
      cut: { segments: [{ id: "s1", src: "main", in: 0, out: 8 }] },
      wordsKey: "wk2",
      plan: '{"title":"Updated"}',
    };
    const merged = mergeProject(old, next);
    expect(merged.resolved).toBe(next.resolved);
    expect(merged.cut).toBe(next.cut);
    expect(mixPlanKey(merged)).not.toBe(mixPlanKey(old));
  });
});

describe("Inspector Fields control stability", () => {
  it("renders a stable textarea for strings both under and over 48 chars so focus never drops", () => {
    const shortHtml = renderToStaticMarkup(React.createElement(Fields, { name: "text", value: "Short text", onChange: () => {} }));
    const longHtml = renderToStaticMarkup(
      React.createElement(Fields, {
        name: "text",
        value: "A string that is definitely longer than forty-eight characters to test crossing the threshold",
        onChange: () => {},
      }),
    );
    expect(shortHtml).toContain("<textarea");
    expect(shortHtml).not.toContain("<input");
    expect(longHtml).toContain("<textarea");
    expect(longHtml).not.toContain("<input");
  });
});
