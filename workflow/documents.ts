import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import type {ProjectSpec} from "./types.js";
import {viralReportMarkdown, type ViralReport} from "./viral-agent.js";

function planMarkdown(spec: ProjectSpec): string {
  return `# ${spec.title}\n\n- 视频定位：${spec.positioning}\n- 目标用户：${spec.audience}\n- 视频风格：${spec.style}\n- 时长：${spec.durationSeconds} 秒\n- 画幅：${spec.aspectRatio}\n`;
}

function scriptMarkdown(spec: ProjectSpec): string {
  const narration = spec.scenes.map((scene) => `- ${scene.startSeconds}-${scene.startSeconds + scene.durationSeconds}s：${scene.narration}`).join("\n");
  return `# ${spec.title}\n\n## 前 3 秒钩子\n\n${spec.hook}\n\n## 旁白\n\n${narration}\n\n## CTA\n\n${spec.cta}\n`;
}

function storyboardMarkdown(spec: ProjectSpec): string {
  return `# 分镜：${spec.title}\n\n${spec.scenes.map((scene, index) => `## 镜头 ${index + 1}\n\n- 时间：${scene.startSeconds}-${scene.startSeconds + scene.durationSeconds} 秒\n- 画面：${scene.visual}\n- AI 生成提示词：${scene.prompt}\n- 旁白：${scene.narration}\n- 字幕：${scene.subtitle}\n`).join("\n")}`;
}

export async function writeProjectDocuments(root: string, spec: ProjectSpec, viralReport?: ViralReport): Promise<string[]> {
  const directories = ["assets/images", "assets/videos", "assets/audio", "voice", "subtitle"];
  await Promise.all(directories.map((directory) => mkdir(path.join(root, directory), {recursive: true})));
  const artifacts = ["video_plan.md", "script.md", "storyboard.md", "project.json", "assets/manifest.json", ...(viralReport ? ["viral_report.md"] : [])];
  await Promise.all([
    writeFile(path.join(root, "video_plan.md"), planMarkdown(spec), "utf8"),
    writeFile(path.join(root, "script.md"), scriptMarkdown(spec), "utf8"),
    writeFile(path.join(root, "storyboard.md"), storyboardMarkdown(spec), "utf8"),
    writeFile(path.join(root, "project.json"), `${JSON.stringify(spec, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "assets/manifest.json"), `${JSON.stringify({schemaVersion: "v1", items: [], policy: "Local assets only until a provider is explicitly configured."}, null, 2)}\n`, "utf8"),
    ...(viralReport ? [writeFile(path.join(root, "viral_report.md"), viralReportMarkdown(viralReport), "utf8")] : []),
  ]);
  return artifacts;
}
