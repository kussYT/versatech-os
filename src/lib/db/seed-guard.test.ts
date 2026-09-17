import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertDestructiveSeedAllowed,
  isDestructiveSeedAllowed,
} from "./seed-guard";

describe("destructive seed guard", () => {
  test("refuses by default, even in development", () => {
    assert.equal(isDestructiveSeedAllowed({}), false);
    assert.equal(isDestructiveSeedAllowed({ NODE_ENV: "development" }), false);
    assert.equal(
      isDestructiveSeedAllowed({
        NODE_ENV: "development",
        ALLOW_DESTRUCTIVE_SEED: "false",
      }),
      false,
    );
    assert.equal(
      isDestructiveSeedAllowed({ ALLOW_DESTRUCTIVE_SEED: "" }),
      false,
    );
    assert.throws(
      () => assertDestructiveSeedAllowed({ NODE_ENV: "development" }),
      /ALLOW_DESTRUCTIVE_SEED=true/,
    );
  });

  test("refuses production even when the flag is true", () => {
    const env = {
      NODE_ENV: "production",
      ALLOW_DESTRUCTIVE_SEED: "true",
    };
    assert.equal(isDestructiveSeedAllowed(env), false);
    assert.throws(
      () => assertDestructiveSeedAllowed(env),
      /development seed in production/,
    );
  });

  test("allows only an explicit disposable-dev combination", () => {
    const env = {
      NODE_ENV: "development",
      ALLOW_DESTRUCTIVE_SEED: "true",
    };
    assert.equal(isDestructiveSeedAllowed(env), true);
    assert.doesNotThrow(() => assertDestructiveSeedAllowed(env));
  });
});
