import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { healthHttpStatus, healthPayload } from "./status";

describe("health payload", () => {
  test("returns a generic ok payload", () => {
    assert.deepEqual(healthPayload(true), { status: "ok" });
    assert.equal(healthHttpStatus(true), 200);
  });

  test("returns a generic unavailable payload without details", () => {
    const payload = healthPayload(false);
    assert.deepEqual(payload, { status: "unavailable" });
    assert.equal(healthHttpStatus(false), 503);
    assert.equal("error" in payload, false);
    assert.equal(JSON.stringify(payload).includes("prisma"), false);
  });
});
