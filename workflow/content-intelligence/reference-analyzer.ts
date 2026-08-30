import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {capture, resolveTool} from "../process.js";
import type {ReferenceFacts} from "./types.js";

function parseRate(value: string | undefined): number {
  if (!value) return 0;
  const [numerator, denominator = "1"] = value.split("/");
  return Number(numerator) / Number(denominator);
}

async function detectSceneCuts(videoPath: string, repositoryRoot: string): Promise<number[]> {
  const ffmpeg = resolveTool("ffmpeg", "Gyan.FFmpeg_");
  const stderr = await new Promise<string>((resolve, reject) => {
    const child = spawn(ffmpeg, [
      "-hide_banner", "-i", videoPath, "-vf", "select='gt(scene,0.32)',showinfo", "-an", "-f", "null", "-",
    ], {cwd: repositoryRoot, shell: false});
    let output = "";
    child.stderr.setEncoding("utf8").on("data", (chunk) => output += chunk);
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output) : reject(new Error(`FFmpeg scene analysis exited with ${code}.`)));
  });
  return [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
}

async function materializeSource(source: string, repositoryRoot: string): Promise<{file: string; cleanup: boolean}> {
  if (!/^https?:\/\//i.test(source)) return {file: path.resolve(repositoryRoot, source), cleanup: false};
  const response = await fetch(source, {redirect: "follow"});
  if (!response.ok) throw new Error(`Reference download failed: HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("video/") && !contentType.includes("octet-stream")) {
    throw new Error("Video links must resolve directly to a public media file; page URLs require manual download first.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 250_000_000) throw new Error("Reference video exceeds the 250 MB local analysis limit.");
  const directory = path.join(repositoryRoot, ".tmp", "reference-analysis");
  await mkdir(directory, {recursive: true});
  const file = path.join(directory, `reference-${randomUUID()}.mp4`);
  await writeFile(file, bytes);
  return {file, cleanup: true};
}

export async function analyzeReferenceVideo(source: string, repositoryRoot: string): Promise<ReferenceFacts> {
  if (!source.trim()) throw new Error("Reference source must not be empty.");
  const materialized = await materializeSource(source.trim(), repositoryRoot);
  try {
    await readFile(materialized.file);
    const ffprobe = resolveTool("ffprobe", "Gyan.FFmpeg_");
    const raw = await capture(ffprobe, [
      "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate",
      "-of", "json", materialized.file,
    ], repositoryRoot);
    const probe = JSON.parse(raw) as {
      format?: {duration?: string};
      streams?: Array<{codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string}>;
    };
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    if (!video?.width || !video.height) throw new Error("Reference has no readable video stream.");
    return {
      source,
      durationSeconds: Number(probe.format?.duration ?? 0),
      width: video.width,
      height: video.height,
      frameRate: parseRate(video.avg_frame_rate),
      codec: video.codec_name ?? "unknown",
      audioPresent: probe.streams?.some((stream) => stream.codec_type === "audio") ?? false,
      sceneCutsSeconds: await detectSceneCuts(materialized.file, repositoryRoot),
    };
  } finally {
    if (materialized.cleanup) await rm(materialized.file, {force: true});
  }
}

export function referenceAnalysisMarkdown(facts: ReferenceFacts): string {
  const boundaries = [0, ...facts.sceneCutsSeconds, facts.durationSeconds].sort((a, b) => a - b);
  const intervals = boundaries.slice(1).map((value, index) => value - boundaries[index]!);
  const averageShot = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : facts.durationSeconds;
  const pacing = averageShot <= 2 ? "快" : averageShot <= 4 ? "中快" : "克制";
  return `# Reference Video Analysis\n\n## 1. 视频结构\n\n- 来源：${facts.source}\n- 工具观测：${facts.durationSeconds.toFixed(2)} 秒，${facts.width}×${facts.height}，${facts.frameRate.toFixed(2)} fps，${facts.codec}，${facts.audioPresent ? "含音频" : "无音频"}\n- 检测到的镜头切点：${facts.sceneCutsSeconds.length ? facts.sceneCutsSeconds.map((value) => `${value.toFixed(2)}s`).join("、") : "未检测到明显硬切"}\n- 估算镜头数：${Math.max(1, intervals.length)}\n- 平均镜头时长：${averageShot.toFixed(2)} 秒；节奏：${pacing}\n- Hook、内容段落与 CTA：需要结合转写或人工语义复核，当前不虚构。\n\n## 2. 视觉分析\n\n- 画幅：${facts.width >= facts.height ? "横屏" : "竖屏"}；分辨率 ${facts.width}×${facts.height}。\n- 转场：以上切点仅代表像素变化超过阈值，不等同于人工确认的转场类型。\n- 字幕风格、主色、镜头景别和构图：当前工具观测不足，标记为待视觉复核。\n\n## 3. 内容与传播推断\n\n- 可确认的节奏事实是平均镜头时长约 ${averageShot.toFixed(2)} 秒。\n- “为什么传播”属于推断，必须结合标题、完播、互动和受众数据验证，不能只凭视频文件下结论。\n- 可测试假设：把首个核心信息放进前 3 秒，并在平均 ${Math.max(2, Math.round(averageShot))} 秒左右制造一次信息变化。\n\n## 4. 复刻建议\n\n### 方案 A：高度复刻结构\n\n保持相近时长、镜头数量和节奏区间，只替换为自己的真实主题、素材和表达，不复制原文案或品牌资产。\n\n### 方案 B：优化版本\n\n保留节奏基线，强化前 3 秒问题、段落路标和单一 CTA；用 A/B 测试验证，不声称必然提升传播。\n\n### 方案 C：适合个人 IP 版本\n\n把外部叙事改为第一人称真实过程：起因、当前进展、产品证据、遇到的问题、下一步；保留克制视觉和公开迭代感。\n`;
}
