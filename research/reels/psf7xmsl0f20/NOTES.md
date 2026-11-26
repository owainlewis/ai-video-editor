# "5 design skills for Claude Code" reel (studied 2026-11-26)

A listicle reel, 52 s, 9:16, 24 fps (720x1280 download). Talking head, warm room, one creator. Owain liked the full-bleed shots on the split.

Frames: `sheet_0.jpg` to `sheet_5.jpg` (two frames a second, 10 s a sheet, read left to right, top row then bottom), full-size top halves `top_*.jpg`, `tops_a.jpg` and `tops_b.jpg`.

## Structure

- 0 to 2 s: hook over his face, small white words with one word in a large yellow serif italic ("AI slop", "better").
- 2 to 4 s: a full-screen white card, the product's mascot in the middle and the numbers 1 to 5 landing round it on a dashed ring, one per word ("you have to give your Claude Code").
- Then five items. Each opens on a giant yellow "#N" over his face (about 0.5 s), then cuts to the split for the item.
- Ends on his face with the call to action ("Comment Design") in the same small white words. No end card.

## The split

- Top about 55%, his face below. No band: the caption sits on the seam in a small dark pill, half over each side.
- **The top is the real thing, full bleed.** A site's hero, a component gallery, a code editor, a docs page, a technical drawing: edge to edge, from the top of the frame to the seam. No browser chrome, no card, no margin, no rounded corners. The page is cropped to the part being said and set large, the rest cut off at the frame's edges.
- One framing per shot, a hard cut to the next framing about every second (21st's hero, its pricing grid, its component grid, the code). Nothing pans inside a shot except a screen recording.
- The product's name is lit on the page as he says it: a text selection (blue) on "Use 21st" and "impeccable", a yellow marker on "Stageshow".
- Variants cycle on one page (the same landing page restyled four ways as he says "critique") as quick hard cuts.

## Against our kit and rules

| His move | What we have | Verdict |
| --- | --- | --- |
| Full-bleed page in the split's top | `frame: "none"` filled the panel inside a 48 px margin, 100 px down | **Taken (2026-11-26):** `frame: "none"` on a split now runs edge to edge, top of frame to seam (`effects/clean/Clean.tsx`, `bleeds`) |
| One framing per shot, cut to the next | RULES 2026-11-25: no zooms or pans on a page | Same rule. Cut to a new shot per framing, about every 1 to 2 s |
| Name lit on the page as it is said | `image` `highlight` with a `phrase` | Have it. Ours is the accent marker; his is a text selection. Keep ours |
| Numbered ring round a logo, one per word | `flow` `fan-out` with a logo node | Close. A ring layout would be new; build only if a listicle needs it |
| Giant yellow "#N" over the face | `hit` | Does not fit: yellow, and his face covered. A `chapter`-like plain number would fit a listicle |
| One word in big yellow serif italic | `hit`, Helvetica only | Does not fit: our type is Helvetica, no yellow |
| Caption in a pill on the seam | Caption band with a hairline | Keep ours (the look is locked) |
| Code editor full bleed | `code` fills its box edge to edge | Have it |
