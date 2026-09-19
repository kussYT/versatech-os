import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RequestContext } from "@mastra/core/request-context";
import {
  VERSATECH_AI_ACTOR_CONTEXT_KEY,
  attachVersatechAiActor,
  createVersatechMastraTools,
} from "@/ai/agent/mastra-tools";
import { takePendingConfirmation } from "@/ai/chat/pending-confirmation";
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

  test("searchCompanies, getCompany, listFollowUps, Wave 4 READ and confirmable WRITE tools are registered", () => {
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
    assert.equal("webSearch" in tools, true);
    assert.equal("createFollowUp" in tools, true);
    assert.equal("completeFollowUp" in tools, true);
    assert.equal("createTask" in tools, true);
  });

  test("WRITE adapter returns a model-visible proposal without confirmToken", async () => {
    const calls: ExecuteToolArgs[] = [];
    const tools = createVersatechMastraTools(async (args) => {
      calls.push(args);
      return {
        success: false,
        error: { code: "CONFIRMATION_REQUIRED", message: "Confirmation serveur requise." },
        proposal: {
          toolName: "createFollowUp",
          args: { companyId: "co_1" },
          humanSummary: "Créer une relance",
          actorId: actor.id,
          requestId: "req_mastra",
          issuedAt: "2026-09-19T10:00:00.000Z",
          expiresAt: "2026-09-19T10:05:00.000Z",
          actionId: "act_mastra",
          confirmToken: "signed-by-b",
          token: "signed-by-b",
        },
      };
    });
    const requestContext = new RequestContext();
    attachVersatechAiActor(requestContext, actor, "req_mastra");
    const result = await tools.createFollowUp.execute!(
      { companyId: "co_1", dueAt: "2026-09-20T08:00:00.000Z", actorId: "user_from_model" },
      { requestContext } as never,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.name, "createFollowUp");
    assert.equal(calls[0]?.runtime.actor.id, actor.id);
    const toolResult = result as {
      success: boolean;
      proposal?: { confirmToken?: string; humanSummary?: string };
    };
    assert.equal(toolResult.success, false);
    assert.equal(toolResult.proposal?.confirmToken, "");
    assert.equal(toolResult.proposal?.humanSummary, "Créer une relance");
    const pending = takePendingConfirmation(requestContext);
    assert.equal(pending?.type, "confirmation_required");
    assert.equal(pending?.token, "signed-by-b");
    assert.equal(pending?.actionId, "act_mastra");
    assert.equal(takePendingConfirmation(requestContext), null);
  });

  test("webSearch is registered READ and does not emit a WRITE confirmation card", async () => {
    const tools = createVersatechMastraTools();
    const requestContext = new RequestContext();
    attachVersatechAiActor(requestContext, actor, "req_web");
    const result = await tools.webSearch.execute!(
      { query: "dernière version Next.js" },
      { requestContext } as never,
    );
    const toolResult = result as { success: boolean; error?: { code?: string } };
    assert.notEqual(toolResult.error?.code, "CONFIRMATION_REQUIRED");
    if (!toolResult.success) {
      assert.ok(
        toolResult.error?.code === "SERVICE_UNAVAILABLE" ||
          toolResult.error?.code === "NOT_AVAILABLE" ||
          toolResult.error?.code === "INTERNAL",
        toolResult.error?.code,
      );
    }
    assert.equal(takePendingConfirmation(requestContext), null);
  });
});
