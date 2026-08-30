import {createHash} from "node:crypto";
import {readdir, readFile, rm, stat} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const targets = [
  path.join(root, ".tmp"),
  path.join(root, "test-results"),
  path.join(root, "playwright-report"),
  path.join(os.tmpdir(), "ai-video-factory-incomplete-node-modules-20260727"),
  path.join(os.tmpdir(), "ai-video-factory-incomplete-vibeframe-node-modules-20260727"),
  path.join(os.tmpdir(), "ai-video-factory-locked-vibeframe-20260727"),
];
if (process.argv.includes("--incomplete-vibeframe")) {
  targets.push(path.join(root, "workflow", "vibeframe", "node_modules"));
  targets.push(path.join(root, "workflow", "vibeframe"));
}
for (const target of targets) {
  let metadata;
  try {
    const details = await stat(target);
    const names = details.isDirectory() ? await readdir(target) : [];
    metadata = {path: target, entries: names.length, type: details.isDirectory() ? "directory" : "file"};
  } catch {
    continue;
  }
  const fingerprint = createHash("sha256").update(JSON.stringify(metadata)).digest("hex");
  await rm(target, {recursive: true, force: true});
  console.log(JSON.stringify({...metadata, metadataSha256: fingerprint, removed: true}));
}
