import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { requestActorFromSession } from "@/lib/auth/request-actor";
import type { SessionUser } from "@/lib/auth/types";
import { createToolRuntime, toToolContext } from "./context";

const actor: SessionUser = {
  id: "user_1",
  name: "Camille Durand",
  email: "camille.durand@versatech.example",
  role: "ADMIN",
};

describe("createToolRuntime", () => {
  test("builds a runtime from SessionUser and strips extra fields", () => {
    const dirty = {
      ...actor,
      actorId: "attacker",
      passwordHash: "scrypt$should-not-leak",
      source: "UI",
      confirmation: { token: "yes", toolName: "createPayment", argsHash: "abc" },
    };

    const created = createToolRuntime(dirty, "req_42");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    assert.deepEqual(created.runtime.actor, actor);
    assert.equal("passwordHash" in created.runtime.actor, false);
    assert.equal("actorId" in created.runtime.actor, false);
    assert.equal("confirmation" in created.runtime, false);
    assert.equal(created.runtime.source, "AI");
    assert.equal(created.runtime.requestId, "req_42");
    assert.deepEqual(Object.keys(created.runtime.actor).sort(), [
      "email",
      "id",
      "name",
      "role",
    ]);
  });

  test("accepts RequestActorResult and ignores a spoofed actorId beside the actor", () => {
    const session = requestActorFromSession(actor);
    const created = createToolRuntime(session, "  req_trim  ");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.runtime.actor.id, "user_1");
    assert.equal(created.runtime.requestId, "req_trim");
  });

  test("returns AUTH_REQUIRED when the session is missing", () => {
    const created = createToolRuntime(requestActorFromSession(null), "req_x");
    assert.deepEqual(created, { ok: false, code: "AUTH_REQUIRED" });
  });
});

describe("toToolContext", () => {
  test("exposes actorId/role from the session, never SessionUser or model confirmation", () => {
    const created = createToolRuntime(actor, "req_ctx");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    const context = toToolContext(created.runtime);
    assert.deepEqual(context, {
      actorId: "user_1",
      role: "ADMIN",
      requestId: "req_ctx",
      source: "AI",
    });
    assert.equal("email" in context, false);
    assert.equal("name" in context, false);
    assert.equal("actor" in context, false);
    assert.equal("confirmation" in context, false);
  });

  test("propagates MEMBER without changing source", () => {
    const member: SessionUser = { ...actor, id: "user_member", role: "MEMBER" };
    const created = createToolRuntime(member, "req_member");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const context = toToolContext(created.runtime);
    assert.equal(context.role, "MEMBER");
    assert.equal(context.actorId, "user_member");
    assert.equal(context.source, "AI");
  });
});
