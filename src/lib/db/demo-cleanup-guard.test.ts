import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEMO_COMPANY_IDS,
  PROTECTED_COMPANY_ID,
  PROTECTED_USER_ID,
  assertCompanyIdInAllowlist,
  assertDemoCleanupExecuteAllowed,
  assertDemoCleanupNotProduction,
  assertNotProtectedCompany,
  assertNotProtectedUser,
  isDemoCleanupExecuteAllowed,
  validateDemoCleanupAllowlist,
} from "./demo-cleanup-guard";

describe("demo cleanup guard", () => {
  test("production => refus, even with the flag", () => {
    const env = { NODE_ENV: "production", ALLOW_DEMO_CLEANUP: "true" };
    assert.equal(isDemoCleanupExecuteAllowed(env), false);
    assert.throws(() => assertDemoCleanupNotProduction(env), /production/);
    assert.throws(() => assertDemoCleanupExecuteAllowed(env), /production/);
  });

  test("flag absent => dry-run only / suppression refusée", () => {
    assert.equal(isDemoCleanupExecuteAllowed({ NODE_ENV: "development" }), false);
    assert.equal(isDemoCleanupExecuteAllowed({ ALLOW_DEMO_CLEANUP: "false" }), false);
    assert.equal(isDemoCleanupExecuteAllowed({ ALLOW_DEMO_CLEANUP: "" }), false);
    assert.doesNotThrow(() =>
      assertDemoCleanupNotProduction({ NODE_ENV: "development" }),
    );
    assert.throws(
      () => assertDemoCleanupExecuteAllowed({ NODE_ENV: "development" }),
      /ALLOW_DEMO_CLEANUP=true/,
    );
  });

  test("protected Company => refus", () => {
    assert.throws(
      () => assertNotProtectedCompany(PROTECTED_COMPANY_ID),
      /ALEX'CEPTION/,
    );
    assert.throws(
      () => assertCompanyIdInAllowlist(PROTECTED_COMPANY_ID),
      /ALEX'CEPTION/,
    );
    assert.throws(
      () => validateDemoCleanupAllowlist([PROTECTED_COMPANY_ID]),
      /ALEX'CEPTION/,
    );
  });

  test("protected User => refus", () => {
    assert.throws(
      () => assertNotProtectedUser(PROTECTED_USER_ID),
      /protected admin user/,
    );
    assert.throws(
      () => validateDemoCleanupAllowlist([PROTECTED_USER_ID]),
      /protected admin user/,
    );
  });

  test("ID hors allowlist => refus", () => {
    assert.throws(
      () => assertCompanyIdInAllowlist("clxxxxxxxxunknownid"),
      /not in the explicit demo cleanup allowlist/,
    );
    assert.doesNotThrow(() => assertCompanyIdInAllowlist(DEMO_COMPANY_IDS[0]));
    assert.deepEqual(validateDemoCleanupAllowlist(), [...DEMO_COMPANY_IDS]);
  });
});
