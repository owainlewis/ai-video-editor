// A reel's call to action (Owain, 2026-11-14): "comment Agent below and I'll send it across" works on
// Instagram, where he answers comments, and not on TikTok or LinkedIn, where he does not. So every
// export makes two versions: the full reel, and one that ends before the call to action. Pure; the
// second version is made in media/nocta.ts.
import { findPhrase, type Issue, snap } from "./resolve.ts";
import type { Word } from "./schema.ts";

// How long a reel holds its last frame after the last word. The voice used to end within a frame or
// two of the video, so on a phone the last word sounded cut off (Owain, 2026-11-14: "comment AGENT
// below and I'll send it ... (across)"). Both versions end this way.
export const END_HOLD = 0.6;
// The version without the call to action holds its last frame as long, while the music fades out.
export const CTA_TAIL = END_HOLD;

// Where the version without the call to action ends: in the pause before its first word, the last
// time those words are said.
export function resolveCta(at: string | undefined, words: Word[], fps: number): { cta?: { at: string; end: number }; issues: Issue[] } {
  if (!at) return { issues: [{ level: "warn", message: 'no "cta": name the words the call to action starts on ("cta": "If you want a guide"), so the export also makes the version without it, for TikTok and LinkedIn' }] };
  let i = -1;
  for (let j = findPhrase(words, at); j >= 0; j = findPhrase(words, at, j + 1)) i = j;
  if (i < 0) return { issues: [{ level: "error", message: `"cta": "${at}" is not said` }] };
  if (i === 0) return { issues: [{ level: "error", message: `"cta": "${at}" starts the reel, so nothing is left without it` }] };
  const gap = Math.max(0, words[i].start - words[i - 1].end);
  return { cta: { at, end: snap(words[i].start - gap / 2, fps) }, issues: [] };
}

// The no-CTA version's length on the timeline.
export const noCtaLength = (cta: { end: number }) => cta.end + CTA_TAIL;
