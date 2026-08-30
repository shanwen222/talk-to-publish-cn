import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {checkEncoding, checkForbiddenCandidates} from "./source-checks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const results = [];

async function record(name, action) {
  const startedAt = new Date().toISOString();
  try {
    await action();
    results.push({name, startedAt, endedAt: new Date().toISOString(), exitCode: 0});
  } catch (error) {
    results.push({name, startedAt, endedAt: new Date().toISOString(), exitCode: 1, error: error instanceof Error ? error.message : String(error)});
  }
}

async function command(file, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(file, args, {cwd: root, stdio: "inherit", shell: false});
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}`)));
  });
}

for (const [name, check] of [
  ["source-uniqueness", checkForbiddenCandidates],
  ["encoding", checkEncoding],
]) {
  await record(name, async () => {
    const issues = await check(root);
    if (issues.length) throw new Error(issues.join("; "));
  });
}
await record("security", () => command("python", ["scripts/check_sensitive.py", "--history"]));
await record("manifest", () => command(process.execPath, ["scripts/governance/check-manifest.mjs"]));
await record("types", () => command(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]));
await record("contracts", () => command(process.execPath, ["--import", "tsx", "--test", "tests/planners.test.ts", "tests/providers.test.ts", "tests/validation.test.ts", "tests/digital-human.test.ts"]));
await record("digital-human-isolation", () => command(process.execPath, ["scripts/governance/check-digital-human-isolation.mjs"]));
await record("fault-injection", () => command(process.execPath, ["scripts/governance/fault-injection.mjs"]));
await record("browser", () => command(process.execPath, ["node_modules/playwright/cli.js", "test"]));
await record("final-artifact", () => command(process.execPath, ["scripts/governance/check-final.mjs"]));
await record("lease-state", async () => {
  const {readdir, readFile} = await import("node:fs/promises");
  const leaseRoots = [path.join(root, ".governance/leases"), path.join(root, ".governance/project-leases")];
  const active = [];
  for (const leaseRoot of leaseRoots) {
    let files = [];
    try { files = await readdir(leaseRoot, {withFileTypes: true}); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    for (const file of files.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
      const lease = JSON.parse((await readFile(path.join(leaseRoot, file.name), "utf8")).replace(/^\uFEFF/, ""));
      if (lease.active) active.push(lease.taskId ?? file.name);
    }
  }
  if (active.length) throw new Error(`Active leases remain: ${active.join(", ")}`);
});

await mkdir(path.join(root, "output"), {recursive: true});
await writeFile(path.join(root, "output/gate-summary.json"), `${JSON.stringify({generatedAt: new Date().toISOString(), results}, null, 2)}\n`);
for (const result of results) console.log(`${result.exitCode === 0 ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`);
if (results.some((result) => result.exitCode !== 0)) process.exit(1);
