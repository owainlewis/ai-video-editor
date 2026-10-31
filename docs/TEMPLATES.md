# Templates

The house looks, settled on the Linear video (2026-10-30). A storyboard names a template for each moment, anchors it to a few spoken words, and fills in only its content. Everything else (fonts, colours, timing, motion) comes from the template, so nobody has to describe an edit again.

Inputs: `Camera.mp4` (the A-roll with the Auphonic audio, cut) and `Screen.mp4` (the OBS track, the same length and in sync).

## The theme: black

- Pure black cards (`#000`, raised `#0B0B0B`), white type (`#F5F5F2`), grey for quiet parts (`#9C9C98`), lines at 14% white.
- No colour accent. Emphasis is Signifier italic on the `*marked*` words.
- Helvetica for text, Signifier for headlines and quotes. A little grain on black, no grid.
- Nothing hard cuts. Every template fades in and out over 0.4 s with ease-in-out. Back-to-back graphics of the same template cross over without fading back to the picture.

## The templates

| Template | Looks like | Fill in | Use for |
| --- | --- | --- | --- |
| `quote` | Full-frame black. One or two lines of Signifier, each word fades in as it is said. One `*marked*` phrase in italic. | `text` (lines split with `//`) | A line worth stopping on: the hook, a thesis, a turn. |
| `split` | Ross style: a paper panel (`#F6F5F2`, faint 60 px grid) on the left half, the speaker's right half beside it. Items appear on their words. | `title`, `sub`, `items` (each with its words) | Lists, steps and levels while he is on camera. |
| `card` | A dark rounded card (radius 28, 94% black, soft shadow) floats over the picture, which blurs (30 px) and dims (to 38%) behind it. Rises 24 px as it fades in. | any visual: list, levels, compare, stat, diagram | Diagrams and structured ideas over desk or screen footage. |
| `screen` | The screen recording full frame, with its own camera inset. | `from`, `to` (words) | Demos. |
| `camera` | The camera full frame, as graded. | (none) | The default: everything not covered by another template. |

The soft fade is part of every template, not a template of its own.

## Rules that come with them

- Graphics go only where Owain is on camera or on desk footage, never over a demo.
- One graphic every 20 to 60 seconds of on-camera time, each held for 4 to 12 seconds.
- Use the speaker's real words. Never invent facts, numbers or UI.
- No lower thirds and no stat cards for his own credentials.

## Storyboard

```json
[
  { "at": "you need to be able to delegate", "template": "quote", "text": "You need to be able to // delegate *real work* to them." },
  { "at": "go from chatting with agents", "template": "split", "title": "Delegation", "sub": "The three levels",
    "items": [{ "text": "Chatting with agents", "at": "chatting with agents" }, { "text": "Delegating complex work", "at": "delegating complex" }] },
  { "at": "So if you think about the three levels", "template": "card", "visual": { "kind": "levels", "items": ["Do the work yourself", "Chat with an agent", "Delegate the task"] } },
  { "at": "So we're going to be using Linear", "template": "screen", "to": "so let's do another example" }
]
```

Every moment lasts until the next one starts. Anything not covered plays `camera`.
