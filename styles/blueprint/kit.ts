// The laid-out kinds as library cards (2026-11-13): the `code` editor and diff view, and the `flow`
// diagram in each of its shapes (engine/flow.ts lays them out; effects/clean/ draws them). The
// samples are neutral stand-ins, clearly sample work: generic code and generic parts, never words
// from Owain's own sessions. Each card's limits are the longest text its layout is tested to hold
// (tests/flow.test.ts).
import type { Card, Slot } from "../catalog";
import { sampleLogo } from "./samples";

const at = (name: string): Slot => ({ name, type: "anchor", optional: true, note: "a spoken phrase; the part lands on its first word" });
const LAYOUTS: Card["layouts"] = ["split", "side", "media"];

// A flow card's slots: how many nodes, and how long each piece of text may be for this shape.
const flowSlots = (nodes: [number, number], label: number, sub: number, arrow?: number, items?: number): Slot[] => [
  { name: "nodes", type: "list", minItems: nodes[0], maxItems: nodes[1] },
  { name: "nodes[].label", type: "text", maxChars: label },
  { name: "nodes[].sub", type: "text", maxChars: sub, optional: true },
  ...(arrow ? [{ name: "nodes[].arrow.label", type: "text", maxChars: arrow, optional: true } as Slot] : []),
  ...(items ? [{ name: "nodes[].items", type: "list", maxItems: 4 } as Slot, { name: "nodes[].items[].text", type: "text", maxChars: items } as Slot] : []),
  { name: "nodes[].icon", type: "image", optional: true, note: "logo:<name>, or a line icon (engine/flow.ts, FLOW_ICONS)" },
  at("nodes[].at"),
  ...(arrow ? [at("nodes[].arrow.at")] : []),
  ...(items ? [at("nodes[].items[].at")] : []),
];

export const kitCards = (): Card[] => [
  {
    id: "blueprint.t2.code",
    kind: "code",
    tier: "t2",
    purpose: "code",
    summary: "An editor window in a light theme: the file's tab, line numbers, syntax colours. Lines type on as they are said; a line or range lights on its word.",
    layouts: LAYOUTS,
    slots: [
      { name: "file", type: "text", maxChars: 40 },
      { name: "lines", type: "list", minItems: 1, maxItems: 16 },
      { name: "lines[].text", type: "text", maxChars: 48 },
      { name: "marks", type: "list", maxItems: 4, optional: true },
      at("lines[].at"),
      at("marks[].at"),
    ],
    sample: {
      visual: {
        kind: "code",
        file: "src/review.ts",
        start: 12,
        typed: true,
        lines: [
          { text: "export async function review(diff: string) {" },
          { text: "  const issues = await findIssues(diff);" },
          { text: "  if (issues.length === 0) return \"Looks good\";" },
          { text: "  return summarize(issues);" },
          { text: "}" },
        ],
        marks: [{ from: 2, to: 3, at: "issues" }],
      },
      header: "The *code*",
      scene: "The *code*",
    },
  },
  {
    id: "blueprint.t2.code.diff",
    kind: "code",
    tier: "t2",
    purpose: "code",
    treatment: "diff",
    summary: "A diff in the editor: the file as it was; removed lines strike red and added lines slide in green, each on its word.",
    layouts: LAYOUTS,
    slots: [
      { name: "file", type: "text", maxChars: 40 },
      { name: "lines", type: "list", minItems: 2, maxItems: 16 },
      { name: "lines[].text", type: "text", maxChars: 48 },
      at("lines[].at"),
      at("marks[].at"),
    ],
    sample: {
      visual: {
        kind: "code",
        file: "src/users.ts",
        start: 8,
        typed: true,
        lines: [
          { text: "export async function load(id: string) {" },
          { text: "  return db.users.find(id);", diff: "del" },
          { text: "  const hit = cache.get(id);", diff: "add" },
          { text: "  return hit ?? db.users.find(id);", diff: "add" },
          { text: "}" },
        ],
        marks: [],
      },
      header: "One *change*",
      scene: "One *change*",
    },
  },
  {
    id: "blueprint.t2.flow",
    kind: "flow",
    tier: "t2",
    purpose: "flow",
    summary: "A row of parts, each passing to the next: cards laid out with equal gaps, an arrow drawing into each as it is named.",
    layouts: LAYOUTS,
    slots: flowSlots([2, 3], 15, 22, 12),
    sample: {
      visual: {
        kind: "flow",
        shape: "row",
        nodes: [
          { label: "You", sub: "one prompt", icon: "user", items: [] },
          { label: "Agent", sub: "plans, builds", icon: "agent", accent: true, arrow: { label: "task" }, items: [] },
          { label: "Pull request", sub: "ready to review", icon: "branch", arrow: { label: "diff" }, items: [] },
        ],
      },
      header: "How it *works*",
      scene: "How it *works*",
    },
  },
  {
    id: "blueprint.t2.flow.column",
    kind: "flow",
    tier: "t2",
    purpose: "flow",
    treatment: "column",
    summary: "Steps down the panel, each passing to the next, wide cards with the icon beside the words.",
    layouts: LAYOUTS,
    slots: flowSlots([2, 4], 24, 28, 12),
    sample: {
      visual: {
        kind: "flow",
        shape: "column",
        nodes: [
          { label: "Bug report", sub: "a user finds it", icon: "chat", items: [] },
          { label: "Agent", sub: "fixes it on a branch", icon: "agent", accent: true, items: [] },
          { label: "Review", sub: "a second agent checks", icon: "check", items: [] },
        ],
      },
      header: "Step by *step*",
      scene: "Step by *step*",
    },
  },
  {
    id: "blueprint.t2.flow.fan-out",
    kind: "flow",
    tier: "t2",
    purpose: "flow",
    treatment: "fan-out",
    summary: "One to many: the first node hands work to the rest, branches drawing in right angles as each is named.",
    layouts: LAYOUTS,
    slots: flowSlots([3, 5], 16, 20, 10),
    sample: {
      visual: {
        kind: "flow",
        shape: "fan-out",
        nodes: [
          { label: "Lead agent", sub: "splits the work", icon: "agent", accent: true, items: [] },
          { label: "Search", icon: "browser", items: [] },
          { label: "Code", icon: "code", items: [] },
          { label: "Tests", icon: "check", items: [] },
        ],
      },
      header: "One to *many*",
      scene: "One to *many*",
    },
  },
  {
    id: "blueprint.t2.flow.fan-in",
    kind: "flow",
    tier: "t2",
    purpose: "flow",
    treatment: "fan-in",
    summary: "Many to one: sources land, then lines run from each into the one that gathers them, the last node.",
    layouts: LAYOUTS,
    slots: flowSlots([3, 5], 16, 20, 10),
    sample: {
      visual: {
        kind: "flow",
        shape: "fan-in",
        nodes: [
          { label: "Docs", icon: "file", items: [] },
          { label: "Code", icon: "code", items: [] },
          { label: "Tickets", icon: "chat", items: [] },
          { label: "Context", sub: "one window", icon: "database", accent: true, items: [] },
        ],
      },
      header: "All in *one*",
      scene: "All in *one*",
    },
  },
  {
    id: "blueprint.t2.flow.before-after",
    kind: "flow",
    tier: "t2",
    purpose: "flow",
    treatment: "before-after",
    summary: "The old way, then the new: the first card lands; on the second's word it is struck and dims as the new one lands in the accent.",
    layouts: LAYOUTS,
    slots: flowSlots([2, 2], 20, 24, 10),
    sample: {
      visual: {
        kind: "flow",
        shape: "before-after",
        nodes: [
          { label: "Copy and paste", sub: "by hand, every time", icon: "chat", items: [] },
          { label: "One command", sub: "runs the whole review", icon: "terminal", items: [] },
        ],
      },
      header: "The *shift*",
      scene: "The *shift*",
    },
  },
  {
    id: "blueprint.t2.flow.versus",
    kind: "flow",
    tier: "t2",
    purpose: "flow",
    treatment: "versus",
    summary: "A versus B: two columns, each headed by its card (a real logo), their points landing in rows compared across.",
    layouts: LAYOUTS,
    slots: flowSlots([2, 2], 18, 20, undefined, 22),
    sample: {
      visual: {
        kind: "flow",
        shape: "versus",
        nodes: [
          { label: "Sample A", icon: sampleLogo("A", 0), items: [{ text: "In your terminal" }, { text: "Asks before it runs" }, { text: "One task at a time" }] },
          { label: "Sample B", icon: sampleLogo("B", 1), accent: true, items: [{ text: "In the cloud" }, { text: "Runs on its own" }, { text: "Many tasks at once" }] },
        ],
      },
      header: "Side by *side*",
      scene: "Side by *side*",
    },
  },
];
