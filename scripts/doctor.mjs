import {existsSync, readdirSync} from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const failures = [];

function firstLine(value) {
  return String(value ?? "").trim().split(/\r?\n/)[0] || "unknown";
}

function run(command, args = []) {
  const result = spawnSync(command, args, {cwd: root, encoding: "utf8", windowsHide: true});
  if (result.error || result.status !== 0) return {ok: false, output: result.error?.message ?? result.stderr ?? "command failed"};
  return {ok: true, output: `${result.stdout ?? ""}${result.stderr ?? ""}`};
}

function findOnPath(name) {
  const executable = isWindows && !name.endsWith(".exe") && !name.endsWith(".cmd") ? `${name}.exe` : name;
  for (const entry of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(entry, executable);
    if (existsSync(candidate)) return candidate;
  }
  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const packages = path.join(localAppData, "Microsoft", "WinGet", "Packages");
      if (existsSync(packages)) {
        for (const entry of readdirSync(packages, {withFileTypes: true})) {
          if (!entry.isDirectory() || !entry.name.startsWith("Gyan.FFmpeg_")) continue;
          const base = path.join(packages, entry.name);
          const stack = [base];
          while (stack.length) {
            const current = stack.pop();
            for (const child of readdirSync(current, {withFileTypes: true})) {
              const childPath = path.join(current, child.name);
              if (child.isDirectory()) stack.push(childPath);
              else if (child.name.toLowerCase() === executable.toLowerCase()) return childPath;
            }
          }
        }
      }
    }
  }
  return null;
}

function check(label, ok, detail, required = true) {
  const status = ok ? "OK  " : required ? "FAIL" : "WARN";
  console.log(`${status} ${label}: ${detail}`);
  if (!ok && required) failures.push(label);
}

const node = run(process.execPath, ["--version"]);
const nodeMajor = Number(firstLine(node.output).replace(/^v/, "").split(".")[0]);
check("Node.js", node.ok && Number.isInteger(nodeMajor) && nodeMajor >= 22, firstLine(node.output) + (nodeMajor < 22 ? " (需要 >=22)" : ""));

const packageJson = path.join(root, "package.json");
check("npm dependencies", existsSync(path.join(root, "node_modules")) && existsSync(path.join(root, "node_modules", "tsx")), "node_modules 已安装");
check("Remotion", existsSync(path.join(root, "node_modules", "@remotion", "cli", "remotion-cli.js")), "@remotion/cli 已安装");
check("HyperFrames", existsSync(path.join(root, "node_modules", "hyperframes", "bin", "hyperframes.mjs")), "hyperframes 已安装");
check("Playwright", existsSync(path.join(root, "node_modules", "playwright", "cli.js")), "playwright 已安装");

const ffmpeg = findOnPath("ffmpeg");
const ffprobe = findOnPath("ffprobe");
check("FFmpeg", Boolean(ffmpeg), ffmpeg ?? "未找到 ffmpeg.exe");
check("ffprobe", Boolean(ffprobe), ffprobe ?? "未找到 ffprobe.exe");

const whisper = path.join(root, ".venv", "Scripts", "whisper.exe");
const venvPython = path.join(root, ".venv", "Scripts", "python.exe");
const pythonVersion = existsSync(venvPython) ? run(venvPython, ["--version"]) : {ok: false, output: ""};
check("Python venv", pythonVersion.ok && /Python 3\.12\./.test(pythonVersion.output), firstLine(pythonVersion.output) || "未找到 Python 3.12 虚拟环境");
check("Whisper", existsSync(whisper), existsSync(whisper) ? whisper : "未找到 .venv\\Scripts\\whisper.exe");

const chromium = run(process.execPath, [
  "--input-type=module",
  "-e",
  "import {chromium} from 'playwright'; const browser = await chromium.launch({headless: true}); await browser.close();",
]);
check("Chromium", chromium.ok, chromium.ok ? "Playwright Chromium 可启动" : "请重新运行 setup.ps1 安装 Chromium");

const vibeFrame = existsSync(path.join(root, "workflow", "vibeframe-runtime", "node_modules", "@vibeframe", "cli", "dist", "index.js"));
check("VibeFrame", vibeFrame, vibeFrame ? "已安装" : "未安装（普通本地口播剪辑可选）", false);

if (failures.length) {
  console.error(`\n环境未就绪：${failures.join(", ")}`);
  console.error("请在仓库根目录重新运行 .\\scripts\\setup.ps1；不要在环境未就绪时开始剪辑。\n");
  process.exitCode = 1;
} else {
  console.log("\n环境检查通过：可以让 Codex 使用本仓库的 Skill 和视频运行时。\n");
}
