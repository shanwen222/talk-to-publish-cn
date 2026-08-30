import type {ProjectSpec, Scene} from "./types.js";

const accents = ["#74F9FF", "#8A7CFF", "#FF6FB7", "#FFD166", "#7CF29A", "#FF8A5B"];

function aiHotspotScenes(): Scene[] {
  const durations = [4, 7, 7, 8, 8, 9, 9, 8];
  const beats = [
    ["AI 又变了", "警报式光点冲入 AI 核心，界面瞬间点亮", "cinematic AI core ignition, cyan particles, premium vertical tech visual", "注意，AI 的下一波变化，已经不是更会聊天。", "AI 下一波：不只是聊天", "curiosity"],
    ["新入口：智能体", "任务从一句目标拆成搜索、分析、制作三个执行节点", "AI agent decomposes a goal into search analysis creation, premium workflow UI", "真正的热点，是智能体开始理解目标、调用工具，并把多步任务连续做完。", "智能体开始连续执行任务", "surprise"],
    ["内容生产重构", "脚本、配音、画面、剪辑沿生产线同步流动", "automated content pipeline script voice visual edit, cinematic dark interface", "对创作者来说，一条指令正在串起脚本、配音、画面和剪辑，内容生产被重新编排。", "一条指令，串起整条生产线", "confidence"],
    ["多模态成默认", "文字、声音、图像与视频围绕同一模型空间融合", "multimodal AI text audio image video orbiting a shared intelligence core", "文字、语音、图片和视频，不再是四个孤岛。多模态正在成为新的默认界面。", "多模态成为默认界面", "possibility"],
    ["机会也有门槛", "高速数据流中出现事实、版权、安全三道闸门", "AI data stream crossing fact copyright safety checkpoints, cinematic warning", "但速度越快，事实核验、版权和数据安全越重要。会生成，不等于能交付。", "会生成 ≠ 能交付", "tension"],
    ["真正的竞争力", "创作者把判断标准嵌入自动化工作流，流程逐段变绿", "creator embedding judgment rules into automated workflow, premium tech control room", "未来真正稀缺的，不是某个提示词，而是把审美、判断和业务标准写进工作流。", "把判断力写进工作流", "confidence"],
    ["从工具到系统", "零散 AI 工具汇聚成可重复运行的视频工厂", "scattered AI tools converging into repeatable video factory, dramatic camera move", "当工具被连接成系统，你得到的才不是一次惊喜，而是稳定、可复制的生产能力。", "从一次生成，到稳定生产", "possibility"],
    ["今天就行动", "启动按钮被按下，第一条自动化流程完整点亮", "bold start button, complete AI workflow lights up, cinematic end card", "现在，选一个重复任务，把它做成你的第一条 AI 工作流。关注我，持续拆解最新 AI 生产力。", "关注我，持续拆解 AI 生产力", "action"],
  ] as const;
  let start = 0;
  return beats.map(([title, visual, prompt, narration, subtitle, emotion], index) => {
    const durationSeconds = durations[index]!;
    const scene: Scene = {
      id: `scene-${index + 1}`,
      startSeconds: start,
      durationSeconds,
      title,
      visual,
      prompt,
      narration,
      subtitle,
      accent: accents[index % accents.length]!,
      motion: (["camera-move", "parallax", "ken-burns"] as const)[index % 3],
      transition: (["light-leak", "whip", "iris", "crossfade"] as const)[index % 4],
      emotion,
    };
    start += durationSeconds;
    return scene;
  });
}

function aiTrendScenes(): Scene[] {
  const beats = [
    ["未来已经开始", "黑色空间中，一条发光时间线快速展开，AI 芯片、机器人与创意工具依次出现", "cinematic vertical motion graphic, glowing AI timeline, deep navy background, cyan light, high contrast", "未来的人工智能，不只会回答问题。它正在成为每个人的行动伙伴。", "AI 正从“回答”走向“行动”"],
    ["趋势一：智能体", "多个 AI Agent 节点自动分工：研究、写作、设计、执行，任务卡片沿连线流动", "multi-agent workflow nodes coordinating tasks, clean futuristic UI, cyan and violet, vertical composition", "第一，AI Agent 会从单点工具，升级为能规划、调用工具并完成目标的数字同事。", "趋势一：AI Agent 成为数字同事"],
    ["趋势二：多模态", "文字、语音、图片、视频四种媒介汇入同一个发光核心，再输出完整作品", "multimodal AI core combining text voice image video, elegant infographic, dark background", "第二，多模态会成为默认交互。说一句话，就能同时生成文案、画面、声音与视频。", "趋势二：多模态成为默认交互"],
    ["趋势三：端侧 AI", "手机与电脑芯片在本地运行模型，数据被一层安全护盾包围", "on-device AI chip in smartphone and laptop, privacy shield, premium tech visualization", "第三，更多模型会运行在手机和电脑本地，速度更快，隐私更强，也更懂个人场景。", "趋势三：AI 走向端侧与个人化"],
    ["真正的机会", "普通创作者站在控制台前，身后浮现内容、产品、教育与服务四条增长路径", "creator operating AI studio, four opportunity paths, content product education service, optimistic", "真正的机会，不是和 AI 比速度，而是学会定义问题、建立流程，并把判断力放进系统。", "机会属于会设计工作流的人"],
    ["现在就开始", "镜头拉近一个简洁的启动按钮，背景中工作流逐步点亮，最后定格品牌式标题", "bold call to action, start button, AI workflow lighting up, premium vertical end card", "从今天开始，把一个重复任务交给 AI，做成你的第一条自动化工作流。关注我，一起把 AI 变成生产力。", "从一个任务开始，把 AI 变成生产力"],
  ] as const;

  return beats.map(([title, visual, prompt, narration, subtitle], index) => ({
    id: `scene-${index + 1}`,
    startSeconds: index * 10,
    durationSeconds: 10,
    title,
    visual,
    prompt,
    narration,
    subtitle,
    accent: accents[index] ?? "#74F9FF",
  }));
}

export function planProject(topic: string, projectId: string, durationSeconds = 60): ProjectSpec {
  const normalized = topic.trim();
  if (!normalized) throw new Error("Topic must not be empty.");
  if (durationSeconds !== 60) {
    throw new Error("v1.0 deterministic planner currently supports exactly 60 seconds.");
  }

  const isAiHotspot = /热点|智能体|Agent/i.test(normalized);
  const isAiFuture = /人工智能.*未来|AI.*未来|未来.*AI/i.test(normalized);
  const scenes = isAiHotspot
    ? aiHotspotScenes()
    : isAiFuture
    ? aiTrendScenes()
    : aiTrendScenes().map((scene, index) => ({
        ...scene,
        title: index === 0 ? normalized.replace(/^制作一个\d+秒/, "").replace(/的视频$/, "") : scene.title,
      }));

  return {
    schemaVersion: isAiHotspot ? "v2" : "v1",
    projectId,
    title: isAiHotspot ? "AI 热点：智能体正在重构内容生产" : isAiFuture ? "未来已来：人工智能的 3 个关键趋势" : normalized,
    positioning: "60 秒竖屏知识短视频，用清晰趋势和行动建议建立认知",
    audience: "关注 AI、内容创作与个人效率的中文用户",
    style: "深色未来感、动效信息图、快节奏字幕、克制高对比配色",
    durationSeconds,
    aspectRatio: "9:16",
    hook: scenes[0]?.subtitle ?? normalized,
    cta: scenes.at(-1)?.subtitle ?? "关注并开始行动",
    contentType: "technology",
    emotionCurve: scenes.map((scene) => scene.emotion ?? "confidence"),
    scenes,
  };
}
