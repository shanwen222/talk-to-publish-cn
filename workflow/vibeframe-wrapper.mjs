import {spawn} from "node:child_process";
import {existsSync, readdirSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pathEntries = [path.join(root, "node_modules", ".bin")];
let chromeExecutablePath;
if (process.platform === "win32" && process.env.LOCALAPPDATA) {
  const packagesRoot = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages");
  if (existsSync(packagesRoot)) {
    const ffmpegPackage = readdirSync(packagesRoot, {withFileTypes: true})
      .find((entry) => entry.isDirectory() && entry.name.startsWith("Gyan.FFmpeg_"));
    if (ffmpegPackage) {
      const ffmpegRoot = path.join(packagesRoot, ffmpegPackage.name);
      const executable = readdirSync(ffmpegRoot, {recursive: true, withFileTypes: true})
        .find((entry) => entry.isFile() && entry.name.toLowerCase() === "ffmpeg.exe");
      if (executable) pathEntries.push(executable.parentPath);
    }
  }
  for (const chromeDirectory of [
    "C:\\Program Files\\Google\\Chrome\\Application",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application",
  ]) {
    const chromeExecutable = path.join(chromeDirectory, "chrome.exe");
    if (existsSync(chromeExecutable)) {
      pathEntries.push(chromeDirectory);
      chromeExecutablePath = chromeExecutable;
    }
  }
  const gitUnixTools = "C:\\Program Files\\Git\\usr\\bin";
  if (existsSync(path.join(gitUnixTools, "which.exe"))) pathEntries.push(gitUnixTools);
}
pathEntries.push(process.env.PATH ?? "");
const childEnvironment = {...process.env};
for (const key of Object.keys(childEnvironment)) {
  if (key.toLowerCase() === "path") delete childEnvironment[key];
}
childEnvironment.PATH = pathEntries.join(path.delimiter);
if (chromeExecutablePath) childEnvironment.CHROME_PATH = chromeExecutablePath;

const entry = path.join(root, "workflow", "vibeframe-runtime", "node_modules", "@vibeframe", "cli", "dist", "index.js");
const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  shell: false,
  env: childEnvironment,
});
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
