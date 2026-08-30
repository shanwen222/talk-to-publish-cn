import {spawn} from "node:child_process";
import {existsSync, readdirSync} from "node:fs";
import path from "node:path";

export function resolveTool(command: string, wingetPackagePrefix?: string): string {
  if (process.platform !== "win32") return command;
  const executable = command.endsWith(".exe") || command.endsWith(".cmd") ? command : `${command}.exe`;
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, executable);
    if (existsSync(candidate)) return candidate;
  }
  if (wingetPackagePrefix && process.env.LOCALAPPDATA) {
    const packagesRoot = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages");
    const packageDirectory = readdirSync(packagesRoot, {withFileTypes: true})
      .find((entry) => entry.isDirectory() && entry.name.startsWith(wingetPackagePrefix));
    if (packageDirectory) {
      const root = path.join(packagesRoot, packageDirectory.name);
      const match = readdirSync(root, {recursive: true, withFileTypes: true})
        .find((entry) => entry.isFile() && entry.name.toLowerCase() === executable.toLowerCase());
      if (match) return path.join(match.parentPath, match.name);
    }
  }
  return command;
}

export async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: "inherit", shell: false});
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

export async function capture(command: string, args: string[], cwd: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {cwd, shell: false});
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", (chunk) => stderr += chunk);
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`)));
  });
}
