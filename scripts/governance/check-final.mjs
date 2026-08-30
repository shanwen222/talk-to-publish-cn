import {readdir, readFile, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const projectOptionIndex = process.argv.indexOf("--project");
const requestedProject = projectOptionIndex >= 0 ? process.argv[projectOptionIndex + 1] : undefined;

async function exists(file) {
  try { await stat(file); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}

async function projectCandidates(projectRoot) {
  return [
    [path.join(projectRoot, "output/final.mp4"), path.join(projectRoot, "output/final.probe.json")],
    [path.join(projectRoot, "final.mp4"), path.join(projectRoot, "final.probe.json")],
  ];
}

const candidates = [];
if (requestedProject) {
  candidates.push(...await projectCandidates(path.resolve(root, requestedProject)));
} else {
  candidates.push([path.join(root, "output/final.mp4"), path.join(root, "output/final.probe.json")]);
  const projectsRoot = path.join(root, "projects");
  try {
    const entries = await readdir(projectsRoot, {withFileTypes: true});
    for (const entry of entries.filter((item) => item.isDirectory())) {
      candidates.push(...await projectCandidates(path.join(projectsRoot, entry.name)));
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

for (const [video, reportPath] of candidates) {
  if (!(await exists(video)) || !(await exists(reportPath))) continue;
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const details = await stat(video);
  if (!report.validation?.valid) throw new Error(`Final video validation failed: ${report.validation?.issues?.join(", ")}`);
  if (details.size <= 0) throw new Error("Final video is empty.");
  console.log(JSON.stringify({path: video, bytes: details.size, valid: true}));
  process.exit(0);
}

throw new Error(requestedProject
  ? `No validated final video found for project ${requestedProject}.`
  : "No validated final video found in root output or any project output.");
