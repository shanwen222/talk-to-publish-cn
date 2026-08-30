import {z} from "zod";

export const sceneSchema = z.object({
  id: z.string().min(1),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  title: z.string().min(1),
  visual: z.string().min(1),
  prompt: z.string().min(1),
  narration: z.string().min(1),
  subtitle: z.string().min(1),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  image: z.string().optional(),
  motion: z.enum(["camera-move", "ken-burns", "parallax"]).optional(),
  transition: z.enum(["light-leak", "whip", "iris", "crossfade"]).optional(),
  emotion: z.enum(["curiosity", "surprise", "tension", "confidence", "possibility", "action"]).optional(),
});

export const projectSpecSchema = z.object({
  schemaVersion: z.enum(["v1", "v2"]),
  projectId: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  positioning: z.string().min(1),
  audience: z.string().min(1),
  style: z.string().min(1),
  durationSeconds: z.number().int().min(15).max(600),
  aspectRatio: z.enum(["9:16", "16:9"]),
  hook: z.string().min(1),
  cta: z.string().min(1),
  contentType: z.enum(["technology", "documentary", "emotion", "cinematic"]).optional(),
  emotionCurve: z.array(z.string()).optional(),
  scenes: z.array(sceneSchema).min(1),
});

export type Scene = z.infer<typeof sceneSchema>;
export type ProjectSpec = z.infer<typeof projectSpecSchema>;

export type PublicProject = {
  schemaVersion: "v1" | "v2";
  projectId: string;
  title: string;
  durationSeconds: number;
  aspectRatio: "9:16" | "16:9";
  status: "planned" | "renderable" | "rendered" | "failed";
  artifacts: string[];
  issues: string[];
};
