import assert from "node:assert/strict";
import test from "node:test";
import {getProviderCapabilities} from "../workflow/providers.js";

test("unconfigured providers fail visibly", () => {
  const capabilities = getProviderCapabilities({});
  assert.equal(capabilities.length, 9);
  assert.ok(capabilities.every((item) => item.available === false));
  assert.ok(capabilities.every((item) => item.reason.startsWith("Unavailable:")));
});

test("only the explicitly configured provider becomes available", () => {
  const capabilities = getProviderCapabilities({KLING_API_KEY: "configured"});
  assert.equal(capabilities.find((item) => item.provider === "kling")?.available, true);
  assert.equal(capabilities.find((item) => item.provider === "runway")?.available, false);
});
