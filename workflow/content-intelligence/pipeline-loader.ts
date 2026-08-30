import {readFile} from "node:fs/promises";
import path from "node:path";
import {pipelineDefinitionSchema, type PipelineDefinition} from "./types.js";

export const pipelineFiles = {
  "personal_ip/build_in_public": "pipelines/personal_ip/build_in_public.yaml",
  "knowledge_video/explain": "pipelines/knowledge_video/explain.yaml",
  "product_video/launch": "pipelines/product_video/launch.yaml",
  "viral_short/tiktok": "pipelines/viral_short/tiktok.yaml",
} as const;

export type PipelineId = keyof typeof pipelineFiles;

export async function loadPipeline(repositoryRoot: string, pipelineId: string): Promise<PipelineDefinition> {
  if (!(pipelineId in pipelineFiles)) {
    throw new Error(`Unknown pipeline "${pipelineId}". Available: ${Object.keys(pipelineFiles).join(", ")}`);
  }
  const file = path.join(repositoryRoot, pipelineFiles[pipelineId as PipelineId]);
  const source = await readFile(file, "utf8");
  let value: unknown;
  try {
    // JSON is a strict, portable subset of YAML 1.2. Keeping definitions in this
    // subset avoids adding a second configuration parser to the video runtime.
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`Pipeline ${pipelineId} is not valid JSON-compatible YAML: ${(error as Error).message}`);
  }
  return pipelineDefinitionSchema.parse(value);
}
