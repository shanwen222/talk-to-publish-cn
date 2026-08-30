import React from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";

export const KenBurns: React.FC<React.PropsWithChildren<{reverse?: boolean}>> = ({children, reverse = false}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {extrapolateRight: "clamp"});
  const scale = reverse ? 1.16 - progress * 0.12 : 1.04 + progress * 0.12;
  const x = interpolate(progress, [0, 1], reverse ? [28, -22] : [-22, 28]);
  return <div style={{width: "100%", height: "100%", transform: `translateX(${x}px) scale(${scale})`}}>{children}</div>;
};
