import {access} from "node:fs/promises";
import path from "node:path";
import type {ProjectSpec} from "./types.js";

export async function validateRenderableProject(projectRoot: string, spec: ProjectSpec): Promise<{renderable: boolean; issues: string[]}> {
  const issues: string[] = [];
  const totalDuration = spec.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (totalDuration !== spec.durationSeconds) issues.push(`Scene duration total ${totalDuration}s does not equal ${spec.durationSeconds}s.`);
  if (spec.scenes[0]?.startSeconds !== 0) issues.push("First scene must start at 0 seconds.");
  for (const file of ["video_plan.md", "script.md", "storyboard.md", "assets/manifest.json"]) {
    try {
      await access(path.join(projectRoot, file));
    } catch {
      issues.push(`Missing required artifact: ${file}`);
    }
  }
  return {renderable: issues.length === 0, issues};
}

export function validateRenderedVideo(probe: {format?: {duration?: string}; streams?: Array<{codec_type?: string; codec_name?: string; width?: number; height?: number}>}, aspectRatio: "9:16" | "16:9" = "9:16"): {valid: boolean; issues: string[]} {
  const issues: string[] = [];
  const duration = Number(probe.format?.duration);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  if (!Number.isFinite(duration) || Math.abs(duration - 60) > 0.25) issues.push(`Expected 60s duration, received ${probe.format?.duration ?? "unknown"}.`);
  if (!video || video.codec_name !== "h264") issues.push("Expected an H.264 video stream.");
  const expected = aspectRatio === "16:9" ? [1920, 1080] : [1080, 1920];
  if (video?.width !== expected[0] || video?.height !== expected[1]) issues.push(`Expected ${expected[0]}x${expected[1]}, received ${video?.width ?? "?"}x${video?.height ?? "?"}.`);
  if (!audio || audio.codec_name !== "aac") issues.push("Expected an AAC audio stream.");
  return {valid: issues.length === 0, issues};
}
