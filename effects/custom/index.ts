// Motion graphics designed for one video's argument (Owain, 2026-10-25). The library is a starting
// kit, not a limit: when a line deserves its own picture, draw it here and use it from the plan as
// { "kind": "custom", "name": "<key>", "props": {...}, "at": ["spoken", "beats"] }.
// A good one that recurs graduates into the schema as a kind of its own.
// Every component gets the shot, the time, its props, the spoken times of its `at` beats, and the box
// it is drawn in (`panel` true inside a split's panel, where the paper shows and the speaker stays).
import type React from "react";
import type { ResolvedShot } from "../../engine/schema";

export type CustomProps = { shot: ResolvedShot; time: number; props: Record<string, unknown>; times: number[]; width: number; height: number; panel: boolean };
// Empty today: the stage moves drawn for one YouTube study were retired on 2026-11-14 with the old
// library cards. A new one-off is added here by its key.
export const CUSTOM: Record<string, React.FC<CustomProps>> = {};
// Drawn to hold still: the frame stays put and only the parts change. A component that does joins
// this set by its key.
export const STILL = new Set<string>();
