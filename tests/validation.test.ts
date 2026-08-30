import assert from "node:assert/strict";
import test from "node:test";
import {validateRenderedVideo} from "../workflow/validation.js";

test("accepts the formal delivery envelope", () => {
  const result = validateRenderedVideo({
    format: {duration: "60.000"},
    streams: [
      {codec_type: "video", codec_name: "h264", width: 1080, height: 1920},
      {codec_type: "audio", codec_name: "aac"},
    ],
  });
  assert.equal(result.valid, true);
});

test("rejects a near-match with wrong duration, dimensions, and no audio", () => {
  const result = validateRenderedVideo({
    format: {duration: "59.4"},
    streams: [{codec_type: "video", codec_name: "h264", width: 1920, height: 1080}],
  });
  assert.equal(result.valid, false);
  assert.equal(result.issues.length, 3);
});

test("circuit contract: malformed probe never becomes a normal result", () => {
  const result = validateRenderedVideo({});
  assert.equal(result.valid, false);
  assert.ok(result.issues.length >= 3);
});
