import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RequestContext } from "@mastra/core/request-context";
import {
  CHAT_MAX_TOOL_CALLS,
  TOOL_CALL_LIMIT_MESSAGE,
  TOOL_CALL_LOOP_MESSAGE,
  ToolCallGuard,
  getOrCreateToolCallGuard,
  refuseToolCallIfLimited,
  requestContextFromToolContext,
  toolCallFingerprint,
} from "@/ai/agent/loop-limit";

describe("toolCallFingerprint", () => {
  test("treats the same payload with different key order as equal", () => {
    assert.equal(
      toolCallFingerprint("searchCompanies", { query: "Nord", city: "Lille" }),
      toolCallFingerprint("searchCompanies", { city: "Lille", query: "Nord" }),
    );
    assert.notEqual(
      toolCallFingerprint("searchCompanies", { query: "Nord" }),
      toolCallFingerprint("getCompany", { query: "Nord" }),
    );
  });
});

describe("ToolCallGuard", () => {
  test("allows six distinct READ calls and refuses the seventh", () => {
    const guard = new ToolCallGuard();
    for (let index = 0; index < CHAT_MAX_TOOL_CALLS; index += 1) {
      const decision = guard.inspect("searchCompanies", { query: `q${index}` });
      assert.equal(decision.ok, true);
    }
    const blocked = guard.inspect("getCompany", { id: "co_1" });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.reason, "limit");
      assert.equal(blocked.message, TOOL_CALL_LIMIT_MESSAGE);
    }
    assert.equal(guard.count, CHAT_MAX_TOOL_CALLS);
  });

  test("refuses the same tool and input twice in a row", () => {
    const guard = new ToolCallGuard();
    assert.equal(guard.inspect("listFollowUps", { status: "OVERDUE" }).ok, true);
    const looped = guard.inspect("listFollowUps", { status: "OVERDUE" });
    assert.equal(looped.ok, false);
    if (!looped.ok) {
      assert.equal(looped.reason, "loop");
      assert.equal(looped.message, TOOL_CALL_LOOP_MESSAGE);
    }
    assert.equal(guard.count, 1);
  });

  test("allows the same tool again when the input changed in between", () => {
    const guard = new ToolCallGuard();
    assert.equal(guard.inspect("getCompany", { id: "co_1" }).ok, true);
    assert.equal(guard.inspect("getCompany", { id: "co_2" }).ok, true);
    assert.equal(guard.inspect("getCompany", { id: "co_1" }).ok, true);
  });
});

describe("refuseToolCallIfLimited", () => {
  test("fail-closes without RequestContext and stores the guard on context", () => {
    const missing = refuseToolCallIfLimited(undefined, "getTodayOverview", {});
    assert.equal(missing?.success, false);

    const requestContext = new RequestContext();
    const first = refuseToolCallIfLimited(requestContext, "getTodayOverview", {});
    assert.equal(first, null);
    const same = getOrCreateToolCallGuard(requestContext);
    assert.equal(same.count, 1);

    const looped = refuseToolCallIfLimited(requestContext, "getTodayOverview", {});
    assert.equal(looped?.success, false);
    if (looped && !looped.success) {
      assert.equal(looped.error.code, "FORBIDDEN");
      assert.equal(looped.error.message, TOOL_CALL_LOOP_MESSAGE);
    }
  });

  test("reads requestContext from a Mastra tool hook context", () => {
    const requestContext = new RequestContext();
    const extracted = requestContextFromToolContext({ requestContext });
    assert.equal(extracted, requestContext);
    assert.equal(requestContextFromToolContext({}), undefined);
  });
});
