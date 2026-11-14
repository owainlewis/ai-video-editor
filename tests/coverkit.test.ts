import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coverPrompt, uploadCover } from "../media/coverkit.ts";
import { probeSize } from "../media/tools.ts";

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
