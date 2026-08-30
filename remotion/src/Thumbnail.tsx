import React from "react";
import {AbsoluteFill} from "remotion";
import type {ProjectSpec} from "../../workflow/types";
import {Particle} from "./cinematic/Particle";

const fontFamily = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

export const Thumbnail: React.FC<{spec: ProjectSpec; platform: "xiaohongshu" | "douyin" | "youtube"}> = ({spec, platform}) => {
  const horizontal = platform === "youtube";
  const accent = spec.scenes[0]?.accent ?? "#74F9FF";
  return (
    <AbsoluteFill style={{fontFamily, color: "white", background: "linear-gradient(145deg,#030511 0%,#101A3D 58%,#140A25 100%)", overflow: "hidden", padding: horizontal ? "72px 90px" : "120px 90px"}}>
      <Particle accent={accent} />
      <div style={{position: "absolute", width: horizontal ? 650 : 850, height: horizontal ? 650 : 850, borderRadius: "50%", background: accent, filter: "blur(160px)", opacity: 0.24, right: -230, top: -230}} />
      <div style={{fontSize: horizontal ? 28 : 34, letterSpacing: 8, color: accent, fontWeight: 800}}>AI HOTSPOT · 60S</div>
      <div style={{marginTop: horizontal ? 52 : 130, maxWidth: horizontal ? 900 : 950, fontSize: horizontal ? 92 : 112, lineHeight: 1.04, fontWeight: 950, letterSpacing: -6}}>
        AI 智能体<br/><span style={{color: accent}}>正在重构</span><br/>内容生产
      </div>
      <div style={{position: "absolute", left: horizontal ? 90 : 95, bottom: horizontal ? 72 : 125, display: "flex", alignItems: "center", gap: 20, fontSize: horizontal ? 27 : 34, fontWeight: 700}}>
        <span style={{display: "inline-block", width: 60, height: 5, background: accent}} /> 从工具到生产系统
      </div>
      <div style={{position: "absolute", right: horizontal ? 80 : 75, bottom: horizontal ? 55 : 110, width: horizontal ? 250 : 290, height: horizontal ? 250 : 290, borderRadius: "50%", border: `4px solid ${accent}`, boxShadow: `0 0 70px ${accent}88, inset 0 0 55px ${accent}44`}} />
    </AbsoluteFill>
  );
};
