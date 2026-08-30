import {spawn} from "node:child_process";
import {existsSync, readdirSync} from "node:fs";
import {homedir} from "node:os";
import {copyFile, mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {digitalHumanComposition} from "../../digital-human/hyperframes/template.js";
import {resolveTool} from "../process.js";
import type {CaptionCue, DigitalHumanConfig, ProviderStatus} from "./types.js";

const factoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(factoryRoot, "node_modules", "hyperframes", "bin", "hyperframes.mjs");

function resolveCachedHeadlessShell(): string | undefined {
  if (process.platform === "win32") {
    const systemChrome = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    ].find((candidate) => existsSync(candidate));
    if (systemChrome) return systemChrome;
  }
  const cacheRoot = path.join(homedir(), ".cache", "puppeteer", "chrome-headless-shell");
  if (!existsSync(cacheRoot)) return undefined;
  const match = readdirSync(cacheRoot, {recursive: true, withFileTypes: true})
    .find((entry) => entry.isFile() && entry.name.toLowerCase() === "chrome-headless-shell.exe");
  return match ? path.join(match.parentPath, match.name) : undefined;
}

export function resolveHyperFrames(): ProviderStatus {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const available = Number.isFinite(nodeMajor) && nodeMajor >= 22 && existsSync(cliPath);
  return {
    provider: "hyperframes",
    available,
    reason: available ? "Pinned local HyperFrames CLI is compatible with this Node runtime." : "HyperFrames 0.7.76 must be installed and requires Node.js 22+.",
    requiredEnvironment: [],
  };
}

async function execute(args: string[], cwd: string): Promise<void> {
  const ffmpeg = resolveTool("ffmpeg", "Gyan.FFmpeg");
  const ffprobe = resolveTool("ffprobe", "Gyan.FFmpeg");
  const mediaBin = path.dirname(ffmpeg);
  const cachedHeadlessShell = resolveCachedHeadlessShell();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        PATH: `${mediaBin}${path.delimiter}${process.env.PATH ?? ""}`,
        FFMPEG_PATH: ffmpeg,
        FFPROBE_PATH: ffprobe,
        ...(cachedHeadlessShell ? {PRODUCER_HEADLESS_SHELL_PATH: cachedHeadlessShell} : {}),
      },
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`HyperFrames exited with code ${code}.`)));
  });
}

export async function writeHyperFramesPackage(input: {
  packageRoot: string;
  avatarPath: string;
  title: string;
  durationSeconds: number;
  config: DigitalHumanConfig;
  cues: CaptionCue[];
}): Promise<string> {
  const assetsRoot = path.join(input.packageRoot, "assets");
  await mkdir(assetsRoot, {recursive: true});
  await copyFile(input.avatarPath, path.join(assetsRoot, "avatar.mp4"));
  const htmlPath = path.join(input.packageRoot, "index.html");
  await writeFile(htmlPath, digitalHumanComposition(input), "utf8");
  return htmlPath;
}

export async function renderHyperFramesPackage(
  packageRoot: string,
  outputPath: string,
  aspectRatio: "9:16" | "16:9",
): Promise<void> {
  const status = resolveHyperFrames();
  if (!status.available) throw new Error(status.reason);
  await mkdir(path.dirname(outputPath), {recursive: true});
  await execute([
    "render",
    "--output", outputPath,
    "--fps", "30",
    "--quality", "high",
    "--workers", "1",
    "--strict",
    "--no-best-effort",
    "--resolution", aspectRatio === "9:16" ? "portrait" : "landscape",
    packageRoot,
  ], factoryRoot);
}

export async function runHyperFramesDoctor(): Promise<void> {
  await execute(["doctor"], factoryRoot);
}
