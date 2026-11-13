// The kit for making a reel's cover in Higgsfield (Owain, 2026-11-13: "Use Higgsfield"): his blank
// portrait card, each of the cover's logos as a PNG to attach as a reference (the official files, so
// the model copies them rather than drawing its own), and his prompt with this reel's title in it.
// He makes the image there and drops it into the project as cover.png; approval then uses it.
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openBrowser } from "@remotion/renderer";
import type { EditPlan } from "../engine/schema.ts";
import { useLogo } from "./project.ts";
import type { Log } from "./tools.ts";

const LIBRARY = join(import.meta.dirname, "../library");

// How each library logo is named in the prompt.
const NAMES: Record<string, string> = {
  google: "Google", openai: "OpenAI", anthropic: "Anthropic", claude: "Claude", deepseek: "DeepSeek", github: "GitHub",
  xai: "xAI", grok: "Grok", "claude-code": "Claude Code", "egm-elephant": "EGM", "egm-goldfish": "EGM", "gradient-bot": "Grok Bot",
};

// Owain's own prompt (2026-11-13), with the title and the logos for this reel.
export const coverPrompt = (title: string, logos: string[]) => `This is an Instagram reel cover. Add text at the top that says, in plain white Helvetica using Title Case:

> ${title}

Add these logos in the background, copied exactly from the attached logo images: ${logos.join(" and ")}. Do not add any other logo, brand or product. Be careful not to place anything on my head. Each logo should have a box or border around it. Avoid any tech cliches. Angle them so that they are visually interesting and fit the scene. They can sit slightly behind me if needed.

Keep the background plain. Go for high-quality and classy, not cheap, tacky AI slop. Professional and tasteful.
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
