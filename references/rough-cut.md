# 可选粗剪 / Optional rough-cut stage

粗剪是流程中的可选阶段，即使本期不使用也要保留记录。只有用户明确希望去掉明显空白、重复句、口头填充或不需要的尾巴时才剪；不要为了凑时长擅自缩短口播。

## 适用条件 / When to use

- 可以自动处理：确定的静音、确定的口头填充词、明显重复且不会改变含义的片段。
- 需要人工听完整句：重复观点、语义边界不清、可能删掉关键字的片段。
- 原始 A-roll 永远保留；粗剪输出放在项目独立目录。

## 安全顺序 / Safe sequence

1. 保留原始视频，建立 project-local proxy/output 目录。
2. 通过项目 `.venv` 的 Whisper 入口转写，先保存 raw transcript。
3. 从 word/segment 时间戳生成 `cut-list.json`；每个非平凡剪切写明理由。
4. 用项目 FFmpeg/local-rough-cut 入口执行，不要另造第二套时间线。
5. 粗剪后重新 Whisper；或者保存经过验证的 source→cut 时间戳映射。禁止把源视频字幕时间戳直接套到粗剪视频。
6. 检查辅音是否被切断、呼吸是否突兀、黑帧/冻结帧、音频断裂和语义变化。

## 何时跳过 / When to skip

用户要求保留录音、停顿属于表达的一部分，或源视频已经是干净的发布长度时跳过。项目进度中写：`rough-cut: skipped (user/source decision)`。

## 必备产物 / Required artifacts

- `transcript/raw.*`
- 发生剪切时的 `cut-list.json`
- `rough-cut.mp4` 或项目等价输出
- 每个非平凡剪切的安全理由
- 粗剪后的新 transcript 或经验证的时间戳 remap
