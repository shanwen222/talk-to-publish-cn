# 执行环境契约

## 运行基线

- 操作系统：Windows；默认 Shell 为 PowerShell。
- 路径：运行命令使用 Windows 绝对路径或仓库内明确相对路径，不通过当前目录猜测项目根目录。
- Node/npm：仓库锁定的 Node/npm 运行时；当前本机已验证 Node 24、npm 11.9。
- Python：系统 Python 不作为 Whisper 入口；Whisper 只允许通过项目 `.venv` 的 Python 3.12 环境调用。
- FFmpeg/ffprobe：必须使用 `npm run doctor` 或已登记的本地工具入口确认存在，缺失时返回非零。

## 唯一入口和编码

- 工作流：`npm run factory -- <command>`。
- 本地转写：`powershell -ExecutionPolicy Bypass -File scripts/whisper.ps1 ...`。
- Remotion：使用项目锁定的 npm CLI，不从网络临时解析版本。
- 数字人：`npm run digital-human -- <command>`。
- 文本文件统一 UTF-8；JSON/YAML/SRT 必须经过真实解析，终端乱码不能单独作为文件损坏证据。
- `.cmd`、PowerShell 和 Node 子进程的退出码必须向上层传播；失败不得返回空产物或假成功。

## 媒体契约

- 横屏默认 1920×1080、30fps；竖屏默认按项目规格登记。
- 发布候选至少包含可解码的视频流和非静音音轨；最终文件用 ffprobe 验收时长、分辨率、编码、音频采样率和字节数。
- HDR/HLG 原片进入 Remotion 前必须先有明确的 BT.709 解释方案，不能依赖浏览器默认解释。
- 大型媒体、模型权重和浏览器二进制属于可重建产物，不进入聊天差异或普通源码镜像。

## 网络、费用与数据边界

- 默认本地优先，不上传用户视频；本地 Whisper 和 FFmpeg 是首选路径。
- OpenAI、ElevenLabs、Fish Audio、HeyGen、VibeFrame 及平台发布调用必须由用户显式授权；密钥只从环境变量读取。
- 付费执行必须有明确的 `--execute` 和成本上限（如入口支持）；缺少凭据时输出 `unavailable` 或明确失败。
- 日志不得输出密钥、Cookie、完整环境变量或用户原始媒体内容。

## 故障注入清单

- 缺少原片、音频或模型时，默认入口返回非零。
- Whisper 转写失败时，不得回退到用户脚本文案伪造时间轴。
- Remotion、FFmpeg、ffprobe 或 HyperFrames 不可用时，不得切换到旧版、备份或共享输出目录。
- 项目租约冲突时必须停止写入，并报告冲突任务。
