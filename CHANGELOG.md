# 更新记录 / Changelog

## 0.2.0 — 2026-08-25

- 仓库与 Skill 统一命名为 `talk-to-publish-cn` / 从口播到成片。
- 主流程、参考资料和 README 改为中文优先，并保留 English summary/README。
- 明确真实口播优先、流程框一起出现后按 cue 高亮、全组件回归和手机端 QA 规则。
- README 增加快速安装、调用示例、输入格式、标准生产流程、项目产物、命令、故障排查和贡献指南。

## Unreleased — 2026-08-30

- 将 `AI-Video-Factory` 的可执行运行时并入同一个公开仓库；本地工作目录与 GitHub `main` 保持同源。
- 增加可重复执行的 `setup.ps1` / `doctor.ps1`，新手不需要手动安装第二个插件；仓库内 HyperFrames/GSAP 与 Remotion 是核心必需引擎，宿主指导 Skill 仅为可选增强。
- doctor 现在会实际启动 Chromium，并在缺依赖时 fail-closed，禁止静默退化成静态或通用剪辑。
- 增加唯一的 `scripts/check_sensitive.py` 发布安全扫描器，覆盖工作区、完整 Git 历史、pre-push 提交范围、凭据、个人信息、本机路径、媒体文件头、嵌入式图片和超大文件；命中时只输出 `source/path/rule/commit`。
- 增加 `scripts/install_pre_push_hook.py` 与 `hooks/pre-push`。维护者首次 clone 后手动安装到当前项目 `.git/hooks/pre-push`；未知 hook 默认不覆盖，显式 `--force` 才允许替换。
- GitHub Actions 使用 `fetch-depth: 0`，并在其他校验前调用同一份扫描器的 `--history` 模式。

## 0.1.0 — 2026-08-25

- 首次公开发布 Talk to Publish skill。
- 保留可选粗剪指导，并明确允许跳过且必须记录。
- 加入字幕一致性、语义设计、HyperFrames/Remotion 渲染和全组件回归 QA。
# Unreleased

- 将 Skill 指令与 `AI-Video-Factory` 运行时代码合并为同一个仓库；不再维护两个 source of truth。
- 增加 `scripts/setup.ps1` 和 `scripts/doctor.ps1`，新手只需一次安装脚本即可准备 Node、Whisper、FFmpeg、Remotion、HyperFrames 和 Chromium。
- 环境检查失败时必须停止视频任务，禁止静默退化成静态或通用剪辑。
- 粗剪流程固化“先从实际视频生成字幕并审计重复，重复时优先保留后一句，结尾保留约 0.5 秒缓冲”的经验。
