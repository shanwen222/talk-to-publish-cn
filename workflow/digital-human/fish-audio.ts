import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import type {ProviderStatus} from "./types.js";

export type FishAudioConfig = {
  apiKey: string;
  referenceId: string;
  model: string;
};

export function resolveFishAudio(environment: NodeJS.ProcessEnv = process.env): ProviderStatus {
  const missing = ["FISH_AUDIO_API_KEY", "FISH_AUDIO_REFERENCE_ID"].filter((name) => !environment[name]?.trim());
  return {
    provider: "fish-audio",
    available: missing.length === 0,
    reason: missing.length ? `Missing ${missing.join(", ")}.` : "Configured for Fish Audio TTS.",
    requiredEnvironment: ["FISH_AUDIO_API_KEY", "FISH_AUDIO_REFERENCE_ID"],
  };
}

function requireConfig(environment: NodeJS.ProcessEnv): FishAudioConfig {
  const status = resolveFishAudio(environment);
  if (!status.available) throw new Error(status.reason);
  return {
    apiKey: environment.FISH_AUDIO_API_KEY!,
    referenceId: environment.FISH_AUDIO_REFERENCE_ID!,
    model: environment.FISH_AUDIO_MODEL?.trim() || "s2-pro",
  };
}

export async function generateFishVoice(
  text: string,
  outputPath: string,
  options: {environment?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch} = {},
): Promise<void> {
  if (!text.trim()) throw new Error("Fish Audio narration is empty.");
  const config = requireConfig(options.environment ?? process.env);
  const response = await (options.fetchImpl ?? fetch)("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "model": config.model,
    },
    body: JSON.stringify({
      text,
      reference_id: config.referenceId,
      format: "mp3",
      sample_rate: 44100,
      mp3_bitrate: 128,
      normalize: true,
      prosody: {speed: 1, volume: 0},
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Fish Audio TTS failed (${response.status}): ${detail}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 512) throw new Error("Fish Audio returned an implausibly small audio artifact.");
  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, bytes);
}
