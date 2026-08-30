import {stat, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {createDirectorPlan, directorPlanMarkdown} from "./director.js";
import {copywriterPlanMarkdown, editShortformCopy} from "./copywriter.js";
import type {DirectorInput, DirectorPlan} from "./types.js";

const requiredPersonalIpArtifacts = ["storyboard.md", "voice_script.md", "asset_plan.md", "final.mp4"];

async function assertArtifact(projectRoot: string, relativePath: string): Promise<void> {
  const info = await stat(path.join(projectRoot, relativePath));
  if (!info.isFile() || info.size === 0) throw new Error(`Required artifact is empty: ${relativePath}`);
}

export async function runContentIntelligence(
  input: DirectorInput,
  repositoryRoot: string,
  projectPath: string,
): Promise<{plan: DirectorPlan; artifacts: string[]}> {
  const projectRoot = path.resolve(repositoryRoot, projectPath);
  const plan = await createDirectorPlan(input, repositoryRoot);
  const expected = plan.pipelineId === "personal_ip/build_in_public" ? requiredPersonalIpArtifacts : [];
  await Promise.all(expected.map((artifact) => assertArtifact(projectRoot, artifact)));
  await mkdir(path.join(projectRoot, "content-intelligence"), {recursive: true});
  await writeFile(path.join(projectRoot, "director_plan.md"), directorPlanMarkdown(plan), "utf8");
  const contentArtifacts = ["director_plan.md"];
  if (plan.pipelineId === "personal_ip/build_in_public") {
    const source = await readFile(path.join(projectRoot, "voice_script.md"), "utf8");
    const copywriterPlan = editShortformCopy({
      source,
      platform: plan.targetPlatform,
      targetCharactersPerSecond: plan.targetCharactersPerSecond,
      minDurationSeconds: plan.durationRangeSeconds.min,
      maxDurationSeconds: plan.durationRangeSeconds.max,
    });
    await writeFile(path.join(projectRoot, "copywriter_plan.md"), copywriterPlanMarkdown(copywriterPlan), "utf8");
    contentArtifacts.push("copywriter_plan.md");
  }
  const artifacts = [...contentArtifacts, ...expected];
  await writeFile(path.join(projectRoot, "content-intelligence", "run.json"), `${JSON.stringify({
    schemaVersion: 1,
    status: "validated",
    pipelineId: plan.pipelineId,
    skills: plan.skills,
    existingVideoPipelinePreserved: true,
    artifacts,
  }, null, 2)}\n`, "utf8");
  return {plan, artifacts};
}
