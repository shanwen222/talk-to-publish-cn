import {randomUUID} from "node:crypto";
import {readFile, stat, writeFile, mkdir} from "node:fs/promises";
import path from "node:path";
import type {ProviderStatus} from "./types.js";

export type HeyGenConfig = {apiKey: string; avatarId: string};
type JsonRecord = Record<string, unknown>;

export function resolveHeyGen(environment: NodeJS.ProcessEnv = process.env): ProviderStatus {
  const missing = ["HEYGEN_API_KEY", "HEYGEN_AVATAR_ID"].filter((name) => !environment[name]?.trim());
  return {
    provider: "heygen",
    available: missing.length === 0,
    reason: missing.length ? `Missing ${missing.join(", ")}.` : "Configured with an existing authorized HeyGen avatar.",
    requiredEnvironment: ["HEYGEN_API_KEY", "HEYGEN_AVATAR_ID"],
  };
}

function requireConfig(environment: NodeJS.ProcessEnv): HeyGenConfig {
  const status = resolveHeyGen(environment);
  if (!status.available) throw new Error(status.reason);
  return {apiKey: environment.HEYGEN_API_KEY!, avatarId: environment.HEYGEN_AVATAR_ID!};
}

async function jsonOrThrow(response: Response, operation: string): Promise<JsonRecord> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${operation} failed (${response.status}): ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    throw new Error(`${operation} returned invalid JSON.`);
  }
}

function dataOf(value: JsonRecord, operation: string): JsonRecord {
  const data = value.data;
  if (!data || typeof data !== "object") throw new Error(`${operation} response is missing data.`);
  return data as JsonRecord;
}

export async function uploadHeyGenAudio(
  audioPath: string,
  options: {environment?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch} = {},
): Promise<string> {
  const config = requireConfig(options.environment ?? process.env);
  const file = await readFile(audioPath);
  if ((await stat(audioPath)).size > 32 * 1024 * 1024) throw new Error("HeyGen audio upload exceeds the 32 MB limit.");
  const form = new FormData();
  form.append("file", new Blob([Uint8Array.from(file)], {type: "audio/mpeg"}), path.basename(audioPath));
  const response = await (options.fetchImpl ?? fetch)("https://api.heygen.com/v3/assets", {
    method: "POST",
    headers: {"x-api-key": config.apiKey, "Idempotency-Key": randomUUID()},
    body: form,
  });
  const data = dataOf(await jsonOrThrow(response, "HeyGen asset upload"), "HeyGen asset upload");
  if (typeof data.asset_id !== "string" || !data.asset_id) throw new Error("HeyGen asset upload did not return asset_id.");
  return data.asset_id;
}

export async function createHeyGenAvatarVideo(
  audioAssetId: string,
  input: {title: string; aspectRatio: "9:16" | "16:9"; resolution: "1080p" | "720p"; engine: "avatar_iv" | "avatar_v"},
  options: {environment?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch} = {},
): Promise<string> {
  if (!audioAssetId) throw new Error("HeyGen audio asset ID is required.");
  const config = requireConfig(options.environment ?? process.env);
  const response = await (options.fetchImpl ?? fetch)("https://api.heygen.com/v3/videos", {
    method: "POST",
    headers: {"x-api-key": config.apiKey, "Content-Type": "application/json", "Idempotency-Key": randomUUID()},
    body: JSON.stringify({
      type: "avatar",
      avatar_id: config.avatarId,
      title: input.title,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      output_format: "mp4",
      audio_asset_id: audioAssetId,
      engine: {type: input.engine},
    }),
  });
  const data = dataOf(await jsonOrThrow(response, "HeyGen video creation"), "HeyGen video creation");
  if (typeof data.video_id !== "string" || !data.video_id) throw new Error("HeyGen video creation did not return video_id.");
  return data.video_id;
}

export async function waitForHeyGenVideo(
  videoId: string,
  options: {
    environment?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    sleep?: (milliseconds: number) => Promise<void>;
    pollIntervalMs?: number;
    maxAttempts?: number;
  } = {},
): Promise<string> {
  const config = requireConfig(options.environment ?? process.env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const maxAttempts = options.maxAttempts ?? 90;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetchImpl(`https://api.heygen.com/v3/videos/${encodeURIComponent(videoId)}`, {
      headers: {"x-api-key": config.apiKey},
    });
    const data = dataOf(await jsonOrThrow(response, "HeyGen video polling"), "HeyGen video polling");
    const status = data.status;
    if (status === "completed") {
      if (typeof data.video_url !== "string" || !data.video_url) throw new Error("Completed HeyGen task is missing video_url.");
      return data.video_url;
    }
    if (status === "failed") throw new Error(`HeyGen video failed: ${String(data.failure_message ?? data.failure_code ?? "unknown error")}`);
    if (attempt < maxAttempts) await sleep(options.pollIntervalMs ?? 10_000);
  }
  throw new Error(`HeyGen video polling timed out after ${maxAttempts} attempts.`);
}

export async function downloadHeyGenVideo(
  videoUrl: string,
  outputPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = new URL(videoUrl);
  if (url.protocol !== "https:") throw new Error("HeyGen video URL must use HTTPS.");
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`HeyGen video download failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) throw new Error("HeyGen returned an implausibly small video artifact.");
  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, bytes);
}
