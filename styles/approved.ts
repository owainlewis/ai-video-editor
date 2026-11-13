// The library cards that meet the bar (Owain, 2026-11-13: "empty the gallery and libraries so we
// only have high quality stuff in there"). The gallery and the editor's Library tab show only these;
// the gallery's "Show all" lists every card, to review candidates. A card joins once Owain approves
// it. Card ids are those in styles/blueprint/style.ts and styles/blueprint/apps.ts.
// 2026-11-13: the reel kit as rebuilt (app windows, code, flow diagrams, browser pages, logos, text
// cards), each at 0 QC errors in the clean light reel. Owain prunes from here.
export const APPROVED: ReadonlySet<string> = new Set<string>([
  "blueprint.t1.cli",
  "blueprint.t1.cli.codex",
  "blueprint.t1.cli.command",
  "blueprint.t1.claudeapp",
  "blueprint.t1.claudeapp.code",
  "blueprint.t1.grokbot",
  "blueprint.t1.grokbot.bots",
  "blueprint.t1.grokbot.profile",
  "blueprint.t2.code",
  "blueprint.t2.code.diff",
  "blueprint.t2.flow",
  "blueprint.t2.flow.column",
  "blueprint.t2.flow.versus",
  "blueprint.t1.beats",
  "blueprint.t1.list.bracket",
  "blueprint.t2.capture.browser",
  "blueprint.t2.logos",
  "blueprint.t2.flow.before-after",
  "blueprint.t2.flow.fan-in",
  "blueprint.t2.flow.fan-out",
]);
