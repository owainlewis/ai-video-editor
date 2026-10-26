# Reel formats

Owain (2026-10-26): "AI News works because it's repeatable. I think practical stuff. How to… Steps to… Breakdown a new thing." Three formats, each a fixed skeleton: the beats never change, the topic, facts and graphics do. Every script starts from one of these. Hooks follow `HOOKS.md`; graphics are still designed per video (`CLAUDE.md`, "Design per video"), but each format has its signature picture so a series is recognisable.

All three: 35 to 55 seconds, one idea, a concrete outcome in the first line, every fact checked against its source, a keyword CTA at the end.

## 1. How to

One outcome, one method, shown working.

| Beat | Time | What it does | Signature picture |
|---|---|---|---|
| Hook | 0 to 3 s | "Here's how to [outcome], [price or time anchor]." | the finished result first |
| The pain | 3 to 8 s | what goes wrong without it | the bad version, briefly |
| The method | 8 to 30 s | the setup, in the order you'd do it | the real screen: file, command, prompt, typing as said |
| Proof | 30 to 40 s | it working | the result, real |
| CTA | last 3 s | "Comment [WORD] and I'll send you [the file / prompt / setup]." | keyword card |

Hook frames: "Here's how to [outcome] in [time]." "This is how you make [tool] [do the useful thing]." "Stop [doing the slow thing]. Do this instead."

## 2. Steps to

A numbered path to an outcome. The number is the promise.

| Beat | Time | What it does | Signature picture |
|---|---|---|---|
| Hook | 0 to 3 s | "[N] steps to [outcome]." with who it's for or a stake | the steps as an empty track, an open loop |
| Each step | 6 to 9 s each | the step, why it matters, one concrete detail | the track lights the step; one picture per step |
| Payoff | 4 to 6 s | what you get when all are done | the full track lit |
| CTA | last 3 s | keyword for the checklist | keyword card |

Keep N between 3 and 5. A list opener ("Here are five ways…") flops in the data; a numbered path to one outcome is different because it promises a destination.

## 3. Breakdown

A new tool, repo or release, explained by an engineer: what it is, how it works, and whether you'd use it. News makes it timely; the verdict makes it yours.

| Beat | Time | What it does | Signature picture |
|---|---|---|---|
| Hook | 0 to 3 s | big name, new thing, outcome: "Google just released a tool that [does X]." | the real repo or product |
| What it is | 3 to 8 s | one sentence, plus the analogy a builder knows | analogy picture |
| Why it exists | 8 to 15 s | the problem it solves, the viewer's own pain | the problem drawn |
| How it works | 15 to 35 s | two to four parts, in the source's own terms | one diagram that builds part by part |
| Verdict | 35 to 45 s | Owain's take: who should use it, what's risky or early | Owain on camera, punch-in |
| CTA | last 3 s | keyword for the repo or guide | keyword card |

The verdict is the beat nobody else has. Never skip it.

## Example scripts (facts checked)

### How to: make Claude Code review what you care about

Source: code.claude.com/docs/en/code-review-customize (REVIEW.md).

> Here's how to make Claude Code review your code the way your team actually would.
>
> Without guidance, AI review can bury the bugs that matter under style and naming nitpicks.
>
> The fix is one file. Add a REVIEW.md to your repo.
>
> First, say what counts as important. Things that would break behaviour, leak data, or block a rollback.
>
> Then cap the noise. Report at most five nits per review.
>
> Then list what not to report. Anything CI already enforces, and generated files.
>
> And list what to always check. Like every database query being scoped to the right tenant.
>
> Now every review focuses on what your team cares about.
>
> Comment REVIEW and I'll send you the template.

### Steps to: review AI code like Anthropic

Source: claude.dev/blog/solving-code-review-at-anthropic (the first five of its six layers; the sixth, release and rollback, comes after merge).

> Five steps to review AI code like the Claude Code team.
>
> Step one. Before you open a PR, a fresh agent reviews the diff, and the tests, build and linter run.
>
> Step two. Automated checks on every PR. If lint, types, tests or the build fail, it can't merge.
>
> Step three. AI review. Agents hunt for bugs, and other agents check each finding.
>
> Step four. A separate security review. Open findings block the merge.
>
> Step five. A human, scaled by risk. Low risk needs no human once the checks pass. Medium needs one person. High needs two.
>
> Do all five, and you stop reading every line, without shipping blind.
>
> Comment REVIEW and I'll send you the checklist.

### Breakdown: Google's AX

Source: github.com/google/ax README. (Recorded 26 Oct as the AX reel; this is its skeleton.)

> Google released a tool for running thousands of AI agents in the cloud. It's called AX, Agent Executor.
>
> Think Kubernetes, but for AI agents.
>
> Here's why it exists. Most of us run agents on our laptops. You can't see what they're doing, what's running, or what it costs.
>
> Here's how it works. You write three things: a workspace, a model, and a task. One command sandboxes the agent and runs it. You can watch it, shell in, or pause and resume it.
>
> My take: if your team runs agents for real work, this is the direction. Take them off laptops and treat them like infrastructure. But it's early, so expect breaking changes before you bet on it.
>
> Comment AX and I'll send you the repo.
