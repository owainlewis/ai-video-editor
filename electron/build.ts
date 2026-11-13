// Builds Studio.app (`npm run app:build`): Electron's own app, renamed, with its icon and the
// studio:// scheme, holding a two-line entry that loads this repo's electron/main.ts. Studio's code
// (and the shell's) is never copied in, so the app always runs the repo as it is now, and needs
// building again only for a new Electron. Unsigned: macOS asks once, the first time it opens.
//   npm run app:build                  dist/Studio.app, for this checkout
//   npm run app:build -- --install     and copy it to /Applications
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appIconPixels, png } from "./icon.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(REPO, "node_modules/electron/dist/Electron.app");
const OUT = join(REPO, "dist/Studio.app");
const ID = "com.owainlewis.studio";

if (!existsSync(SOURCE)) throw new Error("Electron is not installed: run npm install first");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(dirname(OUT), { recursive: true });
cpSync(SOURCE, OUT, { recursive: true, verbatimSymlinks: true });

// The entry: point the shell at this checkout and start it.
const app = join(OUT, "Contents/Resources/app");
mkdirSync(app, { recursive: true });
writeFileSync(join(app, "package.json"), JSON.stringify({ name: "studio", productName: "Studio", type: "module", main: "main.js" }, null, 2));
writeFileSync(
  join(app, "main.js"),
  `// Studio.app runs the repo it was built from (electron/build.ts).\nprocess.env.STUDIO_REPO ??= ${JSON.stringify(REPO)};\nawait import(${JSON.stringify(join(REPO, "electron/main.ts"))});\n`,
);

// The icon, drawn at every size macOS asks for.
const iconset = join(REPO, "dist/studio.iconset");
rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset);
for (const size of [16, 32, 128, 256, 512]) {
  writeFileSync(join(iconset, `icon_${size}x${size}.png`), png(appIconPixels(size), size));
  writeFileSync(join(iconset, `icon_${size}x${size}@2x.png`), png(appIconPixels(size * 2), size * 2));
}
execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(OUT, "Contents/Resources/studio.icns")]);
rmSync(iconset, { recursive: true });
rmSync(join(OUT, "Contents/Resources/electron.icns"), { force: true });

// Its name, identity, icon and the studio:// scheme.
const plist = join(OUT, "Contents/Info.plist");
const buddy = (...cmds: string[]) => execFileSync("/usr/libexec/PlistBuddy", [...cmds.flatMap((c) => ["-c", c]), plist], { stdio: "pipe" });
buddy(
  "Set :CFBundleName Studio",
  "Set :CFBundleDisplayName Studio",
  `Set :CFBundleIdentifier ${ID}`,
  "Set :CFBundleIconFile studio.icns",
);
try {
  buddy("Delete :CFBundleURLTypes");
} catch {} // Electron's own plist has none today
buddy("Add :CFBundleURLTypes array", "Add :CFBundleURLTypes:0 dict", "Add :CFBundleURLTypes:0:CFBundleURLName string Studio", "Add :CFBundleURLTypes:0:CFBundleURLSchemes array", "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string studio");

// Electron's signature no longer matches once the bundle changed: sign it again, ad hoc, so macOS runs it.
execFileSync("codesign", ["--force", "--deep", "--sign", "-", OUT]);
console.log(`Built ${OUT}`);

if (process.argv.includes("--install")) {
  const target = "/Applications/Studio.app";
  rmSync(target, { recursive: true, force: true });
  cpSync(OUT, target, { recursive: true, verbatimSymlinks: true });
  // Tell Launch Services about it, so Spotlight and studio:// links find it straight away.
  execFileSync("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister", ["-f", target]);
  console.log(`Installed ${target}`);
}
