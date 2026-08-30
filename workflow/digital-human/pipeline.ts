import {access, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {captionsToSrt, createCaptionTrack} from "./captions.js";
import {generateFishVoice, resolveFishAudio} from "./fish-audio.js";
import {createHeyGenAvatarVideo, downloadHeyGenVideo, resolveHeyGen, uploadHeyGenAudio, waitForHeyGenVideo} from "./heygen.js";
import {renderHyperFramesPackage, resolveHyperFrames, writeHyperFramesPackage} from "./hyperframes.js";
import {readNarrationScript} from "./script.js";
import {digitalHumanConfigSchema, type DigitalHumanConfig, type DigitalHumanRunRecord} from "./types.js";
import {probeMedia, validateDigitalHumanVideo} from "./validation.js";

type ProjectFacts = {projectId: string; title: string; durationSeconds: number};

async function readProjectFacts(projectRoot: string): Promise<ProjectFacts> {
  const value = JSON.parse(await readFile(path.join(projectRoot, "project.json"), "utf8")) as Partial<ProjectFacts>;
  if (!value.projectId || !value.title || !Number.isFinite(value.durationSeconds)) throw new Error("project.json is missing projectId, title, or durationSeconds.");
  return value as ProjectFacts;
}

export function defaultDigitalHumanConfig(useCase: DigitalHumanConfig["useCase"] = "knowledge"): DigitalHumanConfig {
  return digitalHumanConfigSchema.parse({
    schemaVersion: "digital-human-v1",
    useCase,
    aspectRatio: "9:16",
    resolution: "1080p",
    voice: {provider: "fish-audio", model: "s2-pro"},
    avatar: {provider: "heygen", engine: "avatar_iv"},
    packaging: {provider: "hyperframes", theme: useCase},
  });
}

export function assertPaidExecutionAuthorized(execute: boolean, maxCostUsd: number | undefined): void {
  if (!execute) throw new Error("Cloud generation is disabled by default. Re-run with --execute.");
  if (!Number.isFinite(maxCostUsd) || (maxCostUsd ?? 0) <= 0) {
    throw new Error("Cloud generation requires a positive --max-cost USD operator guard.");
  }
}

async function writeRun(runPath: string, record: DigitalHumanRunRecord): Promise<void> {
  await writeFile(runPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function planDigitalHumanProject(
  projectRoot: string,
  useCase: DigitalHumanConfig["useCase"] = "knowledge",
): Promise<{root: string; config: DigitalHumanConfig}> {
  await access(path.join(projectRoot, "script.md"));
  const facts = await readProjectFacts(projectRoot);
  const root = path.join(projectRoot, "digital-human");
  const config = defaultDigitalHumanConfig(useCase);
  const narration = await readNarrationScript(path.join(projectRoot, "script.md"));
  const cues = createCaptionTrack(narration, facts.durationSeconds);
  await Promise.all([
    mkdir(path.join(root, "voice"), {recursive: true}),
    mkdir(path.join(root, "avatar"), {recursive: true}),
    mkdir(path.join(root, "subtitle"), {recursive: true}),
    mkdir(path.join(root, "package"), {recursive: true}),
  ]);
  await Promise.all([
    writeFile(path.join(root, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "subtitle", "captions.json"), `${JSON.stringify({schemaVersion: "captions-v1", cues}, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "subtitle", "captions.srt"), captionsToSrt(cues), "utf8"),
    writeRun(path.join(root, "run.json"), {
      schemaVersion: "digital-human-run-v1",
      projectId: facts.projectId,
      status: "planned",
      useCase,
      startedAt: new Date().toISOString(),
      paidExecutionAuthorized: false,
      providers: {voice: "fish-audio", avatar: "heygen", packaging: "hyperframes"},
      artifacts: ["config.json", "subtitle/captions.json", "subtitle/captions.srt"],
      externalJobIds: {},
    }),
  ]);
  return {root, config};
}

export async function packageDigitalHumanProject(projectRoot: string): Promise<string> {
  const facts = await readProjectFacts(projectRoot);
  const root = path.join(projectRoot, "digital-human");
  const config = digitalHumanConfigSchema.parse(JSON.parse(await readFile(path.join(root, "config.json"), "utf8")));
  const avatarPath = path.join(root, "avatar", "avatar.mp4");
  const avatarProbe = await probeMedia(avatarPath);
  if (!avatarProbe.video || !avatarProbe.audio || avatarProbe.durationSeconds <= 0) throw new Error("Avatar media must contain valid video and audio streams.");
  const narration = await readNarrationScript(path.join(projectRoot, "script.md"));
  const cues = createCaptionTrack(narration, avatarProbe.durationSeconds);
  await Promise.all([
    writeFile(path.join(root, "subtitle", "captions.json"), `${JSON.stringify({schemaVersion: "captions-v1", cues}, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "subtitle", "captions.srt"), captionsToSrt(cues), "utf8"),
  ]);
  await writeHyperFramesPackage({
    packageRoot: path.join(root, "package"),
    avatarPath,
    title: facts.title,
    durationSeconds: avatarProbe.durationSeconds,
    config,
    cues,
  });
  const outputPath = path.join(root, "final.mp4");
  await renderHyperFramesPackage(path.join(root, "package"), outputPath, config.aspectRatio);
  const validation = await validateDigitalHumanVideo(outputPath, config.aspectRatio);
  if (!validation.valid) throw new Error(`Digital-human final validation failed: ${validation.issues.join("; ")}`);
  return outputPath;
}

export async function runDigitalHumanProject(input: {
  projectRoot: string;
  execute: boolean;
  maxCostUsd?: number;
  useCase?: DigitalHumanConfig["useCase"];
}): Promise<string> {
  assertPaidExecutionAuthorized(input.execute, input.maxCostUsd);
  const fish = resolveFishAudio();
  const heygen = resolveHeyGen();
  const hyperframes = resolveHyperFrames();
  const unavailable = [fish, heygen, hyperframes].filter((provider) => !provider.available);
  if (unavailable.length) throw new Error(unavailable.map((provider) => `${provider.provider}: ${provider.reason}`).join(" "));
  const facts = await readProjectFacts(input.projectRoot);
  const {root, config} = await planDigitalHumanProject(input.projectRoot, input.useCase);
  const runPath = path.join(root, "run.json");
  const record: DigitalHumanRunRecord = {
    schemaVersion: "digital-human-run-v1",
    projectId: facts.projectId,
    status: "running",
    useCase: config.useCase,
    startedAt: new Date().toISOString(),
    paidExecutionAuthorized: true,
    maxCostUsd: input.maxCostUsd,
    providers: {voice: "fish-audio", avatar: "heygen", packaging: "hyperframes"},
    artifacts: [],
    externalJobIds: {},
  };
  await writeRun(runPath, record);
  try {
    const narration = await readNarrationScript(path.join(input.projectRoot, "script.md"));
    const voicePath = path.join(root, "voice", "voice.mp3");
    await generateFishVoice(narration, voicePath);
    record.artifacts.push("voice/voice.mp3");
    await writeRun(runPath, record);
    const audioAssetId = await uploadHeyGenAudio(voicePath);
    const videoId = await createHeyGenAvatarVideo(audioAssetId, {
      title: facts.title,
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
      engine: config.avatar.engine,
    });
    record.externalJobIds.heygenVideoId = videoId;
    await writeRun(runPath, record);
    const videoUrl = await waitForHeyGenVideo(videoId);
    await downloadHeyGenVideo(videoUrl, path.join(root, "avatar", "avatar.mp4"));
    record.artifacts.push("avatar/avatar.mp4");
    await writeRun(runPath, record);
    const finalPath = await packageDigitalHumanProject(input.projectRoot);
    record.artifacts.push("subtitle/captions.json", "subtitle/captions.srt", "package/index.html", "final.mp4");
    record.status = "completed";
    record.completedAt = new Date().toISOString();
    await writeRun(runPath, record);
    return finalPath;
  } catch (error) {
    record.status = "failed";
    record.completedAt = new Date().toISOString();
    record.error = error instanceof Error ? error.message : String(error);
    await writeRun(runPath, record);
    throw error;
  }
}
