// The card library: which catalog cards (styles/blueprint/style.ts) the gallery and the editor's
// Library tab show. Owain curates it from the gallery: Remove from library takes a card out, Add
// back returns it (2026-11-14: "have the ability to delete things from the library"). It is data in
// styles/library.json, read on every request, so a change shows at once with no restart.
//
// A catalog card in neither list is not in the library and not shown anywhere: the 44 older cards
// retired on 2026-11-14 stay in the catalog only because YouTube plans still use their kinds and
// the catalog holds their slot limits.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cards } from "../styles/blueprint/style.ts";
import { ROOT } from "./tools.ts";

export type CardLibrary = { cards: string[]; removed: string[] };

export const CARD_LIBRARY = join(ROOT, "styles", "library.json");

export function readCardLibrary(file = CARD_LIBRARY): CardLibrary {
  if (!existsSync(file)) return { cards: [], removed: [] };
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<CardLibrary>;
  return { cards: raw.cards ?? [], removed: raw.removed ?? [] };
}

// A card in or out of the library. Taking one out keeps it under `removed`, newest first, so it can
// be added back from the gallery; adding it back puts it at the end of the library.
export function setInLibrary(lib: CardLibrary, id: string, on: boolean): CardLibrary {
  const cardsLeft = lib.cards.filter((c) => c !== id);
  const removedLeft = lib.removed.filter((c) => c !== id);
  return on ? { cards: [...cardsLeft, id], removed: removedLeft } : { cards: cardsLeft, removed: [id, ...removedLeft] };
}

// Change the library on disk. Only a card the library has held can be taken out or added back: the
// retired cards are not offered anywhere, and an unknown id is refused.
export function saveInLibrary(id: string, on: boolean, file = CARD_LIBRARY): CardLibrary {
  if (!cards.some((c) => c.id === id)) throw Object.assign(new Error(`no card ${id}`), { code: 404 });
  const lib = readCardLibrary(file);
  if (!lib.cards.includes(id) && !lib.removed.includes(id)) throw Object.assign(new Error(`${id} is not a library card`), { code: 409 });
  const next = setInLibrary(lib, id, on);
  const part = `${file}.partial`;
  writeFileSync(part, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(part, file);
  return next;
}
