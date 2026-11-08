// The beat view: a reel cut into beats of about 2 s, one per change on screen, so every graphic can
// be checked frame by frame before an export.
import { describe, expect, it } from "vitest";
import { beatAt, reelBeats } from "../engine/beats.ts";
import { resolveShots } from "../engine/resolve.ts";
import { Edit } from "../engine/schema.ts";

// Twenty words, one every 0.5 s: "w0" at 0, "w1" at 0.5 and so on.
const words = Array.from({ length: 20 }, (_, i) => ({ text: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
const resolve = (shots: unknown[], duration = 10) => resolveShots(Edit.parse({ title: "t", style: "clean", shots }), words, duration).shots;

describe("reel beats", () => {
  it("starts a beat on every shot and every reveal, and covers the whole reel", () => {
    const shots = resolve([
      { at: "w0", layout: "full" },
      { at: "w2", layout: "card", bg: "ink", visual: { kind: "beats", items: [{ text: "ONE", at: "w3" }, { text: "TWO", at: "w5" }] } },
      { at: "w7", layout: "split", visual: { kind: "custom", name: "x" }, hit: { text: "LOOP", at: "w8" } },
    ]);
    const beats = reelBeats(shots, words, 10);
    expect(beats[0].start).toBe(0);
    expect(beats[beats.length - 1].end).toBe(10);
    beats.forEach((b, i) => i && expect(b.start).toBe(beats[i - 1].end));
    // Shots start on a frame, so up to half a frame from their word.
    const near = (t: number) => beats.find((b) => Math.abs(b.start - t) < 0.02);
    for (const t of [0.95, 1.45, 2.45, 3.45, 3.95]) expect(near(t)).toBeDefined();
    expect(near(3.95)!.changes).toEqual(["hit LOOP"]);
    expect(near(1.45)!.changes).toEqual(["reveal 1/2"]);
  });

  it("splits a long stretch with nothing new so no beat runs past 2.5 s", () => {
    const beats = reelBeats(resolve([{ at: "w0", layout: "full" }]), words, 10);
    expect(beats.length).toBe(5);
    for (const b of beats) expect(b.end - b.start).toBeLessThanOrEqual(2.5);
    expect(beats.slice(1).every((b) => b.changes[0] === "held")).toBe(true);
    // The splits land on a word's start.
    for (const b of beats.slice(1)) expect(words.some((w) => Math.abs(w.start - b.start) < 1 / 30)).toBe(true);
  });

  it("puts changes that land together in one beat, looked at once they have settled", () => {
    const shots = resolve([
      { at: "w0", layout: "full" },
      { at: "w4", layout: "split", visual: { kind: "list", items: [{ text: "a" }, { text: "b" }, { text: "c", at: "w6" }] } },
    ]);
    const beats = reelBeats(shots, words, 5);
    const first = beats.find((b) => Math.abs(b.start - 1.95) < 0.02)!;
    // The shot and its two unanchored items cascade in together.
    expect(first.changes).toEqual(["shot", "reveal 1/3", "reveal 2/3"]);
    // Looked at just before the next beat, once everything in it has landed.
    expect(first.at).toBeCloseTo(first.end - 0.3, 1);
    expect(first.at).toBeLessThan(first.end);
    expect(first.said).toBe("w4 w5");
    expect(beats[beatAt(beats, first.at)]).toBe(first);
    // A short beat is looked at once its change has settled, still inside the beat.
    for (const b of beats) expect(b.at >= b.start && b.at < b.end).toBe(true);
    expect(shots[first.shot].layout).toBe("split");
  });

  it("only counts a kept visual's reveals inside the kept shot's own span", () => {
    const shots = resolve([
      { at: "w0", layout: "split", visual: { kind: "list", items: [{ text: "a", at: "w1" }, { text: "b", at: "w6" }] } },
      { at: "w4", layout: "split", keep: true },
    ], 5);
    const changes = reelBeats(shots, words, 5).flatMap((b) => b.changes);
    expect(changes.filter((c) => c === "reveal 2/2")).toHaveLength(1);
    expect(changes).toContain("header");
  });
});
