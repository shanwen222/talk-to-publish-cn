# 单仓库规则 / Single source of truth

本目录同时是 Codex Skill 和视频生产运行时。不要复制出另一份 `AI-Video-Factory` 或只保留 `SKILL.md` 的残缺副本；所有任务都必须使用当前仓库根目录中的代码、锁定依赖和脚本。

开始任何转写、粗剪、HyperFrames 或 Remotion 任务前，先运行：

```powershell
.\scripts\doctor.ps1
```

检查失败时先在同一仓库运行 `.\scripts\setup.ps1` 自动准备已登记的运行时，再重新运行 doctor；安装或复检仍失败时返回 `blocked_by_dependencies` 并停止任务。禁止因为缺环境而回退成静态字幕、手工猜测时间轴或假装完成。

# Talk to Publish 工程约定

## 必读顺序

1. `AGENTS.md`
2. `SOURCE_OF_TRUTH.md`
3. `ADJUDICATION_AUTHORITY.md`
4. `MODULE_BOUNDARIES.json`
5. `CAPABILITY_AND_INTERFACE_CONTRACTS.json`
6. `EXECUTION_ENVIRONMENT_CONTRACT.md`
7. `ENVIRONMENT.md`
8. `docs/video-production-lines.md`
9. `docs/production-lessons.md`

## 项目边界

本仓库负责本地、可复现的视频策划、脚本、分镜、素材登记、语音/BGM 编排、Remotion 渲染、FFmpeg 后处理、封面生成和供应商接口。VibeFrame、Whisper、Playwright、Remotion 与 FFmpeg 是外部依赖，不复制其源码。API 密钥、Cookie、自动发布账号和生产部署不进入仓库；云模型费用必须由调用者显式配置并触发。

## 唯一入口

- 工作流 CLI：`npm run factory -- <command>`
- Remotion：只能由工作流调用项目锁定的 Remotion CLI；多个项目可并行调用，但必须使用项目独立 props、临时目录和输出路径。
- Python/Whisper：只能由 `scripts/whisper.ps1` 调用项目 `.venv`
- 总门禁：`npm run gate`

入口缺失或依赖不可用时必须返回非零，不允许备用入口或假成功。

## 修改规则

- 新增模块、入口、镜像或公开字段前，先更新治理登记。
- 公共源代码或治理文件变更必须通过 `scripts/governance/lease.ps1 acquire` 获取不可扩围的文件白名单；不同视频任务可以并行，只有白名单路径冲突时才互斥，完成后使用原令牌释放。
- 所有写入项目产物的工作流命令自动获取 `.governance/project-leases/<project-id>.json` 项目租约；同一项目不能被两个会话同时写入，不同项目可以并行。租约异常残留时使用 `npm run factory -- lease --project projects/<id> --action status|release --force` 处理。
- 不覆盖用户或其他任务的未提交更改。
- 配置与密钥分离；仓库只允许提交 `.env.example`。
- 公开提交前必须运行 `npm run security:validate`；禁止 `git add .` / `git add -A`，只暂存明确的文件路径并检查 `git diff --cached`。
- `projects/<project-id>/output/`、缓存、模型权重与浏览器二进制是可重建产物，不是权威源；视频任务不得写入共享根目录 `output/`。
- 禁止保留 `backup`、`final-copy`、`current`、`tmp` 等候选实现。

## 安全与费用

- VibeFrame 默认只允许 `--dry-run`；真实付费生成必须由用户另行授权并设置 `--max-cost`。
- `demo-v2` 默认使用无密钥的 `edge-preview` 神经语音预览器；生产语音必须显式选择 `openai` 或 `elevenlabs`。
- 自动发布和账号操作仍不属于 v2.0 能力；平台适配器只生成发布包，不执行外部写入。
- 日志不得输出密钥、Cookie、访问令牌或完整环境变量。

## 收尾

运行格式、类型、测试、构建、默认入口烟测、源唯一性、安全扫描和环境检查；需要时更新项目 `WORK_PROGRESS.md`；释放租约；确认活动租约为零后运行最终 `npm run gate`。仅本地完成时必须写“本地已验证，未发布”。

## 数字人独立管线

- 独立入口：`npm run digital-human -- <command>`。
- 唯一职责链：Fish Audio 旁白 -> HeyGen 音频驱动 Avatar -> 动态字幕 -> HyperFrames 包装。
- 正式产物根：`projects/*/digital-human/`；不得写入或复用电影管线的 `output/final.mp4`。
- `workflow/factory.ts`、`workflow/voice-agent.ts`、`workflow/music-agent.ts`、`remotion/**` 与 `ffmpeg/finalize.ps1` 是非目标源，必须通过隔离哈希检查。
- 云端执行必须同时提供 `--execute` 与正数 `--max-cost`，且密钥只从环境变量读取。缺少密钥、Avatar ID、任务失败或轮询超时时必须明确失败。
- Avatar 必须由用户在 HeyGen 中合法创建并授权；本仓库不创建、克隆或推断真人身份。

## 项目级 HyperFrames 成片

- 用户明确要求 HyperFrames 包装时，允许在 `projects/<project-id>/hyperframes/` 维护项目专属 HTML/GSAP 合成源。
- 唯一渲染入口为项目锁定的 `node node_modules/hyperframes/bin/hyperframes.mjs`；不得通过网络临时解析未锁定版本。
- 真实产品 UI 只允许来自 `assets/product/manifest.json` 已登记的用户素材；AI 生成资产不得进入该目录，不得伪造或补画产品界面。
- 项目成片写入 `projects/<project-id>/final.mp4`，必须执行 HyperFrames lint、validate、inspect、render 和 ffprobe 验收。
- 缺少付费语音凭据时，必须明确标记本地预览旁白；不得冒充 Fish Audio 正式生成。
