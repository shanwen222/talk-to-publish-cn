# 字幕一致性与语义设计 / Transcript fidelity and semantic design

## 字幕权威 / Caption authority

音频是 source of truth。参考文案只能用于检查低置信度 Whisper 片段、产品名、数字或同音词；听不出且音频无法支持的修订保留为 `review`，不要照抄整句参考文案。

项目应保留：

- raw Whisper JSON/SRT/TSV/VTT/TXT；
- Remotion 实际使用的 accepted caption file；
- `caption-corrections.json`，非平凡修改必须标记 `audioVerified: true`；
- `caption-fidelity-report.md`，说明时间戳来源、文字来源、修订和参考文案介入。

## 逐段方案表 / Scene table

写 HTML 前，每个 semantic segment 至少回答：

| 字段 Field | 必答问题 Required question |
|---|---|
| Source interval | 这段对应真实 Whisper 的哪个时间区间？ |
| Spoken meaning | 观众只需理解哪一个核心意思？ |
| Visual structure | 是流程、对比、时间线、数字、证据、引用还是 CTA？ |
| Why this structure | 为什么这个视觉隐喻能帮助理解？ |
| Entrance | 哪些元素一起入场？是否存在真正的阅读顺序？ |
| Focus cue | 哪个 spoken cue 会改变重点？ |
| Hold/exit | 何时保持、更新或退出？ |
| Safety | 脸、标题、字幕哪些区域必须留空？ |
| Mobile priority | 在 390px 缩略图上还要保留什么？ |

信息层只承载框架，不把整段脚本挤进小字卡片。

## 流程组契约 / Flow-group contract

每个并行步骤必须显式选择一种模式：

- `dynamic-with-cues`：全体按已确认的入场规则出现，口播 cue 到达时只切换当前成员的高亮。
- `static-by-design`：刻意保持静态图，不暗示它会跟着口播变化。
- `structural-sequence`：因为结构讲解而按视觉顺序出现，不冒充真实口播时间线。

不要从旧的 `.pick` class 或通用 `stagger` 猜模式；模式必须写进 scene data/config 和 QA 表。

## English summary

Audio is authoritative, reference copy is verification-only, and every visual segment needs a semantic scene record. Process groups must declare whether they are dynamic with spoken cues, intentionally static, or a structural sequence. Keep information concise and test mobile readability.
