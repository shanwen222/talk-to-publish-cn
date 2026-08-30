import {loadPipeline} from "./pipeline-loader.js";
import {loadSkills} from "./skill-loader.js";
import type {DirectorInput, DirectorPlan} from "./types.js";

function selectPipeline(topic: string): string {
  if (/创业|开发|项目|Build in Public|迭代|上线/i.test(topic)) return "personal_ip/build_in_public";
  if (/发布|新品|产品介绍|功能/i.test(topic)) return "product_video/launch";
  if (/知识|解释|科普|为什么|怎么/i.test(topic)) return "knowledge_video/explain";
  return "viral_short/tiktok";
}

function selectStyle(pipelineId: string): DirectorPlan["style"] {
  if (pipelineId.startsWith("personal_ip")) return "纪录片";
  if (pipelineId.startsWith("product_video")) return "广告";
  return "科技";
}

function shotStrategy(pipelineId: string): string[] {
  if (pipelineId.startsWith("personal_ip")) {
    return [
      "真实开发与产品素材优先，缺失素材明确占位，不生成假界面",
      "前 3 秒用问题 Hook；每 8-12 秒发生一次信息或构图变化",
      "产品展示采用屏幕录制、真实截图、轻推近与信息卡片",
      "转场克制，保留项目日志的纪录感和可验证性",
      "默认不做开头或结尾封面，前三秒直接进入 Hook；只有用户明确要求时才启用封面",
    ];
  }
  if (pipelineId.startsWith("knowledge_video")) {
    return ["问题式 Hook", "概念与案例交替", "每 10 秒信息变化", "结尾总结和互动提问"];
  }
  if (pipelineId.startsWith("product_video")) {
    return ["痛点开场", "真实产品演示", "功能与收益一一对应", "清晰行动入口"];
  }
  return ["前三秒冲突 Hook", "短镜头高信息密度", "情绪逐段升级", "单一 CTA 收束"];
}

export async function createDirectorPlan(input: DirectorInput, repositoryRoot: string): Promise<DirectorPlan> {
  const topic = input.topic.trim();
  if (!topic) throw new Error("Director topic must not be empty.");
  const pipelineId = input.pipelineId ?? selectPipeline(topic);
  const pipeline = await loadPipeline(repositoryRoot, pipelineId);
  const {minSeconds, maxSeconds, defaultTargetSeconds, targetCharactersPerSecond} = pipeline.durationPolicy;
  if (minSeconds > maxSeconds || defaultTargetSeconds < minSeconds || defaultTargetSeconds > maxSeconds) {
    throw new Error(`Pipeline ${pipelineId} has an invalid content-driven duration policy.`);
  }
  const durationSeconds = input.durationSeconds ?? defaultTargetSeconds;
  if (!Number.isInteger(durationSeconds) || durationSeconds < minSeconds || durationSeconds > maxSeconds) {
    throw new Error(`Pipeline ${pipelineId} duration must be an integer within ${minSeconds}-${maxSeconds}s.`);
  }
  const targetPlatform = input.platform ?? pipeline.platforms[0]!;
  if (!pipeline.platforms.includes(targetPlatform)) {
    throw new Error(`Pipeline ${pipelineId} does not support platform ${targetPlatform}.`);
  }
  await loadSkills(repositoryRoot, pipeline.skills);
  return {
    schemaVersion: 1,
    topic,
    videoType: pipeline.videoType,
    targetPlatform,
    durationSeconds,
    durationMode: input.durationSeconds === undefined ? "content-driven" : "explicit",
    durationRangeSeconds: {min: minSeconds, max: maxSeconds},
    targetCharactersPerSecond,
    style: input.style ?? selectStyle(pipelineId),
    pipelineId,
    skills: pipeline.skills,
    shotStrategy: shotStrategy(pipelineId),
    contentStructure: pipeline.fixedStructure,
    assignments: pipeline.stages.map((stage, index) => ({
      order: index + 1,
      agent: stage.agent,
      goal: stage.goal,
      outputs: stage.outputs,
      review: stage.review,
    })),
  };
}

export function directorPlanMarkdown(plan: DirectorPlan): string {
  const publicPlan = {
    视频类型: plan.videoType,
    目标平台: plan.targetPlatform,
    视频时长: plan.durationMode === "content-driven"
      ? `内容驱动；初始目标 ${plan.durationSeconds}s，允许 ${plan.durationRangeSeconds.min}-${plan.durationRangeSeconds.max}s`
      : `${plan.durationSeconds}s（显式约束）`,
    目标口播速度: `${plan.targetCharactersPerSecond} 字/秒`,
    风格: plan.style,
    Pipeline: plan.pipelineId,
    Skills: plan.skills,
    镜头策略: plan.shotStrategy,
    内容结构: plan.contentStructure,
  };
  const assignments = plan.assignments.map((item) =>
    `${item.order}. **${item.agent}**：${item.goal}\n   - 输出：${item.outputs.join("、")}\n   - 复核：${item.review.join("；")}`
  ).join("\n");
  return `# Director Plan\n\n\`\`\`json\n${JSON.stringify(publicPlan, null, 2)}\n\`\`\`\n\n## Agent 任务分配\n\n${assignments}\n`;
}
