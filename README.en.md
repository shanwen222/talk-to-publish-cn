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
