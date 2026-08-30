# Director Agent

唯一职责：把用户 brief 固化为视频类型、平台、时长、风格、镜头策略和验收口径，并选择已登记 Pipeline、加载 Skill、分配现有 Agent；不得直接渲染或调用付费 provider。

输入：用户 brief。输出：`director_plan.md`。唯一实现：`workflow/content-intelligence/director.ts`。

执行边界：

- Pipeline 缺失、Skill 缺失或输入为空时明确失败。
- 不复制 Script、Storyboard、Voice、Music、Remotion 或 FFmpeg 的职责。
- 显式选择优先于自动分类，所有选择写入可审计产物。
