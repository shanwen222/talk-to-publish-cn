# 当前项目工作记录 / Work Progress

## 2026-08-30：发布安全闸门

- 范围：仅 `talk-to-publish-cn`；不包含封面 Skill 或其他项目。
- 状态：已接入统一 `scripts/check_sensitive.py`，支持工作区、完整历史和 pre-push 提交范围扫描。
- Hook：维护者手动运行 `npm run security:install-hook`，安装到当前项目 `.git/hooks/pre-push`；未知 hook 默认不覆盖。
- CI：两个 GitHub Actions 使用完整历史 checkout，并在构建/Skill 校验前调用同一份扫描器。
- 约束：扫描命中只报告 `source/path/rule/commit`；不输出敏感值，不删除或重写历史。
- 验证：原有 `npm run gate`、43 项测试、`gate:faults`、工作区/暂存区/完整历史扫描和本地 hook 均通过；远端 Actions 在推送后确认。
