import React from "react";
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";

export const CameraMove: React.FC<React.PropsWithChildren<{direction?: "push" | "pull" | "drift"}>> = ({children, direction = "push"}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {extrapolateRight: "clamp"});
  const scale = direction === "pull" ? 1.12 - progress * 0.1 : 1.02 + progress * 0.1;
  const x = direction === "drift" ? interpolate(progress, [0, 1], [-24, 24]) : 0;
  return <AbsoluteFill style={{transform: `translateX(${x}px) scale(${scale})`}}>{children}</AbsoluteFill>;
};
