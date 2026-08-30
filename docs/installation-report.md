# v1.0 安装与验收报告

日期：2026-07-27
状态：本地已验证，未发布

## 基础设施

| 组件 | 安装形态 | 版本 | 验证 |
|---|---|---|---|
| VibeFrame | `workflow/vibeframe-runtime/` 隔离 npm 运行时 | 0.115.2 | CLI 版本、项目配置、FFmpeg/Chrome 诊断 |
| Remotion | 根项目锁定 npm 依赖 | 4.0.499 | 包一致性与 1800 帧真实渲染 |
| FFmpeg / ffprobe | WinGet `Gyan.FFmpeg` | 8.1.2 | 合成、探测、H.264/AAC 验收 |
| Playwright | 根项目锁定 npm 依赖 + 本机 Chrome | 1.62.0 | 真实页面角色断言通过 |
| Whisper | `.venv` / Python 3.12.13 | 20250625 | 导入与 CLI 存在性通过 |

VibeFrame 的可选 Kokoro/ONNX TTS 未安装：v1.0 已把 Whisper 登记为语音识别权威依赖，声音生成预留 OpenAI Voice 与 ElevenLabs 接口；不安装重复的可选 TTS 能避免额外模型运行时和第二条声音链。

## Demo

- 输入：合成一条 60 秒的合成测试视频（示例，不含真实客户内容）
- 项目：`projects/<project-id>/`
- 策划：`video_plan.md`
- 脚本：`script.md`
- 分镜：`storyboard.md`
- 素材目录：`assets/images`、`assets/videos`、`assets/audio`
- 中间渲染：`projects/<project-id>/output/remotion.mp4`
- 最终成片：`projects/<project-id>/output/final.mp4`
- 探测事实：1080x1920、30fps、60.053 秒、H.264 视频、AAC 48kHz 双声道、4,205,847 bytes

## 自动化证据

- TypeScript 编译通过。
- Node 契约 8/8 通过。
- Playwright 1/1 通过。
- 故障注入分别阻断候选源码、非法 UTF-8 与疑似密钥。
- 六个时间点抽帧检查：标题、镜头编号、字幕、安全边距和配色均可读。
- Provider 无密钥时全部明确返回 `unavailable`，未产生云端费用。
