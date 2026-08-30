export type ShortformPlatform = "抖音" | "小红书" | "YouTube";

export type CopywriterIssue = {
  kind: "ai-phrase" | "long-sentence" | "low-density";
  detail: string;
};

export type CopywriterBeat = {
  index: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type CopywriterPlan = {
  schemaVersion: 1;
  platform: ShortformPlatform;
  hook: {
    mode: "keep" | "develop";
    selected: string;
    recommendedCandidateCount: number;
    reason: string;
  };
  originalNarration: string;
  revisedNarration: string;
  speakableCharacters: number;
  targetCharactersPerSecond: number;
  recommendedDurationSeconds: number;
  durationRangeSeconds: {min: number; max: number};
  beats: CopywriterBeat[];
  issues: CopywriterIssue[];
  timingOrder: ["copy", "voice", "measured-audio", "captions-and-shots"];
};

export type CopywriterInput = {
  source: string;
  platform?: ShortformPlatform;
  targetCharactersPerSecond?: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
};

const editorialReplacements = [
  {pattern: /值得注意的是[，,：:]?/g, replacement: "但", label: "“值得注意的是”改为直接转折"},
  {pattern: /总而言之[，,：:]?/g, replacement: "说到底，", label: "“总而言之”改为口语化收束"},
  {pattern: /接下来让我们(?:一起来)?/g, replacement: "接下来", label: "删除主持式套话"},
  {pattern: /在当今(?:这个)?(?:快速发展的)?时代[，,]?/g, replacement: "", label: "删除空泛时代背景"},
  {pattern: /众所周知[，,]?/g, replacement: "", label: "删除无证据共识句"},
] as const;

function extractNarration(source: string): string {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!normalized) throw new Error("Copywriter source must not be empty.");
  const narrationSection = normalized.includes("## 旁白")
    ? normalized.split("## 旁白")[1]!.split(/^## /m)[0]!
    : normalized.split(/^## Provider Truth/m)[0]!;
  const lines = narrationSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("```"))
    .map((line) => line
      .replace(/^[-*]\s*/, "")
      .replace(/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?s?[：:]\s*/i, "")
    );
  const text = lines.join("\n").trim();
  if (!text) throw new Error("Copywriter could not find speakable narration.");
  return text;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function speakableCharacters(text: string): number {
  const units = text.match(/[\p{Script=Han}]|[A-Za-z0-9]+/gu) ?? [];
  return Math.round(units.reduce((sum, unit) => sum + (unit.length === 1 && /\p{Script=Han}/u.test(unit) ? 1 : 1.5), 0));
}

function applyEditorialReplacements(text: string): {text: string; issues: CopywriterIssue[]} {
  const issues: CopywriterIssue[] = [];
  let revised = text;
  for (const rule of editorialReplacements) {
    if (rule.pattern.test(revised)) {
      issues.push({kind: "ai-phrase", detail: rule.label});
      rule.pattern.lastIndex = 0;
      revised = revised.replace(rule.pattern, rule.replacement);
    }
    rule.pattern.lastIndex = 0;
  }
  return {
    text: revised
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^[，,]\s*/gm, "")
      .trim(),
    issues,
  };
}

function hookPlan(text: string): CopywriterPlan["hook"] {
  const first = splitSentences(text)[0] ?? text;
  const selected = first.replace(/\s+/g, " ").trim();
  const strongQuestion = /[?？]$/.test(selected) && speakableCharacters(selected) <= 42;
  const explicitTension = /到底|为什么|能不能|值不值得|是否|真相|结果|却|但是/.test(selected);
  if (strongQuestion || (explicitTension && speakableCharacters(selected) <= 36)) {
    return {
      mode: "keep",
      selected,
      recommendedCandidateCount: 1,
      reason: "现有开头已经包含可兑现的问题或冲突，不为凑数量额外生成 Hook。",
    };
  }
  const angleSignals = [
    /还是|是否|能不能|该不该|值不值得|vs/i.test(text),
    /风险|失败|问题|错误|代价|赚钱|收入/.test(text),
    /我|我们|亲自|实测|记录|第.{0,3}次/.test(text),
  ].filter(Boolean).length;
  const recommendedCandidateCount = Math.max(1, Math.min(3, angleSignals || 1));
  return {
    mode: "develop",
    selected,
    recommendedCandidateCount,
    reason: `现有开头缺少明确张力；题材检测到 ${angleSignals} 个有效切入信号，只在这些真实角度内探索候选。`,
  };
}

function buildBeats(sentences: string[], durationSeconds: number): CopywriterBeat[] {
  const totalUnits = Math.max(1, sentences.reduce((sum, sentence) => sum + speakableCharacters(sentence), 0));
  const beats: CopywriterBeat[] = [];
  let cursor = 0;
  let current: string[] = [];
  let currentDuration = 0;

  const flush = () => {
    if (!current.length) return;
    const startSeconds = Number(cursor.toFixed(2));
    cursor += currentDuration;
    beats.push({
      index: beats.length + 1,
      startSeconds,
      endSeconds: Number(Math.min(durationSeconds, cursor).toFixed(2)),
      text: current.join(""),
    });
    current = [];
    currentDuration = 0;
  };

  for (const sentence of sentences) {
    const sentenceDuration = durationSeconds * (speakableCharacters(sentence) / totalUnits);
    if (current.length && currentDuration + sentenceDuration > 8) flush();
    current.push(sentence);
    currentDuration += sentenceDuration;
    if (currentDuration >= 5) flush();
  }
  flush();
  if (beats.length) beats[beats.length - 1]!.endSeconds = durationSeconds;
  return beats;
}

export function editShortformCopy(input: CopywriterInput): CopywriterPlan {
  const platform = input.platform ?? "抖音";
  if (!["抖音", "小红书", "YouTube"].includes(platform)) {
    throw new Error(`Unsupported shortform platform: ${platform}`);
  }
  const targetCharactersPerSecond = input.targetCharactersPerSecond ?? 4.8;
  const minDurationSeconds = input.minDurationSeconds ?? 15;
  const maxDurationSeconds = input.maxDurationSeconds ?? 90;
  if (!Number.isFinite(targetCharactersPerSecond) || targetCharactersPerSecond < 3.5 || targetCharactersPerSecond > 6.5) {
    throw new Error("Target speech rate must be between 3.5 and 6.5 speakable characters per second.");
  }
  if (!Number.isInteger(minDurationSeconds) || !Number.isInteger(maxDurationSeconds)
    || minDurationSeconds < 10 || maxDurationSeconds > 180 || minDurationSeconds > maxDurationSeconds) {
    throw new Error("Copywriter duration range must be an integer range within 10-180 seconds.");
  }

  const originalNarration = extractNarration(input.source);
  const editorial = applyEditorialReplacements(originalNarration);
  const revisedNarration = editorial.text;
  const sentences = splitSentences(revisedNarration);
  const characters = speakableCharacters(revisedNarration);
  const pauseSeconds = Math.max(0, sentences.length - 1) * 0.18
    + Math.max(0, revisedNarration.split(/\n{2,}/).length - 1) * 0.22;
  const rawDuration = characters / targetCharactersPerSecond + pauseSeconds;
  const recommendedDurationSeconds = Math.max(
    minDurationSeconds,
    Math.min(maxDurationSeconds, Math.round(rawDuration)),
  );
  const issues = [...editorial.issues];
  for (const sentence of sentences) {
    const length = speakableCharacters(sentence);
    if (length > 46) {
      issues.push({kind: "long-sentence", detail: `长句约 ${length} 字，建议在不改变事实的前提下拆成两句：${sentence}`});
    }
  }
  if (characters / recommendedDurationSeconds < 3.8) {
    issues.push({kind: "low-density", detail: "单位时间信息密度偏低；优先删减停顿和空话，不增加未经证实的内容。"});
  }

  return {
    schemaVersion: 1,
    platform,
    hook: hookPlan(revisedNarration),
    originalNarration,
    revisedNarration,
    speakableCharacters: characters,
    targetCharactersPerSecond,
    recommendedDurationSeconds,
    durationRangeSeconds: {min: minDurationSeconds, max: maxDurationSeconds},
    beats: buildBeats(sentences, recommendedDurationSeconds),
    issues,
    timingOrder: ["copy", "voice", "measured-audio", "captions-and-shots"],
  };
}

export function copywriterPlanMarkdown(plan: CopywriterPlan): string {
  const issueLines = plan.issues.length
    ? plan.issues.map((issue) => `- [${issue.kind}] ${issue.detail}`).join("\n")
    : "- 未发现预设 AI 套话、超长句或低密度问题。";
  const beatLines = plan.beats.map((beat) =>
    `${beat.index}. ${beat.startSeconds.toFixed(2)}-${beat.endSeconds.toFixed(2)}s：${beat.text}`
  ).join("\n");
  return `# Copywriter Plan

## Hook 策略

- 模式：${plan.hook.mode === "keep" ? "保留现有 Hook" : "按真实角度继续开发"}
- 当前开头：${plan.hook.selected}
- 建议候选数量：${plan.hook.recommendedCandidateCount}（动态结果，不设固定数量）
- 原因：${plan.hook.reason}

## 内容驱动时长

- 平台：${plan.platform}
- 可说字符：${plan.speakableCharacters}
- 目标语速：${plan.targetCharactersPerSecond} 字/秒
- 建议时长：${plan.recommendedDurationSeconds} 秒
- 允许范围：${plan.durationRangeSeconds.min}-${plan.durationRangeSeconds.max} 秒

## 修订旁白

${plan.revisedNarration}

## 节奏段

${beatLines}

## 审校问题

${issueLines}

## 执行顺序

文案审校 → 生成自然旁白 → 读取实际音频时长 → 同步字幕与镜头。禁止为了填满预设时长拉长停顿或粗暴变速。
`;
}
