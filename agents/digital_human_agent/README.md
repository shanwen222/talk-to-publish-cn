# Digital Human Agent

独立编排 `script.md -> Fish Audio -> HeyGen Avatar -> dynamic subtitle -> HyperFrames -> final.mp4`。

边界：

- 只写 `projects/<project-id>/digital-human/`。
- 不调用或修改 Remotion 电影管线。
- 只使用用户已经授权的 HeyGen Avatar ID，不创建或克隆真人身份。
- 默认只规划；真实云端请求必须由 `--execute --max-cost <USD>` 显式开启。
- 任一 provider、任务、下载、渲染或验收失败都必须返回非零退出码。
