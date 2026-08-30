import type {CaptionCue, DigitalHumanConfig} from "../../workflow/digital-human/types.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function digitalHumanComposition(input: {
  title: string;
  durationSeconds: number;
  config: DigitalHumanConfig;
  cues: CaptionCue[];
}): string {
  const portrait = input.config.aspectRatio === "9:16";
  const [width, height] = portrait ? [1080, 1920] : [1920, 1080];
  const captions = input.cues.map((cue) => `
    <div id="caption-${cue.id}" class="clip caption" data-start="${cue.startSeconds.toFixed(3)}" data-duration="${(cue.endSeconds - cue.startSeconds).toFixed(3)}" data-track-index="2">
      <span>${escapeHtml(cue.text)}</span>
    </div>`).join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @font-face{font-family:"Microsoft YaHei";src:local("Microsoft YaHei")}
    *{box-sizing:border-box}html,body{margin:0;background:#05070d;overflow:hidden;font-family:"Microsoft YaHei",sans-serif}
    #stage{position:relative;overflow:hidden;background:linear-gradient(145deg,#07101f,#05070d)}
    .avatar{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .vignette{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.10),transparent 52%,rgba(0,0,0,.55));pointer-events:none}
    .brand{position:absolute;left:54px;top:58px;color:#fff;font-size:26px;font-weight:700;letter-spacing:.12em;text-shadow:0 2px 18px #000}
    .caption{position:absolute;left:6%;right:6%;bottom:11%;display:flex;justify-content:center;text-align:center;color:#fff;font-size:${portrait ? 54 : 46}px;font-weight:800;line-height:1.32;letter-spacing:.02em;text-shadow:0 4px 18px rgba(0,0,0,.9)}
    .caption span{display:inline;padding:.18em .42em;background:linear-gradient(90deg,rgba(5,8,16,.72),rgba(14,32,56,.72));border:1px solid rgba(93,218,255,.5);border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);animation:caption-pop .28s cubic-bezier(.2,.8,.2,1) both}
    @keyframes caption-pop{from{opacity:0;transform:translateY(28px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
  </style>
</head>
<body>
  <div id="stage" data-composition-id="digital-human" data-no-timeline data-start="0" data-duration="${input.durationSeconds.toFixed(3)}" data-width="${width}" data-height="${height}">
    <video id="avatar-video" class="clip avatar" data-start="0" data-duration="${input.durationSeconds.toFixed(3)}" data-track-index="0" data-has-audio="true" src="assets/avatar.mp4" playsinline></video>
    <div id="vignette" class="clip vignette" data-start="0" data-duration="${input.durationSeconds.toFixed(3)}" data-track-index="1"></div>
    <div id="brand-title" class="clip brand" data-start="0" data-duration="${input.durationSeconds.toFixed(3)}" data-track-index="3">${escapeHtml(input.title)}</div>
    ${captions}
  </div>
</body>
</html>`;
}
