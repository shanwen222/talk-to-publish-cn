import {randomUUID} from "node:crypto";
import {hostname} from "node:os";
import {open, mkdir, readFile, unlink} from "node:fs/promises";
import path from "node:path";

export interface ProjectPaths {
  projectId: string;
  projectRoot: string;
  outputRoot: string;
  renderPropsPath: string;
  remotionOutputPath: string;
  finalOutputPath: string;
  probeOutputPath: string;
  thumbnailOutputRoot: string;
  thumbnailPropsPath: string;
  tempRoot: string;
  leasePath: string;
}

export interface ProjectLeaseRecord {
  schemaVersion: 1;
  active: true;
  taskId: string;
  projectId: string;
  projectRoot: string;
  allowedPaths: string[];
  ownerPid: number;
  ownerHost: string;
  token: string;
  createdAt: string;
}

export interface ProjectLease {
  record: ProjectLeaseRecord;
  release: () => Promise<void>;
}

function isDirectProjectPath(projectsRoot: string, projectRoot: string): boolean {
  const relative = path.relative(projectsRoot, projectRoot);
  return relative.length > 0 && !path.isAbsolute(relative) && !relative.startsWith(`..${path.sep}`) && path.dirname(relative) === ".";
}

export function resolveProjectRoot(repositoryRoot: string, projectPath: string): string {
  const projectsRoot = path.resolve(repositoryRoot, "projects");
  const projectRoot = path.resolve(repositoryRoot, projectPath);
  if (!isDirectProjectPath(projectsRoot, projectRoot)) {
    throw new Error(`Project path must be a direct child of projects/: ${projectPath}`);
  }
  return projectRoot;
}

export function getProjectPaths(repositoryRoot: string, projectPath: string): ProjectPaths {
  const projectRoot = resolveProjectRoot(repositoryRoot, projectPath);
  const projectId = path.basename(projectRoot);
  const outputRoot = path.join(projectRoot, "output");
  return {
    projectId,
    projectRoot,
    outputRoot,
    renderPropsPath: path.join(outputRoot, "render-props.json"),
    remotionOutputPath: path.join(outputRoot, "remotion.mp4"),
    finalOutputPath: path.join(outputRoot, "final.mp4"),
    probeOutputPath: path.join(outputRoot, "final.probe.json"),
    thumbnailOutputRoot: path.join(outputRoot, "thumbnails"),
    thumbnailPropsPath: path.join(outputRoot, "thumbnail-props.json"),
    tempRoot: path.join(repositoryRoot, ".tmp", "projects", projectId),
    leasePath: path.join(repositoryRoot, ".governance", "project-leases", `${projectId}.json`),
  };
}

export async function readProjectLease(repositoryRoot: string, projectPath: string): Promise<ProjectLeaseRecord | undefined> {
  const {leasePath} = getProjectPaths(repositoryRoot, projectPath);
  try {
    return JSON.parse(await readFile(leasePath, "utf8")) as ProjectLeaseRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function acquireProjectLease(repositoryRoot: string, projectPath: string, taskId: string): Promise<ProjectLease> {
  const paths = getProjectPaths(repositoryRoot, projectPath);
  await mkdir(path.dirname(paths.leasePath), {recursive: true});
  const token = randomUUID();
  const record: ProjectLeaseRecord = {
    schemaVersion: 1,
    active: true,
    taskId,
    projectId: paths.projectId,
    projectRoot: path.relative(repositoryRoot, paths.projectRoot).replaceAll("\\", "/"),
    allowedPaths: [
      `${path.relative(repositoryRoot, paths.projectRoot).replaceAll("\\", "/")}/**`,
      `.tmp/projects/${paths.projectId}/**`,
    ],
    ownerPid: process.pid,
    ownerHost: hostname(),
    token,
    createdAt: new Date().toISOString(),
  };

  let handle;
  try {
    handle = await open(paths.leasePath, "wx");
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
    await handle.close();
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const existing = await readProjectLease(repositoryRoot, projectPath);
      throw new Error(`Project is already locked: ${paths.projectId}${existing ? ` (task ${existing.taskId}, pid ${existing.ownerPid})` : ""}`);
    }
    throw error;
  }

  let released = false;
  return {
    record,
    release: async () => {
      if (released) return;
      const current = await readProjectLease(repositoryRoot, projectPath);
      if (!current || current.token !== token) {
        throw new Error(`Project lease ownership changed before release: ${paths.projectId}`);
      }
      await unlink(paths.leasePath);
      released = true;
    },
  };
}

export async function forceReleaseProjectLease(repositoryRoot: string, projectPath: string): Promise<void> {
  const {leasePath} = getProjectPaths(repositoryRoot, projectPath);
  await unlink(leasePath).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
}

export async function withProjectLease<T>(
  repositoryRoot: string,
  projectPath: string,
  taskId: string,
  action: () => Promise<T>,
): Promise<T> {
  const lease = await acquireProjectLease(repositoryRoot, projectPath, taskId);
  try {
    return await action();
  } finally {
    await lease.release();
  }
}
