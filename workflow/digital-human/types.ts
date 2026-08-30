import {z} from "zod";

export const digitalHumanConfigSchema = z.object({
  schemaVersion: z.literal("digital-human-v1"),
  useCase: z.enum(["knowledge", "personal-ip", "product"]),
  aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
  resolution: z.enum(["1080p", "720p"]).default("1080p"),
  voice: z.object({
    provider: z.literal("fish-audio"),
    model: z.string().min(1).default("s2-pro"),
  }),
  avatar: z.object({
    provider: z.literal("heygen"),
    engine: z.enum(["avatar_iv", "avatar_v"]).default("avatar_iv"),
  }),
  packaging: z.object({
    provider: z.literal("hyperframes"),
    theme: z.enum(["knowledge", "personal-ip", "product"]).default("knowledge"),
  }),
});

export type DigitalHumanConfig = z.infer<typeof digitalHumanConfigSchema>;

export type CaptionCue = {
  id: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type ProviderStatus = {
  provider: "fish-audio" | "heygen" | "hyperframes";
  available: boolean;
  reason: string;
  requiredEnvironment: string[];
};

export type DigitalHumanRunRecord = {
  schemaVersion: "digital-human-run-v1";
  projectId: string;
  status: "planned" | "running" | "completed" | "failed";
  useCase: DigitalHumanConfig["useCase"];
  startedAt: string;
  completedAt?: string;
  paidExecutionAuthorized: boolean;
  maxCostUsd?: number;
  providers: {
    voice: "fish-audio";
    avatar: "heygen";
    packaging: "hyperframes";
  };
  artifacts: string[];
  externalJobIds: {heygenVideoId?: string};
  error?: string;
};
