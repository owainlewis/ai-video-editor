// The edit plan. Claude Code writes `edit.json` in a project folder; `reel validate`
// resolves every spoken anchor to a time and writes `build/edit.resolved.json`,
// which is what the Remotion composition renders.
import { z } from "zod";

// A phrase the speaker says. Shots and reveals land on its first word.
// Each anchor must come after the previous shot's anchor in the transcript.
const Anchor = z.string().min(1);

// A rectangle in normalised image coordinates: [x, y, width, height], each 0 to 1.
const Rect = z.tuple([z.number(), z.number(), z.number(), z.number()]);
// A capture's camera: a rect, or words on a captured page (see the `image` visual).
const PhraseFrame = z.object({ phrase: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), pad: z.number().min(0).max(0.5).optional(), block: z.boolean().optional(), nth: z.number().int().min(1).optional() });
const CameraRect = z.union([Rect, PhraseFrame]);

const Item = z.object({ text: z.string(), at: Anchor.optional() });

// A form field's text, as the page sets it (from `capture`): `size` is a fraction of the capture's
// height, `pad` (the left padding and border) of its width.
// `secret`: a password field, which shows a dot for each letter.
const FieldFont = z.object({ family: z.string().optional(), size: z.number().positive(), weight: z.number().optional(), color: z.string().optional(), bg: z.string().optional(), pad: z.number().min(0).default(0), secret: z.boolean().optional() });
// One thing an agent does on a captured page: `type` into a field, `check` a box, `click` words (a
// button, a link). The target is a `field` by its label, or a `phrase` on the page, from the capture's
// json; a rect (with `font` for a field) only on a page without one. The resolver fills in the rest.
const PageAction = z
  .object({
    act: z.enum(["type", "click", "check"]),
    field: z.string().optional(),
    phrase: z.string().optional(),
    nth: z.number().int().min(1).optional(),
    rect: Rect.optional(),
    text: z.string().max(60).optional(),
    at: Anchor.optional(),
    font: FieldFont.optional(),
    // `check`: the box as the page draws it ticked; `type`: the field as the page draws it with
    // focus, and where that sits. The capture saves both.
    checked: z.string().optional(),
    focused: z.object({ src: z.string(), box: Rect }).optional(),
  })
  .refine((a) => [a.field, a.phrase, a.rect].filter(Boolean).length === 1, { message: "an action needs one target: a field, a phrase or a rect" })
  .refine((a) => a.act !== "type" || !!a.text, { message: "a type action needs its text" })
  .refine((a) => a.act !== "type" || !a.rect || !!a.font, { message: "a type action on a rect needs the field's font; name the field on a captured page instead" });

// The app mock-ups (effects/apps/): Claude Code and Codex in a terminal, the Claude app and Grok Bot,
// drawn from the real products' layout, colours and labels. Each plays a script of steps: a step
// lands on its own spoken words (`at`), else straight after the step before it.
// `code` spans (in backticks) and **bold** in a step's text are drawn as the app draws them.
// A line of code a tool wrote or changed: `op` marks a diff's removed (del) or added (add) line.
// `n` is its line number in the file; without one, lines count up from 1.
const CodeLine = z.object({ s: z.string().default(""), n: z.number().int().positive().optional(), op: z.enum(["add", "del"]).optional() });
const CliStep = z.object({
  // prompt: typed into the input, then sent; think: the working line with its verb ("Reading");
  // tool: a tool call (`name`, `text` its argument) that runs, then shows `out`; text: the agent's
  // reply; done: the turn's closing line ("Worked for 14s").
  // Claude Code only (captured from 2.1.323 on 2026-11-14): agents: subagents launched side by side
  // (`items`, what each one does); plan: plan mode's "Ready to code?" with the plan (`text` its
  // title, `items` its lines; a line ending in ":" is a heading) and the choice to proceed.
  type: z.enum(["prompt", "think", "tool", "text", "done", "agents", "plan"]),
  text: z.string().default(""),
  name: z.string().optional(),
  out: z.array(z.string()).max(4).optional(),
  // tool (Claude Code): `ask` puts up the permission box first, as manual mode does, and `pick` is
  // the choice made (1, "Yes", by default). `lines` is the code a Write wrote or an Update's diff,
  // shown in the box and under the done tool. `desc`: a Bash command's description.
  ask: z.boolean().optional(),
  pick: z.number().int().min(1).max(2).optional(),
  lines: z.array(CodeLine).max(8).optional(),
  desc: z.string().optional(),
  items: z.array(z.string()).max(8).optional(),
  // On a prompt that starts with "/": the command menu shown while it types (the real commands).
  menu: z.array(z.object({ name: z.string(), desc: z.string().default("") })).max(4).optional(),
  at: Anchor.optional(),
});
const ChatStep = z.object({
  // user: typed into the composer, then sent as a bubble; text: the reply streams in; list: a reply's
  // bullets, one at a time; think: the working line; tool: a folded tool row ("Ran 3 commands");
  // todo: a checklist whose rows tick one at a time; folder (Code, before the first message): the
  // folder menu opens on `items` and `text` is picked.
  type: z.enum(["user", "text", "list", "think", "tool", "todo", "folder"]),
  text: z.string().default(""),
  items: z.array(z.string()).max(5).optional(),
  at: Anchor.optional(),
});
// What the window sits on: nothing (the panel or the graphite stage), or light paper with a dot grid.
const Backdrop = z.enum(["none", "dots"]).default("none");
// Grok Bot's avatars: a coloured blob with two eyes. The colours and shapes are the app's own.
const BotColor = z.enum(["white", "green", "orange", "purple", "red"]);
const BotShape = z.enum(["round", "bean", "egg"]);
const GrokStep = z.object({
  // user: typed and sent; bot: the bot's reply lands; status: the bot's working line beside its avatar
  // ("Finding email address"); time: a day-and-time divider ("Today 7:07 AM").
  type: z.enum(["user", "bot", "status", "time"]),
  text: z.string(),
  at: Anchor.optional(),
});

export const Visual = z.discriminatedUnion("kind", [
  // A real capture (web page, screenshot, photo). The camera moves from `from` to `to`.
  // `highlight` draws a marker over a region when `at` is spoken.
  // On a page from `capture` (assets/pages/<name>.png with its .json), name words instead of rects:
  // a marker `{ "phrase": "Create address", "at": ... }`, a camera `{ "phrase": "...", "pad": 0.1 }`
  // (`phrase` may list several; `block: true` frames the paragraph it sits in; `nth` picks a later
  // match). The plan's resolve fills in the rects (engine/page.ts).
  z.object({
    kind: z.literal("image"),
    src: z.string(),
    from: CameraRect.optional(),
    to: CameraRect.optional(),
    // "browser" puts the capture in a browser window: `url` in the address bar (the site in ink, the
    // path muted), and `title` and `icon` (the page's real title and favicon) on its tab.
    frame: z.enum(["none", "browser", "card"]).default("card"),
    url: z.string().optional(),
    title: z.string().optional(),
    icon: z.string().optional(),
    // A marker over a region, swept in on `at`. `label` adds a callout tag pointing at it.
    highlight: z
      .array(
        z
          .object({ rect: Rect.optional(), phrase: z.string().optional(), nth: z.number().int().min(1).optional(), at: Anchor.optional(), label: z.string().optional() })
          .refine((h) => !!h.rect !== !!h.phrase, { message: "a highlight needs a rect or a phrase, not both" }),
      )
      .default([]),
    // A dark capture: the marker is sage, because a multiplied one disappears on a dark page.
    dark: z.boolean().optional(),
    // On a split, the card sits on a coloured `mat` (a colour from the subject's own brand), with the
    // source's real logo and name above it (`label`), so a plain capture reads as designed (Owain, 2026-10-26).
    mat: z.string().optional(),
    label: z.object({ text: z.string(), logo: z.string().optional() }).optional(),
    // Lifts one real element out of the capture on `at` and shows it large, the card dimmed behind.
    lift: z.object({ rect: Rect, at: Anchor }).optional(),
    // An agent at work on the page: a cursor goes to each target in turn, clicks it, and types into a
    // field or ticks a box. The page under it is the real capture (engine/actions.ts has the timing).
    actions: z.array(PageAction).max(8).optional(),
  }),
  // B-roll footage: a project file, or "broll:<id>" for a clip from the library.
  // `start` is the offset into the clip in seconds.
  // `loop` repeats a short clip (a library's own preview loop) to fill the shot.
  // `rate` below 1 slows a clip a little so a short shot can cover the next spoken word.
  // `sync`: a screen recording cut to match the video, so it plays from the shot's own time.
  z.object({ kind: z.literal("video"), src: z.string(), start: z.number().default(0), loop: z.boolean().default(false), rate: z.number().min(0.5).max(2).default(1), sync: z.boolean().default(false) }),
  // One or more official logos, never redrawn.
  z.object({
    kind: z.literal("logos"),
    items: z.array(z.object({ src: z.string(), name: z.string().optional(), at: Anchor.optional() })).min(1),
    caption: z.string().optional(),
  }),
  // A short headline. Wrap one word in *asterisks* for the Signifier italic accent.
  // `sync`: kinetic type, each word lands as Owain says its match (`words` is filled by the resolver).
  // `cine`: a cinematic quote title, one or two lines of Signifier on black, words fading in as said
  // (Owain, 2026-10-30: "I love these cinematic quote titles", after Alex M H Smith).
  z.object({ kind: z.literal("title"), text: z.string(), kicker: z.string().optional(), sync: z.boolean().optional(), cine: z.boolean().optional(), words: z.array(z.number()).optional() }),
  // `preview` shows every item dimmed from the start, an open loop the reel then closes item by item.
  // Repeat the same list in later shots to call back to it, with `active` on the current item.
  z.object({ kind: z.literal("list"), title: z.string().optional(), items: z.array(Item).min(2), active: z.number().optional(), preview: z.boolean().default(false) }),
  z.object({ kind: z.literal("steps"), title: z.string().optional(), items: z.array(Item).min(2) }),
  z.object({
    kind: z.literal("compare"),
    left: z.object({ label: z.string(), text: z.string() }),
    right: z.object({ label: z.string(), text: z.string(), at: Anchor.optional() }),
    // `even`: two sides of one idea, neither wrong: no strike-through, both set the same.
    even: z.boolean().optional(),
  }),
  // `hit`: lands complete on the cut (no count-up, label already there), for a short full-frame
  // hero number. A count-up flashes numbers that were never said.
  z.object({ kind: z.literal("stat"), value: z.string(), label: z.string(), hit: z.boolean().optional() }),
  // The end card: "Comment KEYWORD" and what they get. Only when there is a real resource to send.
  z.object({ kind: z.literal("cta"), keyword: z.string(), text: z.string(), src: z.string().optional() }),
  // A bar or line chart whose points arrive on their words. `source` is printed under it: the page the
  // numbers come from, or "Illustration" when they only show a shape. Never invent the values.
  z.object({
    kind: z.literal("chart"),
    type: z.enum(["bar", "line"]).default("bar"),
    title: z.string().optional(),
    unit: z.string().optional(),
    // `bound`: the value is an upper bound, not a measurement. The bar is a dashed outline and its
    // label reads "≤", so a chart never presents a limit as a result.
    points: z.array(z.object({ label: z.string(), value: z.number(), note: z.string().optional(), bound: z.boolean().optional(), at: Anchor.optional() })).min(2).max(8),
    highlight: z.number().optional(),
    source: z.string(),
  }),
  // The theory of constraints: stages as circles in a row, work flowing through as dots. Stage
  // `bottleneck` narrows on `at` (default: just after it lands) and a queue piles up in front of it.
  z.object({
    kind: z.literal("constraint"),
    title: z.string().optional(),
    stages: z.array(z.object({ label: z.string(), at: Anchor.optional() })).min(3).max(5),
    bottleneck: z.number().int().min(1),
    note: z.string().optional(),
    at: Anchor.optional(),
  }),
  // A process as numbered stages on a track; each lights as it is named. List only the stages that
  // are said: unnamed stages draw as empty circles, which look unfinished (`check` warns).
  z.object({ kind: z.literal("pipeline"), title: z.string().optional(), stages: z.array(z.object({ label: z.string().optional(), at: Anchor.optional() })).min(2).max(8) }),
  // A lower third over the speaker's picture: a name or point in serif, a short line in sans below it.
  z.object({ kind: z.literal("lower"), title: z.string(), sub: z.string().optional() }),
  // A chapter card: a large number lands over a soft glow, the chapter's name tracked out below it.
  // `hit`: a full-frame card that lands complete on the cut, set like a hero stat (YouTube).
  // A counter whose digits roll to each value as it is said (`steps`, one to three), with an optional
  // result that punches in on its word ("12x"; *marked* text takes the accent). Real numbers only.
  z.object({
    kind: z.literal("odometer"),
    steps: z.array(z.object({ value: z.number(), at: Anchor.optional() })).min(1).max(3),
    label: z.string(),
    result: z.object({ text: z.string(), at: Anchor.optional() }).optional(),
  }),
  // Focus lift over a screen recording: `region` of the frame ([x, y, w, h] in 1920x1080 pixels)
  // lifts off the blurred page as a card and settles back as the shot ends. `mark` highlights a
  // phrase inside it, sweeping from the word `from` to the word `to` as they are said.
  z.object({
    kind: z.literal("lift"),
    region: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    mark: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    from: Anchor.optional(),
    to: Anchor.optional(),
  }),
  // Claude Code or Codex running in a terminal, as the real CLI draws it (captured 2026-11-13): the
  // welcome header, the history, the working line, the input and its footer. The terminal keeps the
  // newest rows, as a real one scrolls.
  z.object({
    kind: z.literal("cli"),
    app: z.enum(["claude-code", "codex"]).default("claude-code"),
    cwd: z.string().default("~/project"),
    // The model line under the name: "Opus 5.5 · Claude Max", "GPT-6-Astra medium".
    model: z.string().optional(),
    welcome: z.boolean().default(true),
    // Claude Code's permission mode, in the footer: auto (Owain's), plan, accept edits or manual.
    mode: z.enum(["auto", "plan", "accept", "manual"]).default("auto"),
    backdrop: Backdrop,
    steps: z.array(CliStep).min(1).max(14),
  }),
  // The Claude desktop app: a chat (`chat`, replies in the serif) or a Code session (`code`). The
  // sidebar shows on a wide frame, as the app hides it on a narrow window. `theme`: the app's dark
  // mode (the default) or its light mode, in claude.ai's own colours for each.
  z.object({
    kind: z.literal("claudeapp"),
    mode: z.enum(["chat", "code"]).default("chat"),
    theme: z.enum(["dark", "light"]).default("dark"),
    title: z.string().optional(),
    model: z.string().default("Opus 5.5"),
    effort: z.string().default("High"),
    recents: z.array(z.string()).max(6).default([]),
    backdrop: Backdrop,
    steps: z.array(ChatStep).min(1).max(10),
  }),
  // The Grok Bot app (xAI), from Owain's screenshot of it: `chat` with one bot, `bots` (the list, a
  // new bot arriving on its word) or `profile` (the bot's page, its scheduled tasks switching on).
  // Sample content only: never the private text in the source screenshot.
  z.object({
    kind: z.literal("grokbot"),
    view: z.enum(["chat", "bots", "profile"]).default("chat"),
    backdrop: Backdrop,
    bot: z.object({ name: z.string(), color: BotColor.default("white"), shape: BotShape.optional() }).default({ name: "Gradient Bot", color: "white" }),
    steps: z.array(GrokStep).max(8).default([]),
    bots: z.array(z.object({ name: z.string(), preview: z.string().default(""), color: BotColor, shape: BotShape.optional(), group: z.string().optional(), unread: z.boolean().optional(), at: Anchor.optional() })).max(7).default([]),
    tasks: z.array(z.object({ name: z.string(), when: z.string(), on: z.boolean().default(true), at: Anchor.optional() })).max(5).default([]),
  }),
  // A one-off motion graphic designed for this reel (Owain, 2026-10-25: "creative freedom to come up
  // with new interesting motion graphics per reel"). `name` picks a component in effects/custom/;
  // `props` is its content; `at` lists its spoken beats in order, passed to it as times.
  z.object({
    kind: z.literal("custom"),
    name: z.string(),
    props: z.record(z.string(), z.unknown()).default({}),
    at: z.array(Anchor).default([]),
  }),
  // The route of the video: a title over a track of numbered stops that pop in on `at` ("the six levels").
  z.object({ kind: z.literal("journey"), title: z.string(), of: z.number().int().min(2).max(12), at: Anchor.optional() }),
  // `of`: how many sections there are; a hit card then shows a progress row, one mark per section
  // (done in ink, this one in the accent, the rest faint).
  z.object({ kind: z.literal("chapter"), number: z.string(), label: z.string(), hit: z.boolean().optional(), of: z.number().int().min(2).max(12).optional() }),
  // A diagram with real layout (engine/flow.ts): nodes as cards, laid out by `shape` with equal gaps
  // and arrows between them, sized to fill the panel and centred. No coordinates: the layout engine
  // places everything. row and column: each node to the next. fan-out: the first node to every other.
  // fan-in: every node to the last. before-after: two nodes; the first is struck as the second lands.
  // versus: two nodes as columns, their `items` in rows compared across.
  // A node: `label` (the real name), `sub` (a short line under it), `icon` ("logo:<name>" for a real
  // logo, or a line icon: file, folder, terminal, browser, database, server, cloud, user, agent, chat,
  // mail, code, branch, lock, check, gear), `accent` on the one node that matters, `at` its word.
  // `arrow`: the arrow into this node (on a fan-in, out of it): `label` (what is passed, "plan.md")
  // and `at`; left out, the arrow draws as the node it joins lands. A diagram, never stand-in UI.
  z.object({
    kind: z.literal("flow"),
    shape: z.enum(["row", "column", "fan-out", "fan-in", "before-after", "versus"]).default("row"),
    nodes: z
      .array(
        z.object({
          label: z.string().min(1),
          sub: z.string().optional(),
          icon: z.string().optional(),
          accent: z.boolean().optional(),
          at: Anchor.optional(),
          arrow: z.object({ label: z.string().optional(), at: Anchor.optional() }).optional(),
          items: z.array(Item).max(4).default([]),
        }),
      )
      .min(2)
      .max(6),
  }),
  // An editor window (engine/code.ts): the file's tab, line numbers, syntax colours in a light theme.
  // Lines type on, each on its word (`at`), or straight after the line above. Any line with `diff`
  // makes it a diff: the file shows as it was, a `del` line is struck red on its word and an `add`
  // line slides in green. `marks` light a line or a range (`from`, `to`: lines counted from 1 in
  // `lines`) on a word. `start`: the first line's number. `typed: false` shows the file at once (a
  // line with its own `at` still appears on its word). The plan supplies every line, never invented.
  z.object({
    kind: z.literal("code"),
    file: z.string().min(1),
    lang: z.enum(["ts", "js", "py", "json", "bash", "text"]).optional(),
    start: z.number().int().min(1).default(1),
    typed: z.boolean().default(true),
    lines: z.array(z.object({ text: z.string(), diff: z.enum(["add", "del"]).optional(), at: Anchor.optional() })).min(1).max(16),
    marks: z.array(z.object({ from: z.number().int().min(1), to: z.number().int().min(1).optional(), at: Anchor })).max(4).default([]),
  }),
  // A library that fills in: real thumbnails (`items`, captured from the source's own site) arrive in
  // a wave and `count` rolls up like an odometer on `at`. `groups` light a set of tiles on their words,
  // with the group's label landing under the count. With no items it is just the count and its labels.
  z.object({
    kind: z.literal("grid"),
    items: z.array(z.string()).default([]),
    count: z.string().optional(),
    label: z.string().optional(),
    cols: z.number().int().min(2).max(6).default(3),
    at: Anchor.optional(),
    groups: z.array(z.object({ label: z.string(), tiles: z.array(z.number()).default([]), at: Anchor.optional() })).default([]),
  }),
  // Many sources flow into one result: chips (plain words, never invented URLs) land, lines draw from
  // each into the result card, dots travel down them, and the card's rows land on their words.
  // With no items it is the card alone, large and centred.
  z.object({
    kind: z.literal("funnel"),
    items: z.array(z.object({ text: z.string(), at: Anchor.optional() })).max(9).default([]),
    at: Anchor.optional(),
    target: z.object({ title: z.string(), kicker: z.string().optional(), lines: z.array(Item).default([]) }),
  }),
  // Two or three real pages as stacked browser windows, each landing in front on its word ("I read
  // three posts about this"). Each shows its capture at `from` (default: the top of the page).
  z.object({
    kind: z.literal("windows"),
    items: z.array(z.object({ src: z.string(), url: z.string().optional(), from: Rect.optional(), at: Anchor.optional() })).min(2).max(3),
    active: z.number().optional(),
  }),
  // ---- Blueprint card kinds (see styles/blueprint/DESIGN.md and the catalog in styles/blueprint/style.ts) ----
  // A table of contents: every part shows dimmed from the start, an open loop, and each lights on its
  // word. `note` is a short tag on the right (a duration, a count). `active` lights one, for a callback.
  z.object({
    kind: z.literal("agenda"),
    title: z.string().optional(),
    items: z.array(z.object({ text: z.string(), note: z.string().optional(), at: Anchor.optional() })).min(2).max(5),
    active: z.number().optional(),
  }),
  // Two states of one thing: the old one lands, then the new one on `at` takes the accent and the old dims.
  // Values are real (a measured time, a real count) or the reel says it is an illustration.
  z.object({
    kind: z.literal("beforeafter"),
    before: z.object({ label: z.string().default("Before"), value: z.string(), text: z.string().optional() }),
    after: z.object({ label: z.string().default("After"), value: z.string(), text: z.string().optional(), at: Anchor.optional() }),
  }),
  // A row of key numbers that count up on their words. `source` is required, like a chart's.
  z.object({
    kind: z.literal("kpi"),
    title: z.string().optional(),
    items: z.array(z.object({ value: z.string(), label: z.string(), at: Anchor.optional() })).min(2).max(4),
    highlight: z.number().optional(),
    source: z.string(),
  }),
  // A 2x2: two axes draw from the centre, and items land in their quadrants on their words.
  z.object({
    kind: z.literal("matrix"),
    title: z.string().optional(),
    x: z.tuple([z.string(), z.string()]),
    y: z.tuple([z.string(), z.string()]),
    items: z.array(z.object({ text: z.string(), quad: z.enum(["tl", "tr", "bl", "br"]), at: Anchor.optional() })).min(1).max(4),
  }),
  // Dated milestones on a track that fills as each is named. Across for up to four, down for more.
  z.object({
    kind: z.literal("timeline"),
    title: z.string().optional(),
    items: z.array(z.object({ date: z.string(), text: z.string(), at: Anchor.optional() })).min(2).max(6),
  }),
  // A stack of layers, built from the bottom up: the first item is the foundation. Each drops onto
  // the stack on its word.
  z.object({
    kind: z.literal("levels"),
    title: z.string().optional(),
    items: z.array(z.object({ text: z.string(), note: z.string().optional(), at: Anchor.optional() })).min(2).max(5),
  }),
  // Boxes that tick as each is said.
  z.object({ kind: z.literal("checklist"), title: z.string().optional(), items: z.array(Item).min(2).max(6) }),
  // A real quote, word for word, with who said it and where. Never paraphrased, never invented.
  // `sync`: each word types in as Owain says its match (fuzzy: "make" matches "makes"); words he
  // does not say appear with the word before. `words` is filled in by the resolver.
  z.object({ kind: z.literal("quote"), text: z.string(), source: z.string(), at: Anchor.optional(), sync: z.boolean().optional(), words: z.array(z.number()).optional() }),
  // Many official logos at once, in a wave. Never redrawn.
  z.object({
    kind: z.literal("logowall"),
    items: z.array(z.object({ src: z.string(), name: z.string().optional() })).min(4).max(12),
    caption: z.string().optional(),
    at: Anchor.optional(),
  }),
  // A feature overview: one large cell and smaller ones, each landing on its word.
  z.object({
    kind: z.literal("bento"),
    cells: z.array(z.object({ title: z.string(), text: z.string().optional(), value: z.string().optional(), at: Anchor.optional() })).min(3).max(5),
  }),
  // A share as an arc: the ring sweeps to `value` percent on `at`, a dot riding its tip and the
  // number counting with it. Real, sourced numbers only; `source` says "Illustration" otherwise.
  z.object({ kind: z.literal("ring"), value: z.number().min(0).max(100), label: z.string(), source: z.string(), at: Anchor.optional() }),
  // A value on a scale: a ticked track from 0 to `max`, the fill running to `value` on `at`.
  z.object({ kind: z.literal("meter"), value: z.number().min(0), max: z.number().positive(), unit: z.string().optional(), label: z.string(), ends: z.tuple([z.string(), z.string()]).optional(), source: z.string(), at: Anchor.optional() }),
  // "N in 100" as a 10x10 grid of dots that fill in reading order to `value` on `at`.
  z.object({ kind: z.literal("waffle"), value: z.number().int().min(0).max(100), label: z.string(), source: z.string(), at: Anchor.optional() }),
  // Kinetic typing: `text` types itself huge across the frame on `at`, then on `settle` shrinks into
  // a small input, where `chips` (pasted links, files) pop in on their words. A neutral input, no brand UI.
  z.object({
    kind: z.literal("type"),
    text: z.string(),
    at: Anchor.optional(),
    settle: Anchor.optional(),
    label: z.string().optional(),
    chips: z.array(Item).default([]),
  }),
  // The house motion library (effects/house.tsx, 2026-11-02): big type, no boxes, each part on its word.
  // Big lines of type, each landing on its word. On YouTube's `over` they sit beside the speaker on
  // the open side of the frame (`side`: auto picks the side away from the face). One *marked* phrase.
  z.object({ kind: z.literal("words"), lines: z.array(Item).min(1).max(4), side: z.enum(["auto", "left", "right", "center"]).default("auto") }),
  // The old way, then the new: `from` lands big; when `to` lands, the old one moves up, dims and is
  // struck through (`even` leaves it unstruck: two sides of one idea, neither wrong).
  z.object({ kind: z.literal("shift"), from: z.object({ text: z.string(), label: z.string().optional(), at: Anchor.optional() }), to: z.object({ text: z.string(), label: z.string().optional(), at: Anchor.optional() }), even: z.boolean().optional() }),
  // One item at a time, huge; as the next lands, the last moves up into a quiet numbered column.
  z.object({ kind: z.literal("focus"), title: z.string().optional(), items: z.array(Item).min(2).max(6) }),
  // A diagram drawn large: nodes land on their words, arrows draw between them, a dot travels the
  // newest. `x` and `y` place a node (0 to 1 of the frame); without them the nodes sit in a row.
  // The clean style (style "clean"): card beats. One huge caps word on a flat card at a time, hard
  // swapped on its word, with size contrast (huge, then small, then huge). `line` is a Signifier line
  // under the last beat (the call to action).
  z.object({
    kind: z.literal("beats"),
    // `cased`: keep the text as written (a call to action like Comment "EGM"); beats are lower case otherwise.
    items: z.array(z.object({ text: z.string(), size: z.enum(["huge", "mid", "small"]).default("huge"), typed: z.boolean().optional(), cased: z.boolean().optional(), at: Anchor.optional() })).min(1).max(6),
    line: z.object({ text: z.string(), at: Anchor.optional() }).optional(),
  }),
  z.object({
    kind: z.literal("map"),
    nodes: z.array(z.object({ id: z.string(), label: z.string(), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(), at: Anchor.optional() })).min(2).max(7),
    edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional(), at: Anchor.optional() })).default([]),
  }),
]);

export const Layout = z.enum([
  "full", // speaker fills the frame
  "punch", // tight on the speaker, for emphasis and the CTA
  "split", // visual on top, speaker below, caption on the seam
  "media", // visual fills the frame, voice continues
  "cutaway", // b-roll fills the whole frame edge to edge, voice continues
  "scene", // a full-frame graphic scene: big headline on top, the visual below, light or dark
  // YouTube (16:9) only:
  "side", // the visual in a card, the speaker in a small rounded window at the side, voice continues
  "half", // a paper panel on the left half, the speaker on the right half; dissolves in and out
  "over", // the speaker's picture as cut, with a quiet overlay on it (a lower third or a cinematic title)
  // The clean style (style "clean") only, on reels; `over` there is the graphic b-roll overlay: the
  // picture full frame with the visual in a dark glass panel.
  "card", // a flat card in ink, paper or green: card beats, a bracketed list or the caption alone
  "diagram", // a full-screen line diagram on green, now and then, where a picture of the structure helps
]);

// The clean style's footage for a shot instead of the speaker: a b-roll shot ("broll:<id>") full
// frame, or in the bottom panel of a split. `rate` below 1 is slow motion (60 fps sources only).
export const Picture = z.union([z.string(), z.object({ src: z.string(), start: z.number().min(0).default(0), rate: z.number().min(0.25).max(2).default(1) })]);
// A key word or number in bold caps, typed on letter by letter, with an optional Signifier tag under
// it. Shows from `at` (the shot's start when left out) to `until` (the shot's end when left out).
const Hit = z.object({ text: z.string(), tag: z.string().optional(), at: Anchor.optional(), until: Anchor.optional() });

// "riser" builds into the shot: it ends on the cut instead of starting on it.
export const SfxKind = z.enum(["whoosh", "pop", "impact", "thud", "blip", "chime", "key", "riser"]);

export const Shot = z.object({
  // The shot's name across versions, for the review, notes and the inspector. Left out, it is made
  // from the anchor; the editor writes it in when it moves a shot's anchor, so the shot stays itself.
  id: z.string().min(1).optional(),
  at: Anchor,
  layout: Layout,
  visual: Visual.optional(),
  // Seconds to move the start from its word, to land on a cut in the footage (YouTube).
  shift: z.number().min(-2).max(2).optional(),
  // Sound on the cut into this shot. Most cuts should have none.
  sfx: SfxKind.optional(),
  // A jump zoom on the speaker for this shot (1 = the layout's framing). Alternating 1 and ~1.18 on
  // successive shots gives a reel a cut on every beat without changing the layout (Owain, 2026-10-26:
  // "a bit dull and low energy"). Reels only: on YouTube the footage is never re-rendered.
  zoom: z.number().min(1).max(1.6).optional(),
  // Starts a new chapter header from this shot on (false hides it).
  header: z.union([z.string(), z.literal(false)]).optional(),
  // Keep the previous shot's visual on screen and running, so a scene builds across shots
  // while the header changes. Needs the same layout as the previous shot and no visual of its own.
  keep: z.boolean().optional(),
  // Scene colour: light (warm white) or dark (near-black with a soft accent glow). Alternate them
  // for rhythm. A kept shot carries the tone of the shot it keeps.
  tone: z.enum(["light", "dark"]).optional(),
  // ---- The clean style (style "clean") ----
  picture: Picture.optional(),
  // A card's colour.
  bg: z.enum(["ink", "paper", "green"]).optional(),
  hit: Hit.optional(),
  // A diagram's name: Signifier italic, two lines, the second tucked in to the right, typed on.
  title: z.object({ lines: z.tuple([z.string(), z.string()]), at: Anchor.optional() }).optional(),
  // A monospace chip naming the real command or skill this step runs (`egm-review`), typed on.
  chip: z.object({ name: z.string(), at: Anchor.optional() }).optional(),
  // A diagram drawn round the frame's centre: the caption sits inside it, at y 960.
  inside: z.boolean().optional(),
  note: z.string().optional(),
});

export const Edit = z.object({
  title: z.string(),
  // reel: 9:16, 1080x1920. youtube: 16:9, 1920x1080, for a rough cut edited by hand: the plan only
  // lays graphics and text over it, sparsely, and never re-cuts the picture.
  canvas: z.enum(["reel", "youtube"]).default("reel"),
  // Every reel is in the clean style, the reel system locked on 2026-11-06 (research/reels/STUDY.md):
  // split first, text cards and cinematic shots, a full-screen diagram now and then, the glass
  // overlay, and the text kit. Drawn by effects/clean/Clean.tsx. The older Ivory reel look was retired
  // on 2026-11-13. YouTube keeps the house look (effects/Wide.tsx) whatever this says.
  style: z.string().default("clean"),
  // The video's theme: the default tone of every graphic. Dark is Graphite on YouTube, Forest on reels.
  // Black (Owain, 2026-10-30: "classier - maybe black"): pure black cards, white type, no sage.
  // On YouTube a dark shot in a light video (`tone: "dark"`) also takes the Black colours.
  theme: z.enum(["light", "dark", "black"]).default("light"),
  // The clean style's colours: "forest" (deep green stage, white type, sage) or "light" (Owain,
  // 2026-11-13: "the green is very muddy... light background + deep green text + occasional black
  // screens"): a near-white stage, deep green type and lines, black cards.
  palette: z.enum(["forest", "light"]).default("light"),
  // YouTube: stretches to leave alone, [start, end] in seconds (demos). No graphics inside them.
  leave: z.array(z.tuple([z.number(), z.number()])).default([]),
  // YouTube: stretches of the original to cut out of the export, [start, end] in seconds (a section
  // said twice). Each edge must fall between words, and no graphic may overlap one.
  remove: z.array(z.tuple([z.number(), z.number()])).default([]),
  // Word captions. Reels have them; YouTube does not unless asked.
  captions: z.boolean().optional(),
  // half: speaker fills the bottom half. inset: the visual gets about 60% and the speaker sits in a rounded window.
  split: z.enum(["half", "inset"]).default("half"),
  // The reel's title. It lands large in frame 1 (the on-screen hook) and then docks as a small
  // header above the panel on every split and media shot. Wrap one word in *asterisks* for the accent.
  header: z.string().optional(),
  // The clean style's text hook (Owain, 2026-11-11): one short headline on screen from the first frame,
  // set as written, with one *marked* phrase in the accent. It holds until its `until` words; left out,
  // to the first cut after the first shot or 3 s, whichever is later, and never past 5 s.
  hook: z.object({ text: z.string().min(1), until: Anchor.optional() }).optional(),
  // The spoken words the reel's call to action starts on ("If you want a guide"), Owain 2026-11-14.
  // Every export also makes a version that ends before them, for TikTok and LinkedIn, where he does
  // not answer comments; the full one, with the call to action, is for Instagram.
  cta: z.string().min(1).optional(),
  // The clean style's cover (Owain, 2026-11-11): frame 0 is a clean card for the Instagram feed, Owain's
  // blank card (library/covers/<image>.png or .jpg) with the title over it. Instagram's default cover is
  // the first frame. `logos` (2026-11-13, after a cover Owain made with an image model): up to two real
  // logos from library/logos in angled glass tiles beside his head, a name or { logo, name } with a label
  // under it; with logos the title moves to the top. `npm run studio -- cover <slug>` writes it as an image.
  cover: z
    .object({
      title: z.string().min(1),
      image: z.string().default("owain"),
      logos: z.array(z.union([z.string(), z.object({ logo: z.string(), name: z.string().optional() })])).max(2).default([]),
      // A real picture to set behind him on the Higgsfield cover (2026-11-23: "This would have been great
      // with a diagram or graph behind"): a diagram or graph from the reel's own sources, in the project.
      backdrop: z.string().optional(),
    })
    .optional(),
  // Where the speaker's face is in the source footage, as fractions of its frame:
  // centre x, centre y, and head height (crown to chin). Used to frame every speaker layout.
  // Required for footage; script projects (no footage) use the placeholder's own.
  face: z.object({ x: z.number(), y: z.number(), h: z.number() }).optional(),
  // Words to set in Signifier italic in the captions, matched case-insensitively.
  accents: z.array(z.string()).default([]),
  music: z.union([
    z.literal(false),
    // `start`: seconds into the track to begin, to skip a slow intro and land on its steady part.
    // `under`: how many LU the bed sits under the voice, measured on this take; it replaces `level`,
    // which is a fixed gain and so changes with how loud the take was recorded. Chill is 15 to 18.
    z.object({ mood: z.enum(["focus", "uplift", "dark"]).default("focus"), track: z.string().optional(), level: z.number().default(-20), under: z.number().min(0).optional(), start: z.number().min(0).optional() }),
  ]).default({ mood: "focus", level: -20 }),
  // A light colour grade on the speaker footage, as CSS filter amounts (1 = unchanged).
  grade: z.object({ brightness: z.number().default(1), contrast: z.number().default(1), saturate: z.number().default(1) }).default({ brightness: 1, contrast: 1, saturate: 1 }),
  // Gain for the speaker's own audio track, in dB.
  voiceGain: z.number().default(0),
  // The footage's sound is already Owain's finished mix (his music and levels, YouTube exports;
  // Owain, 2026-11-10). The graphics' sounds are laid on top at his level: no loudness pass, and a
  // limiter only at 0 dBFS, where an effect lands on a peak. Otherwise the mix is pushed to -14 LUFS.
  mixed: z.boolean().default(false),
  // The video's named parts (intro, part 1, part 2), in order. Each starts on a spoken phrase and
  // runs to the start of the next; the first starts the video. They change nothing on screen: they
  // are how a video is edited and test-rendered a part at a time (engine/parts.ts).
  parts: z.array(z.object({ name: z.string().min(1), at: z.string().min(1) })).default([]),
  shots: z.array(Shot).min(1),
});

// The cut (`cut.json`): what of the footage plays, in order. A project holds several source clips
// (its media bin); the cut is a list of segments, each a stretch of one clip from `in` to `out` in
// that clip's own seconds. The plan (`edit.json`) sits on top of the cut and is anchored to words,
// so its graphics follow the words when the cut changes. A project with no cut.json plays its one
// clip whole, as before.
// "main" is the clip the project was made from (its files sit at the project's root); added clips
// live in clips/<id>/.
export const MAIN = "main";
export const Segment = z.object({
  // Stable, so the editor can select and move a segment across versions.
  id: z.string().min(1),
  src: z.string().min(1),
  in: z.number().min(0),
  out: z.number(),
  // J and L cuts (not used yet): seconds the sound starts before the picture (`audioIn`) or runs
  // on after it (`audioOut`).
  audioIn: z.number().min(0).optional(),
  audioOut: z.number().min(0).optional(),
}).refine((s) => s.out > s.in, "a segment's out must be after its in");
export const Cut = z.object({ segments: z.array(Segment) });
export type CutPlan = z.infer<typeof Cut>;
export type CutSegment = z.infer<typeof Segment>;

export type EditPlan = z.infer<typeof Edit>;
export type VisualSpec = z.infer<typeof Visual>;

export type Word = { text: string; start: number; end: number };

// Everything below is computed by `reel validate`.
// `zooms` and `ticks`: from a recorded screen (media/record.ts), on the timeline.
export type ResolvedVisual = VisualSpec & { times?: number[]; size?: [number, number]; zooms?: { t: number; x: number; y: number; s: number; ms: number }[]; ticks?: number[] };
export type ResolvedShot = {
  // Always set by the resolver: the plan's `id`, or one made from the anchor (resolve.ts, shotIds).
  id?: string;
  header?: string;
  start: number;
  end: number;
  layout: z.infer<typeof Layout>;
  visual?: ResolvedVisual;
  sfx?: z.infer<typeof SfxKind>;
  zoom?: number;
  anchor: string;
  keep?: boolean;
  tone?: "light" | "dark";
  // The clean style: times are resolved from the anchors.
  picture?: { src: string; start: number; rate: number };
  bg?: "ink" | "paper" | "green";
  hit?: { text: string; tag?: string; at: number; until: number };
  title?: { lines: [string, string]; at: number };
  chip?: { name: string; at: number };
  inside?: boolean;
  note?: string;
};
export type ResolvedHook = { text: string; until: number };
export type ResolvedPart = { name: string; anchor: string; start: number; end: number };
export type Chunk = { words: { text: string; start: number; end: number; accent: boolean }[]; start: number; end: number };
// `exact`: play as given (its own gain, never thinned): whooshes, risers and highlight clicks.
export type SfxEvent = { kind: z.infer<typeof SfxKind>; t: number; gain?: number; dur?: number; exact?: boolean };
export type Resolved = {
  slug: string;
  title: string;
  duration: number;
  fps: number;
  // Empty for script projects: the speaker is drawn as a placeholder.
  video: string;
  // Pixel size of the speaker footage: 1080x1920 portrait or 1920x1080 landscape.
  videoSize: [number, number];
  audio: string | null;
  // Export only: draw the overlays alone on a transparent frame, for Final Cut (reel export).
  alpha?: boolean;
  // Export of one part only: the flattened picture holds just that part, and starts at this frame of
  // the timeline. Times everywhere else stay the whole video's.
  pictureFrom?: number;
  parts?: ResolvedPart[];
  face: { x: number; y: number; h: number };
  // Stretches cut out of the export (see Edit.remove).
  remove?: [number, number][];
  grade: { brightness: number; contrast: number; saturate: number };
  split: "half" | "inset";
  canvas: "reel" | "youtube";
  style?: string;
  captions: boolean;
  theme?: "light" | "dark" | "black";
  palette?: "forest" | "light";
  // Light copies for the review board's players: 1080p H.264 video and AAC audio. Renders use the originals.
  preview?: { video?: string; audio?: string };
  // The library only: no footage, but the speaker's place is drawn with the stand-in, where a clean
  // reel with no footage would otherwise be faceless.
  standIn?: boolean;
  // The editor only, when the project has a cut: the segments to play from the clips' preview
  // copies, `start` to `end` on the timeline from `in` in the clip. Exports flatten the cut to one
  // file first (media/cutrender.ts), so they never see this.
  cut?: { video: string; audio?: string; start: number; end: number; in: number }[];
  shots: ResolvedShot[];
  // The clean style's text hook, from the first frame to `until`.
  hook?: ResolvedHook;
  // The call to action: its words, and where the version without it ends (timeline seconds).
  cta?: { at: string; end: number };
  // The cover on frame 0: the card's file in the project.
  cover?: { title: string; image: string; logos?: { src: string; name?: string }[] };
  // Draw the cover card alone, as the cover image (`cover`, QC, approval). The reel itself never
  // shows it: the cover is uploaded to Instagram as its own image (Owain, 2026-11-13).
  asCover?: boolean;
  chunks: Chunk[];
  sfx: SfxEvent[];
};
