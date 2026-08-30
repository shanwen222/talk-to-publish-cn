# HyperFrames + Remotion 渲染 / Rendering

## 分工 / Division of responsibility

- HyperFrames HTML/GSAP 是 visual source of truth：负责版式、确定性动效、转场和视觉 A-roll track。
- Remotion 是 final composition layer：负责视觉轨、原音频、Whisper 字幕和导出。
- FFmpeg 只做 probe、可选粗剪、抽帧和媒体事实检查，不要另造第二套视觉时间线。

## HyperFrames 规则 / Authoring rules

- 写或改 HTML 前先读项目 `DESIGN.md`。
- 先完成 hero/end-state，再加 GSAP entrance。
- 在 `window.__timelines` 注册 paused timeline。
- 使用确定值：禁止 `Math.random()`、`Date.now()` 和无限 repeat。
- 使用 muted/playsinline video，音频单独放置。
- 转场和入场必须有意图；禁止扫描线、纯黑空场和无语义 HUD。
- `entrance` 与 `focus` tween 分开，focus cue 不得意外造成流程框逐个生成。

典型检查命令（以当前 CLI 实际命令为准）：

```powershell
npx hyperframes lint
npx hyperframes check --no-contrast
npx hyperframes check --json --samples 12
npx hyperframes render . -o output/visual-full.mp4 --quality high --resolution landscape --crf 18 --workers 4 --strict-all
```

## Remotion 合成 / Composition

使用 `staticFile()` 引用 HyperFrames visual track 和源音频；字幕时间必须来自 accepted Whisper 文件。字幕字号要适配手机，并避开 caption safe area。

```powershell
npm run build
npx remotion compositions remotion/src/index.ts
npx remotion render remotion/src/index.ts <CompositionId> <project-output>.mp4 --codec h264 --crf 18 --concurrency 4
ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate -of json <project-output>.mp4
```

渲染并人工 QA 通过后，才把 accepted deliverable 复制到用户可见路径；项目源文件和输出保留为可复现记录。

## English summary

HyperFrames/GSAP owns deterministic visual motion; Remotion owns audio, captions, composition, and export. Keep one timeline, use paused deterministic timelines, separate entrance from focus, and verify final media facts with `ffprobe`.
