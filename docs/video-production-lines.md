# 三条视频生产线

## 文档定位

这是三条生产线的拓扑和边界说明，不替代各模块的执行源码。每条线有独立入口、产物根目录和失败策略；公共 Remotion、FFmpeg、Whisper 能力只能通过已登记入口消费。

## 生产线总览

| 生产线 | 适用内容 | 唯一正式入口 | 关键权威源 | 正式产物 | 当前状态 |
|---|---|---|---|---|---|
| 电影化视频线 | 电影感知识、产品展示、叙事类视频 | `npm run factory -- render --project projects/<id>`；项目要求包装时使用项目锁定 HyperFrames CLI | `remotion/src/**`、`ffmpeg/finalize.ps1`、`projects/<id>/hyperframes/index.html`（仅项目专属包装） | `projects/<id>/output/final.mp4` 或项目登记的 `projects/<id>/final.mp4` | 本地可运行；已有早期项目本地验收 |
| 个人 IP / 口播线 | 独立开发日志、知识口播、产品讲解 | `npm run factory -- rough-cut` → Remotion/FFmpeg 渲染 | `workflow/local-rough-cut.ts`、`scripts/whisper.ps1`、Remotion 画面源 | `projects/<id>/rough-cut/*`、`projects/<id>/output/final.mp4` | 本地流程已验证；后续按 SOP 复用 |
| 数字人视频线 | 知识类、个人 IP、产品介绍数字人视频 | `npm run digital-human -- doctor|plan|package|run` | `workflow/digital-human/**`、`digital-human/**` | `projects/<id>/digital-human/**` | 本地包装已验证；云端生成待用户授权和凭据 |

## 不变量

- 三条线不得互相覆盖产物；数字人线不得写入电影线或共享根目录的最终视频。
- 真实产品 UI 只能来自已登记的用户素材；AI 只能补充背景、B-roll、转场和动效。
- Whisper 字幕必须来自实际音频转写；用户文案只能在识别疑点处辅助对照，不能替代实际口播文字。所有语义修改必须回听并留下校正记录，执行 `docs/transcript-fidelity-standard.md`。
- 付费 provider 和平台发布默认关闭；缺少密钥、Avatar ID 或授权时必须明确失败。
- 公共 Remotion/FFmpeg 源码可以复用，但项目 props、临时目录、租约和输出路径必须隔离。

## 本地验收顺序

1. 先确认所属生产线和项目目录。
2. 运行该生产线唯一入口的 `doctor` 或计划阶段。
3. 生成/检查转写、素材登记和中间产物。
4. 先做关键帧或短片视觉样片，再做全片渲染。
5. 用 ffprobe 检查时长、分辨率、编码、音轨和文件大小。
6. 更新 `WORK_PROGRESS.md`，明确“本地已验证，未发布”。

## 当前边界

“三条生产线”是当前项目架构目标；跨会话声称已完成的改造，在本项目重新通过默认入口、门禁和媒体验收前，只记录为用户报告或待验证，不直接标记为生产已验收。
