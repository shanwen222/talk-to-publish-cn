# 业务裁决权

| 正式结论 | 唯一裁决模块 | 输入事实 | 正式输出 | 只读消费者 | 失败策略 |
|---|---|---|---|---|---|
| 项目是否可渲染 | `workflow/validation.ts::validateRenderableProject` | 计划、脚本、分镜、资产清单、时长 | `renderable`、`issues` | CLI、渲染器 | 不可用 |
| 供应商是否可用 | `workflow/providers.ts::getProviderCapabilities` | provider 类型与显式配置 | `available`、`reason` | CLI、未来适配器 | `unavailable` |
| 语音提供器是否可执行 | `workflow/voice-agent.ts::resolveVoiceProvider` | 显式 provider 与环境变量 | provider、可用性、原因 | CLI、语音生成器 | 明确失败 |
| BGM 风格与混音参数 | `workflow/music-agent.ts::selectMusicProfile` | `contentType` | profile、音量、淡入淡出、ducking | CLI、FFmpeg | 明确失败 |
| 平台发布规格 | `workflow/platform-adapters.ts::createPlatformPackages` | 平台名称与项目事实 | 画幅、封面、元数据、发布状态 | 用户、未来发布器 | 不执行发布 |
| 最终视频是否合格 | `workflow/validation.ts::validateRenderedVideo` | ffprobe 的视频/音频事实 | `valid`、`issues` | CLI、交付摘要 | 明确失败 |
| 视频类型、Pipeline 与 Skill 选择 | `workflow/content-intelligence/director.ts::createDirectorPlan` | 用户主题、显式平台/时长/风格 | DirectorPlan | 现有 Agent、CLI | 未知配置或空主题时明确失败 |
| Pipeline 定义是否合法 | `workflow/content-intelligence/pipeline-loader.ts::loadPipeline` | 登记 YAML | PipelineDefinition | Director、CLI | schema 不匹配时明确失败 |
| 参考视频事实是否可用 | `workflow/content-intelligence/reference-analyzer.ts::analyzeReferenceVideo` | 本地媒体与 ffprobe/FFmpeg 观测 | 媒体事实、推断、A/B/C 建议 | Director、用户 | 不可读时明确失败，不生成伪事实 |
| 短视频文案的建议时长、Hook策略与审校结果 | `workflow/content-intelligence/copywriter.ts::editShortformCopy` | 原始旁白、平台、目标语速与 Pipeline 时长边界 | 修订旁白、动态 Hook 策略、建议时长、节奏段与审校问题 | Script、Voice、Storyboard、Director、用户 | 不改写事实；空文案、非法参数或越界结果时明确失败 |
| 本地口播粗剪决策与保留区间 | `workflow/local-rough-cut.ts::createRoughCutPlan` | 本地 Whisper 分段、FFmpeg 静音事实、显式阈值 | 可审计的 keep/remove/review 决策与保留区间 | Editing Agent、渲染器、用户 | 仅自动删除明确填充音；疑似重拍和重复表达默认保留并标记 review |

展示层、文档生成器、Remotion 和 FFmpeg 只能消费这些结论，不得重新计算同名结论。

## 数字人管线裁决

| 正式结论 | 唯一裁决模块 | 输入事实 | 正式输出 | 失败策略 |
|---|---|---|---|---|
| 数字人云端调用是否获准 | `workflow/digital-human/pipeline.ts::assertPaidExecutionAuthorized` | `--execute`、`--max-cost` | 已授权或异常 | 默认拒绝 |
| Fish Audio 是否可执行 | `workflow/digital-human/fish-audio.ts::resolveFishAudio` | 显式环境变量 | 可用性与原因 | unavailable |
| HeyGen 是否可执行 | `workflow/digital-human/heygen.ts::resolveHeyGen` | 显式环境变量与 Avatar ID | 可用性与原因 | unavailable |
| 动态字幕是否有效 | `workflow/digital-human/captions.ts::createCaptionTrack` | 脚本文本、目标时长 | 有序 cue | 空文本或非法时长失败 |
| 数字人成片是否合格 | `workflow/digital-human/validation.ts::validateDigitalHumanVideo` | ffprobe 媒体事实 | valid、issues | 明确失败 |

## 项目级 HyperFrames 裁决

| 正式结论 | 唯一裁决模块 | 输入事实 | 正式输出 | 失败策略 |
|---|---|---|---|---|
| 产品 UI 是否真实 | `projects/*/assets/product/manifest.json` | 用户原始文件、SHA-256、用途 | `user-provided` 或拒绝 | 未登记即拒绝 |
| 旁白是否为 Fish Audio | `projects/*/voice/metadata.json` | provider、凭据状态、生成命令 | provider 事实 | 不得以风格相似冒充 |
| HyperFrames 成片是否合格 | HyperFrames 检查 + ffprobe | lint、validate、inspect、音视频流、时长、画幅 | 合格或 issues | 明确失败 |
