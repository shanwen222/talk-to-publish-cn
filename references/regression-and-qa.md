# 全组件回归与人工视觉 QA / Regression and visual QA

## 回归矩阵 / Regression matrix

样片通过后，枚举全片每个 scene 和 flow-like structure：`step-box`、timeline node、`loop-box`、ladder stage、`big-choice` comparison 等。每组记录：

- scene 与全局时间范围；
- component/group ID；
- `dynamic-with-cues`、`static-by-design` 或 `structural-sequence`；
- entrance 行为与 cue-to-focus 映射；
- first、middle、final verification 时间；
- 状态与 evidence-frame 路径。

这张表是 gate，不是事后备注。样片里验证过的规则，只有在所有匹配组件都映射后才算迁移完成。

## 最低视觉 QA / Minimum visual QA

抽取全分辨率关键帧：

1. 第一场和第一条字幕；
2. 每个流程组的 all-visible 状态；
3. 每个动态组的 first/middle/final focus；
4. 每个场景转场和最后 10 秒；
5. 至少一张 390px 宽的手机缩略图。

人工检查：

- 字幕是否与真实口播一致；
- 手机上主标题、关键数字、当前高亮是否清楚；
- 人物亮度以及脸/嘴/标题/字幕安全区；
- 叠层是否通透而非实心遮挡；
- 右侧语义标签是否真的服务于当前内容；
- 是否出现过期 radar、scanner 或旋转装饰；
- 全局规则是否误只落在一个场景；
- 是否有裁切、黑帧、冻结画面或转场碰撞。

## 交付记录 / Delivery record

记录最终路径、时长、分辨率、帧率、编码、音频采样率、QA 帧路径和是否使用粗剪。更新项目进度、用户反馈、production lessons、事故记录和 source manifest。用户要求跳过样片时，记录决定，但不能跳过内部关键帧 QA。

## English summary

After sample approval, regress every matching flow group. Verify all-visible and first/middle/final focus states, transitions, captions, safe areas, semantic labels, transparency, and a phone-size thumbnail. Keep evidence paths in the delivery record.
