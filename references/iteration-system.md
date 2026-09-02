# 强制迭代系统 / Mandatory iteration system

版本：`iteration-system-v1`
适用范围：本 Skill 的中文真人口播、个人 IP 横屏视频。

这份文件不是可选参考，而是每次视频任务的前置门禁。它把历史经验从“看过就算”改成“加载、登记、回归、验收”四个可检查动作。

## 规则优先级

出现冲突时按以下顺序执行：

1. 当前用户对本期视频的明确要求；
2. 用户已确认的 `previous-editorial-v1` 往期视觉基线；
3. `docs/approved-visual-baseline.md` 与 `docs/approved-visual-standard.md`；
4. 本项目 `DESIGN.md` 的语义方案；
5. 通用排版和动效默认值。

项目设计不能静默覆盖已确认的视觉基线。确需偏离时，必须在项目记录中写明偏离原因、用户确认和新的回归帧。

## 每次任务的强制动作

### 1. 开工前加载

必须完整读取以下内容，再开始写视觉代码或渲染：

- `SKILL.md`；
- `docs/production-lessons.md`（历史事故与固化门禁）；
- `docs/approved-visual-baseline.md`（个人 IP 默认基线）；
- `docs/approved-visual-standard.md`（移动端动态口播标准）；
- `docs/transcript-fidelity-standard.md`（字幕权威）；
- 本文件与 `references/semantic-design.md`。

然后运行：

```powershell
python scripts/iteration_preflight.py --project <project-dir> --phase start
```

该命令会生成项目级 `iteration-context.json`，记录本次实际加载的规则文件哈希、采用的视觉 profile 和待验收门禁。没有该文件，不得进入视觉包装。

### 1.1 三步 Hook 的节奏模板

当开头口播明确列举三个或以上动作/步骤，或画面出现类似“写文案 / 剪视频 / 做封面”的并列结构时，必须在 `DESIGN.md` 登记 `rhythm-profile: hook-structure-focus-v1`，不得退回通用静态卡片。没有结构化 Hook 时也要显式登记 `rhythm-profile: none`，不能留空让执行层自行猜测。

### 2. 视觉方案登记

在 `DESIGN.md` 中明确写出：

- `iteration-system: loaded`；
- `style-profile: previous-editorial-v1`（或记录用户确认的例外）；
- 每个场景的入口方式、口播 cue、当前高亮、退出点和字幕安全区；
- 每个流程组是 `dynamic-with-cues`、`structural-sequence` 还是 `static-by-design`。
- 若存在三步 Hook，登记 `rhythm-profile: hook-structure-focus-v1`；否则登记 `rhythm-profile: none`。
- 使用人物蒙版的场景登记 `mask-profile: centered-nose-shadow-only`；不使用蒙版也要登记 `mask-profile: none`。

### 3. 渲染前门禁

完成视觉代码和样片后，运行：

```powershell
python scripts/iteration_preflight.py --project <project-dir> --phase render
```

渲染门禁会拒绝以下情况：经验文件发生变化却没有重新加载、项目没有登记 profile、没有设计/QA 记录、没有声明字幕与入场/高亮规则。

### 4. 最终回归

最终 QA 必须覆盖至少：

- 开头 Hook 的首个/中间/最终加载状态；
- 关键词高亮与大字幕的手机可读性；
- 一个 Skill/流程组的错峰状态；
- 一个素材切换边界，确认字幕不被遮挡、蒙版不断、转场不露黑边；
- 结尾 CTA 与上一轮已修复问题。

关键帧和结论写入 `QA.md`、`WORK_PROGRESS.md` 和交付记录。没有回归证据只能标记 `preview`，不能标记 `final`。

## 往期视觉基线：`previous-editorial-v1`

这是本用户已确认的个人 IP 横屏口播默认风格。它不是“凭感觉像往期”，而是必须满足的可观察规则：

- **字幕**：主字幕 62–72px，中文优先 Microsoft YaHei / DengXian；白字、深色描边与阴影；单行过长时拆成两行，不缩回小字。
- **关键词**：当前口播中的主题词使用品牌黄色高亮，可配轻微放大或短脉冲；不额外复制成第二套解释文字。
- **加载式入场**：旁白明确列举的步骤、动作或标题按语义顺序出现，使用淡入、擦入、裁切 reveal 或轻微位移；间隔通常 0.30–0.60 秒。结构需要先整体可见时，仍必须为当前步骤提供独立 cue/highlight。
- **三步 Hook 节奏**：先建立顶部标题、语义信息栏和三步卡片的整体骨架；随后按口播 cue 逐项聚焦。当前卡片轻微放大（约 1.06–1.12 倍）并切换为黄色重点，非当前卡片保持可读但降低强调；底部大字幕与当前关键词同步高亮。焦点切换时保持同一版式，不重置、不闪回、不复制一行解释性大字。
- **素材错峰**：多张截图/Skill 页面按口播顺序错峰入场，保持左上→右下或左→右的阅读路径；素材切换优先使用克制翻页/页面边界转场，不使用突兀全屏炫技。
- **素材讲解**：真实截图优先；素材段使用连续人物蒙版，人物、素材内部文字和字幕互不遮挡；不把生成说明文字压到素材上。
- **蒙版硬规则**：蒙版启用时，人物鼻子对准圆心，容器固定在安全区；默认不使用黄色/青色圆环，只保留柔和阴影；内部视频顶端归零并裁切在容器内，不能露顶部黑边；全屏人物与蒙版必须使用同一条逐帧同步的视频源，避免 60fps 源片在 30fps 输出中双 `<video>` 解码造成高频抖动；蒙版从素材段开始到结束（包括转场）持续存在，不中途切回全屏。
- **信息栏**：卡片、线框、编号和短标签只表达当前结构；禁止用密集小字代替口播，也禁止为了“科技感”添加无语义雷达、扫描线或黄色调试框。
- **优先级**：人物主体 > 口播字幕 > 场景主标题 > 主题牌 > 证据细节 > 装饰。

## `hook-structure-focus-v1` 验收清单

适用于三步或多步的开头结构：

- [ ] 整体骨架先建立：顶部标题、左侧信息栏、步骤卡片和人物主体同时处于可理解关系；
- [ ] 当前步骤由真实口播 cue 驱动聚焦，不能只靠固定时间点轮播；
- [ ] 非当前步骤不消失、不与当前步骤抢同等视觉权重；
- [ ] 当前卡片放大/变黄/短脉冲与底部关键词高亮同步；
- [ ] 步骤卡片与字幕不在同一行重叠，人物脸和嘴不被遮挡；
- [ ] 至少抽查首个焦点、中间焦点和最终焦点三帧，手机缩略图仍能读清。

## 蒙版回归清单

适用于 `mask-profile: centered-nose-shadow-only`：

- [ ] 人物鼻子/脸部中心与圆形容器圆心对齐，不能靠“看起来差不多”通过；
- [ ] 画面连续抽查至少 3 帧，人物不高频跳动、不双影；
- [ ] 容器顶部、底部和侧边没有黑边或源视频边缘露出；
- [ ] 无黄色/青色描边，只有用户明确要求时才允许恢复描边；
- [ ] 素材切换和翻页期间蒙版保持连续，字幕层级在素材与蒙版之上；
- [ ] 若源片与输出帧率不同，确认全屏和蒙版没有并行解码同一源片的两个 HTML video。

## 新反馈如何进入系统

新问题不能只改当前组件。必须记录“症状 → 根因 → 固化规则 → 验证帧”，并判断它属于：

- 全局规则：更新本文件或 `docs/approved-visual-baseline.md`；
- 历史经验：更新 `docs/production-lessons.md`；
- 本期例外：只写入项目 `DESIGN.md` / `USER_FEEDBACK_LOG.md`，不能污染全局默认。

下一次任务的 preflight 会重新计算这些文件的哈希；规则变更后旧的 `iteration-context.json` 自动失效，必须重新加载。
