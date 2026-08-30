import {existsSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {run} from "./process.js";
import type {ProjectSpec} from "./types.js";

const thumbnails = [
  ["ThumbnailXiaohongshu", "xiaohongshu.png"],
  ["ThumbnailDouyin", "douyin.png"],
  ["ThumbnailYouTube", "youtube.png"],
] as const;

export async function generateThumbnails(spec: ProjectSpec, projectRoot: string, repositoryRoot: string): Promise<string[]> {
  const outputRoot = path.join(projectRoot, "output", "thumbnails");
  await mkdir(outputRoot, {recursive: true});
  const propsPath = path.join(projectRoot, "output", "thumbnail-props.json");
  await writeFile(propsPath, `${JSON.stringify({spec}, null, 2)}\n`, "utf8");
  const cli = path.join(repositoryRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const browserExecutable = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(existsSync);
  const outputs: string[] = [];
  for (const [composition, filename] of thumbnails) {
    const output = path.join(outputRoot, filename);
    await run(process.execPath, [
      cli, "still", "remotion/src/index.ts", composition, output, `--props=${propsPath}`, "--image-format=png", "--log=warn",
      ...(browserExecutable ? [`--browser-executable=${browserExecutable}`] : []),
    ], repositoryRoot);
    outputs.push(output);
  }
  return outputs;
}
