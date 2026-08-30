# 从口播到成片 · Talk to Publish

[![Runtime gate](https://github.com/shanwen222/talk-to-publish-cn/actions/workflows/runtime.yml/badge.svg)](https://github.com/shanwen222/talk-to-publish-cn/actions/workflows/runtime.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个面向 Codex 的中文口播视频生产 Skill：把一段真实口播，变成有字幕、有节奏、有语义动效、手机上看得清的可发布成片。

它不是“套一套固定模板”，也不是“把整段文案塞进信息栏”。它做的是：先听懂你真正说了什么，再决定这一段应该用流程、数字、对比、证据、时间线还是一句悬浮提示来表达。

> **一句话理解**：让声音负责讲清楚，让画面负责把结构讲明白。

> **单仓库说明**：Skill 指令和视频生产运行时已经合并在本仓库。不要再分别安装 `talk-to-publish-cn` 和 `AI-Video-Factory`；从 GitHub 获取这一份仓库，运行一次安装脚本即可。

## 小白安装：复制后直接用

第一版一键路径面向 Windows + PowerShell。建议把仓库直接放到 Codex 的 Skill 目录，这样 Codex 读取的指令和实际执行的代码就是同一份文件：

```powershell
$codexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$skillDir = Join-Path $codexRoot "skills\talk-to-publish-cn"
New-Item -ItemType Directory -Force -Path (Split-Path $skillDir) | Out-Null
git clone https://github.com/shanwen222/talk-to-publish-cn.git $skillDir
Set-Location $skillDir
.\scripts\setup.ps1
```

安装脚本会自动安装/检查 Node.js、FFmpeg、Python 3.12、Whisper、Remotion、HyperFrames 和 Playwright Chromium。第一次安装和第一次下载 Whisper 模型可能需要较长时间，这是正常的。

### 两层依赖：核心引擎必需，宿主指导可选

正式执行时，Skill 会先运行 `.\scripts\doctor.ps1`。仓库内锁定的
HyperFrames/GSAP 和 Remotion 是核心执行引擎，和 FFmpeg、Whisper、Chromium 一样
属于必需运行时，缺失时 doctor 会阻断任务。它们已经由 `setup.ps1` 安装，不要求
用户手动下载或维护第二套运行时。

另外，Codex 宿主可能提供同名的远程操作指导 Skill。宿主有这些能力时，可以额外加载
`hyperframes:hyperframes`、`hyperframes:gsap`、
`remotion:remotion-best-practices`、`remotion:remotion-markup`、
`remotion:remotion-render`、`remotion:remotion-captions` 来获得更详细的操作提示，
但它们只是指导层，不是本地引擎，也不是本仓库正常运行的安装前置。

只有本地 doctor 失败才会返回 `blocked_by_dependencies` 并停止，不会偷偷退化成
静态字幕、手工时间线或简化版成片。只做粗剪/转写时不加载未使用的视觉能力，但
仍必须通过 doctor。

完整依赖、来源、锁定版本和验证方式见
[`references/dependencies.json`](references/dependencies.json)。系统运行时由
`setup.ps1` 自动准备；不复制第二份插件或 Skill。

不熟悉 PowerShell 时，也可以在解压后的仓库目录双击 `setup.cmd`；检查环境时双击 `doctor.cmd`。GitHub 网页下载 ZIP 也可以，关键是必须保留整个仓库目录，不能只拿 `SKILL.md`。

如果电脑没有 `CODEX_HOME`，上面的命令会自动使用用户目录下的 `.codex\skills`；也可以把仓库克隆到任意目录，然后在该目录执行 `setup.ps1`，在 Codex 中用 `$talk-to-publish-cn` 显式调用。不要只复制 `SKILL.md`，也不要再维护一份单独的 `AI-Video-Factory`。

安装结束必须看到：

```text
环境检查通过：可以让 Codex 使用本仓库的 Skill 和视频运行时。
```

如果检查失败，不要开始剪辑，重新运行：

```powershell
.\scripts\setup.ps1
```

完整环境说明见 [ENVIRONMENT.md](ENVIRONMENT.md)。

## 公开仓库安全门禁

这个仓库会被公开克隆，安全扫描是正常工作流的一部分，不是出问题后的补救：

```powershell
# 扫描工作区、未忽略文件和全部 Git 历史
npm run security:validate

# 只检查当前暂存区（提交前快速检查）
python scripts/check_sensitive.py --staged

# 维护者首次 clone 后手动安装到当前项目的 .git/hooks/pre-push
npm run security:install-hook
```

扫描会拦截密钥、令牌、私钥、个人路径、常见联系方式、个人素材文件、PNG/JPEG/GIF/PDF/ZIP/RIFF/ICO 等二进制头、嵌入式图片和超大文件，并且只输出 `source/path/rule/commit`，不打印秘密原文。GitHub Actions 会在 push 和 pull request 上再次扫描完整历史。

安装器默认不会覆盖已有的未知 `.git/hooks/pre-push`；确认旧 hook 后确实需要替换时，才显式运行 `python scripts/install_pre_push_hook.py --force`。安装脚本不会把 `.git/hooks/pre-push` 加入提交，也不会修改共享的 `core.hooksPath`。

提交时严禁使用 `git add .` 或 `git add -A`。请只暂存本次明确要提交的文件，例如：

```powershell
git add -- README.md SKILL.md scripts/check_sensitive.py
git diff --cached
```

视频、截图、原始转写和本机项目产物应留在仓库外；如果确有授权的通用资产，也要先确认许可证和手机端展示需求。发现误提交时，先撤销/轮换凭据，再按 [SECURITY.md](SECURITY.md) 处理历史清理。

## 为什么需要它？

普通的 AI 剪辑很容易出现几个问题：

- 把用户给的参考文案误当成逐字稿，字幕和真实口播对不上；
- 信息栏堆满小字，电脑勉强能看，手机完全读不清；
- 流程框一次性全部跳出，或者无视口播节奏乱做 stagger；
- 右侧放一个没有意义的雷达、扫描线或旋转 HUD；
- 样片里改对了，完整版其他同类组件却没有同步；
- 技术 lint 通过了，但人物被挡脸、素材太暗、关键数字看不见。

Talk to Publish 把这些经验固化成一套可回归的生产流程：真实音频优先、语义设计先行、动效状态分离、全组件回归、手机端人工 QA。

## 它能做什么？

### 从真实口播开始

用 Whisper 识别真实 A-roll，保存原始 transcript 和修订理由。参考文案只用于核对人名、数字、产品名和低置信度片段，不能直接替换整段口播。

### 让画面表达结构，而不是复述台词

根据语义选择视觉结构：

| 口播内容 | 适合的画面表达 |
|---|---|
| “第一步、第二步、第三步” | 流程框、节点、阶段高亮 |
| “从 300 到 500、收入破万” | 大数字、增长线、简洁对比 |
| “以前 vs 现在” | 前后对照或左右分栏 |
| “这是一个证据” | 放大的截图、局部重点、手绘圈选 |
| “问题有三个” | 先出现结构，再按口播高亮当前项 |
| “最后评论区见” | 简短 CTA，不堆整段文案 |

### 让动效跟着说话走

流程图的默认规则不是“框一个个生成”，而是：

1. 流程结构整体进入画面；
2. 口播说到某一步时，对应框高亮；
3. 其他框保持可见但降低强调；
4. 下一句开始时，焦点自然切换。

这样观众能同时看到全局结构，又知道当前讲到哪里。`entrance`（入场）和 `focus`（口播高亮）在代码和 QA 中严格分离。

### 用 HyperFrames + GSAP 做动效，用 Remotion 做成片

- **HyperFrames + GSAP**：版式、流程图、数字、进度条、语义侧标和确定性动效；
- **Remotion**：合成视觉轨、原始音频、Whisper 字幕并导出；
- **FFmpeg / ffprobe**：媒体探测、可选粗剪、抽帧和规格核验；
- **人工视觉 QA**：检查手机可读性、透明度、人物安全区和全片一致性。

## 快速开始 / Quick start

### 1. 在 Codex 中调用

显式调用：

```text
$talk-to-publish-cn
```

自然语言也可以触发，例如：

```text
用“从口播到成片”把这个中文口播做成横屏视频。
先识别真实口播，不要直接照抄我给的参考文案。
信息栏只放结构和关键数字，流程框一起出现，口播说到哪一步就高亮哪一步。
先做 20 秒样片，确认后再出完整版。
```

### 2. 给它什么输入？

推荐一次性提供：

```text
源视频：C:\\path\\to\\talking-head.mp4
参考文案：C:\\path\\to\\reference.txt（只能用于核对，不是逐字稿）
截图/产品素材：C:\\path\\to\\asset-01.png
输出要求：16:9、1920×1080、30fps；先出 20 秒样片
视觉偏好：科技感、人物保持明亮、信息栏少字、手机可读
```

没有参考文案也可以直接做；没有截图也可以只做语义动效。

## 标准生产流程 / Production workflow

```text
真实口播
   ↓
Whisper 转写 + 参考文案核对
   ↓
可选粗剪（只剪明确的空白/重复/填充）
   ↓
逐段语义设计表 DESIGN.md
   ↓
HyperFrames / GSAP 视觉与动效
   ↓
5–30 秒样片 + 关键帧 QA
   ↓
全组件回归：所有流程组都要同步规则
   ↓
Remotion 合成字幕、音频与视觉轨
   ↓
人工视觉 QA + ffprobe 规格核验
   ↓
可发布成片
```

### 阶段 A：识别真实口播

必须保留：

- raw Whisper JSON/SRT/TSV/VTT/TXT；
- 实际用于 Remotion 的 accepted captions；
- `caption-corrections.json`；
- `caption-fidelity-report.md`。

每一处修订都要能回答：这是听到了什么，还是仅仅参考了文案？如果音频无法支持修订，就标记为 `review`，不擅自改成参考文案。

### 阶段 B：决定是否粗剪

粗剪不是默认步骤。只有明确需要时才处理死空气、重复句、填充词或不需要的尾巴。用户要求保留原录音时，记录：

```text
rough-cut: skipped (user/source decision)
```

一旦粗剪，必须重新转写，或保存经过验证的源时间线到粗剪时间线映射。

### 阶段 C：写语义设计表

每个片段至少写清：

- 真实 Whisper 时间区间；
- 这一段口播的一个核心意思；
- 选择流程/数字/对比/证据/CTA 等结构的原因；
- 哪些元素一起入场；
- 哪个 spoken cue 触发高亮；
- 什么时候保持、更新或退出；
- 脸、标题、字幕需要留出的安全区；
- 390px 手机缩略图上必须看清什么。

### 阶段 D：先做样片，再迁移全片

样片至少要覆盖一个复杂流程组、一次字幕 cue、一个语义侧标和一次人物安全检查。样片通过后，不代表工作结束：必须在全片盘点所有相同类型的流程框、数字卡、对比组和侧栏，并建立回归矩阵。

### 阶段 E：人工视觉 QA

不能只看 lint/check 是否通过。至少检查：

- 手机上主标题、关键数字和当前高亮是否读得清；
- 人物脸、嘴、标题、字幕是否被长期遮挡；
- 素材是否足够大、透明度是否合适、重点是否可见；
- 右侧元素是否服务当前口播，而不是无意义地旋转；
- 进度条、流程高亮和字幕是否与真实时间线一致；
- 是否出现黑帧、冻结画面、裁切、转场碰撞或只改对一处的局部规则。

## 项目产物 / Expected artifacts

本仓库本身就是可复现的 Skill + Runtime，核心目录如下：

```text
talk-to-publish-cn/
├─ SKILL.md                       # Codex 实际执行的工作指令
├─ package.json                   # 锁定的 JS 运行时依赖
├─ workflow/                      # 视频生产 CLI 与编排
├─ remotion/                      # 最终合成层
├─ ffmpeg/                        # FFmpeg 后处理入口
├─ scripts/setup.ps1              # 一键安装
├─ scripts/doctor.ps1             # 一键环境检查
├─ scripts/whisper.ps1            # 本地真实口播转写
├─ skills/                        # 内容编排所需的辅助规则
├─ references/                    # Skill 的详细规范
└─ projects/                      # 你的项目产物（默认不提交）
```

## 常用命令 / Useful commands

```powershell
# 环境检查
.\scripts\doctor.ps1

# 重新安装或修复环境
.\scripts\setup.ps1
```

### 校验这个 Skill

```powershell
python scripts/validate_skill.py
npm run security:validate
```

### HyperFrames

```powershell
npx hyperframes lint
npx hyperframes check --no-contrast
npx hyperframes check --json --samples 12
npx hyperframes render . -o output/visual-full.mp4 --quality high --resolution landscape --crf 18 --workers 4 --strict-all
```

### Remotion 与媒体规格

```powershell
npm run build
npx remotion compositions remotion/src/index.ts
npx remotion render remotion/src/index.ts <CompositionId> output/final.mp4 --codec h264 --crf 18 --concurrency 4
ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate -of json output/final.mp4
```

命令会因项目运行时版本略有差异；以项目现有脚本和当前 CLI 的 `--help` 为准。

## 常见问题 / Troubleshooting

### Codex 没有自动识别 Skill

先用 `$talk-to-publish-cn` 显式调用，并确认 Skill 文件夹名正好是 `talk-to-publish-cn`，内部存在 `SKILL.md` 和 `agents/openai.yaml`。

### 字幕和口播不一致

检查是否误把参考文案当成逐字稿。回到 raw Whisper transcript，逐句听音；参考文案只能修正低置信度词，不得覆盖真实时间线。

### 流程框全部一起出现，但没有跟着讲解高亮

检查 scene data 是否声明了 `dynamic-with-cues`，并确认 `focus` cue 绑定的是 Whisper 时间，而不是只绑定了入场动画。

### 样片改好了，完整版只有一处有效

说明没有做 full-component regression。盘点全片所有同类组件，为每组保存 all-visible、first-focus、middle-focus、final-focus 关键帧。

### 信息栏在手机上看不清

删掉解释性小字，只保留一个主标题、一个副标题和必要的关键数字；增大字号、增加留白，素材优先保证核心内容可读。

### 人物被遮挡或右侧元素没有意义

重新检查 face/title/caption safe area 和当前语义。侧栏、雷达或 HUD 只有在表达真实关系、状态或数据时才保留。

### 朋友安装后效果很差

通常是只复制了 `SKILL.md`，没有安装同一仓库里的运行时依赖。请让对方从 GitHub 克隆完整仓库，在仓库根目录运行 `.\scripts\setup.ps1`，并确认 `.\scripts\doctor.ps1` 通过后再开始任务。环境未通过时，Codex 不应继续生成视频。

## 参考文档 / References

- [SKILL.md](SKILL.md)：Codex 实际执行的核心流程与硬性规则
- [semantic-design.md](references/semantic-design.md)：字幕证据链、scene table、流程组契约
- [rough-cut.md](references/rough-cut.md)：可选粗剪与时间戳重映射
- [rendering.md](references/rendering.md)：HyperFrames/GSAP 与 Remotion 的分工和命令
- [regression-and-qa.md](references/regression-and-qa.md)：全组件回归、关键帧与手机端人工 QA
- [README.en.md](README.en.md)：English README

## 参与贡献 / Contributing

欢迎提交 Issue 或 Pull Request。请说明：

1. 你遇到的用户问题；
2. 需要新增或修改的工作流规则；
3. 如何验证没有引入新的字幕、动效或手机可读性回归。

提交前运行：

```powershell
python scripts/validate_skill.py
```

不要提交个人视频、截图、转写稿、密钥、Cookie、access token、本机绝对路径或未授权字体。详见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [SECURITY.md](SECURITY.md)。

## 许可证 / License

MIT，详见 [LICENSE](LICENSE)。
