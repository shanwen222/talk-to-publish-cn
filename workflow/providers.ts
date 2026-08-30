export type ProviderKind = "image" | "video" | "voice";

export type ProviderCapability = {
  provider: string;
  kind: ProviderKind;
  available: boolean;
  reason: string;
  requiredEnvironment: string[];
};

const definitions = [
  ["flux", "image", ["FAL_API_KEY"]],
  ["dall-e", "image", ["OPENAI_API_KEY"]],
  ["midjourney", "image", ["MIDJOURNEY_ADAPTER_URL"]],
  ["kling", "video", ["KLING_API_KEY"]],
  ["runway", "video", ["RUNWAY_API_SECRET"]],
  ["sora", "video", ["OPENAI_API_KEY"]],
  ["seedance", "video", ["FAL_API_KEY"]],
  ["openai-voice", "voice", ["OPENAI_API_KEY"]],
  ["elevenlabs", "voice", ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]],
] as const;

export function getProviderCapabilities(environment: NodeJS.ProcessEnv = process.env): ProviderCapability[] {
  return definitions.map(([provider, kind, requiredEnvironment]) => {
    const available = requiredEnvironment.every((name) => Boolean(environment[name]?.trim()));
    return {
      provider,
      kind,
      available,
      reason: available ? "Configured explicitly." : `Unavailable: missing ${requiredEnvironment.join(", ")}.`,
      requiredEnvironment: [...requiredEnvironment],
    };
  });
}
