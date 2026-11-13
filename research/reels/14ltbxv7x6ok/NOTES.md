# 14ltbxv7x6ok: EGM in 42 seconds

Owain sent it on 2026-11-11: "We are making similar content on this topic so we can learn from it." Same topic as our EGM reels (`projects/egm-reel-v2`, `projects/egm-clean`).

42.7 s, 720x1280, 30 fps. -14.3 LUFS, LRA 2.3, peak -0.6 dBTP. 181 words, about 257 words a minute, speech from the first frame.

Read `overview.jpg` (a frame every second), `keyframes.jpg` (six moments at full size) and `motion-17.jpg` (8 fps over 2 s, the goldfish arriving).

## The script

13 sentences, one idea each:

1. Hook (0:00): "Google just open sourced a free plugin that stops your AI from writing buggy, sloppy code."
2. Proof (0:05): thousands of Google engineers use it every day.
3. Name (0:09): the Elephant Goldfish Model, a two-agent setup.
4. How it works (0:12 to 0:25): the elephant knows your project and writes the plan; goldfish with zero context stress test it and find every gap.
5. Why (0:25): you can't spot your own mistakes, a fresh pair of eyes can.
6. Payoff (0:32): you approve the plan, then Claude builds. Saves hours and tokens.
7. Call to action (0:37): comment "Google" for a step-by-step guide by DM.

Our `egm-reel-v2` opens the same way ("Google just released a new plugin...") and speaks at the same pace (263 words a minute), but runs 74.5 s. This one says the whole idea in 43 s by cutting the skill list, the install and the detail, and keeping one example.

## The picture

- **Three views, in about equal shares:** split (a graphic on top, him in a rounded card below) 44%; a full-frame graphic on a dark blurred background 42%; his face full frame 14%, only at the end for the call to action.
- **Cuts land on sentence starts:** 9 cuts in 43 s (1.8, 4.9, 8.8, 12.2, 17.4, 25.1, 32.1, 34.7, 37.5), about 4.3 s a shot. But something changes inside every shot about once a second: a highlight wipes on, a line types, a goldfish arrives, a word lights up. The eye never waits.
- **Captions on the seam,** two or three words at a time, bold white sans; the word being said is full white and the next ones are grey. One key word per line turns blue italic serif ("free", "elephant", "goldfish", "blind", "tokens"). The same two-typeface trick we use (Helvetica and Signifier), with blue where we use sage.
- **A header for the hook only:** "Google's Free Fix For *Sloppy AI Code*" over the first 5 s, with Google in its brand colours and the phrase in a blue highlight box. It goes once the idea is named.
- **Real where it can be:** the real egm.dev page, with a highlighter wiping across "Thousands of Google engineers" as he says it; the real Google logo; the real Elephant and Goldfish marks, which become the reel's characters.
- **Clean mock-ups where it explains:** a tidy Claude Code window (`/egm-brainstorm Add webhook delivery`, the elephant reading files) and a short plan, "Webhook delivery", with three lines: delivery, storage, rollout.

## The best moment (0:17 to 0:25)

The plan sits full frame. Four goldfish slide in from the right with motion blur, one per beat of "a bunch of goldfish agents". On "tear it apart" each one attacks a line: a red box, a strike-through, and a red note naming the flaw ("Same event, sent twice", "Missing: what if a delivery fails?", "Old events pile up forever", "No rollback plan").

This is the mechanism shown, not described. The viewer sees what a zero-context reviewer does to a real plan, in 8 seconds and with no diagram. Then (0:25 to 0:31) the same plan in a review window, the elephant's approval and the goldfish's red change request, and (0:32) Claude Code's real "Would you like to proceed?" prompt on "approve".

## What we take

1. **Shorter.** Aim for 40 to 50 s on this topic. One example, not the skill list.
2. **Show the reviewers working on a real plan.** We have a better example than theirs, because ours is real: Owain's YouTube IQ user-accounts spec, where six reviewers found 20 blockers. Real findings from that run ("routes would leak data between users", "SQLite for thousands of users", "the YouTube quota doesn't reach thousands of users") struck through by goldfish beat an invented webhook plan. Take the findings from the recording, never invent them.
3. **The marks as characters.** Elephant and Goldfish icons that move and act (arrive, attack, approve), not a labelled diagram. We already have both marks (`effects/custom/egmicons.ts`).
4. **Change inside the shot about once a second,** even when the shot holds 4 s. Our clean style's two-second rule is the floor, not the target.
5. **A highlighter on the real page** for the proof line, which our recorder already does (`mark`).
6. **The call to action on his face, full frame, last 5 s,** with the keyword as the only caption.

## What we leave

- **Invented mock-ups as if real.** Their plan, the goldfish notes and the Claude Code session are designed for the reel. Our rule is real captures and real findings (RULES.md, "Show the thing"), and our demo gives us both.
- **Blue as the accent.** Ours is sage.
- **The grey upcoming words in the caption.** It reads as karaoke; our caption is calmer.
- **"Comment Google for a DM."** That is a ManyChat keyword funnel. Use it only if Owain has one set up; otherwise keep his usual call to action.

Not measured: whether there is music under the voice (the voice barely pauses), and whether the voice was sped up.
