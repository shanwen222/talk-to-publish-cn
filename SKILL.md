---
name: talk-to-publish-cn
description: 将中文口播素材制作成可发布的横屏视频：真实语音转写、可选粗剪、Whisper 字幕、按语义设计的动态信息层、HyperFrames/GSAP 动效、Remotion 合成与手机端人工 QA。
---

# 从口播到成片 · Talk to Publish

## Mandatory runtime gate (single repository)

先区分两层依赖：HyperFrames/GSAP 与 Remotion 的本地执行引擎是核心必需；
`hyperframes:*` / `remotion:*` 只是 Codex 宿主里的操作指导 Skill，可选但不能
替代本地引擎。视频生成始终依赖仓库内锁定的 HyperFrames/GSAP + Remotion，
由 doctor 检查并在缺失时阻断。

The repository is self-contained for normal local video production. Before any
formal task, run `./scripts/doctor.ps1` (PowerShell: `.\\scripts\\doctor.ps1`).
The doctor checks the locked Node dependencies, HyperFrames/GSAP package, Remotion,
Playwright Chromium, FFmpeg/ffprobe, Python 3.12, and local Whisper. These are the
only installation prerequisites for the normal path.

Codex-hosted guidance Skills are optional accelerators, not installation prerequisites:
when available, load `hyperframes:hyperframes` + `hyperframes:gsap` for HyperFrames
authoring and the relevant `remotion:*` guidance Skills for Remotion/captions/rendering
(`remotion:remotion-best-practices`, `remotion:remotion-markup`,
`remotion:remotion-render`, and `remotion:remotion-captions`).
When a host does not provide those Skills, use the local CLI and the rules in this
repository; do not ask a beginner to install a second plugin or repository.

If the local doctor fails, stop and return `blocked_by_dependencies` until
`scripts/setup.ps1` succeeds. Never silently replace the pipeline with static
subtitles, a handwritten timeline, plain CSS, an unloaded simplified rule, or a
result that only looks complete. Rough-cut/transcription-only tasks still must pass
the local doctor.

The complete runtime and host-capability declaration is in
`references/dependencies.json`; do not create a second dependency list in a
task directory or a copied Skill folder.

把中文 talking-head（口播/访谈/教程）从真实录音推进到可发布成片。默认使用 HyperFrames + GSAP 负责视觉与动效，Remotion 负责最终合成、字幕和导出。这个 Skill 不是固定模板：每段画面应由口播语义决定信息结构。

## 单仓库运行时 / Single-repository runtime

这个 Skill 与视频生产代码属于同一个仓库。执行任何剪辑、转写、HyperFrames 或 Remotion 工作前，先在仓库根目录运行：

```powershell
.\scripts\doctor.ps1
```

如果检查失败，先在同一仓库运行 `.\scripts\setup.ps1` 自动准备已登记的本地运行时，再重新运行 doctor；安装或复检仍失败时返回 `blocked_by_dependencies` 并停止任务。禁止在运行时缺失时退化成静态字幕、套模板或用参考文案伪造时间线。不要把本仓库的 `SKILL.md` 复制到另一个没有运行时的目录；以当前仓库根目录为唯一 source of truth。正常剪辑不要求用户另装第二个插件或第二份仓库。

## 核心规则 / Non-negotiable rules

- **口播是真实来源**：用户给的文案只能作 reference，用来核对专有名词、数字和低置信度 ASR，不得整段替换真实口播。
- **保存证据链**：保留 raw Whisper JSON/SRT/TSV/VTT/TXT；所有非平凡修订写入 `caption-corrections.json`，并记录 `audioVerified: true` 的听音依据。
- **先审计再剪辑**：先用实际视频生成一轮字幕并做重复审计，再决定是否删除重复句；参考文案不能代替这一轮真实转写。
- **先做语义设计**：信息层展示流程、关系、结构和少量关键数字，不把整段口播变成密密麻麻的小字。
- **动效要跟语义走**：流程框可以一起出现，再根据口播把当前步骤高亮；不要把“高亮时间线”误做成“流程框逐个生成”。`entrance` 与 `focus` 必须是两个独立状态。
- **人物是 A-roll 主体**：不长期挡脸、嘴、标题或字幕安全区；叠层保持通透，手机缩略图仍能读到主标题、关键数字和当前重点。
- **右侧信息必须有意义**：默认使用简短、悬浮的语义标签。禁止没有语义的常驻 radar/scanner/旋转 HUD；若使用雷达，必须说明它表达的关系或数据。
- **拒绝稿要隔离**：失败成片只能作为对照。新方案创建新的 `redo/vN` 或独立 composition，不在失败底稿上打补丁。
- **全局规则要回归**：样片通过后，逐一盘点全片所有流程框、时间线、对比组和数字卡，不能只在样片某一处生效。
- **提交前做隐私扫描**：运行 `npm run security:validate` 扫描工作区和全部 Git 历史；不要提交密钥、Cookie、个人素材、转写稿或本机路径。
- **只暂存明确文件**：禁止 `git add .` 和 `git add -A`。使用 `git add -- <明确的文件路径>`，再检查 `git diff --cached`，避免把临时素材、凭据或个人资料带入公开仓库。

## 工作流 / Workflow

1. **检查与登记输入**：确认源视频、时长、画幅、音频、参考文案、截图/产品素材和输出路径；保留原始文件，先读项目的设计与反馈记录。
2. **识别真实口播**：运行项目 Whisper 入口，保存 raw transcript；从这轮视频生成字幕后运行重复审计，识别整句重复、长句内重复和近似重录。只删除音频后的幻觉段，并生成字幕一致性报告：时间戳来源、真实听到的文字、参考文案修订分别列出。
3. **可选粗剪**：用户要去停顿、重复句、明显废话时，按 [rough-cut.md](references/rough-cut.md) 执行；先完成字幕重复审计，确认重复时默认优先保留后一句；最终结尾默认保留约 0.5 秒缓冲。用户要求保留原 A-roll 时跳过，但在项目记录中明确 `rough-cut: skipped`。
4. **先做语义方案**：编写 `DESIGN.md` 和逐段 scene table，记录口播意思、视觉结构、使用理由、入场、口播 cue、高亮、退出、安全区和手机优先级。参考 [semantic-design.md](references/semantic-design.md)。
5. **建立隔离版本**：旧版本保留；只把需要的媒体和锁定依赖复制到新的 composition/redo 目录，绝不拿被否定的成片当新底稿。
6. **制作 HyperFrames 层**：先搭 end-state，再用确定性的 GSAP 入场和语义转场。进度条只在能帮助节奏时使用；流程组件用数据驱动，保证同一条已确认规则能覆盖全片。
7. **默认先出短样片**：渲染 5–30 秒，至少包含一个复杂流程组、一次字幕 cue、一个语义侧标和一次人物安全检查。用户明确跳过样片时，仍要内部抽关键帧做 QA。
8. **全组件回归**：全片渲染前列出每个 flow-like group；标注 `dynamic-with-cues`、`static-by-design` 或 `structural-sequence`。动态组至少检查 all-visible、first-focus、middle-focus、final-focus。参考 [regression-and-qa.md](references/regression-and-qa.md)。
9. **渲染与合成**：先跑 HyperFrames lint/check/inspect/render，再用 Remotion 合成视觉轨、原音频和 Whisper 字幕。默认 1920×1080/30fps、H.264/AAC，除非用户另有要求。详细命令见 [rendering.md](references/rendering.md)。
10. **人工 QA 与交付**：检查全分辨率关键帧、转场、字幕、脸/标题/字幕安全区、透明度、手机缩略图和媒体规格；更新 `WORK_PROGRESS.md`、`USER_FEEDBACK_LOG.md`、事故/经验记录和 source manifest，再交付文件路径与真实规格。不要自动对外发布。
11. **发布安全门禁**：公开仓库前运行 `npm run security:validate`。首次克隆后由维护者手动运行 `npm run security:install-hook`，将唯一 hook 安装到当前项目的 `.git/hooks/pre-push`；未知 hook 默认不覆盖，只有显式 `--force` 才允许替换。CI 以 `--history` 重复检查完整历史。

## 参考资料 / References

- [rough-cut.md](references/rough-cut.md)：可选粗剪和时间线重映射 / optional trimming。
- [semantic-design.md](references/semantic-design.md)：真实口播校对、逐段设计表和流程组契约 / transcript fidelity and semantic planning。
- [rendering.md](references/rendering.md)：HyperFrames/GSAP 与 Remotion 的分工、检查和导出 / rendering architecture。
- [regression-and-qa.md](references/regression-and-qa.md)：全组件回归、关键帧和手机端人工检查 / visual QA。

## English summary

This skill turns Chinese talking-head footage into a publishable video. Audio is authoritative; supplied scripts are reference-only. Plan visuals by meaning, separate entrance from spoken focus, keep overlays translucent and mobile-readable, use HyperFrames/GSAP for deterministic motion and Remotion for final composition, then perform full-component regression and human visual QA. Keep rough-cut instructions in the project even when the cut is skipped.
