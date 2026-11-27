import { describe, expect, it } from "vitest";
import { planChanges } from "../engine/changes.ts";

const card = (at: string, text = "x") => ({ at, layout: "split", visual: { kind: "card", text } });

describe("what a change to the plan did", () => {
  it("finds added, changed and removed shots by their anchor", () => {
    const before = { title: "t", shots: [card("Anthropic just"), card("an article"), { at: "the end", layout: "full" }] };
    const after = { title: "t", shots: [card("Anthropic just", "y"), { at: "new words", layout: "split", visual: { kind: "flow" } }, { at: "the end", layout: "full" }] };
    expect(planChanges(before, after)).toEqual([
      { type: "changed", id: "anthropic-just", kind: "card", anchor: "Anthropic just" },
      { type: "added", id: "new-words", kind: "flow", anchor: "new words" },
      { type: "removed", id: "an-article", kind: "card", anchor: "an article" },
    ]);
  });
  it("lists a change to the plan itself once per field", () => {
    expect(planChanges({ hook: { text: "a" }, shots: [] }, { hook: { text: "b" }, cta: "If you want", shots: [] })).toEqual([
      { type: "plan", field: "hook" },
      { type: "plan", field: "cta" },
    ]);
  });
  it("does not count a reorder or an id written for a moved anchor", () => {
    const a = card("one");
    const b = card("two");
    expect(planChanges({ shots: [a, b] }, { shots: [b, a] })).toEqual([]);
    expect(planChanges({ shots: [{ ...a, id: "one" }] }, { shots: [a] })).toEqual([]);
  });
  it("names a shot with no visual by keep or its layout", () => {
    const out = planChanges({ shots: [] }, { shots: [{ at: "a", keep: true }, { at: "b", layout: "full" }] });
    expect(out.map((c) => "kind" in c && c.kind)).toEqual(["keep", "full"]);
  });
  it("copes with a plan that is not a plan", () => {
    expect(planChanges({}, { shots: "nope" })).toEqual([]);
  });
});
