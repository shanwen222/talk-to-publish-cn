import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Loop,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {ProjectSpec, Scene} from "../../workflow/types";
import {CameraMove} from "./cinematic/CameraMove";
import {CinematicTransition} from "./cinematic/CinematicTransition";
import {KenBurns} from "./cinematic/KenBurns";
import {Parallax} from "./cinematic/Parallax";
import {Particle} from "./cinematic/Particle";

const fontFamily = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

const Background: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const rotation = interpolate(frame, [0, 300], [0, 28]);
  return (
    <AbsoluteFill style={{background: "linear-gradient(155deg, #050816 0%, #0A1028 55%, #090713 100%)", overflow: "hidden"}}>
      <div style={{position: "absolute", width: 900, height: 900, borderRadius: "50%", background: accent, filter: "blur(180px)", opacity: 0.18, top: -250, right: -360, transform: `rotate(${rotation}deg)`}} />
      <div style={{position: "absolute", inset: 80, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 56}} />
      {Array.from({length: 7}).map((_, index) => (
        <div key={index} style={{position: "absolute", left: 110 + index * 140, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.025)"}} />
      ))}
    </AbsoluteFill>
  );
};

const SceneCard: React.FC<{scene: Scene; index: number; total: number}> = ({scene, index, total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 16, stiffness: 90}});
  const {durationInFrames} = useVideoConfig();
  const exit = interpolate(frame, [Math.max(0, durationInFrames - 18), durationInFrames], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const opacity = enter * exit;
  const translateY = interpolate(enter, [0, 1], [90, 0]);
  const imageScale = interpolate(frame, [0, durationInFrames], [1.06, 1.16]);
  const revealed = Math.max(1, Math.ceil(interpolate(frame, [5, Math.min(40, durationInFrames - 5)], [0, scene.subtitle.length], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})));
  const VisualMotion = scene.motion === "ken-burns" ? KenBurns : React.Fragment;
  return (
    <AbsoluteFill style={{fontFamily, color: "white", padding: "170px 110px 150px", opacity}}>
      <div style={{display: "flex", alignItems: "center", gap: 18, fontSize: 28, letterSpacing: 4, color: scene.accent, fontWeight: 700}}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div style={{height: 2, width: 90, background: scene.accent}} />
        <span style={{color: "rgba(255,255,255,0.48)"}}>{String(total).padStart(2, "0")}</span>
      </div>
      <h1 style={{fontSize: 104, lineHeight: 1.08, margin: "90px 0 54px", letterSpacing: -5, transform: `translateY(${translateY}px)`, textShadow: `0 0 55px ${scene.accent}44`}}>
        {scene.title}
      </h1>
      <div style={{height: 700, borderRadius: 48, overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.11)", background: `linear-gradient(145deg, ${scene.accent}24, rgba(255,255,255,0.025))`}}>
        {scene.image ? (
          <Img src={staticFile(scene.image)} style={{width: "100%", height: "100%", objectFit: "cover", transform: `scale(${imageScale})`}} />
        ) : (
          <VisualMotion>
          <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center"}}>
            <div style={{width: 360, height: 360, border: `3px solid ${scene.accent}`, borderRadius: "50%", boxShadow: `0 0 80px ${scene.accent}66, inset 0 0 70px ${scene.accent}33`, transform: `rotate(${frame * 0.18}deg)`}}>
              <div style={{position: "absolute", inset: 55, border: "1px dashed rgba(255,255,255,0.45)", borderRadius: "42%"}} />
            </div>
            <div style={{position: "absolute", fontSize: 42, fontWeight: 800, letterSpacing: 5}}>AI · 未来</div>
          </div>
          </VisualMotion>
        )}
      </div>
      <div style={{marginTop: 80, fontSize: 48, lineHeight: 1.45, fontWeight: 700}}>
        <span style={{color: scene.accent}}>「</span>{scene.subtitle.slice(0, revealed)}<span style={{opacity: 0.24}}>{scene.subtitle.slice(revealed)}</span><span style={{color: scene.accent}}>」</span>
      </div>
      <div style={{position: "absolute", left: 110, right: 110, bottom: 85, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)"}}>
        <div style={{height: "100%", width: `${((index + frame / durationInFrames) / total) * 100}%`, background: scene.accent, borderRadius: 3}} />
      </div>
    </AbsoluteFill>
  );
};

export const FactoryVideo: React.FC<{spec: ProjectSpec; includeTemplateAudio?: boolean}> = ({spec, includeTemplateAudio = true}) => (
  <AbsoluteFill>
    {includeTemplateAudio && <Loop durationInFrames={300}>
      <Audio src={staticFile("audio/default-bgm.mp3")} volume={0.16} />
    </Loop>}
    {spec.scenes.map((scene, index) => (
      <Sequence key={scene.id} from={Math.round(scene.startSeconds * 30)} durationInFrames={Math.round(scene.durationSeconds * 30)}>
        <CameraMove direction={scene.motion === "parallax" ? "drift" : index % 2 ? "pull" : "push"}>
          <Background accent={scene.accent} />
          <Parallax accent={scene.accent} />
          <Particle accent={scene.accent} />
          <SceneCard scene={scene} index={index} total={spec.scenes.length} />
        </CameraMove>
        <CinematicTransition type={scene.transition} accent={scene.accent} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
