# 安全说明 / Security

不要提交 API key、Cookie、access token、私人素材、个人转写稿或本机路径。凭据应放在仓库之外的环境变量中。

## 提交前检查

仓库内置标准库实现的扫描器，不依赖 npm：

```powershell
python scripts/check_sensitive.py --staged
npm run security:validate
```

`security:validate` 会检查当前工作区和所有本地 Git ref 可达的历史 blob。`setup.ps1` 或 `npm run security:install-hook` 会启用 `.githooks/pre-push`；GitHub Actions 也会在 push / pull request 时执行同一套全历史检查。扫描结果会隐藏匹配值，只显示文件和行号。

严禁使用 `git add .` / `git add -A`。只暂存明确的源文件，并在提交前检查 `git diff --cached`。视频、截图、原始转写、项目产物和本机路径默认不属于公开运行时。

## 误提交处理

1. 立即撤销或轮换已经暴露的密钥；不要把秘密贴到 issue 或聊天记录。
2. 从当前树移除文件，并运行 `npm run security:validate`。
3. 如果秘密曾进入历史，暂停推送并联系维护者进行历史重写；仅删除当前文件不足以保护已泄露的凭据。

如果误提交了秘密或个人资产：先撤销/轮换凭据，再私下联系维护者；不要把仍有效的秘密贴到公开 issue。

## English

Do not commit API keys, cookies, access tokens, private media, personal transcripts, or local machine paths. Keep credentials outside the repository. If a secret is exposed, revoke it first and contact the maintainer privately.

The repository includes a dependency-free scanner (`scripts/check_sensitive.py`), a full-history validator, a versioned pre-push hook, and CI checks. Stage explicit files only; never use `git add .` or `git add -A`.
