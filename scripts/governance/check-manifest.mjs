import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {listFirstPartyFiles} from "./source-checks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(await readFile(path.join(root, "SOURCE_MANIFEST.json"), "utf8"));
const expected = new Map(manifest.entries.map((entry) => [entry.path, entry]));
const actualFiles = (await listFirstPartyFiles(root)).filter((file) => path.basename(file) !== "SOURCE_MANIFEST.json");
const issues = [];
for (const file of actualFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const entry = expected.get(relative);
  if (!entry) {
    issues.push(`Unregistered source: ${relative}`);
    continue;
  }
  const data = await readFile(file);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (entry.sha256 !== sha256 || entry.bytes !== data.byteLength) issues.push(`Manifest mismatch: ${relative}`);
  expected.delete(relative);
}
for (const missing of expected.keys()) issues.push(`Manifest source missing: ${missing}`);
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Manifest OK: ${actualFiles.length} sources`);
}
