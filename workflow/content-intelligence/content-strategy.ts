export type ContentDirection = {
  index: number;
  title: string;
  angle: string;
  evidenceNeeded: string;
};

export function generateContentDirections(topicInput: string): ContentDirection[] {
  const topic = topicInput.trim();
  if (!topic) throw new Error("Content strategy topic must not be empty.");
  const templates = [
    ["我为什么开始做这件事", "起点与动机", "真实立项记录"],
    ["一个人用 AI 做产品，第一版用了多久", "过程与效率", "提交记录或时间线"],
    ["第一版上线：现在到底能做什么", "进展公开", "真实产品页面"],
    ["最难的不是写代码，而是做这个决定", "关键取舍", "设计稿或决策记录"],
    ["用户第一次使用后说了什么", "反馈与验证", "经授权且匿名化的反馈"],
    ["我做错的第一个功能", "复盘与反差", "版本差异或问题记录"],
    ["AI 帮了我什么，又没帮我什么", "能力边界", "真实工作流与人工判断"],
    ["第 7 天的数据够不够说明问题", "阶段结果", "真实且注明口径的数据"],
    ["下一版只改三件事", "迭代预告", "公开路线图"],
    ["普通人用 AI 做产品，机会到底在哪里", "阶段观点", "过程证据与限制条件"],
  ] as const;
  return templates.map(([suffix, angle, evidenceNeeded], index) => ({
    index: index + 1,
    title: `${topic}：${suffix}`,
    angle,
    evidenceNeeded,
  }));
}

export function contentStrategyMarkdown(topic: string, directions = generateContentDirections(topic)): string {
  return `# Content Strategy\n\n- 主题：${topic.trim()}\n- 原则：不虚构收入、用户、反馈或产品能力；缺少证据的方向保留为待验证选题。\n\n${directions.map((item) =>
    `## ${item.index}. ${item.title}\n\n- 角度：${item.angle}\n- 需要证据：${item.evidenceNeeded}\n`
  ).join("\n")}`;
}
