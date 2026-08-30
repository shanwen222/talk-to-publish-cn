import {mkdir, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {checkEncoding, checkForbiddenCandidates, checkSecrets} from "./source-checks.mjs";

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
  const secretIssues = await checkSecrets(fixture);
  if (!secretIssues.some((issue) => issue.includes("secret.ts"))) throw new Error("Secret injection was not detected.");

  console.log(JSON.stringify({candidate: candidateIssues[0], encoding: encodingIssues[0], secret: secretIssues[0]}));
} finally {
  await rm(fixture, {recursive: true, force: true});
}
