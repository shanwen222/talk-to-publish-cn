# 发布记忆卡

- 仓库边界：`AI-Video-Factory/` 单仓库子目录。
- 当前运行目标：Windows 本机，Node.js 20+、npm、项目 Python 3.12、FFmpeg。
- 正式构建：`npm ci && npm run build && npm run gate`。
- 正式发布通道：v1.0 尚未建立远程或生产发布；不得手工上传冒充发布。
- 三条生产线：电影化视频线、个人 IP/口播线、数字人视频线；边界与入口见 `docs/video-production-lines.md`。
- 当前生产状态：三条线均只允许标记为本地已验证/待发布或部分完成/仍待验证；没有生产已验收版本。
- 健康检查：`npm run doctor`。
- 业务烟测：`npm run demo` 后使用 ffprobe 验证 1080x1920、60 秒、H.264/AAC。
- 回滚：仅 Git 中经过门禁的完整版本；不从缓存、产物或单文件备份覆盖权威源。
- 已验证故障路线：依赖缺失、项目文件缺失、ffprobe 失败均必须返回非零。
