import React from "react";
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import type {Scene} from "../../../workflow/types";

export const CinematicTransition: React.FC<{type?: Scene["transition"]; accent: string}> = ({type = "crossfade", accent}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = interpolate(frame, [0, 8, durationInFrames - 10, durationInFrames], [0.7, 0, 0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const x = type === "whip" ? interpolate(frame, [durationInFrames - 10, durationInFrames], [-1100, 0], {extrapolateLeft: "clamp"}) : 0;
  const radius = type === "iris" ? interpolate(frame, [durationInFrames - 10, durationInFrames], [100, 0], {extrapolateLeft: "clamp"}) : 100;
  return <AbsoluteFill style={{pointerEvents: "none", opacity, transform: `translateX(${x}px)`, background: type === "light-leak" ? `radial-gradient(circle at 80% 30%, #fff, ${accent} 18%, transparent 58%)` : "#050816", clipPath: `circle(${radius}% at 50% 50%)`, mixBlendMode: type === "light-leak" ? "screen" : "normal"}} />;
};
