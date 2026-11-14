import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCardLibrary, saveInLibrary, setInLibrary } from "../media/cardlibrary.ts";

describe("the card library", () => {
  it("takes a card out to removed, newest first, and adds it back at the end", () => {
    const lib = { cards: ["a", "b", "c"], removed: ["x"] };
    const out = setInLibrary(lib, "b", false);
    expect(out).toEqual({ cards: ["a", "c"], removed: ["b", "x"] });
    expect(setInLibrary(out, "b", true)).toEqual({ cards: ["a", "c", "b"], removed: ["x"] });
    // Doing it twice changes nothing more.
    expect(setInLibrary(out, "b", false)).toEqual(out);
  });

  it("saves to its file, and refuses a card it never held or one that does not exist", () => {
    const file = join(mkdtempSync(join(tmpdir(), "cards-")), "library.json");
    writeFileSync(file, JSON.stringify({ cards: ["blueprint.t1.cli", "blueprint.t2.code"], removed: [] }));
    expect(saveInLibrary("blueprint.t2.code", false, file)).toEqual({ cards: ["blueprint.t1.cli"], removed: ["blueprint.t2.code"] });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(readCardLibrary(file));
    expect(saveInLibrary("blueprint.t2.code", true, file).cards).toEqual(["blueprint.t1.cli", "blueprint.t2.code"]);
    expect(() => saveInLibrary("blueprint.t2.kpi", true, file)).toThrow(/not a library card/);
    expect(() => saveInLibrary("blueprint.nope", true, file)).toThrow(/no card/);
  });
});
