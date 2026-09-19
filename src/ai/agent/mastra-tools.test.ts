import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RequestContext } from "@mastra/core/request-context";
import {
  VERSATECH_AI_ACTOR_CONTEXT_KEY,
  attachVersatechAiActor,
  createVersatechMastraTools,
} from "@/ai/agent/mastra-tools";
import type { ExecuteToolArgs } from "@/ai/tools";
import type { SessionUser } from "@/lib/auth/types";
import { emptyTodayOverview } from "@/lib/services/today/schema";

const actor: SessionUser = {
  id: "user_session",
  name: "Camille Durand",
  email: "camille.durand@versatech.example",
  role: "ADMIN",
};

describe("mastra READ adapters", () => {
  test("missing RequestContext actor returns AUTH_REQUIRED", async () => {
    const tools = createVersatechMastraTools(async () => {
      throw new Error("executeTool must not run without an actor");
    });
    const result = await tools.getTodayOverview.execute!({}, {
      requestContext: new RequestContext(),
    } as never);
    assert.equal(result && typeof result === "object" && "success" in result, true);
    const toolResult = result as { success: boolean; error?: { code?: string } };
    assert.equal(toolResult.success, false);
    assert.equal(toolResult.error?.code, "AUTH_REQUIRED");
  });

  test("actor is taken from RequestContext, not tool JSON", async () => {
    const calls: ExecuteToolArgs[] = [];
    const overview = emptyTodayOverview();
    const tools = createVersatechMastraTools(async (args) => {
      calls.push(args);
      return { success: true, data: overview };
    });
    const requestContext = new RequestContext();
    attachVersatechAiActor(requestContext, actor, "req_mastra");

    const result = await tools.getTodayOverview.execute!(
      { actorId: "user_from_model", now: "1999-01-01T00:00:00.000Z" },
      { requestContext } as never,
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.name, "getTodayOverview");
    assert.equal(calls[0]?.runtime.actor.id, actor.id);
    assert.notEqual(calls[0]?.runtime.actor.id, "user_from_model");
    assert.deepEqual(result, { success: true, data: overview });

    const stored = requestContext.getRaw(VERSATECH_AI_ACTOR_CONTEXT_KEY);
    assert.equal(stored && typeof stored === "object" && "id" in stored, true);
    assert.equal((stored as SessionUser).id, actor.id);
  });

  test("searchCompanies, getCompany, listFollowUps and Wave 4 READ tools are registered", () => {
    const tools = createVersatechMastraTools();
    assert.equal("getTodayOverview" in tools, true);
    assert.equal("searchCompanies" in tools, true);
    assert.equal("getCompany" in tools, true);
    assert.equal("listFollowUps" in tools, true);
    assert.equal("listTasks" in tools, true);
    assert.equal("listCalendarItems" in tools, true);
    assert.equal("getTodayTour" in tools, true);
    assert.equal("getPipeline" in tools, true);
    assert.equal("getFinanceSnapshot" in tools, true);
    assert.equal("getRecentActivity" in tools, true);
  });
});
