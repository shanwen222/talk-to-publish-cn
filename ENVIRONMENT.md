# 运行环境 / Runtime

这个仓库现在是“一套东西”：Skill 指令和视频生产代码在同一个目录、同一个 Git 仓库、同一个版本。正常本地剪辑不需要再安装第二个 Codex 插件或第二份 `AI-Video-Factory`。

## 新手只需要做一次

在仓库根目录打开 PowerShell，执行：

```powershell
.\scripts\setup.ps1
```

安装脚本会自动完成：

- Node.js 22 或更高版本；
- 仓库锁定的 Remotion、HyperFrames、GSAP/React 和 Playwright 依赖；
- FFmpeg 与 ffprobe；
- 项目专用 Python 3.12 虚拟环境；
- 本地 Whisper 转写；
- Playwright Chromium 浏览器。

脚本可以重复执行。安装完成后会自动运行环境检查；只有所有必要项通过，才算安装成功。这里的 HyperFrames/GSAP 与 Remotion 本地包是核心必需引擎；宿主提供的 `hyperframes:*` / `remotion:*` 指导 Skill 仅是可选增强，缺少指导层不会阻止本地引擎工作。

## 以后每次使用

```powershell
.\scripts\doctor.ps1
```

如果检查失败，不要继续让 Codex 剪片。把终端最后的错误信息发给 Codex，或者重新运行：

```powershell
.\scripts\setup.ps1
```

## 重要说明

- 只支持 Windows + PowerShell 的第一版运行路径；
- 不要把 `node_modules`、`.venv`、FFmpeg 安装目录、Whisper 模型或视频素材提交到 GitHub；
- 第一次转写会下载 Whisper 模型，属于正常现象；
- `VibeFrame`、Fish Audio、HeyGen 等付费或外部服务不是普通口播剪辑的必要依赖，未配置时不影响本地 Whisper + HyperFrames + Remotion 流程；
- 如果某一步缺依赖，流程必须失败并指出原因，不能偷偷退化成静态字幕或“看起来完成”的假成片。
