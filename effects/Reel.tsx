import React from "react";
import type { Resolved } from "../engine/schema";
import { Clean } from "./clean/Clean";
import { Cover } from "./clean/cover";

// Every reel draws in the clean style (locked 2026-11-06; the older Ivory reel look was retired on
// 2026-11-13). YouTube videos draw in `Wide`.
// The cover card alone when asked for the cover image (`asCover`); the reel never shows it.
export const Reel: React.FC<Resolved> = (r) => (r.asCover && r.cover ? <Cover cover={r.cover} /> : <Clean {...r} />);
