import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {listFirstPartyFiles} from "./source-checks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(root, "SOURCE_MANIFEST.json");
const excluded = new Set(["SOURCE_MANIFEST.json"]);
const files = (await listFirstPartyFiles(root))
  .filter((file) => !excluded.has(path.basename(file)))
  .sort((a, b) => a.localeCompare(b));
const entries = [];
for (const file of files) {
  const data = await readFile(file);
  entries.push({
    path: path.relative(root, file).replaceAll("\\", "/"),
    role: "authoritative-or-registered-source",
    bytes: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
    mirrorOf: null,
    releaseTarget: "local-v1",
  });
}
await writeFile(manifestPath, `${JSON.stringify({schemaVersion: 1, generatedBy: "scripts/governance/update-manifest.mjs", entries}, null, 2)}\n`, "utf8");
console.log(JSON.stringify({updated: entries.length, path: manifestPath}));
