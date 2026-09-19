import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  TODAY_BRIEFING_QUESTION,
  TODAY_BRIEFING_TOOL,
  resolveTodayBriefingTool,
} from "@/ai/agent/today-briefing";
import {
  getToolPermission,
  isPermissionExecutable,
} from "@/ai/permissions";
import { createToolRuntime } from "@/ai/context";
import { createExecuteTool, createProductionTools, executeTool } from "@/ai/tools";
import type { SessionUser } from "@/lib/auth/types";
import { emptyTodayOverview, parseTodayOverview } from "@/lib/services/today/schema";

const actor: SessionUser = {
  id: "user_1",
  name: "Camille Durand",
  email: "camille.durand@versatech.example",
  role: "ADMIN",
};

describe("first scenario — Qu'est-ce que j'ai aujourd'hui ?", () => {
  test("the only mutation-free path is getTodayOverview", () => {
    const tool = resolveTodayBriefingTool(TODAY_BRIEFING_QUESTION);
    assert.equal(tool, TODAY_BRIEFING_TOOL);
    assert.equal(getToolPermission(tool!), "READ");
    assert.equal(isPermissionExecutable("READ"), true);
    assert.equal(isPermissionExecutable("WRITE"), false);
    assert.equal(isPermissionExecutable("CRITICAL"), false);
    assert.notEqual(tool, "createFollowUp");
    assert.notEqual(tool, "updateQuoteStatus");
  });

  test("executeTool getTodayOverview returns the ToolResult success shape", async () => {
    const overview = parseTodayOverview(emptyTodayOverview());
    const created = createToolRuntime(actor, "req_today");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const execute = createExecuteTool(
      createProductionTools({
        getTodayOverview: async ({ actor: serviceActor }) => {
          assert.equal(serviceActor.id, actor.id);
          return overview;
        },
      }),
    );
    const result = await execute({
      runtime: created.runtime,
      name: "getTodayOverview",
      input: {},
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(result.data, overview);
    }
  });

  test("the same question cannot execute WRITE", async () => {
    const created = createToolRuntime(actor, "req_today_write");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const result = await executeTool({
      runtime: created.runtime,
      name: "createFollowUp",
      input: { companyId: "co_1", dueAt: "2026-09-20T08:00:00.000Z" },
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, "NOT_AVAILABLE");
    }
  });
});
