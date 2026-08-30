import {z} from "zod";

export const pipelineStageSchema = z.object({
  id: z.string().min(1),
  agent: z.string().min(1),
  goal: z.string().min(1),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).min(1),
  review: z.array(z.string()).min(1),
});

export const pipelineDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9_-]+\/[a-z0-9_-]+$/),
  videoType: z.enum(["知识视频", "产品视频", "创业日志", "故事视频"]),
  contentGoal: z.string().min(1),
  platforms: z.array(z.enum(["抖音", "小红书", "YouTube"])).min(1),
  durationOptions: z.array(z.number().int().min(15).max(180)).min(1),
  durationPolicy: z.object({
    mode: z.literal("content-driven"),
    minSeconds: z.number().int().min(10).max(180),
    maxSeconds: z.number().int().min(10).max(180),
    defaultTargetSeconds: z.number().int().min(10).max(180),
    targetCharactersPerSecond: z.number().min(3.5).max(6.5),
  }),
  skills: z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1),
  template: z.string().min(1),
  fixedStructure: z.array(z.string()).min(3),
  stages: z.array(pipelineStageSchema).min(2),
});

export type PipelineDefinition = z.infer<typeof pipelineDefinitionSchema>;

export type DirectorInput = {
  topic: string;
  platform?: "抖音" | "小红书" | "YouTube";
  durationSeconds?: number;
  style?: "科技" | "情绪" | "纪录片" | "广告";
  pipelineId?: string;
};

export type DirectorPlan = {
  schemaVersion: 1;
  topic: string;
  videoType: PipelineDefinition["videoType"];
  targetPlatform: "抖音" | "小红书" | "YouTube";
  durationSeconds: number;
  durationMode: "explicit" | "content-driven";
  durationRangeSeconds: {min: number; max: number};
  targetCharactersPerSecond: number;
  style: "科技" | "情绪" | "纪录片" | "广告";
  pipelineId: string;
  skills: string[];
  shotStrategy: string[];
  contentStructure: string[];
  assignments: Array<{
    order: number;
    agent: string;
    goal: string;
    outputs: string[];
    review: string[];
  }>;
};

export type ReferenceFacts = {
  source: string;
  durationSeconds: number;
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  audioPresent: boolean;
  sceneCutsSeconds: number[];
};
