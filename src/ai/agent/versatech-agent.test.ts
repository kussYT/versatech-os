import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CHAT_MAX_STEPS } from "@/ai/agent/loop-limit";
import { VERSATECH_AGENT_INSTRUCTIONS } from "@/ai/agent/versatech-agent";

describe("VersaTech agent instructions", () => {
  test("are French-default, fail-closed on invention, and deny writes", () => {
    assert.match(VERSATECH_AGENT_INSTRUCTIONS, /français/i);
    assert.match(VERSATECH_AGENT_INSTRUCTIONS, /Ne jamais inventer/);
    assert.match(VERSATECH_AGENT_INSTRUCTIONS, /Distingue zéro/);
    assert.match(VERSATECH_AGENT_INSTRUCTIONS, /DATA/);
    assert.match(VERSATECH_AGENT_INSTRUCTIONS, /combiner/);
    assert.match(VERSATECH_AGENT_INSTRUCTIONS, /relances en retard/);
    assert.match(VERSATECH_AGENT_INSTRUCTIONS, /Les écritures ne sont pas disponibles/);
    assert.doesNotMatch(VERSATECH_AGENT_INSTRUCTIONS, /DATABASE_URL/);
    assert.doesNotMatch(VERSATECH_AGENT_INSTRUCTIONS, /AUTH_SECRET/);
  });

  test("LLM step ceiling is high enough for six READ tool rounds plus an answer", () => {
    assert.equal(CHAT_MAX_STEPS, 7);
  });
});
