import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp, mkdir, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  acquireProjectLease,
  forceReleaseProjectLease,
  getProjectPaths,
  readProjectLease,
  resolveProjectRoot,
} from "../workflow/project-isolation.js";

async function createRepositoryFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-video-factory-isolation-"));
  await mkdir(path.join(root, "projects", "episode-a"), {recursive: true});
  await mkdir(path.join(root, "projects", "episode-b"), {recursive: true});
  return root;
}

test("each project gets independent output, temp, and lease paths", async () => {
  const root = await createRepositoryFixture();
  try {
    const a = getProjectPaths(root, "projects/episode-a");
    const b = getProjectPaths(root, "projects/episode-b");
    assert.notEqual(a.outputRoot, b.outputRoot);
    assert.notEqual(a.renderPropsPath, b.renderPropsPath);
    assert.notEqual(a.tempRoot, b.tempRoot);
    assert.notEqual(a.leasePath, b.leasePath);
    assert.equal(resolveProjectRoot(root, "projects/episode-a"), path.join(root, "projects", "episode-a"));
    assert.throws(() => resolveProjectRoot(root, "output"), /direct child of projects/);
    assert.throws(() => resolveProjectRoot(root, "projects/episode-a/output"), /direct child of projects/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("different projects can hold leases concurrently", async () => {
  const root = await createRepositoryFixture();
  try {
    const leaseA = await acquireProjectLease(root, "projects/episode-a", "render:episode-a");
    const leaseB = await acquireProjectLease(root, "projects/episode-b", "render:episode-b");
    assert.equal((await readProjectLease(root, "projects/episode-a"))?.taskId, "render:episode-a");
    assert.equal((await readProjectLease(root, "projects/episode-b"))?.taskId, "render:episode-b");
    await assert.rejects(
      () => acquireProjectLease(root, "projects/episode-a", "rough-cut:episode-a"),
      /already locked/,
    );
    await leaseA.release();
    await leaseB.release();
    assert.equal(await readProjectLease(root, "projects/episode-a"), undefined);
    assert.equal(await readProjectLease(root, "projects/episode-b"), undefined);
  } finally {
    await forceReleaseProjectLease(root, "projects/episode-a");
    await forceReleaseProjectLease(root, "projects/episode-b");
    await rm(root, {recursive: true, force: true});
  }
});

test("a single project cannot be claimed twice, even when claims race", async () => {
  const root = await createRepositoryFixture();
  try {
    const results = await Promise.allSettled([
      acquireProjectLease(root, "projects/episode-a", "render:first"),
      acquireProjectLease(root, "projects/episode-a", "render:second"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const winner = results.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof acquireProjectLease>>> => result.status === "fulfilled");
    await winner?.value.release();
  } finally {
    await forceReleaseProjectLease(root, "projects/episode-a");
    await rm(root, {recursive: true, force: true});
  }
});
