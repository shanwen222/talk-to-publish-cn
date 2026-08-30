# 权威源登记

| 能力 | 唯一权威源 | 允许镜像/产物 | 唯一入口 | 消费者 | 失败策略 |
|---|---|---|---|---|---|
| 工作流状态机 | `workflow/factory.ts` | `projects/*/state.json` | `npm run factory` | CLI、测试 | 明确失败 |
| 视频计划 | `workflow/planners.ts` | `projects/*/video_plan.md` | `npm run factory -- create` | 分镜生成器 | 明确失败 |
| 脚本 | `workflow/planners.ts` | `projects/*/script.md` | `npm run factory -- create` | 分镜、字幕 | 明确失败 |
| 分镜 | `workflow/planners.ts` | `projects/*/storyboard.md` | `npm run factory -- create` | 资产清单、Remotion | 明确失败 |
| 爆款结构 | `workflow/viral-agent.ts` | `projects/*/viral_report.md` | 工作流 `create` | 计划、脚本、分镜 | 明确失败 |
| 语音生成 | `workflow/voice-agent.ts` | `projects/*/voice/voice.mp3`、`voice/metadata.json` | 工作流 `voice`/`demo-v2` | 音频混合器 | 缺配置或请求失败时明确失败 |
| BGM 选择与混音 | `workflow/music-agent.ts` | `projects/*/assets/audio/bgm.mp3`、`final-mix.m4a`、`music.json` | 工作流 `music`/`demo-v2` | FFmpeg 后处理 | 明确失败 |
| 电影化组件 | `remotion/src/cinematic/*` | `projects/*/output/remotion.mp4` | 工作流 `render` | Remotion 主模板 | 明确失败；不同项目可并行 |
| 封面生成 | `remotion/src/Thumbnail.tsx` | `projects/*/output/thumbnails/*.png` | 工作流 `thumbnail`/`demo-v2` | 用户、平台发布包 | 明确失败；不同项目可并行 |
| 平台发布包 | `workflow/platform-adapters.ts` | `projects/*/platforms/*.json` | 工作流 `adapt`/`demo-v2` | 未来发布器 | 只生成包，不发布 |
| Director 方案与 Pipeline 选择 | `workflow/content-intelligence/director.ts` | `projects/*/director_plan.md`、`content-intelligence/run.json` | 工作流 `direct`/`run-v3` | 现有 Agent、用户 | 空主题、未知 pipeline 或缺 skill 时明确失败 |
| Pipeline 定义 | `pipelines/*/*.yaml` | 无 | `workflow/content-intelligence/pipeline-loader.ts` | Director、工作流 | schema 不合法时明确失败 |
| 内容 Skill 规则 | `skills/*/skill.md` | 无 | `workflow/content-intelligence/skill-loader.ts` | Director、各 Agent | 未登记或规则为空时明确失败 |
| 参考视频分析 | `workflow/content-intelligence/reference-analyzer.ts` | `reference_analysis.md` | 工作流 `reference` | Director、用户 | 媒体不可读时明确失败；事实与推断分离 |
| 内容选题策略 | `workflow/content-intelligence/content-strategy.ts` | `content_strategy.md` | 工作流 `strategy` | Director、用户 | 空主题或不足 10 个方向时明确失败 |
| 短视频文案审校与内容定时 | `workflow/content-intelligence/copywriter.ts` | `copywriter_plan.md` | 工作流 `copyedit`、内容 Pipeline | Script Agent、Voice Agent、Storyboard Agent、用户 | 空文案、非法语速或越界时长时明确失败；不得虚构事实 |
| 本地口播粗剪 | `workflow/local-rough-cut.ts` | `projects/*/rough-cut/analysis.json`、`cut-list.json`、`transcript.md`、`preview.mp4`、`a-roll-rough-cut.mp4` | 工作流 `rough-cut` | Editing Agent、Storyboard Agent、用户 | 原片、Whisper、FFmpeg、剪辑决策或媒体验收失败时明确失败；不上传素材 |
| 供应商契约 | `workflow/providers.ts` | 无 | `npm run providers` | 未来适配器 | 未配置时 `unavailable` |
| Remotion 画面 | `remotion/src/FactoryVideo.tsx` | `projects/*/output/remotion.mp4` | 工作流 `render` | FFmpeg 后处理 | 明确失败；不同项目可并行 |
| FFmpeg 合成 | `ffmpeg/finalize.ps1` | `projects/*/output/final.mp4` | 工作流 `render` | 用户 | 明确失败；v2 外部混音存在时必须使用 |
| Whisper 字幕与本地转写 | `scripts/whisper.ps1` | `subtitle/*.srt`、本地粗剪项目中的 JSON/SRT | 该脚本或工作流 `rough-cut` | 工作流、Editing Agent | 无音频、模型或合法输出格式时明确失败 |
| VibeFrame | `workflow/vibeframe-runtime/package.json` 锁定包 | `.vibeframe/` 项目配置 | `npm run vibe:*` | 人工/未来工作流 | 默认仅 dry-run |
| 治理清单 | `SOURCE_MANIFEST.json` | 无 | `npm run manifest:check` | 总门禁 | 明确失败 |
| 三条生产线拓扑与边界 | `docs/video-production-lines.md` | 无 | 文档治理；各线使用各自正式入口 | 用户、工作流、治理门禁 | 线别或入口未登记时明确失败 |
| 生产经验与返工门禁 | `docs/production-lessons.md` | 无 | 文档治理；项目进度引用经验编号 | 用户、三条生产线、QA | 新问题未记录症状、原因和门禁时不得宣称经验已固化 |

依赖锁文件 `package-lock.json` 是第三方版本解析的唯一镜像记录，由 npm 单向生成，禁止手工编辑。

## 数字人管线权威源

| 能力 | 唯一权威源 | 允许镜像/产物 | 唯一入口 | 失败策略 |
|---|---|---|---|---|
| 数字人流程状态机 | `workflow/digital-human/pipeline.ts` | `projects/*/digital-human/run.json` | `npm run digital-human` | 明确失败 |
| Fish Audio 旁白 | `workflow/digital-human/fish-audio.ts` | `projects/*/digital-human/voice/voice.mp3` | 数字人 `run` | 缺密钥或请求失败即失败 |
| HeyGen Avatar | `workflow/digital-human/heygen.ts` | `projects/*/digital-human/avatar/avatar.mp4` | 数字人 `run` | 缺授权 Avatar、任务失败或超时即失败 |
| 动态字幕 | `workflow/digital-human/captions.ts` | `projects/*/digital-human/subtitle/captions.json`、`captions.srt` | 数字人 `plan`/`run` | 输入为空即失败 |
| HyperFrames 包装 | `workflow/digital-human/hyperframes.ts`、`digital-human/hyperframes/template.ts` | `projects/*/digital-human/package/index.html`、`final.mp4` | 数字人 `package`/`run` | CLI、媒体或验收失败即失败 |
| 非目标隔离基线 | `DIGITAL_HUMAN_NON_TARGET_BASELINE.json` | 无 | `npm run gate` | 哈希漂移即失败 |

## 项目级 HyperFrames 权威源

| 能力 | 唯一权威源 | 允许镜像/产物 | 唯一入口 | 失败策略 |
|---|---|---|---|---|
| 个人 IP 项目合成 | `projects/*/hyperframes/index.html` | `projects/*/final.mp4` | 项目锁定 HyperFrames CLI | lint、inspect、render 或媒体验收失败即失败 |
| 真实产品素材来源 | `projects/*/assets/product/manifest.json` | `projects/*/assets/product/*` | 用户提供素材导入 | 未登记素材不得作为产品 UI |
| 项目旁白文案 | `projects/*/voice_script.md` | `projects/*/voice/*` | 显式语音 provider | provider 与实际生成方式必须如实记录 |
