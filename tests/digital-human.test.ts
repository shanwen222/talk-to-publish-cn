import assert from "node:assert/strict";
import test from "node:test";
import {captionsToSrt, createCaptionTrack} from "../workflow/digital-human/captions.js";
import {resolveFishAudio} from "../workflow/digital-human/fish-audio.js";
import {resolveHeyGen, waitForHeyGenVideo} from "../workflow/digital-human/heygen.js";
import {assertPaidExecutionAuthorized, defaultDigitalHumanConfig} from "../workflow/digital-human/pipeline.js";
import {extractNarration} from "../workflow/digital-human/script.js";

test("digital-human config keeps the independent provider chain", () => {
  const config = defaultDigitalHumanConfig("product");
  assert.equal(config.voice.provider, "fish-audio");
  assert.equal(config.avatar.provider, "heygen");
  assert.equal(config.packaging.provider, "hyperframes");
  assert.equal(config.packaging.theme, "product");
});

test("paid execution is default-deny and requires a positive guard", () => {
  assert.throws(() => assertPaidExecutionAuthorized(false, 5), /disabled by default/);
  assert.throws(() => assertPaidExecutionAuthorized(true, 0), /positive --max-cost/);
  assert.doesNotThrow(() => assertPaidExecutionAuthorized(true, 5));
});

test("provider checks cannot claim availability without explicit environment", () => {
  assert.equal(resolveFishAudio({}).available, false);
  assert.equal(resolveHeyGen({}).available, false);
  assert.equal(resolveFishAudio({FISH_AUDIO_API_KEY: "x", FISH_AUDIO_REFERENCE_ID: "r"}).available, true);
  assert.equal(resolveHeyGen({HEYGEN_API_KEY: "x", HEYGEN_AVATAR_ID: "a"}).available, true);
});

test("script extraction and caption allocation are ordered and bounded", () => {
  const narration = extractNarration("# 标题\n\n## 旁白\n- 0-3s：未来已经到来。\n- 3-6s：准备好了吗？");
  assert.match(narration, /未来已经到来/);
  const cues = createCaptionTrack(narration, 6);
  assert.ok(cues.length >= 2);
  assert.equal(cues[0]?.startSeconds, 0);
  assert.equal(cues.at(-1)?.endSeconds, 6);
  assert.match(captionsToSrt(cues), /00:00:00,000 -->/);
});

test("empty caption source and invalid durations fail explicitly", () => {
  assert.throws(() => createCaptionTrack("", 5), /empty/);
  assert.throws(() => createCaptionTrack("hello", 0), /positive/);
});

test("HeyGen failed state is not treated as a completed video", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    data: {status: "failed", failure_message: "render rejected"},
  }), {status: 200, headers: {"content-type": "application/json"}});
  await assert.rejects(
    waitForHeyGenVideo("job-1", {
      environment: {HEYGEN_API_KEY: "key", HEYGEN_AVATAR_ID: "avatar"},
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {},
      maxAttempts: 1,
    }),
    /render rejected/,
  );
});

test("HeyGen polling has a finite timeout", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({data: {status: "processing"}}), {status: 200});
  await assert.rejects(
    waitForHeyGenVideo("job-2", {
      environment: {HEYGEN_API_KEY: "key", HEYGEN_AVATAR_ID: "avatar"},
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {},
      maxAttempts: 2,
      pollIntervalMs: 0,
    }),
    /timed out/,
  );
});
