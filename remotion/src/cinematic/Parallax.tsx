import React from "react";
import {AbsoluteFill, interpolate, useCurrentFrame} from "remotion";

export const Parallax: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{overflow: "hidden", pointerEvents: "none"}}>
      {[0, 1, 2].map((layer) => {
        const y = interpolate(frame, [0, 300], [70 * (layer + 1), -55 * (layer + 1)]);
        return <div key={layer} style={{position: "absolute", width: 620 - layer * 130, height: 620 - layer * 130, borderRadius: "46%", border: `${3 - layer}px solid ${accent}${["55", "3a", "22"][layer]}`, left: 230 + layer * 65, top: 590 + layer * 65, transform: `translateY(${y}px) rotate(${frame * (0.05 + layer * 0.03)}deg)`, boxShadow: `0 0 ${80 - layer * 15}px ${accent}22`}} />;
      })}
    </AbsoluteFill>
  );
};
