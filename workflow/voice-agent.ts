import {existsSync} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {capture, resolveTool, run} from "./process.js";

export type VoiceProvider = "openai" | "elevenlabs" | "edge-preview";

export type VoiceResolution = {
  provider: VoiceProvider;
  available: boolean;
  reason: string;
};

function extractNarration(markdown: string): string {
  const section = markdown.split("## 旁白")[1]?.split("## CTA")[0] ?? "";
  const lines = [...section.matchAll(/^-\s+\d+(?:\.\d+)?-\d+(?:\.\d+)?s：(.+)$/gm)].map((match) => match[1]!.trim());
  if (lines.length === 0) throw new Error("Voice Agent could not find timed narration lines in script.md.");
  return lines.join("\n");
}

function edgeExecutable(repositoryRoot: string): string {
  return path.join(repositoryRoot, ".venv", "Scripts", process.platform === "win32" ? "edge-tts.exe" : "edge-tts");
}

export function resolveVoiceProvider(
  requested: VoiceProvider | "auto",
  repositoryRoot: string,
  environment: NodeJS.ProcessEnv = process.env,
): VoiceResolution {
  const selected = requested === "auto"
    ? environment.ELEVENLABS_API_KEY?.trim() && environment.ELEVENLABS_VOICE_ID?.trim()
      ? "elevenlabs"
      : environment.OPENAI_API_KEY?.trim()
        ? "openai"
        : "edge-preview"
    : requested;
  if (selected === "openai") {
    return {provider: selected, available: Boolean(environment.OPENAI_API_KEY?.trim()), reason: environment.OPENAI_API_KEY?.trim() ? "Configured explicitly." : "Missing OPENAI_API_KEY."};
  }
  if (selected === "elevenlabs") {
    const missing = ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"].filter((key) => !environment[key]?.trim());
    return {provider: selected, available: missing.length === 0, reason: missing.length === 0 ? "Configured explicitly." : `Missing ${missing.join(", ")}.`};
  }
  return {provider: selected, available: existsSync(edgeExecutable(repositoryRoot)), reason: existsSync(edgeExecutable(repositoryRoot)) ? "Local neural preview provider is installed." : "edge-tts is not installed in .venv."};
}

async function assertResponse(response: Response, provider: string): Promise<ArrayBuffer> {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`${provider} voice request failed (${response.status}): ${detail}`);
  }
  return response.arrayBuffer();
}

async function generateOpenAi(text: string, destination: string, environment: NodeJS.ProcessEnv): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {Authorization: `Bearer ${environment.OPENAI_API_KEY}`, "Content-Type": "application/json"},
    body: JSON.stringify({
      model: environment.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: environment.OPENAI_TTS_VOICE || "coral",
      input: text,
      instructions: "自然、可信、清晰的中文科技短视频旁白；节奏紧凑，有真实呼吸感，不过度推销。",
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  await writeFile(destination, Buffer.from(await assertResponse(response, "OpenAI")));
}

async function generateElevenLabs(text: string, destination: string, environment: NodeJS.ProcessEnv): Promise<void> {
  const voiceId = environment.ELEVENLABS_VOICE_ID!;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {"xi-api-key": environment.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg"},
    body: JSON.stringify({
      text,
      model_id: environment.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
      voice_settings: {stability: 0.48, similarity_boost: 0.78, style: 0.22, use_speaker_boost: true, speed: 1.08},
    }),
    signal: AbortSignal.timeout(120_000),
  });
  await writeFile(destination, Buffer.from(await assertResponse(response, "ElevenLabs")));
}

export async function generateProjectVoice(projectRoot: string, repositoryRoot: string, requested: VoiceProvider | "auto" = "auto"): Promise<string> {
  const resolution = resolveVoiceProvider(requested, repositoryRoot);
  if (!resolution.available) throw new Error(`Voice provider ${resolution.provider} is unavailable: ${resolution.reason}`);
  const scriptPath = path.join(projectRoot, "script.md");
  const destination = path.join(projectRoot, "voice", "voice.mp3");
  await mkdir(path.dirname(destination), {recursive: true});
  const text = extractNarration(await readFile(scriptPath, "utf8"));
  if (resolution.provider === "openai") await generateOpenAi(text, destination, process.env);
  else if (resolution.provider === "elevenlabs") await generateElevenLabs(text, destination, process.env);
  else {
    await run(edgeExecutable(repositoryRoot), [
      "--voice", process.env.EDGE_TTS_VOICE || "zh-CN-XiaoxiaoNeural",
      "--rate=+12%", "--pitch=-2Hz", "--text", text, "--write-media", destination,
    ], repositoryRoot);
  }
  const ffprobe = resolveTool("ffprobe", "Gyan.FFmpeg_");
  const durationSeconds = Number((await capture(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", destination], repositoryRoot)).trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 1) throw new Error("Generated voice file failed duration validation.");
  await writeFile(path.join(projectRoot, "voice", "metadata.json"), `${JSON.stringify({
    schemaVersion: "v2",
    provider: resolution.provider,
    previewOnly: resolution.provider === "edge-preview",
    source: "script.md",
    output: "voice/voice.mp3",
    durationSeconds,
  }, null, 2)}\n`, "utf8");
  return destination;
}
