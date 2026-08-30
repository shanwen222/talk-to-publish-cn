# Talk to Publish · 从口播到成片

An open-source Codex skill for turning real Chinese talking-head footage into a publishable horizontal video. It combines Whisper-faithful captions, optional rough cutting, semantic motion design, HyperFrames/GSAP authoring, Remotion composition, and mobile-first human QA.

## Install once (single repository)

This repository contains both the Codex skill instructions and the local video runtime. Do not install a separate `AI-Video-Factory` copy.

```powershell
git clone https://github.com/shanwen222/talk-to-publish-cn.git "$env:CODEX_HOME\skills\talk-to-publish-cn"
Set-Location "$env:CODEX_HOME\skills\talk-to-publish-cn"
.\scripts\setup.ps1
```

The setup script installs/checks Node.js, FFmpeg, Python 3.12, Whisper, Remotion, HyperFrames, and Playwright Chromium. Run `.\scripts\doctor.ps1` before a production task; if it fails, fix the environment instead of falling back to a static or generic edit. See [ENVIRONMENT.md](ENVIRONMENT.md).

## Public-repository safety gate

Run the privacy scanner before publishing changes:

```powershell
npm run security:validate
python scripts/check_sensitive.py --staged
npm run security:install-hook
```

The scanner checks the worktree and all reachable Git history for secrets, private keys, personal paths, contact data, personal media, and suspicious screenshot/recording names. It prints redacted locations only. CI repeats the full-history check on every push and pull request.

Maintainers should run `npm run security:install-hook` once after cloning. It installs only this project's `hooks/pre-push` into `.git/hooks/pre-push`; an unknown existing hook is never overwritten unless `--force` is supplied. The installer does not commit `.git/hooks` or change a shared `core.hooksPath`.

Never use `git add .` or `git add -A` in this public repository. Stage only the exact files you intend to publish, then review `git diff --cached`. Keep personal footage, screenshots, transcripts, credentials, and local project outputs outside the repository. See [SECURITY.md](SECURITY.md).

Then invoke it explicitly with:

```text
$talk-to-publish-cn
```

## Design principles

- Audio is authoritative. A supplied script is reference material for resolving ASR uncertainty, not a replacement transcript.
- Information layers communicate structure, relationships, and a few key numbers; they do not repeat the whole narration.
- Process groups normally enter together and highlight the step named by the speech cue. Entrance and focus are separate states.
- Every right-side label, radar, or HUD element needs a semantic reason. Decorative rotation is not a reason.
- HyperFrames + GSAP owns deterministic visual motion; Remotion owns captions, audio, composition, and export.
- Approved sample rules must be regression-tested across every matching component in the full video.
- Keep the face, title, and caption safe areas clear, use translucent overlays, and inspect phone-size keyframes manually.

See [SKILL.md](SKILL.md) for the complete bilingual workflow and [references/](references/) for rough-cut, semantic-design, rendering, and regression QA details.
