import assert from "node:assert/strict";
import test from "node:test";
import {planProject} from "../workflow/planners.js";

test("positive: creates a complete 60-second AI trends project", () => {
  const spec = planProject("制作一个60秒介绍人工智能未来趋势的视频", "ai-future-trends");
  assert.equal(spec.durationSeconds, 60);
  assert.equal(spec.scenes.length, 6);
  assert.equal(spec.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0), 60);
  assert.match(spec.hook, /AI|人工智能/);
  assert.ok(spec.cta.length > 5);
});

test("near-negative: rejects an empty topic", () => {
  assert.throws(() => planProject("  ", "empty"), /must not be empty/);
});

test("boundary: rejects unsupported duration instead of silently changing it", () => {
  assert.throws(() => planProject("AI", "ai", 59), /exactly 60 seconds/);
});
