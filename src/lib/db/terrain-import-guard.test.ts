import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  TERRAIN_PROSPECT_IMPORT_FLAG,
  assertTerrainProspectImportAllowed,
  isTerrainProspectImportAllowed,
} from "./terrain-import-guard";

describe("terrain prospect import guard", () => {
  test("production without flag => refus", () => {
    const env = { NODE_ENV: "production" };
    assert.equal(isTerrainProspectImportAllowed(env), false);
    assert.throws(
      () => assertTerrainProspectImportAllowed(env),
      /ALLOW_TERRAIN_PROSPECT_IMPORT=true/,
    );
  });

  test("production with flag false => refus", () => {
    const env = {
      NODE_ENV: "production",
      ALLOW_TERRAIN_PROSPECT_IMPORT: "false",
    };
    assert.equal(isTerrainProspectImportAllowed(env), false);
    assert.throws(() => assertTerrainProspectImportAllowed(env), /production/);
  });

  test("production with flag true => autorisé", () => {
    const env = {
      NODE_ENV: "production",
      ALLOW_TERRAIN_PROSPECT_IMPORT: "true",
    };
    assert.equal(isTerrainProspectImportAllowed(env), true);
    assert.doesNotThrow(() => assertTerrainProspectImportAllowed(env));
  });

  test("ALLOW_DESTRUCTIVE_SEED does not authorize production import", () => {
    const env = {
      NODE_ENV: "production",
      ALLOW_DESTRUCTIVE_SEED: "true",
      ALLOW_TERRAIN_PROSPECT_IMPORT: "false",
    };
    assert.equal(isTerrainProspectImportAllowed(env), false);
    assert.throws(
      () => assertTerrainProspectImportAllowed(env),
      new RegExp(TERRAIN_PROSPECT_IMPORT_FLAG),
    );
  });

  test("development remains allowed without the production flag", () => {
    assert.equal(isTerrainProspectImportAllowed({ NODE_ENV: "development" }), true);
    assert.doesNotThrow(() =>
      assertTerrainProspectImportAllowed({ NODE_ENV: "development" }),
    );
  });
});
