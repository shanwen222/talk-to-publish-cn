# 架构决策记录

## 2026-08-30：单仓库新手运行时

- `talk-to-publish-cn` 同时承载 Codex Skill 指令和原 `AI-Video-Factory` 的本地运行时代码；GitHub `main` 与本地活动目录是同一 source of truth。
- Node、HyperFrames、Remotion、Playwright Chromium、FFmpeg/ffprobe、Python 3.12 与 Whisper 由仓库脚本统一准备；不要求新手理解依赖，也不要求另装第二个 Codex 插件。
- 仓库内 HyperFrames/GSAP 与 Remotion 执行引擎是核心必需；宿主侧 `hyperframes:*` / `remotion:*` 仅是可选指导层。本地 doctor 失败仍必须阻断任务，避免环境缺失时产出低质量静态视频。
- 复制仓库而不是只复制 `SKILL.md` 是公开安装契约；`setup.ps1` 幂等，`doctor.ps1` 负责每次任务前检查并实际启动 Chromium。

## 2026-07-27：v1.0 初始化

- 采用单一 TypeScript 工作流入口，不为每个 agent 创建独立执行引擎；`agents/` 只保存角色契约。
- Remotion 负责确定性画面合成，FFmpeg 只做最终编码/复用与验证。
- VibeFrame 作为可选工作流管理与未来付费生成层，默认仅 dry-run，并锁定 npm 包。
- Whisper 使用项目 Python 3.12 虚拟环境，避免依赖当前未被上游声明支持的系统 Python 3.14。
- Playwright 使用项目级 Chromium，不依赖不稳定的系统浏览器路径。
- OpenMontage 只参考 manifest → stage → review → checkpoint 的设计，不作为依赖，避免引入不必要的 AGPL 组合与重复裁决。
- 初次空仓治理采用一次性 bootstrap；治理入口建立后，所有业务实现必须使用任务租约。
- Windows 上 pnpm 续装留下并发安装进程与不完整依赖树，已通过固定清理器移除；正式包管理入口改为 npm 11.9.0，并删除 pnpm 锁文件，避免双重依赖权威源。
- VibeFrame 的可选 Kokoro TTS 依赖会额外安装 ONNX 运行时；v1.0 已有 Whisper 且不承诺 VibeFrame TTS，因此隔离运行时使用 `--omit=optional` 安装。
- Windows 总门禁不得直接以 `spawn` 启动 `.cmd`；已改为由 Node 执行各工具的 JavaScript 入口，并用一次失败后其余只读门禁仍全部执行的结果证明门禁可达。
- PowerShell 5.1 的 UTF-8 `Set-Content` 会写 BOM；租约状态改用无 BOM UTF-8，读取端仍兼容既有 BOM 状态。

## 2026-07-27：v2.0 商业短视频扩展

- 保持单一工作流 CLI 与现有目录不变，六项新能力以独立 agent 模块和可选渲染参数接入。
- Voice Agent 同时实现 ElevenLabs 与 OpenAI HTTP 契约；无密钥 Demo 只允许显式 `edge-preview`，元数据必须记录实际 provider。
- Music Agent 生成无版权程序化 BGM，并以 FFmpeg 侧链压缩、淡入淡出和目标响度保证语音优先。
- Cinematic Agent 只提供 Remotion 视觉组件，最终镜头选择仍来自项目规格，避免展示层重新裁决内容。
- Viral Agent 使用确定性结构规则生成 Hook、节奏和情绪曲线，不输出不可验证的“爆款概率”。
- Platform Adapter v2.0 只生成本地发布包，未获账号授权前禁止执行小红书、抖音或 YouTube 外部写入。
- 预览旁白短于 60 秒时，Music Agent 必须先补静音再参与侧链压缩，避免 FFmpeg `-shortest` 截短成片；正式混音固定输出 48kHz 双声道。
# 2026-07-27 - Independent digital-human pipeline

- Added a separately owned `digital-human` pipeline: Fish Audio -> HeyGen -> dynamic captions -> HyperFrames.
- Preserved the existing cinematic pipeline as immutable non-target source, enforced by SHA-256 gate checks.
- Require explicit paid execution authorization (`--execute` and positive `--max-cost`); no cloud fallback or false-success path.
- Require an already authorized HeyGen Avatar ID; identity creation or cloning is out of scope.
# 2026-07-28 - Demo 01 project-scoped HyperFrames production

- Registered project-scoped HyperFrames HTML/GSAP compositions without changing the Remotion cinematic or digital-human pipelines.
- Product UI is provenance-locked to user-provided assets recorded in `assets/product/manifest.json`.
- AI generation is restricted to abstract B-roll, backgrounds, transitions, and motion graphics.
- Missing Fish Audio credentials require an explicitly labeled local preview voice; no false provider attribution.

## 2026-07-29：v3.0 内容生产智能层

- 继续保留 `workflow/factory.ts` 单一入口、Remotion、FFmpeg、Voice、Music、Thumbnail 与现有 Agent；v3 仅新增上游编排和内容规则层。
- 采用 OpenMontage 的 Pipeline-first、Skill-as-instructions、stage artifact 与 review checkpoint 思想，但不引入其代码或运行时依赖。
- Pipeline 使用仓库内版本化 `.yaml` 定义；Director 只选择和分配，不直接渲染或调用付费 provider。
- Skill 是可审计内容规则，不复制成第二套执行引擎；现有 Agent 和渲染 Pipeline 仍是唯一执行方。
- Reference Analyzer 必须区分工具观测事实与内容推断；无法读取媒体时禁止虚构镜头、字幕、传播原因或质量评分。
- v3 首个 personal_ip 测试复用早期已验收样片和真实素材，只新增 Director 编排产物与完整性验证，不重新编码或替换既有成片。
- `workflow/factory.ts` 因新增 `direct`、`strategy`、`reference`、`run-v3` 四个共享 CLI 分支发生预期漂移；核对差异并确认 8 个其余电影基线文件和全部数字人实现未变后，以独占治理租约重封隔离哈希。

## 2026-07-29：短视频文案编辑与内容驱动时长

- Hook 不采用固定“三选一”契约：已有强 Hook 时直接保留；只有题材存在真实且有价值的不同切入角度时才建议备选，数量由内容决定。
- 时长从硬套 30/60/180 秒升级为 Pipeline 范围内的内容驱动建议；显式时长仍可作为约束，但不得为填满时长增加空话。
- Copywriter Agent 只对用户或 Script Agent 已有文案做口语化审校、语速估算、节奏分段和风险提示，不生成收入、用户、效果或产品能力事实。
- 采用配音优先顺序：文案审校 -> 自然旁白 -> 实际音频时长 -> 字幕与镜头同步；禁止先锁画面时长后粗暴拉伸语音。

## 2026-08-02：吸收通用工程治理规范并登记三条生产线

- 采用通用规范中的最小可执行集合：唯一活动进度表、固定状态机、证据化验收、跨会话纠错记录、唯一入口和失败可见性。
- 将项目生产线明确分为电影化视频线、个人 IP/口播线和数字人视频线；每条线拥有独立入口、产物根目录和非目标边界。
- 不把另一会话的口头完成状态直接当作本地生产验收；必须在本仓库的默认入口、门禁和媒体验收通过后再提升状态。
- 新增 `EXECUTION_ENVIRONMENT_CONTRACT.md` 与 `docs/video-production-lines.md`，不替换 Remotion、FFmpeg、Whisper 或现有 Agent。

## 2026-08-02：将真实视频返工经验固化为生产门禁

- 新增 `docs/production-lessons.md`，把早期项目的实际问题转为“症状—原因—处理—固定做法”。
- 以后默认顺序固定为：A-roll 粗剪和语义确认 → 按 A-roll 录产品操作 → 实际音频 Whisper → 15–30 秒复杂样片 → 全片包装 → 媒体 QA。
- 字幕、产品录屏、人物版式和信息卡统一使用全局时间线；Whisper 事实优先，用户文案只作审校依据。
- HDR/HEVC、横竖屏留白、蒙版频繁切换、产品内容遮挡、语义误删和预览音色误标等问题，必须在全片渲染前通过对应检查点。
- 经验库只记录已观测问题和已验证处理，不把平台流量或传播效果从本地渲染结果中推断出来。
