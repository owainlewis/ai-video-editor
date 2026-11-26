// The editor's actions on a project: POST /api/projects/<slug>/<action>. One schema per action,
// read by the server to check what arrives (server/index.ts) and by the editor for its types
// (app/api.ts), so the two cannot drift.
import { z } from "zod";
import { Cut } from "./schema.ts";

const Range = z.object({ start: z.number(), end: z.number() });
// A shot by its id (engine/resolve.ts, shotIds). `start`, its time on the timeline, still finds it.
const shotRef = { id: z.string().min(1).optional(), start: z.number().optional() };
const PlanShot = z.looseObject({ at: z.string(), layout: z.string() });
const none = z.object({});

export const Actions = {
  chat: z.object({ note: z.string().trim().min(1, "empty note"), selection: Range.nullish(), playhead: z.number().default(0) }),
  suggest: none,
  decide: z.object({ id: z.string(), accept: z.boolean(), note: z.string().default("") }),
  drop: z.object({ ref: z.string().min(1), at: z.number(), length: z.number().default(3) }),
  "shot-start": z.object({ from: z.number(), to: z.number() }),
  "shot-end": z.object({ ...shotRef, to: z.number() }),
  shot: z.object({ ...shotRef, shot: PlanShot.optional(), remove: z.boolean().optional() }),
  variants: z.object({ start: z.number(), note: z.string().optional() }),
  "variant-use": z.object({ id: z.string() }),
  "variant-clear": none,
  place: z.object({ card: z.string(), at: z.number() }),
  parts: z.object({
    add: z.object({ name: z.string().min(1), at: z.number() }).optional(),
    rename: z.object({ name: z.string(), to: z.string().min(1) }).optional(),
    remove: z.string().optional(),
  }),
  stop: none,
  undo: none,
  redo: none,
  cut: z.object({ cut: Cut }),
  // `force`: export with QC errors, plan warnings or items not yet approved. Owain's call only.
  render: z
    .object({
      part: z
        .string()
        .trim()
        .min(1, "part name cannot be empty")
        .refine((s) => !s.startsWith("-") && !/[\0\r\n]/.test(s), "invalid part name")
        .optional(),
      from: z.number().finite().min(0).optional(),
      to: z.number().finite().min(0).optional(),
      force: z.boolean().optional(),
    })
    .refine((d) => !(d.part !== undefined && (d.from !== undefined || d.to !== undefined)), "use part, or from and to, not both")
    .refine((d) => (d.from === undefined) === (d.to === undefined), "from and to must both be provided")
    .refine((d) => d.from === undefined || d.to! > d.from, "to must be after from"),
  // Review (engine/review.ts). `hash` is the item as the page last saw it: a save against an item
  // that has changed since is refused, so a decision never lands on a graphic Owain has not seen.
  review: z.object({ id: z.string(), hash: z.string(), status: z.enum(["waiting", "approved", "change"]).optional(), comment: z.string().optional() }),
  // A note on the timeline: a new one (`t` and `text`), a change to one (`id`), or `remove`.
  note: z.object({ id: z.string().optional(), t: z.number().optional(), text: z.string().optional(), status: z.enum(["open", "sent", "done"]).optional(), remove: z.boolean().optional() }),
  // Every open note and change, to Claude, as one run.
  "review-send": none,
  qc: none,
  // Mix the sound as the export will, for the editor to play.
  mix: none,
  // A finished reel (media/approve.ts): copy its current export and cover to the approved folder,
  // take it out again (to the Trash), or show it in Finder.
  approve: none,
  unapprove: none,
  reveal: none,
} as const;

export type ActionName = keyof typeof Actions;
export type ActionInput<K extends ActionName> = z.input<(typeof Actions)[K]>;
export type ActionData<K extends ActionName> = z.infer<(typeof Actions)[K]>;
export const isAction = (name: string): name is ActionName => Object.hasOwn(Actions, name);
