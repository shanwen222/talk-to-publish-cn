import path from "node:path";
import {capture, resolveTool} from "../process.js";

type ProbeStream = {codec_type?: string; codec_name?: string; width?: number; height?: number};
type ProbeDocument = {streams?: ProbeStream[]; format?: {duration?: string; size?: string}};

export type MediaProbe = {
  durationSeconds: number;
  sizeBytes: number;
  video: ProbeStream | undefined;
  audio: ProbeStream | undefined;
};

export async function probeMedia(mediaPath: string): Promise<MediaProbe> {
  const absoluteMediaPath = path.resolve(mediaPath);
  const ffprobe = resolveTool("ffprobe", "Gyan.FFmpeg");
  const stdout = await capture(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", absoluteMediaPath], path.dirname(absoluteMediaPath));
  const parsed = JSON.parse(stdout) as ProbeDocument;
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    sizeBytes: Number(parsed.format?.size ?? 0),
    video: parsed.streams?.find((stream) => stream.codec_type === "video"),
    audio: parsed.streams?.find((stream) => stream.codec_type === "audio"),
  };
}

export async function validateDigitalHumanVideo(
  mediaPath: string,
  expectedAspectRatio: "9:16" | "16:9",
): Promise<{valid: boolean; issues: string[]; probe: MediaProbe}> {
  const probe = await probeMedia(mediaPath);
  const issues: string[] = [];
  if (!probe.video) issues.push("Missing video stream.");
  if (!probe.audio) issues.push("Missing audio stream.");
  if (!Number.isFinite(probe.durationSeconds) || probe.durationSeconds <= 0) issues.push("Invalid duration.");
  if (probe.sizeBytes < 10_000) issues.push("Final video is implausibly small.");
  if (probe.video?.width && probe.video.height) {
    const portrait = probe.video.height > probe.video.width;
    if (expectedAspectRatio === "9:16" && !portrait) issues.push("Expected portrait 9:16 output.");
    if (expectedAspectRatio === "16:9" && portrait) issues.push("Expected landscape 16:9 output.");
  }
  return {valid: issues.length === 0, issues, probe};
}
