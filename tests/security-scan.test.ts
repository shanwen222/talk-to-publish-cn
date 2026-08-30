import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scannerPath = path.join(projectRoot, "scripts", "check_sensitive.py");
const installerPath = path.join(projectRoot, "scripts", "install_pre_push_hook.py");
const hookSource = path.join(projectRoot, "hooks", "pre-push");

type CommandResult = {status: number; stdout: string; stderr: string};

function runPython(args: string[], input = ""): CommandResult {
  try {
    const stdout = execFileSync("python", [scannerPath, ...args], {
      cwd: projectRoot,
      encoding: "utf8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {status: 0, stdout, stderr: ""};
  } catch (error) {
    const failure = error as {status?: number; stdout?: Buffer | string; stderr?: Buffer | string};
    return {
      status: failure.status ?? 2,
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? ""),
    };
  }
}

function runInstaller(args: string[]): CommandResult {
  try {
    const stdout = execFileSync("python", [installerPath, ...args], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {status: 0, stdout, stderr: ""};
  } catch (error) {
    const failure = error as {status?: number; stdout?: Buffer | string; stderr?: Buffer | string};
    return {
      status: failure.status ?? 2,
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? ""),
    };
  }
}

function git(repo: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "security-test",
      GIT_AUTHOR_EMAIL: "security-test@example.invalid",
      GIT_COMMITTER_NAME: "security-test",
      GIT_COMMITTER_EMAIL: "security-test@example.invalid",
    },
  }).trim();
}

async function tempRepository(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "talk-to-publish-security-"));
  git(repo, ["init", "--quiet"]);
  return repo;
}

function pngHeader(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
}

test("clean repository scan passes without a finding", async () => {
  const repo = await tempRepository();
  try {
    const result = runPython(["--worktree-only", "--repo", repo, "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), []);
  } finally {
    await rm(repo, {recursive: true, force: true});
  }
});

test("image magic headers are detected even when the extension is hidden", async () => {
  const repo = await tempRepository();
  try {
    await writeFile(path.join(repo, "asset.dat"), pngHeader());
    const result = runPython(["--worktree-only", "--repo", repo, "--json"]);
    assert.equal(result.status, 1);
    const findings = JSON.parse(result.stdout) as Array<{rule: string; path: string}>;
    assert.ok(findings.some((item) => item.rule === "png-header" && item.path === "asset.dat"));
  } finally {
    await rm(repo, {recursive: true, force: true});
  }
});

test("mixed binary content still detects a credential without echoing it", async () => {
  const repo = await tempRepository();
  const token = ["sk-", "abcdefghijklmnopqrstuvwxyz", "123456"].join("");
  try {
    await writeFile(path.join(repo, "mixed.bin"), Buffer.concat([Buffer.from([0, 255, 1]), Buffer.from(token), Buffer.from([0]) ]));
    const result = runPython(["--worktree-only", "--repo", repo, "--json"]);
    assert.equal(result.status, 1);
    const findings = JSON.parse(result.stdout) as Array<{rule: string}>;
    assert.ok(findings.some((item) => item.rule === "openai-token"));
    assert.ok(findings.some((item) => item.rule === "nul-byte-binary"));
    assert.ok(findings.some((item) => item.rule === "non-utf8-binary"));
    assert.equal(result.stdout.includes(token), false);
  } finally {
    await rm(repo, {recursive: true, force: true});
  }
});

test("email, phone, and credentials are reported by rule only", async () => {
  const repo = await tempRepository();
  const email = ["person", "@", "not-example", ".test"].join("");
  const phone = ["138", "0011", "2233"].join("");
  const token = ["ghp_", "abcdefghijklmnopqrstuvwxyz", "123456"].join("");
  try {
    await writeFile(path.join(repo, "notes.txt"), `${email}\n${phone}\n${token}\n`);
    const result = runPython(["--worktree-only", "--repo", repo, "--json"]);
    assert.equal(result.status, 1);
    const findings = JSON.parse(result.stdout) as Array<{rule: string; path: string; source: string; commit: string}>;
    assert.ok(findings.some((item) => item.rule === "email-address"));
    assert.ok(findings.some((item) => item.rule === "phone-number"));
    assert.ok(findings.some((item) => item.rule === "github-token"));
    assert.ok(findings.every((item) => item.path === "notes.txt" && item.source === "worktree" && item.commit === "WORKTREE"));
    assert.equal(result.stdout.includes(email), false);
    assert.equal(result.stdout.includes(phone), false);
    assert.equal(result.stdout.includes(token), false);
  } finally {
    await rm(repo, {recursive: true, force: true});
  }
});

test("deleted historical media and credentials remain detectable", async () => {
  const repo = await tempRepository();
  const token = ["sk-", "abcdefghijklmnopqrstuvwxyz", "123456"].join("");
  const photo = path.join(repo, "old-photo.bin");
  const secret = path.join(repo, "old-secret.txt");
  try {
    await writeFile(photo, pngHeader());
    await writeFile(secret, token);
    git(repo, ["add", "--", "old-photo.bin", "old-secret.txt"]);
    git(repo, ["commit", "-m", "historical fixture", "--quiet"]);
    const originalCommit = git(repo, ["rev-parse", "HEAD"]);
    await rm(photo);
    await rm(secret);
    git(repo, ["rm", "--", "old-photo.bin", "old-secret.txt"]);
    git(repo, ["commit", "-m", "remove fixture", "--quiet"]);
    const result = runPython(["--history", "--repo", repo, "--json"]);
    assert.equal(result.status, 1);
    const findings = JSON.parse(result.stdout) as Array<{source: string; path: string; rule: string; commit: string}>;
    assert.ok(findings.some((item) => item.source === "history" && item.path === "old-photo.bin" && item.rule === "png-header" && item.commit === originalCommit));
    assert.ok(findings.some((item) => item.source === "history" && item.path === "old-secret.txt" && item.rule === "openai-token" && item.commit === originalCommit));
    assert.equal(result.stdout.includes(token), false);
    const pushedCommit = git(repo, ["rev-parse", "HEAD"]);
    const prePush = runPython(
      ["--pre-push", "--repo", repo, "--json"],
      `refs/heads/main ${pushedCommit} refs/heads/main ${"0".repeat(40)}\n`,
    );
    assert.equal(prePush.status, 1);
    const prePushFindings = JSON.parse(prePush.stdout) as Array<{source: string; path: string; rule: string; commit: string}>;
    assert.ok(prePushFindings.some((item) => item.source === "pre-push" && item.path === "old-photo.bin" && item.commit === originalCommit));
    assert.equal(prePush.stdout.includes(token), false);
  } finally {
    await rm(repo, {recursive: true, force: true});
  }
});

test("unknown pre-push hooks are not overwritten unless force is explicit", async () => {
  const repo = await tempRepository();
  const unknown = "#!/bin/sh\necho keep-this-hook\n";
  try {
    await mkdir(path.join(repo, "hooks"), {recursive: true});
    await writeFile(path.join(repo, "hooks", "pre-push"), await readFile(hookSource));
    const hooksDir = path.join(repo, ".git", "hooks");
    await mkdir(hooksDir, {recursive: true});
    const destination = path.join(hooksDir, "pre-push");
    await writeFile(destination, unknown, "utf8");
    const refused = runInstaller(["--repo", repo]);
    assert.equal(refused.status, 1);
    assert.equal(await readFile(destination, "utf8"), unknown);
    const forced = runInstaller(["--repo", repo, "--force"]);
    assert.equal(forced.status, 0, forced.stderr);
    assert.equal(await readFile(destination, "utf8"), await readFile(hookSource, "utf8"));
    await rm(destination);
    const installed = runInstaller(["--repo", repo]);
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(await readFile(destination, "utf8"), await readFile(hookSource, "utf8"));
  } finally {
    await rm(repo, {recursive: true, force: true});
  }
});

test("the local hook and CI both call the one scanner", async () => {
  const hook = await readFile(hookSource, "utf8");
  const runtimeWorkflow = await readFile(path.join(projectRoot, ".github", "workflows", "runtime.yml"), "utf8");
  const skillWorkflow = await readFile(path.join(projectRoot, ".github", "workflows", "validate.yml"), "utf8");
  assert.match(hook, /scripts\/check_sensitive\.py/);
  assert.match(hook, /--pre-push/);
  assert.match(runtimeWorkflow, /python scripts\/check_sensitive\.py --history/);
  assert.match(skillWorkflow, /python scripts\/check_sensitive\.py --history/);
});
