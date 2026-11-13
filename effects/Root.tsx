import React from "react";
import { Composition } from "remotion";
import { blank } from "./canvas";
import { Reel } from "./Reel";
import { Wide, WH, WW } from "./Wide";
import type { Resolved } from "../engine/schema";

// Props come from projects/<slug>/build/edit.resolved.json (written by `npm run studio -- check`).
const empty: Resolved = { ...blank("reel"), title: "Empty", duration: 3, shots: [] };

const metadata = ({ props }: { props: Resolved }) => ({ durationInFrames: Math.max(1, Math.round(props.duration * props.fps)), fps: props.fps });

// "Reel" is 9:16 for Instagram; "Wide" is 16:9 for YouTube. `compositionFor` picks by canvas.
export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} width={1080} height={1920} fps={30} durationInFrames={90} defaultProps={empty} calculateMetadata={metadata} />
    <Composition id="Wide" component={Wide} width={WW} height={WH} fps={30} durationInFrames={90} defaultProps={{ ...empty, canvas: "youtube", captions: false }} calculateMetadata={metadata} />
  </>
);
