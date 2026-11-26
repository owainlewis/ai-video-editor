import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { clock, createEventBus, type Event, type EventSourceLike, watchRestarts } from "../app/api.ts";
import { mixPlanKey } from "../app/Editor.tsx";
import { bigWords, type PlanShot } from "../app/Inspector.tsx";
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
    ).toEqual({ ...DEFAULTS.youtube, bottom: LIMITS.bottom[1], showRight: false });
    expect(
      parsePanels(JSON.stringify({ left: 100, right: 420.4, bottom: 50, showLeft: false }), "reel"),
    ).toEqual({ ...DEFAULTS.reel, left: LIMITS.left[0], right: 420, bottom: LIMITS.bottom[0], showLeft: false });
  });

  it("keeps panels saved before the inspector had its own column", () => {
    // An old save has no inspector: it shows, at its usual width.
    const old = parsePanels(JSON.stringify({ left: 300, right: 360, bottom: 280, showLeft: true, showRight: true, showBottom: true }), "reel");
    expect(old.inspector).toBe(DEFAULTS.reel.inspector);
    expect(old.showInspector).toBe(true);
    expect(parsePanels(JSON.stringify({ inspector: 999, showInspector: false }), "reel")).toMatchObject({ inspector: LIMITS.inspector[1], showInspector: false });
  });

  it("clamps splitter drag sizes to limits while preserving minimum viewer room", () => {
    const rect = { left: 0, right: 1400, bottom: 800, width: 1400, height: 800 };
    const panels = { left: 280, inspector: 280, right: 400, bottom: 300, showLeft: true, showInspector: true, showRight: true, showBottom: true };
    // The room for the library: 1400 less padding (12), its gap (6), the inspector and Claude with
    // their gaps (286 + 406) and the viewer's 280 = 410, even with the pointer further right.
    expect(dragSize("left", { x: 700, y: 0 }, rect, panels)).toBe(410);
    // With Claude and the inspector hidden it reaches its own limit.
    expect(dragSize("left", { x: 900, y: 0 }, rect, { ...panels, showRight: false, showInspector: false })).toBe(480);
    // The pointer's distance from the right edge, less the padding and half the gap.
    expect(dragSize("right", { x: 1400 - 9 - 350, y: 0 }, rect, panels)).toBe(350);
    // The inspector's edge is Claude's column further in.
    expect(dragSize("inspector", { x: 1400 - 9 - 406 - 300, y: 0 }, rect, panels)).toBe(300);
    expect(dragSize("inspector", { x: 1400 - 9 - 300, y: 0 }, rect, { ...panels, showRight: false })).toBe(300);
    // The timeline keeps 220 px for the viewer, clamped to its own limits.
    expect(dragSize("bottom", { x: 0, y: 100 }, rect, panels)).toBe(560);
    expect(dragSize("bottom", { x: 0, y: 750 }, rect, panels)).toBe(150);
  });

  it("gives each shown side panel its width and gap, and a hidden one nothing", () => {
    expect(panelStyle({ left: 300, inspector: 260, right: 350, bottom: 250, showLeft: false, showInspector: true, showRight: true, showBottom: false })).toEqual({
      "--left": "0px",
      "--inspector": "266px",
      "--right": "356px",
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

describe("inspector: only the big words", () => {
  it("offers the hit word, a diagram's title, the header and a card's own title, and writes each back", () => {
    const shot: PlanShot = { at: "x", layout: "split", header: "Setup", hit: { text: "FAST", at: "fast" }, title: { lines: ["code", "review"] }, visual: { kind: "chart", title: "Speed", points: [] } as never };
    const w = bigWords(shot);
    expect(w.map((x) => x.label)).toEqual(["Hit word", "Title", "Header", "Title"]);
    expect((w[0].set(shot, "FASTER").hit as { text: string; at: string })).toEqual({ text: "FASTER", at: "fast" });
    expect((w[1].set(shot, "one\ntwo three").title as { lines: string[] }).lines).toEqual(["one", "two three"]);
    expect(w[2].set(shot, "").header).toBeUndefined();
    expect((w[3].set(shot, "Cost").visual as { title: string }).title).toBe("Cost");
  });
  it("offers each beat's words and keeps the rest of the item", () => {
    const shot: PlanShot = { at: "x", layout: "card", visual: { kind: "beats", items: [{ text: "one", size: "huge", at: "one" }, { text: "two", size: "mid" }] } as never };
    const w = bigWords(shot);
    expect(w.map((x) => x.label)).toEqual(["Beat 1", "Beat 2"]);
    expect((w[1].set(shot, "TWO").visual as { items: unknown[] }).items).toEqual([{ text: "one", size: "huge", at: "one" }, { text: "TWO", size: "mid" }]);
  });
  it("offers nothing for a graphic made of small print", () => {
    expect(bigWords({ at: "x", layout: "split", visual: { kind: "flow", shape: "row", nodes: [{ label: "a" }, { label: "b" }] } as never })).toEqual([]);
    expect(bigWords({ at: "x", layout: "split", visual: { kind: "image", src: "a.png", frame: "browser" } as never })).toEqual([]);
  });
});
