import {existsSync} from "node:fs";
import {access, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {planProject} from "./planners.js";
import {writeProjectDocuments} from "./documents.js";
import {getProviderCapabilities} from "./providers.js";
import {projectSpecSchema, type PublicProject} from "./types.js";
import {capture, resolveTool, run} from "./process.js";
import {validateRenderableProject, validateRenderedVideo} from "./validation.js";
import {optimizeViralStructure} from "./viral-agent.js";
import {generateProjectVoice, type VoiceProvider} from "./voice-agent.js";
import {createMusicMix, type MusicStyle} from "./music-agent.js";
import {generateThumbnails} from "./thumbnail-agent.js";
import {createPlatformPackages} from "./platform-adapters.js";
import {createDirectorPlan, directorPlanMarkdown} from "./content-intelligence/director.js";
import {contentStrategyMarkdown} from "./content-intelligence/content-strategy.js";
import {analyzeReferenceVideo, referenceAnalysisMarkdown} from "./content-intelligence/reference-analyzer.js";
import {runContentIntelligence} from "./content-intelligence/runner.js";
import {copywriterPlanMarkdown, editShortformCopy, type ShortformPlatform} from "./content-intelligence/copywriter.js";
import {runLocalRoughCut, type RoughCutAction, type RoughCutLayout} from "./local-rough-cut.js";
import {forceReleaseProjectLease, getProjectPaths, readProjectLease, resolveProjectRoot, withProjectLease} from "./project-isolation.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDemoId = "ai-future-trends";
const defaultDemoTopic = "制作一个60秒介绍人工智能未来趋势的视频";
const v2DemoId = "ai-hotspot-v2";
const v2DemoTopic = "制作一个60秒AI热点视频";

function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function repeatedOption(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]!);
  }
  return values;
}

function positiveIntegerOption(name: string, fallback: number): number {
  const value = option(name);
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

async function loadSpec(projectRoot: string) {
  return projectSpecSchema.parse(JSON.parse(await readFile(path.join(projectRoot, "project.json"), "utf8")));
}

async function writeState(projectRoot: string, project: PublicProject): Promise<void> {
  await writeFile(path.join(projectRoot, "state.json"), `${JSON.stringify(project, null, 2)}\n`, "utf8");
}

async function createProject(topic: string, projectId: string): Promise<string> {
  const projectRoot = path.join(repositoryRoot, "projects", projectId);
  const planned = planProject(topic, projectId);
  const viral = planned.schemaVersion === "v2" ? optimizeViralStructure(planned) : undefined;
  const spec = viral?.spec ?? planned;
  const artifacts = await writeProjectDocuments(projectRoot, spec, viral?.report);
  const validation = await validateRenderableProject(projectRoot, spec);
  await writeState(projectRoot, {
    schemaVersion: spec.schemaVersion,
    projectId,
    title: spec.title,
    durationSeconds: spec.durationSeconds,
    aspectRatio: spec.aspectRatio,
    status: validation.renderable ? "renderable" : "failed",
    artifacts,
    issues: validation.issues,
  });
  if (!validation.renderable) throw new Error(validation.issues.join("\n"));
  return projectRoot;
}

async function renderProject(projectRoot: string, renderConcurrency = 2): Promise<void> {
  const absoluteProjectRoot = resolveProjectRoot(repositoryRoot, projectRoot);
  const paths = getProjectPaths(repositoryRoot, projectRoot);
  const spec = await loadSpec(absoluteProjectRoot);
  const validation = await validateRenderableProject(absoluteProjectRoot, spec);
  if (!validation.renderable) throw new Error(`Project is not renderable:\n${validation.issues.join("\n")}`);

  await mkdir(paths.outputRoot, {recursive: true});
  const propsPath = paths.renderPropsPath;
  const remotionOutput = paths.remotionOutputPath;
  const browserExecutable = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].find((candidate) => existsSync(candidate));
  const audioMix = path.join(absoluteProjectRoot, "assets", "audio", "final-mix.m4a");
  await writeFile(propsPath, `${JSON.stringify({spec, includeTemplateAudio: !existsSync(audioMix)}, null, 2)}\n`, "utf8");

  const remotionCli = path.join(repositoryRoot, "node_modules/@remotion/cli/remotion-cli.js");
  await run(process.execPath, [
    remotionCli, "render", "remotion/src/index.ts", "FactoryVideo", remotionOutput,
    `--props=${propsPath}`, "--public-dir=remotion/public", "--codec=h264", "--crf=25", `--concurrency=${renderConcurrency}`, "--log=info",
    ...(browserExecutable ? [`--browser-executable=${browserExecutable}`] : []),
  ], repositoryRoot);

  await finalizeProject(absoluteProjectRoot);
}

async function finalizeProject(projectRoot: string): Promise<void> {
  const absoluteProjectRoot = resolveProjectRoot(repositoryRoot, projectRoot);
  const paths = getProjectPaths(repositoryRoot, projectRoot);
  const spec = await loadSpec(absoluteProjectRoot);
  const remotionOutput = paths.remotionOutputPath;
  const finalOutput = paths.finalOutputPath;
  const probeOutput = paths.probeOutputPath;
  const ffmpegPath = resolveTool("ffmpeg", "Gyan.FFmpeg_");
  const ffprobePath = resolveTool("ffprobe", "Gyan.FFmpeg_");
  const audioMix = path.join(absoluteProjectRoot, "assets", "audio", "final-mix.m4a");
  await run("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(repositoryRoot, "ffmpeg/finalize.ps1"),
    "-Source", remotionOutput, "-Destination", finalOutput, "-FfmpegPath", ffmpegPath,
    ...(existsSync(audioMix) ? ["-AudioMix", audioMix] : []),
  ], repositoryRoot);

  const rawProbe = await capture(ffprobePath, [
    "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height",
    "-of", "json", finalOutput,
  ], repositoryRoot);
  const probe = JSON.parse(rawProbe);
  const rendered = validateRenderedVideo(probe, spec.aspectRatio);
  await writeFile(probeOutput, `${JSON.stringify({validation: rendered, probe}, null, 2)}\n`, "utf8");
  await writeState(absoluteProjectRoot, {
    schemaVersion: spec.schemaVersion,
    projectId: spec.projectId,
    title: spec.title,
    durationSeconds: spec.durationSeconds,
    aspectRatio: spec.aspectRatio,
    status: rendered.valid ? "rendered" : "failed",
    artifacts: ["video_plan.md", "script.md", "storyboard.md", "assets/manifest.json", ...(spec.schemaVersion === "v2" ? ["viral_report.md", "voice/voice.mp3", "assets/audio/final-mix.m4a", "platforms/*.json", "output/thumbnails/*.png"] : []), "output/final.mp4", "output/final.probe.json"],
    issues: rendered.issues,
  });
  if (!rendered.valid) throw new Error(`Rendered video failed validation:\n${rendered.issues.join("\n")}`);
}

async function doctor(): Promise<void> {
  const checks: Array<[string, string, string[]]> = [
    ["Node.js", process.execPath, ["--version"]],
    ["FFmpeg", resolveTool("ffmpeg", "Gyan.FFmpeg_"), ["-version"]],
    ["FFprobe", resolveTool("ffprobe", "Gyan.FFmpeg_"), ["-version"]],
    ["Remotion", process.execPath, [path.join(repositoryRoot, "node_modules/@remotion/cli/remotion-cli.js"), "versions"]],
    ["Playwright", process.execPath, [path.join(repositoryRoot, "node_modules/playwright/cli.js"), "--version"]],
  ];
  let failed = false;
  for (const [name, command, args] of checks) {
    try {
      const result = (await capture(command, args, repositoryRoot)).trim().split(/\r?\n/)[0];
      console.log(`OK  ${name}: ${result}`);
    } catch (error) {
      failed = true;
      console.error(`FAIL ${name}: ${(error as Error).message}`);
    }
  }
  try {
    await access(path.join(repositoryRoot, ".venv/Scripts/whisper.exe"));
    console.log("OK  Whisper: project virtual environment");
  } catch {
    failed = true;
    console.error("FAIL Whisper: .venv/Scripts/whisper.exe is missing");
  }
  try {
    await access(path.join(repositoryRoot, "workflow/vibeframe-runtime/node_modules/@vibeframe/cli/dist/index.js"));
    console.log("OK  VibeFrame: optional runtime");
  } catch {
    console.log("WARN VibeFrame: optional runtime not installed");
  }
  if (failed) process.exitCode = 1;
}

async function runProjectTask<T>(projectPath: string, taskId: string, action: () => Promise<T>): Promise<T> {
  return withProjectLease(repositoryRoot, projectPath, taskId, action);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "help";
  if (command === "create") {
    const topic = option("--topic");
    const id = option("--id");
    if (!topic || !id) throw new Error("Usage: npm run factory -- create --topic <topic> --id <project-id>");
    const projectPath = path.join("projects", id);
    console.log(await runProjectTask(projectPath, `create:${id}`, () => createProject(topic, id)));
  } else if (command === "render") {
    const projectPath = option("--project", `projects/${defaultDemoId}`)!;
    await runProjectTask(projectPath, `render:${path.basename(projectPath)}`, () => renderProject(projectPath, positiveIntegerOption("--render-concurrency", 2)));
  } else if (command === "finalize") {
    const projectPath = option("--project", `projects/${defaultDemoId}`)!;
    await runProjectTask(projectPath, `finalize:${path.basename(projectPath)}`, () => finalizeProject(projectPath));
  } else if (command === "voice") {
    const projectPath = option("--project", `projects/${v2DemoId}`)!;
    const projectRoot = resolveProjectRoot(repositoryRoot, projectPath);
    console.log(await runProjectTask(projectPath, `voice:${path.basename(projectPath)}`, () => generateProjectVoice(projectRoot, repositoryRoot, (option("--provider", "auto") as VoiceProvider | "auto"))));
  } else if (command === "music") {
    const projectPath = option("--project", `projects/${v2DemoId}`)!;
    const projectRoot = resolveProjectRoot(repositoryRoot, projectPath);
    const spec = await loadSpec(projectRoot);
    console.log(await runProjectTask(projectPath, `music:${path.basename(projectPath)}`, () => createMusicMix(projectRoot, repositoryRoot, (option("--style", spec.contentType ?? "technology") as MusicStyle), spec.durationSeconds)));
  } else if (command === "thumbnail") {
    const projectPath = option("--project", `projects/${v2DemoId}`)!;
    const projectRoot = resolveProjectRoot(repositoryRoot, projectPath);
    console.log((await runProjectTask(projectPath, `thumbnail:${path.basename(projectPath)}`, async () => generateThumbnails(await loadSpec(projectRoot), projectRoot, repositoryRoot))).join("\n"));
  } else if (command === "adapt") {
    const projectPath = option("--project", `projects/${v2DemoId}`)!;
    const projectRoot = resolveProjectRoot(repositoryRoot, projectPath);
    console.log((await runProjectTask(projectPath, `adapt:${path.basename(projectPath)}`, async () => createPlatformPackages(projectRoot, await loadSpec(projectRoot)))).join("\n"));
  } else if (command === "demo") {
    const projectPath = `projects/${defaultDemoId}`;
    await runProjectTask(projectPath, `demo:${defaultDemoId}`, async () => {
      const projectRoot = await createProject(defaultDemoTopic, defaultDemoId);
      await renderProject(projectRoot, positiveIntegerOption("--render-concurrency", 2));
    });
  } else if (command === "demo-v2") {
    const projectPath = `projects/${v2DemoId}`;
    await runProjectTask(projectPath, `demo-v2:${v2DemoId}`, async () => {
      const projectRoot = await createProject(v2DemoTopic, v2DemoId);
      const spec = await loadSpec(projectRoot);
      await generateProjectVoice(projectRoot, repositoryRoot, (option("--provider", "auto") as VoiceProvider | "auto"));
      await createMusicMix(projectRoot, repositoryRoot, spec.contentType ?? "technology", spec.durationSeconds);
      await generateThumbnails(spec, projectRoot, repositoryRoot);
      await createPlatformPackages(projectRoot, spec);
      await renderProject(projectRoot, positiveIntegerOption("--render-concurrency", 2));
    });
  } else if (command === "direct") {
    const topic = option("--topic");
    if (!topic) throw new Error("Usage: npm run factory -- direct --topic <topic> [--pipeline <id>] [--output <file>]");
    const plan = await createDirectorPlan({topic, pipelineId: option("--pipeline")}, repositoryRoot);
    const output = path.resolve(repositoryRoot, option("--output", "director_plan.md")!);
    await mkdir(path.dirname(output), {recursive: true});
    await writeFile(output, directorPlanMarkdown(plan), "utf8");
    console.log(output);
  } else if (command === "strategy") {
    const topic = option("--topic");
    if (!topic) throw new Error("Usage: npm run factory -- strategy --topic <topic> [--output <file>]");
    const output = path.resolve(repositoryRoot, option("--output", "content_strategy.md")!);
    await mkdir(path.dirname(output), {recursive: true});
    await writeFile(output, contentStrategyMarkdown(topic), "utf8");
    console.log(output);
  } else if (command === "copyedit") {
    const input = option("--input");
    if (!input) throw new Error("Usage: npm run factory -- copyedit --input <script.md> [--output <file>] [--platform <抖音|小红书|YouTube>] [--target-cps <number>] [--min-duration <seconds>] [--max-duration <seconds>]");
    const output = path.resolve(repositoryRoot, option("--output", "copywriter_plan.md")!);
    const numericOption = (name: string): number | undefined => {
      const value = option(name);
      if (value === undefined) return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number.`);
      return parsed;
    };
    const plan = editShortformCopy({
      source: await readFile(path.resolve(repositoryRoot, input), "utf8"),
      platform: option("--platform", "抖音") as ShortformPlatform,
      targetCharactersPerSecond: numericOption("--target-cps"),
      minDurationSeconds: numericOption("--min-duration"),
      maxDurationSeconds: numericOption("--max-duration"),
    });
    await mkdir(path.dirname(output), {recursive: true});
    await writeFile(output, copywriterPlanMarkdown(plan), "utf8");
    console.log(output);
  } else if (command === "reference") {
    const source = option("--input");
    if (!source) throw new Error("Usage: npm run factory -- reference --input <video-or-direct-url> [--output <file>]");
    const output = path.resolve(repositoryRoot, option("--output", "reference_analysis.md")!);
    const facts = await analyzeReferenceVideo(source, repositoryRoot);
    await mkdir(path.dirname(output), {recursive: true});
    await writeFile(output, referenceAnalysisMarkdown(facts), "utf8");
    console.log(output);
  } else if (command === "run-v3") {
    const topic = option("--topic");
    const project = option("--project");
    if (!topic || !project) throw new Error("Usage: npm run factory -- run-v3 --topic <topic> --project <path> [--pipeline <id>]");
    const result = await runProjectTask(project, `run-v3:${path.basename(project)}`, () => runContentIntelligence({topic, pipelineId: option("--pipeline")}, repositoryRoot, project));
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "rough-cut") {
    const project = option("--project");
    if (!project) {
      throw new Error("Usage: npm run factory -- rough-cut --project <path> --action <plan|preview|master|run> [--input <video> ...] [--inputs <a;b>] [--model base] [--final-tail-buffer 0.5] [--layout portrait-left]");
    }
    const action = option("--action", "run") as RoughCutAction;
    if (!["plan", "preview", "master", "run"].includes(action)) {
      throw new Error("--action must be plan, preview, master, or run.");
    }
    const layout = option("--layout", "portrait-left") as RoughCutLayout;
    if (!["portrait-left", "blur-background", "contain", "cover"].includes(layout)) {
      throw new Error("--layout must be portrait-left, blur-background, contain, or cover.");
    }
    const joinedInputs = option("--inputs")
      ?.split(";")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
    const inputs = [...repeatedOption("--input"), ...joinedInputs];
    const numeric = (name: string, fallback: number): number => {
      const value = option(name);
      const parsed = value === undefined ? fallback : Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number.`);
      return parsed;
    };
    console.log(JSON.stringify(await runProjectTask(project, `rough-cut:${path.basename(project)}`, () => runLocalRoughCut({
      repositoryRoot,
      projectRoot: project,
      action,
      inputs,
      language: option("--language", "zh"),
      model: option("--model", "base"),
      silenceThresholdSeconds: numeric("--silence-threshold", 0.9),
      retainedPauseSeconds: numeric("--retained-pause", 0.35),
      silenceNoiseDb: numeric("--silence-noise-db", -35),
      finalTailBufferSeconds: numeric("--final-tail-buffer", 0.5),
      layout,
    })), null, 2));
  } else if (command === "lease") {
    const project = option("--project");
    const action = option("--action", "status")!;
    if (!project || !["status", "release"].includes(action)) {
      throw new Error("Usage: npm run factory -- lease --project projects/<id> --action <status|release> [--force]");
    }
    if (action === "status") {
      console.log(JSON.stringify(await readProjectLease(repositoryRoot, project) ?? {active: false}, null, 2));
    } else {
      if (!process.argv.includes("--force")) throw new Error("lease release requires --force.");
      await forceReleaseProjectLease(repositoryRoot, project);
      console.log(JSON.stringify({released: true, project: getProjectPaths(repositoryRoot, project).projectId}, null, 2));
    }
  } else if (command === "providers") {
    console.log(JSON.stringify(getProviderCapabilities(), null, 2));
  } else if (command === "doctor") {
    await doctor();
  } else {
    console.log("Commands: create, voice, music, thumbnail, adapt, render, finalize, demo, demo-v2, direct, strategy, copyedit, reference, run-v3, rough-cut, lease, providers, doctor");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
