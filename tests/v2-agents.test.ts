import assert from "node:assert/strict";
import test from "node:test";
import {planProject} from "../workflow/planners.js";
import {optimizeViralStructure} from "../workflow/viral-agent.js";
import {selectMusicProfile} from "../workflow/music-agent.js";
import {resolveVoiceProvider} from "../workflow/voice-agent.js";

test("v2 hotspot planner creates a paced 60-second cinematic project", () => {
  const planned = planProject("制作一个60秒AI热点视频", "ai-hotspot-v2");
  const {spec, report} = optimizeViralStructure(planned);
  assert.equal(spec.schemaVersion, "v2");
  assert.equal(spec.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0), 60);
  assert.equal(spec.scenes.length, 8);
  assert.equal(report.hook.windowSeconds, 3);
  assert.equal(report.emotionCurve.at(-1), "action");
  assert.ok(spec.scenes.every((scene) => scene.motion && scene.transition));
});

test("music profiles preserve voice-priority mixing policy", () => {
  for (const style of ["technology", "documentary", "emotion", "cinematic"] as const) {
    const profile = selectMusicProfile(style);
    assert.equal(profile.style, style);
    assert.ok(profile.bgmGain < 0.5);
    assert.ok(profile.fadeInSeconds > 0);
    assert.ok(profile.fadeOutSeconds > 0);
  }
});

test("cloud voice providers fail visibly without credentials", () => {
  const openai = resolveVoiceProvider("openai", process.cwd(), {});
  const eleven = resolveVoiceProvider("elevenlabs", process.cwd(), {});
  assert.equal(openai.available, false);
  assert.match(openai.reason, /OPENAI_API_KEY/);
  assert.equal(eleven.available, false);
  assert.match(eleven.reason, /ELEVENLABS_API_KEY/);
});
