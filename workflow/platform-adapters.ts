import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import type {ProjectSpec} from "./types.js";

const platforms = {
  xiaohongshu: {videoAspectRatio: "9:16", thumbnail: "output/thumbnails/xiaohongshu.png", thumbnailSize: [1242, 1660]},
  douyin: {videoAspectRatio: "9:16", thumbnail: "output/thumbnails/douyin.png", thumbnailSize: [1080, 1440]},
  youtube: {videoAspectRatio: "9:16", thumbnail: "output/thumbnails/youtube.png", thumbnailSize: [1280, 720]},
} as const;

export async function createPlatformPackages(projectRoot: string, spec: ProjectSpec): Promise<string[]> {
  const destination = path.join(projectRoot, "platforms");
  await mkdir(destination, {recursive: true});
  return Promise.all(Object.entries(platforms).map(async ([platform, configuration]) => {
    const output = path.join(destination, `${platform}.json`);
    await writeFile(output, `${JSON.stringify({
      schemaVersion: "v2", platform, status: "ready-for-manual-review", publishingEnabled: false,
      title: spec.title, caption: `${spec.hook}\n\n${spec.cta}`, video: "output/final.mp4", ...configuration,
    }, null, 2)}\n`, "utf8");
    return output;
  }));
}
