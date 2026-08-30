import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlayableRanges,
  createRoughCutEntries,
  findRepeatCandidates,
  speechSimilarity,
  type RoughCutEntry,
} from "../workflow/local-rough-cut.js";

test("local rough cut removes only fixed filler and keeps connective words", () => {
  const entries = createRoughCutEntries([{
    source: "speaker.mov",
    sourceOrder: 0,
    segments: [
      {start: 0, end: 0.6, text: "呃"},
      {start: 0.7, end: 2.8, text: "然后我们看第二个功能"},
      {start: 3, end: 4.1, text: "嗯，这个功能已经上线"},
    ],
  }]);
  assert.equal(entries[0]?.decision, "remove");
  assert.equal(entries[0]?.reason, "fixed-filler");
  assert.equal(entries[1]?.decision, "keep");
  assert.equal(entries[2]?.decision, "keep");
});

test("possible retakes are review items and remain audible by default", () => {
  const entries = createRoughCutEntries([{
    source: "speaker.mov",
    sourceOrder: 0,
    segments: [
      {start: 0, end: 2, text: "今天我来介绍这个产品"},
      {start: 2.4, end: 4.5, text: "今天我来介绍这个产品"},
      {start: 5, end: 6, text: "不对，重新来"},
    ],
  }]);
  assert.equal(entries[1]?.decision, "review");
  assert.equal(entries[1]?.reason, "possible-repeated-take");
  assert.equal(entries[2]?.decision, "review");
  assert.equal(entries[2]?.reason, "explicit-retake-marker");
  assert.equal(speechSimilarity(entries[0]!.text, entries[1]!.text), 1);
});

test("removed entries form a real cut barrier while review entries are retained", () => {
  const base = {
    source: "speaker.mov",
    sourceOrder: 0,
    confidence: 1,
  };
  const entries: RoughCutEntry[] = [
    {...base, id: "a", segmentIndex: 0, startSeconds: 0, endSeconds: 2, text: "第一句", decision: "keep", reason: "spoken-content"},
    {...base, id: "b", segmentIndex: 1, startSeconds: 2.1, endSeconds: 2.4, text: "呃", decision: "remove", reason: "fixed-filler"},
    {...base, id: "c", segmentIndex: 2, startSeconds: 2.5, endSeconds: 4, text: "第二句", decision: "review", reason: "possible-repeated-take"},
    {...base, id: "d", segmentIndex: 3, startSeconds: 4.4, endSeconds: 6, text: "第三句", decision: "keep", reason: "spoken-content"},
  ];
  const ranges = buildPlayableRanges(entries, new Map([["speaker.mov", 10]]), 0.4, 0.8);
  assert.equal(ranges.length, 2);
  assert.deepEqual(ranges[0]?.entryIds, ["a"]);
  assert.deepEqual(ranges[1]?.entryIds, ["c", "d"]);
  assert.equal(ranges[0]?.startSeconds, 0);
  assert.equal(ranges[0]?.endSeconds, 2.2);
});

test("long silences inside a speech segment become cut barriers while keeping a short breath", () => {
  const entry: RoughCutEntry = {
    id: "speech",
    source: "speaker.mov",
    sourceOrder: 0,
    segmentIndex: 0,
    startSeconds: 0,
    endSeconds: 10,
    text: "前半句，后半句",
    decision: "keep",
    reason: "spoken-content",
    confidence: 1,
  };
  const ranges = buildPlayableRanges(
    [entry],
    new Map([["speaker.mov", 10]]),
    0.4,
    0.8,
    [{source: "speaker.mov", intervals: [{startSeconds: 4, endSeconds: 7, durationSeconds: 3}]}],
  );
  assert.equal(ranges.length, 2);
  assert.ok((ranges[0]?.endSeconds ?? 0) < (ranges[1]?.startSeconds ?? 0));
  assert.deepEqual(ranges[0]?.entryIds, ["speech"]);
  assert.deepEqual(ranges[1]?.entryIds, ["speech"]);
});

test("invalid reviewed decision fails instead of silently rendering", () => {
  const invalid = [{
    id: "bad",
    source: "speaker.mov",
    sourceOrder: 0,
    segmentIndex: 0,
    startSeconds: 0,
    endSeconds: 2,
    text: "内容",
    decision: "maybe",
    reason: "manual",
    confidence: 1,
  }] as unknown as RoughCutEntry[];
  assert.throws(
    () => buildPlayableRanges(invalid, new Map([["speaker.mov", 3]])),
    /Invalid decision/,
  );
});

test("repeat audit catches a sentence embedded in a longer segment", () => {
  const base = {
    source: "speaker.mov",
    sourceOrder: 0,
    confidence: 1,
    decision: "keep" as const,
    reason: "spoken-content",
  };
  const candidates = findRepeatCandidates([
    {
      ...base,
      id: "long",
      segmentIndex: 0,
      startSeconds: 30,
      endSeconds: 42,
      text: "我在做一个软件项目为什么拥抱AI因为这是趋势手机普及之后很多人都不用手工处理了",
    },
    {
      ...base,
      id: "later",
      segmentIndex: 1,
      startSeconds: 42,
      endSeconds: 48,
      text: "手机普及之后很多人都不用手工处理了",
    },
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.laterEntryId, "later");
  assert.equal(candidates[0]?.recommendation, "prefer-later-after-listen");
  assert.equal(candidates[0]?.kind, "contained-repeat");
});

test("final tail buffer keeps approximately half a second after the last speech range", () => {
  const entry: RoughCutEntry = {
    id: "last",
    source: "speaker.mov",
    sourceOrder: 0,
    segmentIndex: 0,
    startSeconds: 0,
    endSeconds: 2,
    text: "最后一句",
    decision: "keep",
    reason: "spoken-content",
    confidence: 1,
  };
  const ranges = buildPlayableRanges(
    [entry],
    new Map([["speaker.mov", 10]]),
    0.35,
    0.8,
    [],
    0.5,
  );
  assert.equal(ranges.length, 1);
  assert.ok(Math.abs((ranges[0]?.endSeconds ?? 0) - 2.5) < 0.001);
});
