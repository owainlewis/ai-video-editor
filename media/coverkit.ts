// The kit for making a reel's cover in Higgsfield (Owain, 2026-11-13: "Use Higgsfield"): his blank
// portrait card, each of the cover's logos as a PNG to attach as a reference (the official files, so
// the model copies them rather than drawing its own), and his prompt with this reel's title in it.
// He makes the image there and drops it into the project as cover.png; approval then uses it.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openBrowser } from "@remotion/renderer";
import type { EditPlan } from "../engine/schema.ts";
import { useLogo } from "./project.ts";
import { ffmpeg, type Log, probeSize } from "./tools.ts";

const LIBRARY = join(import.meta.dirname, "../library");

// How each library logo is named in the prompt.
const NAMES: Record<string, string> = {
  google: "Google", openai: "OpenAI", anthropic: "Anthropic", claude: "Claude", deepseek: "DeepSeek", github: "GitHub",
  xai: "xAI", grok: "Grok", "claude-code": "Claude Code", "egm-elephant": "EGM", "egm-goldfish": "EGM", "gradient-bot": "Grok Bot",
};

// Owain's own prompt (2026-11-13), with the title and the logos for this reel, made at 9:16 with the
// text and logos inside the middle 3:4 the profile grid shows (a 3:4 cover needed empty space added).
export const coverPrompt = (title: string, logos: string[]) => `This is an Instagram reel cover. Add text at the top that says, in plain white Helvetica using Title Case:

> ${title}

Add these logos in the background, copied exactly from the attached logo images: ${logos.join(" and ")}. Do not add any other logo, brand or product. Be careful not to place anything on my head. Each logo should have a box or border around it. Avoid any tech cliches. Angle them so that they are visually interesting and fit the scene. They can sit slightly behind me if needed.

Keep the background plain. Go for high-quality and classy, not cheap, tacky AI slop. Professional and tasteful.

This is a tall 9:16 image. Extend the plain background to fill the frame. Keep the text and the logos within the middle three quarters of the height: nothing important in the top eighth or the bottom eighth, which Instagram's grid crops off. Leave clear empty space above the title: the top of the first line should sit about a fifth of the way down the image, not near the top edge.
`;

// Each logo drawn by Chrome on a dark 1024 px tile, the official file at its own colours. Many of
// them are white, so they need a dark ground: QuickLook flattened them onto white and Grok came out
// a blank square, which the model then drew from memory (2026-11-13).
async function logoTiles(logos: { id: string; src: string }[], out: string): Promise<void> {
  const browser = await openBrowser("chrome", { logLevel: "error" });
  try {
    const page = await browser.newPage({ context: () => null, logLevel: "error", indent: false, pageIndex: 0, onBrowserLog: () => {}, onLog: () => {} } as never);
    await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
    const cdp = (page as unknown as { _client(): { send(m: string, p?: object): Promise<{ value?: { data: string }; data?: string }> } })._client();
    for (const { id, src } of logos) {
      const html = `<body style="margin:0;width:1024px;height:1024px;background:#141414;display:grid;place-items:center"><img src="${src}" style="max-width:640px;max-height:640px;width:640px;object-fit:contain"></body>`;
      await page.goto({ url: `data:text/html;base64,${Buffer.from(html).toString("base64")}`, timeout: 30000 } as never);
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(out, `logo-${id}.png`), Buffer.from((shot.value ?? shot).data!, "base64"));
    }
  } finally {
    await browser.close({ silent: true } as never);
  }
}

export async function coverKit(dir: string, cover: NonNullable<EditPlan["cover"]>): Promise<string> {
  const out = join(dir, "renders/cover-kit");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const card = ["png", "jpg"].map((x) => join(LIBRARY, "covers", `${cover.image}.${x}`)).find((f) => existsSync(f));
  if (!card) throw new Error(`no cover card library/covers/${cover.image}.png`);
  copyFileSync(card, join(out, `portrait${card.slice(card.lastIndexOf("."))}`));
  const names: string[] = [];
  const tiles: { id: string; src: string }[] = [];
  for (const l of cover.logos) {
    const id = typeof l === "string" ? l : l.logo;
    // The brand's name, which the model knows; a tile's own label ("Your bot") is for the drawn cover.
    names.push(NAMES[id] ?? (typeof l === "string" ? undefined : l.name) ?? id);
    const src = useLogo(id);
    if (!src) throw new Error(`the cover's logo "${id}" is not in library/logos`);
    tiles.push({ id, src });
  }
  await logoTiles(tiles, out);
  writeFileSync(join(out, "prompt.txt"), coverPrompt(cover.title, names));
  return out;
}

// The cover as Instagram wants it: 1080x1920 (9:16). The picture sits at the bottom of the frame at
// full width, so the portrait runs off the bottom edge as a photo does, and the space above it is
// filled with its top edge's colour (the plain dark background, so there is no seam). The profile
// grid shows the middle 3:4 (y 240 to 1680): the title and the logos, near the top of the picture,
// stay in it, and only the bottom of the shirt falls below. Owain's first upload was the 3:4 image
// itself, and the grid cut the top of the title; a band under the shirt in a flat colour showed as a
// grey strip (both 2026-11-13).
export const UPLOAD = { width: 1080, height: 1920 };

// The average colour of a strip along the top edge, as ffmpeg's hex (0xRRGGBB).
function topColour(file: string): string {
  const out = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "crop=iw:max(2\\,ih/100):0:0,scale=1:1:flags=area,format=rgb24", "-f", "rawvideo", "-"]);
  const [r = 0, g = 0, b = 0] = out.stdout ?? [];
  return `0x${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function uploadCover(src: string, out: string, log?: Log): void {
  const { width: W, height: H } = UPLOAD;
  const [w, h] = probeSize(src);
  // Made at 9:16 already (Higgsfield's 9:16 is 1520x2688, a hair wider): filled to the frame, the
  // few pixels over trimmed from the sides.
  if (Math.abs(w / h / (W / H) - 1) < 0.02) {
    ffmpeg(["-i", src, "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`, "-q:v", "2", out], log);
    return;
  }
  // At full width, or full height for anything taller than 9:16 (then centred across).
  const wide = w / h > W / H;
  const fw = wide ? W : Math.round((H * w) / h / 2) * 2;
  const fh = wide ? Math.round((W * h) / w / 2) * 2 : H;
  ffmpeg(["-i", src, "-vf", `scale=${fw}:${fh}:flags=lanczos,pad=${W}:${H}:${(W - fw) / 2}:${H - fh}:color=${topColour(src)}`, "-q:v", "2", out], log);
}
