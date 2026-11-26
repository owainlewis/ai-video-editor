import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const openBrowserMock = vi.fn();
vi.mock("@remotion/renderer", () => ({
  openBrowser: (...args: unknown[]) => openBrowserMock(...args),
}));

import { coverKit, coverPrompt, grey, titleShift, topColour, uploadCover } from "../media/coverkit.ts";
import { probeSize, ROOT } from "../media/tools.ts";

describe("the Higgsfield cover prompt", () => {
  it("carries the title as written and names only the reel's own logos", () => {
    const p = coverPrompt("Give Your AI Agents Their Own Email", ["Grok", "Grok Bot"]);
    expect(p).toContain("> Give Your AI Agents Their Own Email");
    expect(p).toContain("copied exactly from the attached logo images: Grok and Grok Bot");
    expect(p).toContain("Do not add any other logo");
    expect(p).toContain("tall 9:16 image");
    expect(p).toContain("nothing important in the top eighth or the bottom eighth");
    expect(p).toContain("about a fifth of the way down");
  });
});

// One pixel's colour, as [r, g, b].
const pixel = (file: string, x: number, y: number) => [...spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `crop=1:1:${x}:${y},format=rgb24`, "-f", "rawvideo", "-"]).stdout];

describe("the cover for upload", () => {
  it("sits a 3:4 cover at the bottom of a 9:16 frame, its top in the grid's 3:4, the space above in its top colour", () => {
    const dir = mkdtempSync(join(tmpdir(), "cover-"));
    const src = join(dir, "cover.png");
    // 3:4: a blue band at the top edge, red in the middle, green at the bottom edge.
    spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=red:s=300x400", "-vf", "drawbox=y=0:w=iw:h=20:color=blue:t=fill,drawbox=y=380:w=iw:h=20:color=lime:t=fill", "-frames:v", "1", src]);
    const out = join(dir, "upload.jpg");
    uploadCover(src, out);
    expect(probeSize(out)).toEqual([1080, 1920]);
    // The picture is 1440 tall, from y 480: blue above it, its top band at 480, green at the bottom edge.
    expect(pixel(out, 540, 200)[2]).toBeGreaterThan(180);
    expect(pixel(out, 540, 520)[2]).toBeGreaterThan(180);
    const [r, g, b] = pixel(out, 540, 1200);
    expect(r).toBeGreaterThan(200);
    expect(g + b).toBeLessThan(60);
    expect(pixel(out, 540, 1910)[1]).toBeGreaterThan(180);
  });

  it("fills the frame with a cover made at 9:16, adding no space", () => {
    const dir = mkdtempSync(join(tmpdir(), "cover-"));
    const src = join(dir, "cover.png");
    spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=red:s=1520x2688", "-vf", "drawbox=y=0:w=iw:h=20:color=blue:t=fill", "-frames:v", "1", src]);
    const out = join(dir, "upload.jpg");
    uploadCover(src, out);
    expect(probeSize(out)).toEqual([1080, 1920]);
    expect(pixel(out, 540, 4)[2]).toBeGreaterThan(180);
    expect(pixel(out, 540, 200)[0]).toBeGreaterThan(200);
  });
});

// Instagram's grid draws its reel icon over the top-right of the 3:4 tile (Owain, 2026-11-14).
describe("the cover's title under the grid's reel icon", () => {
  // A dark 9:16 cover with white type from row `at` (in Higgsfield's 1520x2688).
  const cover = (at: number) => {
    const dir = mkdtempSync(join(tmpdir(), "cover-"));
    const src = join(dir, "cover.png");
    spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=0x141414:s=1520x2688", "-vf", `drawbox=x=300:y=${at}:w=900:h=120:color=white:t=fill`, "-frames:v", "1", src]);
    return { src, out: join(dir, "upload.jpg") };
  };

  it("moves a title that starts near the top of the grid's 3:4 down, below the icon", () => {
    const { src, out } = cover(400); // 286 in the frame, 3% down the 3:4
    uploadCover(src, out);
    // 12% down the 3:4 (y 240 to 1680) is frame row 413.
    expect(pixel(out, 540, 400)[0]).toBeLessThan(60);
    expect(pixel(out, 540, 425)[0]).toBeGreaterThan(200);
  });

  it("leaves a title that is already low enough where it is", () => {
    const { src, out } = cover(800); // 571 in the frame
    uploadCover(src, out);
    expect(pixel(out, 540, 560)[0]).toBeLessThan(60);
    expect(pixel(out, 540, 580)[0]).toBeGreaterThan(200);
  });

  it("moves a cover a tenth of the frame at most, and says so", () => {
    const W = 1080, H = 1920;
    const px = Buffer.alloc(W * H, 20);
    px.fill(255, 10 * W + 300, 10 * W + 700);
    px.fill(255, 11 * W + 300, 11 * W + 700);
    px.fill(255, 12 * W + 300, 12 * W + 700);
    const said: string[] = [];
    expect(titleShift(px, W, H, (m) => said.push(m))).toBe(192);
    expect(said.join()).toContain("Make the cover again");
  });

  it("finds no title on a light cover", () => {
    expect(titleShift(Buffer.alloc(1080 * 1920, 240), 1080, 1920)).toBe(0);
  });
});

describe("coverkit empty logos and ffmpeg error paths", () => {
  const savedPath = process.env.PATH;
  const tempDirs: string[] = [];
  const tempFiles: string[] = [];

  const makeTempDir = (prefix: string) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    openBrowserMock.mockReset();
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
    for (const f of tempFiles.splice(0)) rmSync(f, { force: true });
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("skips spawning Chrome when cover.logos is empty", async () => {
    const coversDir = join(ROOT, "library", "covers");
    const createdCoversDir = !existsSync(coversDir);
    mkdirSync(coversDir, { recursive: true });
    const cardName = `__test-portrait-${process.pid}`;
    const cardPath = join(coversDir, `${cardName}.png`);
    writeFileSync(cardPath, "fake-png");
    tempFiles.push(cardPath);
    if (createdCoversDir) tempDirs.push(coversDir);

    const projectDir = makeTempDir("studio-coverkit-");
    openBrowserMock.mockImplementation(() => {
      throw new Error("should not open Chrome when logos is empty");
    });

    const out = await coverKit(projectDir, { title: "No Logos Here", image: cardName, logos: [] });
    expect(openBrowserMock).not.toHaveBeenCalled();
    expect(existsSync(join(out, "portrait.png"))).toBe(true);
    expect(readFileSync(join(out, "prompt.txt"), "utf8")).toContain("No Logos Here");
    expect(readFileSync(join(out, "prompt.txt"), "utf8")).toContain("Do not add any logo");
  });

  it("throws when ffmpeg is missing or exits non-zero in topColour and grey", () => {
    // 1. Missing ffmpeg binary (spawnSync returns out.error = ENOENT).
    const emptyBin = makeTempDir("studio-empty-bin-");
    process.env.PATH = emptyBin;
    expect(() => topColour("/tmp/does-not-matter.png")).toThrow(/ffmpeg/i);
    expect(() => grey("/tmp/does-not-matter.png", "scale=10:10")).toThrow(/ffmpeg/i);

    // 2. Failing ffmpeg binary (non-zero exit status).
    const failBin = makeTempDir("studio-fail-bin-");
    const fakeFfmpeg = join(failBin, "ffmpeg");
    writeFileSync(fakeFfmpeg, `#!${process.execPath}\nprocess.stderr.write("corrupt input\\n");\nprocess.exit(1);\n`);
    chmodSync(fakeFfmpeg, 0o755);
    process.env.PATH = failBin;
    expect(() => topColour("/tmp/does-not-matter.png")).toThrow(/corrupt input/);
    expect(() => grey("/tmp/does-not-matter.png", "scale=10:10")).toThrow(/corrupt input/);
  });
});
