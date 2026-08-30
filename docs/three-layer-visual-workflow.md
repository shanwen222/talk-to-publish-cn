# 三层视觉流水线（Open Design + HyperFrames + Remotion）

适用范围：个人 IP 横屏口播、真实录屏/截图证据、需要动态包装的短视频。

## 固定顺序

```text
真实 A-roll / 通过忠实度门禁的 Whisper 字幕
        ↓
Open Design：先锁版式、色板、动效禁用项和安全区
        ↓
HyperFrames：HTML/CSS/GSAP 动态视觉层
        ↓
HyperFrames lint / inspect / animation map / 关键帧样片
        ↓
Remotion：读取 HyperFrames 视觉输出，合成字幕、A-roll 和音频
        ↓
Remotion build / still QA / 全片 render
        ↓
FFmpeg + ffprobe：封装、媒体事实检查、交付
```

## 不可跳过的验收条件

- `DESIGN.md` 必须在写 HTML 之前存在，并明确背景、字体、安全区、动效和禁用项。
- 字幕合成前必须通过 `docs/transcript-fidelity-standard.md`：参考稿只能辅助识别疑点，不能替代口播文字；只使用 Whisper 时间戳不等于通过字幕忠实度验收。
- HyperFrames 必须有真正的 `index.html`，不是只在 Remotion 文档里写“沿用 HyperFrames”。
- HTML 必须包含 `data-composition-id`、`data-start`、`data-duration`、`data-track-index`，并注册 `window.__timelines`。
- 每个场景必须先做静态布局帧，再做 GSAP 入场和场景转换；不得先写动画再猜位置。
- `lint`、`inspect` 和 animation map 通过后才可以渲染 HyperFrames 样片。
- Remotion 只能把“已经通过 HyperFrames 验收的视觉层”带入最终合成；Remotion 中可以做字幕、时间线和媒体封装，但不能用一组静态卡片假装 HyperFrames 动效。
- 交付前至少抽查：开头 Hook、每个证据段首尾、一个动效中间帧、结尾；检查人物脸、字幕、截图文字和背景是否被遮挡。

## 移动端信息与节奏门禁（不可跳过）

- 每段先写“一个主结论 + 一个辅助关系”，画面展示流程、框架、结构或结果，不把参考文案整段搬进信息栏。
- 右上角主题必须是当前语义的结论牌：小标签 + 主主题 + 一个重点词/短线；禁止固定雷达、密集 bullet 或第二套字幕。
- 画面文字使用移动端 token：主标题 ≥ 60px、场景标题 ≥ 48px、副标题 ≥ 28px、关键标签 ≥ 20px。低于 16px 的文字不得承载信息。
- 流程和节点必须按 1→2→3→4 顺序入场，步骤间隔 0.30–0.60 秒；禁止所有元素在同一时刻整体跳出。
- 每次样片和全片都要保存 390px 宽手机缩略图，并逐字确认主标题、副标题、主题牌可读。
- 证据列必须先检查人物脸/肩安全缓冲，再决定尺寸、透明度和运镜；缩小字号不能代替删信息或改版式。
- 默认视觉基准已封存于 `docs/approved-visual-standard.md`：右上角采用透明悬浮语义字，不回退到整块矩形信息框。

## 反馈回归机制

用户每次提出的视觉问题必须同步写入：

1. 全局经验库 `docs/production-lessons.md`；
2. 当前项目 `DESIGN.md`；
3. 当前项目 `USER_FEEDBACK_LOG.md`；
4. 当前版本 QA 的回归矩阵。

每次改动完成后，除了验证本次反馈，还必须复查上一轮已经修复的字体、信息密度、主题语义、顺序入场、人物安全区和透明度问题。未完成回归矩阵，不得标记 `final`。

## 产物命名

- `preview-remotion.mp4`：仅功能验证，不可直接交付。
- `hyperframes/preview.mp4`：动态视觉层通过工具链后的样片。
- `final-hf-remotion.mp4`：三层流水线完整通过后的交付候选。
- `QA.md`：记录命令、关键帧、媒体编码和人工验收结论。
