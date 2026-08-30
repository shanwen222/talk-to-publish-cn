# 数字人视频独立 Pipeline

## 定位

面向知识类短视频、个人 IP 视频和产品介绍视频。它与原有 Remotion 电影视频 Pipeline 并列运行，互不覆盖：

`script.md -> Fish Audio voice.mp3 -> HeyGen avatar.mp4 -> dynamic captions -> HyperFrames package -> digital-human/final.mp4`

## 配置

将 `.env.example` 复制为本地 `.env`，或在进程环境中设置：

- `FISH_AUDIO_API_KEY`
- `FISH_AUDIO_REFERENCE_ID`：已授权的 Fish Audio voice reference
- `FISH_AUDIO_MODEL`：默认 `s2-pro`
- `HEYGEN_API_KEY`
- `HEYGEN_AVATAR_ID`：用户已合法创建并授权的 Avatar look ID

密钥不得写入项目 JSON、日志或仓库。当前实现不创建或克隆 Avatar。

## 命令

环境诊断（不调用付费 API）：

```powershell
npm run digital-human -- doctor
npm run digital-human -- doctor --full
```

为已有 Factory 项目建立数字人目录和字幕计划（免费、本地）：

```powershell
npm run digital-human -- plan --project projects/ai-hotspot-v2 --use-case knowledge
```

使用已有本地 `digital-human/avatar/avatar.mp4` 进行 HyperFrames 包装：

```powershell
npm run digital-human -- package --project projects/ai-hotspot-v2
```

真实云端生产：

```powershell
npm run digital-human -- run --project projects/ai-hotspot-v2 --use-case knowledge --execute --max-cost 5
```

`--max-cost` 是本地操作员授权记录，不是供应商账单的硬性封顶。请同时在 Fish Audio 和 HeyGen 账户侧设置预算与限额。HeyGen 异步任务最多轮询 90 次，每次默认间隔 10 秒；失败和超时均会写入 `run.json` 并返回非零。

## 产物

```text
projects/<id>/digital-human/
├── config.json
├── run.json
├── voice/voice.mp3
├── avatar/avatar.mp4
├── subtitle/captions.json
├── subtitle/captions.srt
├── package/index.html
├── package/assets/avatar.mp4
└── final.mp4
```

字幕按实际 Avatar 视频时长重新分配，HyperFrames 使用独立 HTML 合成并保留 Avatar 音轨。
