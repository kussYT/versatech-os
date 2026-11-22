import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateGooglePushEligibility } from "@/lib/integrations/google/push-eligibility";

describe("evaluateGooglePushEligibility", () => {
  it("rejects non-MEETING calendar types", () => {
    const result = evaluateGooglePushEligibility({
      type: "TASK",
      syncStatus: null,
      externalProvider: null,
      externalId: null,
    });
    assert.deepEqual(result, { eligible: false, reason: "not_meeting" });
  });

  it("rejects Google-imported events (no write-back loop)", () => {
    const result = evaluateGooglePushEligibility({
      type: "MEETING",
      syncStatus: "imported",
      externalProvider: "google",
      externalId: "g_1",
    });
    assert.deepEqual(result, { eligible: false, reason: "imported" });
  });

  it("rejects remote_deleted markers", () => {
    const result = evaluateGooglePushEligibility({
      type: "MEETING",
      syncStatus: "remote_deleted",
      externalProvider: "google",
      externalId: "g_1",
    });
    assert.deepEqual(result, { eligible: false, reason: "remote_deleted" });
  });

  it("creates when a CRM RDV has no Google id", () => {
    const result = evaluateGooglePushEligibility({
      type: "MEETING",
      syncStatus: null,
      externalProvider: null,
      externalId: null,
    });
    assert.deepEqual(result, { eligible: true, mode: "create" });
  });

  it("updates when a CRM RDV already has a Google id (idempotent re-save)", () => {
    const result = evaluateGooglePushEligibility({
      type: "MEETING",
      syncStatus: "pushed",
      externalProvider: "google",
      externalId: "g_abc",
    });
    assert.deepEqual(result, { eligible: true, mode: "update" });
  });

  it("retries create/update after a previous error status", () => {
    const createRetry = evaluateGooglePushEligibility({
      type: "MEETING",
      syncStatus: "error:unavailable",
      externalProvider: null,
      externalId: null,
    });
    assert.deepEqual(createRetry, { eligible: true, mode: "create" });

    const updateRetry = evaluateGooglePushEligibility({
      type: "MEETING",
      syncStatus: "error:unavailable",
      externalProvider: "google",
      externalId: "g_abc",
    });
    assert.deepEqual(updateRetry, { eligible: true, mode: "update" });
  });
});
