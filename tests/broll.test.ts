import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { brollFolder, clipsFolder, loadLibrary, useClip } from "../media/broll.ts";
import { ROOT } from "../media/tools.ts";

// The b-roll library's folder is a setting: STUDIO_BROLL in the environment or .env.
const saved = process.env.STUDIO_BROLL;
afterEach(() => {
  if (saved === undefined) delete process.env.STUDIO_BROLL;
  else process.env.STUDIO_BROLL = saved;
});

describe("b-roll library folder", () => {
  it("follows STUDIO_BROLL, with ~ as the home folder", () => {
    process.env.STUDIO_BROLL = "~/Clips/b-roll";
    expect(brollFolder()).toBe(join(homedir(), "Clips/b-roll"));
    expect(clipsFolder()).toBe(join(homedir(), "Clips/b-roll/.clips"));
    process.env.STUDIO_BROLL = "elsewhere/broll";
    expect(brollFolder()).toBe(join(ROOT, "elsewhere/broll"));
  });

  it("is library/broll when nothing sets it", () => {
    // A copy of the two modules in a folder with no .env, so its ROOT has no setting.
    const root = realpathSync(mkdtempSync(join(tmpdir(), "studio-broll-")));
    mkdirSync(join(root, "media"));
    for (const f of ["tools.ts", "broll.ts"]) copyFileSync(join(ROOT, "media", f), join(root, "media", f));
    const env = { ...process.env };
    delete env.STUDIO_BROLL;
    const out = execFileSync(join(ROOT, "node_modules/.bin/tsx"), ["-e", 'import("./media/broll.ts").then((m) => console.log(m.brollFolder()))'], { cwd: root, env, encoding: "utf8" });
    expect(out.trim()).toBe(join(root, "library", "broll"));
  });

  it("reads the index and copies shots from that folder", () => {
    const lib = mkdtempSync(join(tmpdir(), "studio-lib-"));
    mkdirSync(join(lib, ".clips"));
    writeFileSync(join(lib, "index.json"), JSON.stringify([{ id: "desk-1", description: "a desk" }]));
    writeFileSync(join(lib, ".clips", "desk-1.mp4"), "video");
    process.env.STUDIO_BROLL = lib;
    expect(loadLibrary().map((c) => c.id)).toEqual(["desk-1"]);
    const project = mkdtempSync(join(tmpdir(), "studio-proj-"));
    expect(useClip(project, "desk-1")).toBe("assets/broll/desk-1.mp4");
    expect(useClip(project, "gone-1")).toBeNull();
    // A shot the library no longer holds keeps playing from the project's own copy.
    process.env.STUDIO_BROLL = mkdtempSync(join(tmpdir(), "studio-empty-"));
    expect(useClip(project, "desk-1")).toBe("assets/broll/desk-1.mp4");
  });
});
