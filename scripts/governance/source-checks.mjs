import {readFile, readdir} from "node:fs/promises";
import path from "node:path";

const ignoredDirectories = new Set(["node_modules", ".venv", ".git", ".governance", ".vibeframe", "output", ".tmp", ".cache", "test-results", "playwright-report"]);
const textExtensions = new Set([".md", ".json", ".ts", ".tsx", ".mjs", ".ps1", ".yml", ".yaml", ".example"]);

export async function listFirstPartyFiles(root) {
  const results = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else results.push(absolute);
    }
  }
  await visit(root);
  return results;
}

export async function checkEncoding(root) {
  const issues = [];
  const decoder = new TextDecoder("utf-8", {fatal: true});
  for (const file of await listFirstPartyFiles(root)) {
    const extension = path.extname(file);
    if (!textExtensions.has(extension) && ![".gitignore"].includes(path.basename(file))) continue;
    try {
      const text = decoder.decode(await readFile(file));
      if (/[\uFFFD]|\u951F\u65A4\u62F7|\u00C3.|\u00C2./u.test(text)) issues.push(`Mojibake sentinel: ${path.relative(root, file)}`);
    } catch {
      issues.push(`Invalid UTF-8: ${path.relative(root, file)}`);
    }
  }
  return issues;
}

export async function checkForbiddenCandidates(root) {
  const issues = [];
  const pattern = /(?:\.bak|\.old|\.before|\.current|\.orig|\.copy|[-_.](?:backup|candidate|imported|tmp))(?:\.|$)/i;
  for (const file of await listFirstPartyFiles(root)) {
    if (pattern.test(path.basename(file))) issues.push(`Forbidden candidate source: ${path.relative(root, file)}`);
  }
  return issues;
}
