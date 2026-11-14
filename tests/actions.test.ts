import { describe, expect, it } from "vitest";
import { actionBeats, actionOffset, FOCUS, MOVE, typedChars } from "../engine/actions.ts";
import { typeTime } from "../engine/apps.ts";
import { type Box, findField, type Page, placePhrases } from "../engine/page.ts";
import { visualAnchors } from "../engine/resolve.ts";

const font = { family: "Inter", size: 0.03, weight: 400, color: "rgb(0, 0, 0)", bg: "rgb(255, 255, 255)", pad: 0.012 };
const page: Page = {
  url: "https://example.com/sign-up",
  title: "Sign up",
  dark: false,
  scale: 3,
  size: [1000, 500],
  runs: [
    { text: "Create", box: [0.1, 0.8, 0.08, 0.04] as Box, block: 0 },
    { text: "account", box: [0.19, 0.8, 0.09, 0.04] as Box, block: 0 },
  ],
  blocks: [{ tag: "button", box: [0.08, 0.78, 0.22, 0.08] }],
  fields: [
    { label: "Full name", kind: "text", box: [0.1, 0.2, 0.5, 0.08], font },
    { label: "Email address", kind: "text", box: [0.1, 0.4, 0.5, 0.08], font, focused: { src: "assets/pages/p-focus-1.png", box: [0.095, 0.39, 0.51, 0.1] } },
    { label: "Send me updates", kind: "check", box: [0.1, 0.6, 0.02, 0.04], checked: "assets/pages/p-check-2.png" },
  ],
};

describe("actionBeats", () => {
  it("plays unanchored actions one after another, a cursor trip before each click", () => {
    const b = actionBeats([{ act: "type", text: "Ada" }, { act: "check" }, { act: "click" }], 10, []);
    expect(b[0].t).toBeCloseTo(10.15 + MOVE);
    expect(b[0].t1).toBeCloseTo(b[0].t + FOCUS + typeTime(3));
    expect(b[1].t).toBeCloseTo(b[0].t1 + MOVE);
    expect(b[2].t).toBeCloseTo(b[1].t1 + MOVE);
  });

  it("lands an anchored click on its words, never before the action before it is done", () => {
    const b = actionBeats([{ act: "type", text: "a long name to type" }, { act: "click", at: "submit" }], 0, [undefined, 0.5]);
    expect(b[1].t).toBeGreaterThanOrEqual(b[0].t1 + 0.2);
    const late = actionBeats([{ act: "click", at: "x" }, { act: "click", at: "y" }], 0, [3, 6]);
    expect(late.map((x) => x.t)).toEqual([3, 6]);
  });

  it("types the text letter by letter between the click and the end", () => {
    const [b] = actionBeats([{ act: "type", text: "abcdef" }], 0, []);
    expect(typedChars("abcdef", b, b.t)).toBe(0);
    expect(typedChars("abcdef", b, (b.t + FOCUS + b.t1) / 2)).toBe(3);
    expect(typedChars("abcdef", b, b.t1)).toBe(6);
  });

  it("puts the actions' anchors after the highlights and the lift", () => {
    const v = { kind: "image" as const, src: "p.png", frame: "browser" as const, highlight: [{ phrase: "a", at: "one" }], lift: { rect: [0, 0, 1, 1] as Box, at: "two" }, actions: [{ act: "click" as const, phrase: "Create account", at: "three" }] };
    expect(visualAnchors(v)).toEqual(["one", "two", "three"]);
    expect(actionOffset(v)).toBe(2);
  });
});

describe("findField", () => {
  it("finds a field by its label, any case, or by the start of it", () => {
    expect(findField(page, "full name").box[1]).toBe(0.2);
    expect(findField(page, "Email").label).toBe("Email address");
  });

  it("names the page's fields when the label is not there", () => {
    expect(() => findField(page, "Phone")).toThrow(/no field labelled "Phone".*"/);
  });
});

describe("placePhrases with actions", () => {
  it("fills in each target's box, its text style, its focus and its tick", () => {
    const { visual, errors } = placePhrases(
      {
        kind: "image",
        src: "assets/pages/p.png",
        frame: "browser",
        highlight: [],
        actions: [
          { act: "type", field: "Email", text: "ada@example.com" },
          { act: "check", field: "Send me updates" },
          { act: "click", phrase: "Create account" },
        ],
      },
      page,
    );
    expect(errors).toEqual([]);
    const [type, check, click] = visual.actions!;
    expect(type.rect).toEqual([0.1, 0.4, 0.5, 0.08]);
    expect(type.font?.family).toBe("Inter");
    expect(type.focused?.src).toBe("assets/pages/p-focus-1.png");
    expect(check.checked).toBe("assets/pages/p-check-2.png");
    expect(click.rect?.[0]).toBeCloseTo(0.1);
    expect(click.rect?.[2]).toBeCloseTo(0.18);
  });

  it("refuses to type into a box or tick a field", () => {
    const { errors } = placePhrases({ kind: "image", src: "p.png", frame: "browser", highlight: [], actions: [{ act: "type", field: "Send me updates", text: "x" }, { act: "check", field: "Full name" }] }, page);
    expect(errors).toHaveLength(2);
  });

  it("asks for a capture when there is no page json to name fields on", () => {
    const { errors } = placePhrases({ kind: "image", src: "p.png", frame: "browser", highlight: [], actions: [{ act: "click", phrase: "Go" }] }, undefined);
    expect(errors[0]).toMatch(/studio capture/);
  });
});
