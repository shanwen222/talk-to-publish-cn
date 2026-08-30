import React from "react";
import {AbsoluteFill, interpolate, useCurrentFrame} from "remotion";

const particles = Array.from({length: 34}, (_, index) => ({
  x: (index * 83 + 47) % 1080,
  y: (index * 137 + 91) % 1920,
  size: 3 + (index % 5),
  speed: 0.35 + (index % 7) * 0.08,
}));

export const Particle: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{overflow: "hidden", pointerEvents: "none"}}>
      {particles.map((particle, index) => {
        const y = (particle.y - frame * particle.speed + 2100) % 2100 - 90;
        const opacity = interpolate(Math.sin((frame + index * 11) / 18), [-1, 1], [0.12, 0.7]);
        return <div key={index} style={{position: "absolute", left: particle.x, top: y, width: particle.size, height: particle.size, borderRadius: "50%", background: accent, opacity, boxShadow: `0 0 16px ${accent}`}} />;
      })}
    </AbsoluteFill>
  );
};
