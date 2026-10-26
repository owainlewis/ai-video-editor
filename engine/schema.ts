// The edit plan. Claude Code writes `edit.json` in a project folder; `reel validate`
// resolves every spoken anchor to a time and writes `build/edit.resolved.json`,
// which is what the Remotion composition renders.
import { z } from "zod";
import { reviewLine } from "./reviewmd";

// A phrase the speaker says. Shots and reveals land on its first word.
// Each anchor must come after the previous shot's anchor in the transcript.
const Anchor = z.string().min(1);

// A rectangle in normalised image coordinates: [x, y, width, height], each 0 to 1.
const Rect = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const Item = z.object({ text: z.string(), at: Anchor.optional() });

export const Visual = z.discriminatedUnion("kind", [
  // A real capture (web page, screenshot, photo). The camera moves from `from` to `to`.
  // `highlight` draws a marker over a region when `at` is spoken.
  z.object({
    kind: z.literal("image"),
    src: z.string(),
    from: Rect.optional(),
    to: Rect.optional(),
    // "browser" puts the capture in a browser window: `url` in the address bar (the site in ink, the
    // path muted), and `title` and `icon` (the page's real title and favicon) on its tab.
    frame: z.enum(["none", "browser", "card"]).default("card"),
    url: z.string().optional(),
    title: z.string().optional(),
    icon: z.string().optional(),
    // A marker over a region, swept in on `at`. `label` adds a callout tag pointing at it.
    highlight: z.array(z.object({ rect: Rect, at: Anchor.optional(), label: z.string().optional() })).default([]),
  }),
  // B-roll footage: a project file, or "broll:<id>" for a clip from the library.
  // `start` is the offset into the clip in seconds.
  // `loop` repeats a short clip (a library's own preview loop) to fill the shot.
  // `rate` below 1 slows a clip a little so a short shot can cover the next spoken word.
  z.object({ kind: z.literal("video"), src: z.string(), start: z.number().default(0), loop: z.boolean().default(false), rate: z.number().min(0.5).max(2).default(1) }),
  // One or more official logos, never redrawn.
  z.object({
    kind: z.literal("logos"),
    items: z.array(z.object({ src: z.string(), name: z.string().optional(), at: Anchor.optional() })).min(1),
    caption: z.string().optional(),
  }),
  // A short headline. Wrap one word in *asterisks* for the Signifier italic accent.
  // `sync`: kinetic type, each word lands as Owain says its match (`words` is filled by the resolver).
  z.object({ kind: z.literal("title"), text: z.string(), kicker: z.string().optional(), sync: z.boolean().optional(), words: z.array(z.number()).optional() }),
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
  // A chat input (e.g. Claude) where a prompt types itself out on `at`.
  z.object({ kind: z.literal("prompt"), app: z.string().default("Claude"), text: z.string(), at: Anchor.optional() }),
  // The end card: "Comment KEYWORD" and what they get. Only when there is a real resource to send.
  z.object({ kind: z.literal("cta"), keyword: z.string(), text: z.string(), src: z.string().optional() }),
  // A terminal that types each line when it is spoken.
  z.object({ kind: z.literal("terminal"), title: z.string().optional(), lines: z.array(Item).min(1) }),
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
  // The docs' example REVIEW.md in a browser over the Graphite stage. Each mark highlights one line
  // of it (by its exact text, see engine/reviewmd.ts) as `at` is said.
  z.object({
    kind: z.literal("reviewmd"),
    marks: z.array(z.object({ line: z.string().refine((l) => reviewLine(l) >= 0, "not a line of the docs' REVIEW.md"), at: Anchor })).max(4).default([]),
  }),
  // Product moments drawn clean, full frame, in depth (effects/ui.tsx). Words come from the real
  // source: a Claude Code session from a demo, a search for the real page, the article's own tiers.
  z.object({
    kind: z.literal("claudecode"),
    title: z.string().optional(),
    // Shown in Claude Code's working colour from the first prompt until the first output line.
    status: z.string().optional(),
    lines: z.array(z.object({ text: z.string(), style: z.enum(["prompt", "out", "head", "item", "dim", "ok"]).default("out"), at: Anchor.optional() })).min(1).max(12),
    mark: z.object({ line: z.number().int().min(0), phrase: z.string(), at: Anchor.optional() }).optional(),
  }),
  z.object({
    kind: z.literal("search"),
    text: z.string(),
    at: Anchor.optional(),
    cps: z.number().positive().optional(),
    result: z.object({ site: z.string(), title: z.string(), text: z.string().optional(), at: Anchor.optional() }).optional(),
  }),
  // An email typing itself out, from an agent (the agent's own example text).
  z.object({
    kind: z.literal("compose"),
    from: z.string(),
    emoji: z.string().optional(),
    subject: z.string(),
    body: z.array(z.string()).min(1).max(3),
    file: z.string().optional(),
    lines: z.number().int().optional(),
    cps: z.number().positive().optional(),
    at: Anchor.optional(),
    send: Anchor.optional(),
  }),
  // Labelled pills in their own colours (a repo's divisions); each named one lights on its word.
  // `focus` lights some from the start; `count` lands a big number over the grid.
  z.object({
    kind: z.literal("divisions"),
    items: z.array(z.object({ label: z.string(), color: z.string(), at: Anchor.optional() })).min(2).max(24),
    focus: z.array(z.number().int()).optional(),
    count: z.object({ value: z.string(), label: z.string(), at: Anchor.optional() }).optional(),
  }),
  // Rows of real names drifting past in opposite directions, a count landing over them on `count.at`.
  z.object({
    kind: z.literal("chips"),
    rows: z.array(z.array(z.string()).min(2)).min(1).max(5),
    count: z.object({ value: z.string(), label: z.string(), at: Anchor.optional() }).optional(),
  }),
  // An agent's pipeline: steps queued, running on their word, passed when the next one starts.
  z.object({
    kind: z.literal("runs"),
    title: z.string(),
    emoji: z.string().optional(),
    steps: z.array(z.object({ label: z.string(), agent: z.string().optional(), at: Anchor.optional() })).min(2).max(6),
    done: Anchor.optional(),
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
  z.object({
    kind: z.literal("tiers"),
    title: z.string().optional(),
    items: z.array(z.object({ label: z.string(), rule: z.string(), examples: z.string(), at: Anchor.optional(), markAt: Anchor.optional() })).min(2).max(4),
  }),
  // The route of the video: a title over a track of numbered stops that pop in on `at` ("the six levels").
  z.object({ kind: z.literal("journey"), title: z.string(), of: z.number().int().min(2).max(12), at: Anchor.optional() }),
  // `of`: how many sections there are; a hit card then shows a progress row, one mark per section
  // (done in ink, this one in the accent, the rest faint).
  z.object({ kind: z.literal("chapter"), number: z.string(), label: z.string(), hit: z.boolean().optional(), of: z.number().int().min(2).max(12).optional() }),
  // A diagram of how parts talk: cards joined by lines that draw on `at`. `chip` rides along an edge
  // (what is passed, e.g. "plan.md"). Two or three nodes sit in a row; with `root`, the first node
  // sits on top and the rest branch below it. A diagram, never a stand-in for real UI.
  z.object({
    kind: z.literal("flow"),
    root: z.boolean().default(false),
    nodes: z.array(z.object({ title: z.string(), kicker: z.string().optional(), lines: z.array(z.string()).default([]), at: Anchor.optional() })).min(2).max(4),
    edges: z.array(z.object({ from: z.number(), to: z.number(), chip: z.string().optional(), at: Anchor.optional() })).default([]),
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
  "over", // the speaker's picture as cut, with a quiet overlay on it (a lower third or a cinematic title)
]);

// "riser" builds into the shot: it ends on the cut instead of starting on it.
export const SfxKind = z.enum(["whoosh", "pop", "impact", "thud", "blip", "chime", "key", "riser"]);

export const Shot = z.object({
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
  // A shared-element transition from the previous scene: an element of it (a grid tile, the result
  // card, the typed input, or any frame rect [x, y, w, h] in 0 to 1) grows to become this shot.
  enter: z.object({ from: z.enum(["tile", "card", "input", "rect"]), index: z.number().default(0), rect: Rect.optional() }).optional(),
  note: z.string().optional(),
});

export const Edit = z.object({
  title: z.string(),
  // reel: 9:16, 1080x1920. youtube: 16:9, 1920x1080, for a rough cut edited by hand: the plan only
  // lays graphics and text over it, sparsely, and never re-cuts the picture.
  canvas: z.enum(["reel", "youtube"]).default("reel"),
  // The house style. Ivory is the only one; the field is kept so old plans still parse.
  style: z.string().default("ivory"),
  // The video's theme: the default tone of every graphic. Dark is Graphite on YouTube, Forest on reels.
  theme: z.enum(["light", "dark"]).default("light"),
  // YouTube: stretches to leave alone, [start, end] in seconds (demos). No graphics inside them.
  leave: z.array(z.tuple([z.number(), z.number()])).default([]),
  // YouTube: stretches of the original to cut out of the export, [start, end] in seconds (a section
  // said twice). Each edge must fall between words, and no graphic may overlap one.
  remove: z.array(z.tuple([z.number(), z.number()])).default([]),
  // Word captions. Reels have them; YouTube does not unless asked.
  captions: z.boolean().optional(),
  // react: the default for tool drops. The speaker stays on screen in a split while the
  //   top panel walks through the source, a highlight on each claim as it is said.
  // mixed: for how-it-works and setup reels. Every layout, b-roll cutaways, faster cuts.
  // film: soft tech product film. Full-frame scenes that build across shots, light and dark
  //   alternating, the speaker as punctuation. Something changes on screen at least every 3.6 s.
  format: z.enum(["react", "mixed", "film"]).default("react"),
  // half: speaker fills the bottom half. inset: the visual gets about 60% and the speaker sits in a rounded window.
  split: z.enum(["half", "inset"]).default("half"),
  // The reel's title. It lands large in frame 1 (the on-screen hook) and then docks as a small
  // header above the panel on every split and media shot. Wrap one word in *asterisks* for the accent.
  header: z.string().optional(),
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
  shots: z.array(Shot).min(1),
});

export type EditPlan = z.infer<typeof Edit>;
export type VisualSpec = z.infer<typeof Visual>;

export type Word = { text: string; start: number; end: number };

// Everything below is computed by `reel validate`.
export type ResolvedItem = { text: string; t: number };
export type ResolvedVisual = VisualSpec & { times?: number[]; size?: [number, number] };
export type ResolvedShot = {
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
  enter?: { from: "tile" | "card" | "input" | "rect"; index: number; rect?: [number, number, number, number] };
};
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
  face: { x: number; y: number; h: number };
  // Stretches cut out of the export (see Edit.remove).
  remove?: [number, number][];
  grade: { brightness: number; contrast: number; saturate: number };
  split: "half" | "inset";
  canvas: "reel" | "youtube";
  style?: string;
  captions: boolean;
  // Light copies for the review board's players: 1080p H.264 video and AAC audio. Renders use the originals.
  preview?: { video?: string; audio?: string };
  shots: ResolvedShot[];
  chunks: Chunk[];
  sfx: SfxEvent[];
};
