import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baseline = JSON.parse(await readFile(path.join(root, "DIGITAL_HUMAN_NON_TARGET_BASELINE.json"), "utf8"));
const drift = [];

for (const [relativePath, expected] of Object.entries(baseline.files)) {
  const bytes = await readFile(path.join(root, relativePath));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) drift.push(`${relativePath}: expected ${expected}, got ${actual}`);
}

if (drift.length) {
  throw new Error(`Digital-human isolation violated:\n${drift.join("\n")}`);
}

console.log(`Digital-human isolation verified for ${Object.keys(baseline.files).length} cinematic sources.`);
