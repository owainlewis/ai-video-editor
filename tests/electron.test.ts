import { describe, expect, it } from "vitest";
import { type Listed, needsRestart, notices, routeFor, serverUrl, summary } from "../electron/logic.ts";
import { trayBitmap } from "../electron/icon.ts";

const reel = (slug: string, status: Listed["status"], approvedAt: string | null = null): Listed => ({
  slug,
  title: slug.toUpperCase(),
  status,
  approval: { state: approvedAt ? "approved" : "draft", at: approvedAt },
});

describe("the desktop app", () => {
  it("restarts the server for its own code, not for the editor or the data", () => {
    for (const f of ["engine/resolve.ts", "media/approve.ts", "server/index.ts", "styles/cards.ts", "effects/clean/Clean.tsx", "cli.ts", "package.json"]) expect(needsRestart(f), f).toBe(true);
    for (const f of ["app/Editor.tsx", "projects/a1-reel-1/edit.json", "library/broll/index.json", "tests/clean.test.ts", "docs/RULES.md", "engine/README.md", "electron/main.ts"])
      expect(needsRestart(f), f).toBe(false);
  });

  it("reads the server's address from its first line", () => {
    expect(serverUrl("Studio is running at http://localhost:4748")).toBe("http://localhost:4748");
    expect(serverUrl("vite ready")).toBeNull();
  });

  it("opens studio:// links on the editor's pages", () => {
    expect(routeFor("studio://p/a1-reel-1")).toBe("#/p/a1-reel-1");
    expect(routeFor("studio://p/a1-reel-1/review")).toBe("#/p/a1-reel-1/review");
    expect(routeFor("studio:///p/a1-reel-1/")).toBe("#/p/a1-reel-1");
    expect(routeFor("studio://gallery")).toBe("#/gallery");
    expect(routeFor("studio://")).toBe("#/");
    expect(routeFor("studio://p/../etc")).toBeNull();
    expect(routeFor("https://example.com")).toBeNull();
  });

  it("tells Owain when an import or export finishes, or anything fails, and nothing else", () => {
    const running = (stage: string) => ({ stage, done: false, at: "t1" });
    const before = [reel("a", running("Transcribing")), reel("b", running("Rendering 40%")), reel("c", running("Mixing")), reel("d", running("QC"))];
    const after = [
      reel("a", { stage: "Ready", done: true, at: "t2" }),
      reel("b", { stage: "Render failed", done: true, error: "\nQC found 2 errors: shot 3 runs off the frame\nmore", at: "t2" }),
      reel("c", { stage: "Mixed", done: true, at: "t2" }),
      reel("d", { stage: "Checked", done: true, at: "t2" }),
    ];
    expect(notices(before, after)).toEqual([
      { title: "Import ready", body: "A", route: "#/p/a" },
      { title: "B: Render failed", body: "QC found 2 errors: shot 3 runs off the frame", route: "#/p/b" },
    ]);
  });

  it("stays quiet about what had already finished, and about projects it had not seen", () => {
    const done = { stage: "Rendered", done: true, at: "t1" };
    expect(notices([reel("a", done)], [reel("a", done)])).toEqual([]);
    expect(notices([], [reel("a", done)])).toEqual([]);
    // The same stage again, later: a second export.
    expect(notices([reel("a", done)], [reel("a", { ...done, at: "t2" })])).toEqual([{ title: "Export finished", body: "A", route: "#/p/a" }]);
  });

  it("lists what is running and the week's approvals in the menu bar", () => {
    const now = Date.parse("2026-11-13T12:00:00");
    const s = summary(
      [reel("a", { stage: "Rendering 40%", done: false }), reel("b", null, "2026-11-12T10:00:00.000Z"), reel("c", null, "2026-11-01T10:00:00.000Z")],
      ["b"],
      now,
    );
    expect(s.working).toEqual([
      { slug: "a", label: "A: Rendering 40%" },
      { slug: "b", label: "B: Claude is working" },
    ]);
    expect(s.week).toBe("This week: 1 of 7 approved");
  });

  it("draws the menu bar icon as a template image with soft edges", () => {
    const { buffer, width, height } = trayBitmap();
    expect([width, height]).toEqual([36, 36]);
    const alpha = [...Array(width * height).keys()].map((i) => buffer[i * 4 + 3]);
    expect(alpha.some((a) => a === 255)).toBe(true);
    expect(alpha.some((a) => a > 0 && a < 255)).toBe(true);
    expect(alpha[0]).toBe(0);
    for (let i = 0; i < width * height; i++) expect(buffer[i * 4] + buffer[i * 4 + 1] + buffer[i * 4 + 2]).toBe(0);
  });
});
