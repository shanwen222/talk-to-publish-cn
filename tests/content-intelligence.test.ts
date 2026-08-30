import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createDirectorPlan} from "../workflow/content-intelligence/director.js";
import {generateContentDirections} from "../workflow/content-intelligence/content-strategy.js";
import {loadPipeline} from "../workflow/content-intelligence/pipeline-loader.js";
import {referenceAnalysisMarkdown} from "../workflow/content-intelligence/reference-analyzer.js";
import {editShortformCopy} from "../workflow/content-intelligence/copywriter.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("director selects personal IP pipeline and preserves the fixed narrative", async () => {
  const plan = await createDirectorPlan({
    topic: "如果一个普通人用AI做一个产品，它到底有没有机会赚钱？",
    pipelineId: "personal_ip/build_in_public",
    platform: "YouTube",
    durationSeconds: 60,
  }, repositoryRoot);
  assert.equal(plan.videoType, "创业日志");
  assert.equal(plan.pipelineId, "personal_ip/build_in_public");
  assert.deepEqual(plan.contentStructure, ["Hook", "项目背景", "当前进展", "产品展示", "问题", "下一步计划"]);
  assert.match(plan.shotStrategy.join("\n"), /不生成假界面/);
  assert.equal(plan.durationMode, "explicit");
  assert.equal(plan.targetCharactersPerSecond, 5);
});

test("director accepts non-round durations inside a content-driven pipeline range", async () => {
  const adaptive = await createDirectorPlan({
    topic: "记录我的 AI 产品本周迭代",
    pipelineId: "personal_ip/build_in_public",
    platform: "小红书",
  }, repositoryRoot);
  assert.equal(adaptive.durationMode, "content-driven");
  assert.equal(adaptive.durationSeconds, 45);
  assert.deepEqual(adaptive.durationRangeSeconds, {min: 20, max: 180});

  const explicit = await createDirectorPlan({
    topic: "记录我的 AI 产品本周迭代",
    pipelineId: "personal_ip/build_in_public",
    durationSeconds: 47,
  }, repositoryRoot);
  assert.equal(explicit.durationSeconds, 47);
  await assert.rejects(() => createDirectorPlan({
    topic: "记录我的 AI 产品本周迭代",
    pipelineId: "personal_ip/build_in_public",
    durationSeconds: 181,
  }, repositoryRoot), /within 20-180s/);
});

test("all registered pipeline definitions parse and have reviewable stages", async () => {
  for (const id of [
    "personal_ip/build_in_public",
    "knowledge_video/explain",
    "product_video/launch",
    "viral_short/tiktok",
  ]) {
    const pipeline = await loadPipeline(repositoryRoot, id);
    assert.ok(pipeline.stages.every((stage) => stage.outputs.length > 0 && stage.review.length > 0));
    assert.ok(pipeline.skills.includes("shortform_copywriting"));
    assert.ok(pipeline.stages.some((stage) => stage.agent === "Copywriter Agent"));
  }
});

test("copywriter keeps a strong hook instead of forcing three alternatives", () => {
  const plan = editShortformCopy({
    source: "# 旁白\n\n如果一个普通人用 AI 做产品，它到底有没有机会赚钱？\n今天，我开始验证这个问题。",
    minDurationSeconds: 10,
    maxDurationSeconds: 90,
  });
  assert.equal(plan.hook.mode, "keep");
  assert.equal(plan.hook.recommendedCandidateCount, 1);
  assert.notEqual(plan.recommendedDurationSeconds, 60);
  assert.deepEqual(plan.timingOrder, ["copy", "voice", "measured-audio", "captions-and-shots"]);
});

test("copywriter removes known AI phrasing and rejects invalid timing controls", () => {
  const plan = editShortformCopy({
    source: "在当今快速发展的时代，值得注意的是，产品已经上线。接下来让我们一起看看真实页面。",
    targetCharactersPerSecond: 5,
    minDurationSeconds: 10,
    maxDurationSeconds: 45,
  });
  assert.doesNotMatch(plan.revisedNarration, /在当今|值得注意的是|让我们/);
  assert.ok(plan.issues.some((issue) => issue.kind === "ai-phrase"));
  assert.throws(() => editShortformCopy({source: "有效文案。", targetCharactersPerSecond: 7}), /between 3.5 and 6.5/);
});

test("unknown pipeline and empty strategy fail visibly", async () => {
  await assert.rejects(() => loadPipeline(repositoryRoot, "unknown/pipeline"), /Unknown pipeline/);
  assert.throws(() => generateContentDirections(" "), /must not be empty/);
});

test("content strategy returns exactly ten evidence-bound directions", () => {
  const directions = generateContentDirections("我的AI项目上线");
  assert.equal(directions.length, 10);
  assert.ok(directions.every((item) => item.evidenceNeeded.length > 0));
});

test("reference report separates measured facts from unverified semantics", () => {
  const markdown = referenceAnalysisMarkdown({
    source: "sample.mp4",
    durationSeconds: 15,
    width: 1920,
    height: 1080,
    frameRate: 30,
    codec: "h264",
    audioPresent: true,
    sceneCutsSeconds: [4, 8, 12],
  });
  assert.match(markdown, /方案 A/);
  assert.match(markdown, /方案 B/);
  assert.match(markdown, /方案 C/);
  assert.match(markdown, /不虚构|不能只凭/);
});
