import React from "react";
import {Composition} from "remotion";
import {FactoryVideo} from "./FactoryVideo";
import type {ProjectSpec} from "../../workflow/types";
import {Thumbnail} from "./Thumbnail";

const defaultSpec: ProjectSpec = {
  schemaVersion: "v1",
  projectId: "preview",
  title: "Talk to Publish",
  positioning: "Chinese talking-head video",
  audience: "Creator",
  style: "Semantic motion",
  durationSeconds: 60,
      aspectRatio: "16:9",
  hook: "From a real voice to a publishable video",
  cta: "Start building",
  scenes: [{
    id: "preview-1",
    startSeconds: 0,
    durationSeconds: 60,
    title: "Talk to Publish",
    visual: "Preview",
    prompt: "Preview",
    narration: "Preview",
    subtitle: "从真实口播，到一条完整视频",
    accent: "#74F9FF",
  }],
};

export const FactoryRoot: React.FC = () => (
  <>
    <Composition
      id="FactoryVideo"
      component={FactoryVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={1800}
      defaultProps={{spec: defaultSpec}}
    />
    <Composition id="ThumbnailXiaohongshu" component={Thumbnail} width={1242} height={1660} fps={30} durationInFrames={1} defaultProps={{spec: defaultSpec, platform: "xiaohongshu" as const}} />
    <Composition id="ThumbnailDouyin" component={Thumbnail} width={1080} height={1440} fps={30} durationInFrames={1} defaultProps={{spec: defaultSpec, platform: "douyin" as const}} />
    <Composition id="ThumbnailYouTube" component={Thumbnail} width={1280} height={720} fps={30} durationInFrames={1} defaultProps={{spec: defaultSpec, platform: "youtube" as const}} />
  </>
);
