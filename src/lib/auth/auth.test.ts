import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SignJWT } from "jose";
import { AUTH_REQUIRED_RESULT, actorOrUnauthorized } from "./guard";
import { isPublicPath, safeRedirectPath } from "./paths";
import { hashPassword, verifyPassword } from "./password";
import {
  consumeLoginAttempt,
  loginAttemptKey,
  resetLoginAttempts,
} from "./rate-limit";
import { createSessionToken, verifySessionToken } from "./token";
import { loginSchema } from "../validations/auth";

const SECRET = "unit-test-secret-at-least-32-characters-long";

describe("password hashing", () => {
  test("hashes and verifies a password without storing plaintext", async () => {
    const password = "versatech-dev-local";
    const hash = await hashPassword(password);

    assert.notEqual(hash, password);
    assert.match(hash, /^scrypt\$/);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword("wrong-password", hash), false);
  });

  test("rejects a malformed hash", async () => {
    assert.equal(await verifyPassword("anything", "plaintext"), false);
    assert.equal(await verifyPassword("anything", ""), false);
  });
});

describe("session token", () => {
  test("round-trips a user id", async () => {
    const token = await createSessionToken("user_abc", SECRET, 60);
    const payload = await verifySessionToken(token, SECRET);
    assert.deepEqual(payload, { sub: "user_abc" });
  });

  test("rejects a tampered token", async () => {
    const token = await createSessionToken("user_abc", SECRET, 60);
    const tampered = `${token.slice(0, -4)}xxxx`;
    assert.equal(await verifySessionToken(tampered, SECRET), null);
  });

  test("rejects a token signed with another secret", async () => {
    const token = await createSessionToken("user_abc", SECRET, 60);
    assert.equal(
      await verifySessionToken(token, "another-secret-at-least-32-characters!!"),
      null,
    );
  });

  test("rejects an expired token", async () => {
    const expired = await new SignJWT({ sub: "user_abc" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_abc")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));

    assert.equal(await verifySessionToken(expired, SECRET), null);
  });

  test("rejects an empty token", async () => {
    assert.equal(await verifySessionToken("", SECRET), null);
  });
});

describe("public paths and redirects", () => {
  test("only /connexion is public", () => {
    assert.equal(isPublicPath("/connexion"), true);
    assert.equal(isPublicPath("/connexion/reset"), true);
    assert.equal(isPublicPath("/"), false);
    assert.equal(isPublicPath("/entreprises"), false);
    assert.equal(isPublicPath("/projets/abc"), false);
  });

  test("blocks open redirects", () => {
    assert.equal(safeRedirectPath(null), "/");
    assert.equal(safeRedirectPath("/pipeline"), "/pipeline");
    assert.equal(safeRedirectPath("//evil.example"), "/");
    assert.equal(safeRedirectPath("https://evil.example"), "/");
    assert.equal(safeRedirectPath("/connexion"), "/");
    assert.equal(safeRedirectPath("/entreprises?x=1"), "/entreprises?x=1");
  });
});

describe("authenticated vs unauthenticated actor guard", () => {
  const actor = {
    id: "user_1",
    name: "Camille Durand",
    email: "camille.durand@versatech.example",
    role: "ADMIN" as const,
  };

  test("returns the actor when authenticated", () => {
    const result = actorOrUnauthorized(actor);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.actor.id, "user_1");
    }
  });

  test("returns AUTH_REQUIRED_RESULT when unauthenticated", () => {
    const result = actorOrUnauthorized(null);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.result, AUTH_REQUIRED_RESULT);
      assert.equal(result.result.message, "Authentification requise.");
    }
  });
});

describe("login rate limit", () => {
  test("blocks after too many attempts for the same email and ip", () => {
    const key = loginAttemptKey("camille.durand@versatech.example", "127.0.0.1");
    resetLoginAttempts(key);

    for (let index = 0; index < 8; index += 1) {
      assert.equal(consumeLoginAttempt(key).allowed, true);
    }

    assert.equal(consumeLoginAttempt(key).allowed, false);
    resetLoginAttempts(key);
    assert.equal(consumeLoginAttempt(key).allowed, true);
  });
});

describe("login schema", () => {
  test("normalizes email and requires a password", () => {
    const parsed = loginSchema.safeParse({
      email: "  Camille.Durand@Versatech.example ",
      password: "versatech-dev-local",
      from: "/pipeline",
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.email, "camille.durand@versatech.example");
    }

    const missing = loginSchema.safeParse({
      email: "not-an-email",
      password: "",
    });
    assert.equal(missing.success, false);
  });
});
