# 贡献指南 / Contributing

欢迎改进这个工作流。贡献应让流程更可复现、语义更清楚，或更适合手机观看。

提交 pull request 前请确认：

1. 保持“真实口播优先、参考文案只用于核对”的边界。
2. 不加入个人视频、截图、凭据、本机绝对路径或未授权字体。
3. 修改动效规则时，分别写清 `entrance` 与 `focus`，并同步更新回归指引。
4. 运行 `python scripts/validate_skill.py`。
5. 运行 `npm ci`、`npm run build` 和 `npm test` 验证合并后的运行时。
6. 优先更新对应 reference 文件，不要在多处复制同一条规则。
7. 提交前运行 `python scripts/check_sensitive.py --staged` 和 `npm run security:validate`；只暂存明确文件，禁止 `git add .` / `git add -A`。

请在 PR 中说明：用户问题、改动的工作流规则、验证方法。

## English

Contributions should improve reproducibility, semantic clarity, or mobile safety. Keep audio authority and reference-script boundaries intact, avoid personal assets and secrets, separate entrance from focus, update regression guidance, and run the validator before opening a pull request.
