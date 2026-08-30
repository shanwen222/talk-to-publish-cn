# 本地口播粗剪

这条链路用于在电脑本地完成口播原片的转写、停顿分析、粗剪计划、预览和高清母版输出。它直接读取相机或手机原文件，不依赖 ChatCut 时间线，不上传视频，也不会调用付费云端接口。

## 工作原理

```text
原始视频
  ↓
本地 Whisper 转写（JSON / SRT）
  ↓
字幕重复审计（精确重复 / 长句内重复 / 近似重录）
  ↓
FFmpeg 静音检测
  ↓
生成可审计 cut-list.json
  ↓
人工或 Codex 审核 review 项
  ↓
FFmpeg 从原片重建预览 / 高清母版
```

Whisper 的时间戳是剪辑定位依据，不等于最终剪辑决定。每轮粗剪必须先生成一份实际字幕，再做重复审计；审计会检查完整重复、较长句子中包含的重复句，以及相邻的近似重录。疑似重复表达、重录提示和语义不确定片段会标为 `review`，默认保留，人工回听确认后通常优先保留后一句，避免误删完整意思。

超过阈值的段内长停顿会保留约 0.35 秒呼吸后形成真实剪切点。最终可播放范围额外保留约 0.5 秒源尾巴（`--final-tail-buffer 0.5`），让最后一句说完后有自然缓冲，避免成片硬切；如果原片尾巴不足则按实际长度保留。

同样，Whisper 时间戳来自真实音频，不等于后续字幕文字必然忠实。字幕校正必须遵守 [口播字幕忠实度标准](transcript-fidelity-standard.md)：先独立识别、再回听，参考稿只用于识别不清处的候选对照。

## 第一次运行

在 `AI-Video-Factory` 目录执行：

```powershell
npm run factory -- rough-cut `
  --project projects/episode-002 `
  --action run `
  --input "D:\video\part-01.mov" `
  --input "D:\video\part-02.mov" `
  --model base `
  --layout portrait-left
```

`run` 会完成分析并生成一份快速预览。多个 `--input` 按命令中的顺序衔接。

可选画面布局：

- `portrait-left`：竖屏人物放在横屏左侧，右侧留给录屏和包装。
- `blur-background`：竖屏主体居中，背景使用同源模糊扩展。
- `contain`：完整保留画面，空余区域填黑。
- `cover`：铺满画布，可能裁掉边缘。

## 审核与高清输出

分析结果位于：

```text
projects/<episode-id>/rough-cut/
├── analysis.json
├── cut-list.json
├── transcript.md
├── repeat-audit.json
├── repeat-audit.md
├── transcripts/
├── preview.mp4
└── a-roll-rough-cut.mp4
```

`cut-list.json` 中每个片段有三种决定：

- `keep`：保留。
- `remove`：删除，并形成真实剪切边界。
- `review`：需要语义审核；未确认前仍保留在成片中。

确认剪辑清单后生成高清母版：

```powershell
npm run factory -- rough-cut `
  --project projects/episode-002 `
  --action master `
  --final-tail-buffer 0.5
```

如只想重新分析，不渲染：

```powershell
npm run factory -- rough-cut `
  --project projects/episode-002 `
  --action plan `
  --input "D:\video\part-01.mov"
```

如只想依据现有清单重做预览：

```powershell
npm run factory -- rough-cut `
  --project projects/episode-002 `
  --action preview
```

## 输出质量

- 预览：1280×720、H.264、AAC，优先速度。
- 高清母版：1920×1080、H.264 CRF 18、AAC，适合进入后续 Remotion 包装或剪映精修。
- 检测到 HLG/PQ HDR 原片时，会执行色调映射并输出标准 BT.709，避免简单转码造成黑白、偏色或高光异常。
- 中间片段从原视频直接读取并按剪辑清单重建，上传平台的代理文件不会替代原始母版。

## 能做与不能做

本地链路擅长：转写、字幕驱动的重复审计、时间轴、长停顿压缩、静音定位、固定口癖清理、多段拼接、横屏重构、HDR 转 SDR、尾部缓冲、预览和高清母版。

“这两句话意思重复，哪句表达更好”仍属于语义判断。当前策略会把它标记出来，交给人或 Codex 审核，不为了追求全自动而冒险误删。确认后的清单可以反复重渲染，不必重新上传或重新转写。
