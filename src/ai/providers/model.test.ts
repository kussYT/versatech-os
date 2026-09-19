import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getLanguageModel, isVersatechAiConfigured } from "./model";

describe("VersaTech AI provider", () => {
  test("isVersatechAiConfigured never returns a key", () => {
    const configured = isVersatechAiConfigured();
    assert.equal(typeof configured, "boolean");
  });

  test("getLanguageModel fails closed without leaking secrets when unconfigured", {
    skip: isVersatechAiConfigured(),
  }, () => {
    assert.throws(() => getLanguageModel(), /not configured/);
  });
});
