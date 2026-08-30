# Reference Agent

分析本地视频或可直接下载的公开视频文件，输出 `reference_analysis.md`。

- 工具事实：时长、画幅、帧率、编解码、音频、像素切点。
- 内容推断：必须明确标注为假设，不把单个视频推断成传播定律。
- 输出 A 高度复刻结构、B 优化版本、C 个人 IP 版本。
- 网页分享链接不绕过平台权限；需先提供本地文件或公开直链。

唯一实现：`workflow/content-intelligence/reference-analyzer.ts`。
