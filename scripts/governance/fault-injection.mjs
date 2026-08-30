import {mkdir, rm, writeFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {checkEncoding, checkForbiddenCandidates} from "./source-checks.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function runSensitiveScan(root) {
  const python = process.platform === "win32" ? "python" : "python3";
  await new Promise((resolve, reject) => {
    const child = spawn(python, [path.join(repoRoot, "scripts/check_sensitive.py"), "--worktree-only", "--repo", root, "--json"], {cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], shell: false});
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 1 && stdout.includes("credential-assignment") ? resolve() : reject(new Error(`sensitive scan exit=${code}: ${stderr}`)));
  });
}

const fixture = path.join(os.tmpdir(), `ai-video-factory-gate-${process.pid}`);
await mkdir(fixture, {recursive: true});
try {
  await writeFile(path.join(fixture, "factory.ts.current"), "export const ok = true;\n");
  const candidateIssues = await checkForbiddenCandidates(fixture);
  if (!candidateIssues.some((issue) => issue.includes("factory.ts.current"))) throw new Error("Candidate-source injection was not detected.");

  await writeFile(path.join(fixture, "bad.md"), Buffer.from([0xc3, 0x28]));
  const encodingIssues = await checkEncoding(fixture);
  if (!encodingIssues.some((issue) => issue.includes("bad.md"))) throw new Error("Invalid UTF-8 injection was not detected.");

  const injectedSecret = `const API_${"KEY"} = "${"a".repeat(24)}";\n`;
  await writeFile(path.join(fixture, "secret.ts"), injectedSecret);
  await runSensitiveScan(fixture);

  console.log(JSON.stringify({candidate: Boolean(candidateIssues.length), encoding: Boolean(encodingIssues.length), security: true}));
} finally {
  await rm(fixture, {recursive: true, force: true});
}
