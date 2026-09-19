import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RequestContext } from "@mastra/core/request-context";
import {
  CHAT_MAX_TOOL_CALLS,
  CHAT_MAX_WEB_SEARCH_CALLS,
  TOOL_CALL_LIMIT_MESSAGE,
  TOOL_CALL_LOOP_MESSAGE,
  WEB_SEARCH_LIMIT_MESSAGE,
  WRITE_CHAIN_MESSAGE,
  ToolCallGuard,
  getOrCreateToolCallGuard,
  isWebSearchTool,
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

  test("allows one confirmable WRITE then refuses a second WRITE chain", () => {
    const guard = new ToolCallGuard();
    assert.equal(guard.inspect("createFollowUp", { companyId: "co_1" }).ok, true);
    const chained = guard.inspect("createTask", { title: "Rappel", companyId: "co_1" });
    assert.equal(chained.ok, false);
    if (!chained.ok) {
      assert.equal(chained.reason, "write-chain");
      assert.equal(chained.message, WRITE_CHAIN_MESSAGE);
    }
    assert.equal(guard.writeCount, 1);
    assert.equal(guard.inspect("searchCompanies", { query: "Nord" }).ok, true);
  });

  test("allows two distinct webSearch calls then refuses the third", () => {
    assert.equal(CHAT_MAX_WEB_SEARCH_CALLS, 2);
    assert.equal(isWebSearchTool("webSearch"), true);
    assert.equal(isWebSearchTool("searchCompanies"), false);
    const guard = new ToolCallGuard();
    assert.equal(guard.inspect("webSearch", { query: "actualité fibre" }).ok, true);
    assert.equal(guard.inspect("searchCompanies", { query: "Nord" }).ok, true);
    assert.equal(guard.inspect("webSearch", { query: "horaires actuellement" }).ok, true);
    assert.equal(guard.webSearchCount, 2);
    assert.equal(guard.writeCount, 0);
    const blocked = guard.inspect("webSearch", { query: "prix actuel" });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.reason, "web-search");
      assert.equal(blocked.message, WEB_SEARCH_LIMIT_MESSAGE);
    }
    assert.equal(guard.count, 3);
    assert.equal(guard.inspect("createFollowUp", { companyId: "co_1" }).ok, true);
  });

  test("consecutive identical webSearch is still a loop, not a third search", () => {
    const guard = new ToolCallGuard();
    assert.equal(guard.inspect("webSearch", { query: "news" }).ok, true);
    const looped = guard.inspect("webSearch", { query: "news" });
    assert.equal(looped.ok, false);
    if (!looped.ok) {
      assert.equal(looped.reason, "loop");
      assert.equal(looped.message, TOOL_CALL_LOOP_MESSAGE);
    }
    assert.equal(guard.webSearchCount, 1);
    assert.equal(guard.count, 1);
  });
});

describe("webSearch budget (Wave 7)", () => {
  test("refuses a third distinct webSearch when the server counter exists", () => {
    assert.equal(CHAT_MAX_WEB_SEARCH_CALLS, 2);
    const guard = new ToolCallGuard();
    assert.equal(guard.inspect("webSearch", { query: "q1" }).ok, true);
    assert.equal(guard.inspect("webSearch", { query: "q2" }).ok, true);
    const third = guard.inspect("webSearch", { query: "q3" });
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal(third.reason, "web-search");
      assert.equal(third.message, WEB_SEARCH_LIMIT_MESSAGE);
    }
    assert.equal(guard.webSearchCount, 2);
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

  test("refuses a third webSearch on the same request", () => {
    const requestContext = new RequestContext();
    assert.equal(refuseToolCallIfLimited(requestContext, "webSearch", { query: "a" }), null);
    assert.equal(refuseToolCallIfLimited(requestContext, "webSearch", { query: "b" }), null);
    const blocked = refuseToolCallIfLimited(requestContext, "webSearch", { query: "c" });
    assert.equal(blocked?.success, false);
    if (blocked && !blocked.success) {
      assert.equal(blocked.error.code, "FORBIDDEN");
      assert.equal(blocked.error.message, WEB_SEARCH_LIMIT_MESSAGE);
    }
    assert.equal(getOrCreateToolCallGuard(requestContext).webSearchCount, 2);
  });
});
