import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const remotionState = { frame: 0, fps: 30, width: 1080, height: 1920 };

vi.mock("remotion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("remotion")>();
  return {
    ...actual,
    useCurrentFrame: () => remotionState.frame,
    useVideoConfig: () => ({
      fps: remotionState.fps,
      width: remotionState.width,
      height: remotionState.height,
      durationInFrames: 300,
      id: "Test",
      defaultProps: {},
      props: {},
      defaultCodec: null,
    }),
    getRemotionEnvironment: () => ({ isStudio: false, isRendering: false, isPlayer: false, isReadOnlyStudio: false }),
    staticFile: (p: string) => `/static/${p}`,
    AbsoluteFill: ({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div style={style} {...rest}>
        {children}
      </div>
    ),
    Sequence: ({ children, name, from, durationInFrames }: { children?: React.ReactNode; name?: string; from?: number; durationInFrames?: number }) => (
      <div data-seq={name} data-from={from} data-dur={durationInFrames}>
        {children}
      </div>
    ),
    Img: ({ src, style }: { src?: string; style?: React.CSSProperties }) => <img src={src} style={style} />,
    OffthreadVideo: ({ src, startFrom, style }: { src?: string; startFrom?: number; style?: React.CSSProperties }) => (
      <video data-offthread="true" src={src} data-start-from={startFrom} style={style} />
    ),
  };
});

vi.mock("@remotion/media", () => ({
  Video: ({ src, trimBefore, style }: { src?: string; trimBefore?: number; style?: React.CSSProperties }) => (
    <video src={src} data-trim-before={trimBefore} style={style} />
  ),
  Audio: () => null,
}));

import { blank, shotAt } from "../effects/canvas.ts";
import { Clean, fillsPanel, PANEL } from "../effects/clean/Clean.tsx";
import { C } from "../effects/clean/kit.tsx";
import { GREEN } from "../effects/clean/text.tsx";
import { Wide } from "../effects/Wide.tsx";
import { Journey, VisualView } from "../effects/Visuals.tsx";
import { ChartVisual } from "../effects/elements.tsx";
import { MeterCard } from "../effects/cards.tsx";
import { pal, SceneCanvas, softTheme, SoftThemeContext } from "../effects/soft.tsx";
import { BLACK, GRAPHITE } from "../styles/ivory/tokens.ts";
import type { Resolved, ResolvedShot } from "../engine/schema.ts";

const makeShot = (overrides: Partial<ResolvedShot>): ResolvedShot => ({
  start: 0,
  end: 3,
  layout: "split",
  anchor: "test",
  ...overrides,
});

const makePlan = (canvas: "reel" | "youtube", shots: ResolvedShot[], extra: Partial<Resolved> = {}): Resolved => ({
  ...blank(canvas),
  title: "Test",
  duration: shots.length ? shots[shots.length - 1].end : 3,
  shots,
  ...extra,
});

beforeEach(() => {
  remotionState.frame = 0;
  remotionState.fps = 30;
  remotionState.width = 1080;
  remotionState.height = 1920;
});

describe("Clean full-bleed split margins", () => {
  it("fillsPanel matches synced videos and frame: none images on split shots only", () => {
    expect(fillsPanel(makeShot({ layout: "split", visual: { kind: "image", src: "hero.png", frame: "none", highlight: [] } }))).toBe(true);
    expect(fillsPanel(makeShot({ layout: "split", visual: { kind: "image", src: "page.png", frame: "browser", highlight: [] } }))).toBe(false);
    expect(fillsPanel(makeShot({ layout: "split", visual: { kind: "image", src: "card.png", frame: "card", highlight: [] } }))).toBe(false);
    expect(fillsPanel(makeShot({ layout: "split", visual: { kind: "video", src: "rec.mp4", start: 0, loop: false, rate: 1, sync: true } }))).toBe(true);
    expect(fillsPanel(makeShot({ layout: "split", visual: { kind: "video", src: "broll.mp4", start: 0, loop: false, rate: 1, sync: false } }))).toBe(false);
    expect(fillsPanel(makeShot({ layout: "full", visual: { kind: "image", src: "hero.png", frame: "none", highlight: [] } }))).toBe(false);
  });

  it("fills the full split panel edge to edge for frame: none images", () => {
    const shot = makeShot({
      layout: "split",
      visual: { kind: "image", src: "hero.png", frame: "none", highlight: [] },
    });
    const html = renderToStaticMarkup(<Clean {...makePlan("reel", [shot], { style: "clean" })} />);
    expect(html).toContain(`position:absolute;left:0;top:0;width:1080px;height:${PANEL}px`);
    expect(html).not.toContain("left:48px");
  });

  it("fills the full split panel for frame: none images even when from rect is set", () => {
    const shot = makeShot({
      layout: "split",
      visual: { kind: "image", src: "hero.png", frame: "none", from: [0, 0, 1, 0.5], highlight: [] },
    });
    const html = renderToStaticMarkup(<Clean {...makePlan("reel", [shot], { style: "clean" })} />);
    expect(html).toContain(`position:absolute;left:0;top:0;width:1080px;height:${PANEL}px`);
    expect(html).not.toContain("left:48px");
  });

  it("keeps margins for framed browser/card images on split shots", () => {
    const shot = makeShot({
      layout: "split",
      visual: { kind: "image", src: "page.png", frame: "browser", highlight: [] },
    });
    const html = renderToStaticMarkup(<Clean {...makePlan("reel", [shot], { style: "clean" })} />);
    expect(html).toContain("left:48px");
    expect(html).toContain("width:984px");
  });
});

describe("Last-frame shot lookup", () => {
  it("shotAt returns the last shot at time === duration and past end, and handles empty lists", () => {
    const shots: ResolvedShot[] = [
      makeShot({ start: 0, end: 2, anchor: "first" }),
      makeShot({ start: 2, end: 5, anchor: "last" }),
    ];
    expect(shotAt(shots, 0).index).toBe(0);
    expect(shotAt(shots, 1.99).index).toBe(0);
    expect(shotAt(shots, 2).index).toBe(1);
    expect(shotAt(shots, 5).index).toBe(1);
    expect(shotAt(shots, 5).shot?.anchor).toBe("last");
    expect(shotAt(shots, 9).index).toBe(1);
    expect(shotAt([], 0)).toEqual({ index: -1, shot: undefined });
  });

  it("keeps the last shot on Clean at time === duration instead of flashing shot 0", () => {
    const shots: ResolvedShot[] = [
      makeShot({ start: 0, end: 2, layout: "card", bg: "green", anchor: "first" }),
      makeShot({ start: 2, end: 5, layout: "card", bg: "paper", anchor: "last" }),
    ];
    remotionState.frame = 5 * 30; // time === duration (5s)
    const html = renderToStaticMarkup(<Clean {...makePlan("reel", shots, { style: "clean", duration: 5 })} />);
    expect(html).toContain(`background:${C.paper}`);
    expect(html).not.toContain(`background:${GREEN}`);
  });

  it("keeps the last shot on Wide at time === duration instead of flashing shot 0", () => {
    const shots: ResolvedShot[] = [
      makeShot({ start: 0, end: 2, layout: "over", anchor: "first", visual: { kind: "title", text: "FIRST_SHOT_TITLE" } }),
      makeShot({ start: 2, end: 5, layout: "over", anchor: "last", visual: { kind: "title", text: "LAST_SHOT_TITLE" } }),
    ];
    remotionState.frame = 5 * 30; // time === duration (5s)
    remotionState.width = 1920;
    remotionState.height = 1080;
    const html = renderToStaticMarkup(<Wide {...makePlan("youtube", shots, { duration: 5 })} />);
    expect(html).toContain("LAST_SHOT_TITLE");
    expect(html).not.toContain("FIRST_SHOT_TITLE");
  });
});

describe("Palette context scoping (no cross-tree leakage)", () => {
  it("does not leak YouTube black/graphite dark palette into subsequent Reel components or pal()", () => {
    const ytShot = makeShot({ start: 0, end: 3, layout: "media", tone: "dark", visual: { kind: "words", lines: [{ text: "Hello" }], side: "auto" } });
    remotionState.width = 1920;
    remotionState.height = 1080;

    // Render Wide with black theme, then dark (graphite) theme
    const ytBlack = renderToStaticMarkup(<Wide {...makePlan("youtube", [ytShot], { theme: "black" })} />);
    expect(ytBlack).toContain(BLACK.bg);

    const ytGraphite = renderToStaticMarkup(<Wide {...makePlan("youtube", [ytShot], { theme: "dark" })} />);
    expect(ytGraphite).toContain(GRAPHITE.bg);

    // Default pal("dark") must remain Forest (#192E28), unaffected by Wide renders
    expect(pal("dark").bg).toBe("#192E28");

    // Rendering a dark SceneCanvas outside Wide must use Forest (#192E28), not Black or Graphite
    const reelScene = renderToStaticMarkup(<SceneCanvas tone="dark" time={0} />);
    expect(reelScene).toContain("#192E28");
    expect(reelScene).not.toContain(BLACK.bg);
    expect(reelScene).not.toContain(GRAPHITE.bg);
  });

  it("scopes Wide black theme to its own tree when rendered alongside a Reel component in Gallery", () => {
    const ytShot = makeShot({ start: 0, end: 3, layout: "media", tone: "dark", visual: { kind: "words", lines: [{ text: "Hello" }], side: "auto" } });
    const html = renderToStaticMarkup(
      <div>
        <div data-tree="yt">
          <Wide {...makePlan("youtube", [ytShot], { theme: "black" })} />
        </div>
        <div data-tree="reel">
          <SceneCanvas tone="dark" time={0} />
        </div>
      </div>,
    );
    const [ytPart, reelPart] = html.split('data-tree="reel"');
    expect(ytPart).toContain(BLACK.bg);
    expect(reelPart).toContain("#192E28");
    expect(reelPart).not.toContain(BLACK.bg);
  });

  it("resets SoftThemeContext inside Clean even if rendered under a YouTube dark context", () => {
    const shot = makeShot({
      start: 0,
      end: 3,
      layout: "split",
      tone: "dark",
      visual: { kind: "stat", value: "99", label: "score", hit: true },
    });
    const html = renderToStaticMarkup(
      <SoftThemeContext.Provider value={softTheme(true, true)}>
        <Clean {...makePlan("reel", [shot], { style: "clean" })} />
      </SoftThemeContext.Provider>,
    );
    // Forest dark ink is #F7F3EC, whereas Black ink is #F5F5F2
    expect(html).toContain("#F7F3EC");
    expect(html).not.toContain(BLACK.ink);
  });
});

describe("Video trimBefore uses project FPS", () => {
  it("uses r.fps for Clean Picture b-roll trimBefore instead of hardcoded 30", () => {
    remotionState.fps = 60;
    const shot = makeShot({
      start: 0,
      end: 4,
      layout: "full",
      picture: { src: "clip.mp4", start: 2, rate: 1 },
    });
    const html = renderToStaticMarkup(<Clean {...makePlan("reel", [shot], { style: "clean", fps: 60 })} />);
    expect(html).toContain('data-trim-before="120"');
  });

  it("uses composition fps in Visuals VideoVisual for synced, scene, and default videos", () => {
    remotionState.fps = 60;

    const syncedShot = makeShot({ start: 2, end: 5, layout: "split" });
    const syncedHtml = renderToStaticMarkup(
      <VisualView slug="p" shot={syncedShot} time={2.5} w={1080} h={864} v={{ kind: "video", src: "screen.mp4", start: 0, loop: false, rate: 1, sync: true }} />,
    );
    expect(syncedHtml).toContain('data-trim-before="120"');

    const sceneShot = makeShot({ start: 0, end: 5, layout: "scene" });
    const sceneHtml = renderToStaticMarkup(
      <VisualView slug="p" shot={sceneShot} time={1} w={900} h={600} v={{ kind: "video", src: "b.mp4", start: 2, loop: false, rate: 1, sync: false }} />,
    );
    expect(sceneHtml).toContain('data-trim-before="120"');

    const cutawayShot = makeShot({ start: 0, end: 5, layout: "cutaway" });
    const cutawayHtml = renderToStaticMarkup(
      <VisualView slug="p" shot={cutawayShot} time={1} w={1920} h={1080} v={{ kind: "video", src: "c.mp4", start: 2, loop: false, rate: 1, sync: false }} bleed />,
    );
    expect(cutawayHtml).toContain('data-trim-before="120"');
  });
});

describe("Crash guards in effects/", () => {
  it("guards CineTitle and TitleVisual when v.words is shorter than the text words", () => {
    const shot = makeShot({ start: 0, end: 4, layout: "media" });
    expect(() =>
      renderToStaticMarkup(
        <VisualView slug="p" shot={shot} time={1} w={900} h={600} v={{ kind: "title", text: "One Two Three", cine: true, words: [0.2] }} />,
      ),
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(
        <VisualView slug="p" shot={shot} time={1} w={900} h={600} v={{ kind: "title", text: "One *Two* Three", sync: true, words: [0.2] }} />,
      ),
    ).not.toThrow();
  });

  it("guards StepsVisual when adjacent words are less than 0.1s apart", () => {
    const shot = makeShot({ start: 0, end: 4, layout: "split" });
    expect(() =>
      renderToStaticMarkup(
        <VisualView
          slug="p"
          shot={shot}
          time={1.05}
          w={900}
          h={600}
          v={{ kind: "steps", items: [{ text: "First" }, { text: "Second" }], times: [1.0, 1.04] }}
        />,
      ),
    ).not.toThrow();
  });

  it("guards Journey when n <= 1", () => {
    const html1 = renderToStaticMarkup(<Journey n={1} here={1} time={1} start={0} width={600} />);
    const html0 = renderToStaticMarkup(<Journey n={0} here={0} time={1} start={0} width={600} />);
    expect(html1).not.toContain("NaN");
    expect(html0).not.toContain("NaN");
  });

  it("guards ChartVisual with fewer than 2 points and uses unique clipPath IDs", () => {
    const shot = makeShot({ start: 0, end: 4, layout: "split" });
    expect(() =>
      renderToStaticMarkup(
        <ChartVisual shot={shot} time={1} w={900} h={600} v={{ kind: "chart", type: "line", points: [{ label: "Only", value: 10 }], source: "Illustration" }} />,
      ),
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(
        <ChartVisual shot={shot} time={1} w={900} h={600} v={{ kind: "chart", type: "bar", points: [], source: "Illustration" }} />,
      ),
    ).not.toThrow();

    const lineChart = {
      kind: "chart" as const,
      type: "line" as const,
      points: [
        { label: "A", value: 10 },
        { label: "B", value: 20 },
      ],
      source: "Illustration",
    };
    const twoCharts = renderToStaticMarkup(
      <>
        <ChartVisual shot={shot} time={2} w={900} h={600} v={lineChart} />
        <ChartVisual shot={shot} time={2} w={900} h={600} v={lineChart} />
      </>,
    );
    const ids = [...twoCharts.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).not.toBe("chart-0");
  });

  it("guards MeterCard when max === 0", () => {
    const shot = makeShot({ start: 0, end: 4, layout: "split" });
    const html = renderToStaticMarkup(
      <MeterCard slug="p" shot={shot} time={2} w={900} h={600} v={{ kind: "meter", value: 0, max: 0, label: "Zero", source: "Illustration" }} />,
    );
    expect(html).not.toContain("NaN");
  });
});
