# 架构

```text
用户 brief
  -> workflow/planners.ts
  -> video_plan.md + script.md + storyboard.md + project.json
  -> validateRenderableProject
  -> Remotion（项目独立 props/output，可并行）
  -> FFmpeg（项目独立 output，AAC + faststart）
  -> ffprobe
  -> validateRenderedVideo
  -> projects/<project-id>/output/final.mp4
```

`project.json` 是一次生产的规范化项目对象；Markdown 是给人审阅的正式投影，Remotion props 是给渲染器的投影。任何窗口都不得重新推导项目是否可渲染或成片是否合格。

## 并行生产线

公共 `workflow/`、Remotion 源码和锁定依赖只读共享；每个视频会话独占一个 `projects/<project-id>/`，并自动取得项目租约。项目输出、props、封面、状态和临时目录均按 project id 隔离。不同项目可以同时调用同一套 Remotion，公共源代码或治理文件变更必须在所有视频任务暂停后进行。

并行渲染示例：

```powershell
Start-Process npm.cmd -ArgumentList "run factory -- render --project projects/episode-001 --render-concurrency 2"
Start-Process npm.cmd -ArgumentList "run factory -- render --project projects/episode-002 --render-concurrency 2"
```

`--render-concurrency` 是单个视频内部的 Remotion worker 数；多个视频同时渲染时应主动降低该值，避免所有会话共同占满 CPU、内存和磁盘。

Provider 接口只报告能力与显式配置状态。Flux、DALL-E、Midjourney、Kling、Runway、Sora、Seedance、OpenAI Voice 与 ElevenLabs 暂无调用实现。
