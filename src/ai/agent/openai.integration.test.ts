import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RequestContext } from "@mastra/core/request-context";
import { TODAY_BRIEFING_QUESTION } from "@/ai/agent/today-briefing";
import { getOrCreateToolCallGuard } from "@/ai/agent/loop-limit";
import { attachVersatechAiActor } from "@/ai/agent/mastra-tools";
import { isVersatechAiConfigured } from "@/ai/providers/model";
import type { SessionUser } from "@/lib/auth/types";

const actor: SessionUser = {
  id: "user_session",
  name: "Camille Durand",
  email: "camille.durand@versatech.example",
  role: "ADMIN",
};

describe("optional live LLM", () => {
  test(
    "agent generate for the today briefing question (skipped without API key)",
    { skip: !isVersatechAiConfigured() },
    async () => {
      const { versatechAgent } = await import("@/ai/index");
      const requestContext = new RequestContext();
      attachVersatechAiActor(requestContext, actor, "req_live");
      getOrCreateToolCallGuard(requestContext);
      const result = await versatechAgent.generate(TODAY_BRIEFING_QUESTION, {
        requestContext,
        maxSteps: 3,
      });
      assert.equal(typeof result.text, "string");
      const serialized = JSON.stringify(result.text);
      assert.equal(serialized.includes("DATABASE_URL"), false);
      assert.equal(serialized.includes("AUTH_SECRET"), false);
    },
  );
});
