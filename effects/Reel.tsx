import React from "react";
import type { Resolved } from "../engine/schema";
import { Clean } from "./clean/Clean";

// Every reel draws in the clean style (locked 2026-11-06; the older Ivory reel look was retired on
// 2026-11-13). YouTube videos draw in `Wide`.
export const Reel: React.FC<Resolved> = (r) => <Clean {...r} />;
