import path from "node:path";
import {fileURLToPath} from "node:url";
import {resolveFishAudio} from "./fish-audio.js";
import {resolveHeyGen} from "./heygen.js";
import {resolveHyperFrames, runHyperFramesDoctor} from "./hyperframes.js";
import {packageDigitalHumanProject, planDigitalHumanProject, runDigitalHumanProject} from "./pipeline.js";
import type {DigitalHumanConfig} from "./types.js";

const factoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const command = argv[0] ?? "doctor";

function option(name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function projectRoot(): string {
  const value = option("--project");
  if (!value) throw new Error("--project is required.");
  const resolved = path.resolve(factoryRoot, value);
  const projectsRoot = path.join(factoryRoot, "projects") + path.sep;
  if (!resolved.startsWith(projectsRoot)) throw new Error("--project must resolve inside the Factory projects directory.");
  return resolved;
}

async function main(): Promise<void> {
  if (command === "doctor") {
    console.log(JSON.stringify({providers: [resolveFishAudio(), resolveHeyGen(), resolveHyperFrames()]}, null, 2));
    if (argv.includes("--full")) await runHyperFramesDoctor();
    return;
  }
  if (command === "plan") {
    const useCase = (option("--use-case") ?? "knowledge") as DigitalHumanConfig["useCase"];
    const result = await planDigitalHumanProject(projectRoot(), useCase);
    console.log(JSON.stringify({status: "planned", root: result.root, config: result.config}, null, 2));
    return;
  }
  if (command === "package") {
    const finalPath = await packageDigitalHumanProject(projectRoot());
    console.log(JSON.stringify({status: "completed", finalPath}, null, 2));
    return;
  }
  if (command === "run") {
    const finalPath = await runDigitalHumanProject({
      projectRoot: projectRoot(),
      execute: argv.includes("--execute"),
      maxCostUsd: option("--max-cost") === undefined ? undefined : Number(option("--max-cost")),
      useCase: option("--use-case") as DigitalHumanConfig["useCase"] | undefined,
    });
    console.log(JSON.stringify({status: "completed", finalPath}, null, 2));
    return;
  }
  throw new Error(`Unknown digital-human command: ${command}. Use doctor, plan, package, or run.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
