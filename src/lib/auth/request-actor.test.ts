import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { requestActorFromSession } from "./request-actor";
import type { SessionUser } from "./types";

describe("requestActorFromSession", () => {
  const actor: SessionUser = {
    id: "user_1",
    name: "Camille Durand",
    email: "camille.durand@versatech.example",
    role: "ADMIN",
  };

  test("returns AUTH_REQUIRED when the session is null", () => {
    const result = requestActorFromSession(null);
    assert.deepEqual(result, { ok: false, code: "AUTH_REQUIRED" });
  });

  test("returns the same SessionUser fields when authenticated", () => {
    const result = requestActorFromSession(actor);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.actor, actor);
      assert.equal(result.actor.id, actor.id);
      assert.equal(result.actor.name, actor.name);
      assert.equal(result.actor.email, actor.email);
      assert.equal(result.actor.role, actor.role);
    }
  });

  test("does not throw and does not redirect", () => {
    assert.doesNotThrow(() => {
      requestActorFromSession(null);
      requestActorFromSession(actor);
    });
  });

  test("actor object has no passwordHash", () => {
    const dirty = {
      ...actor,
      passwordHash: "should-not-leak",
    };
    const result = requestActorFromSession(dirty);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal("passwordHash" in result.actor, false);
      assert.deepEqual(Object.keys(result.actor).sort(), [
        "email",
        "id",
        "name",
        "role",
      ]);
      assert.deepEqual(result.actor, actor);
    }
  });
});
