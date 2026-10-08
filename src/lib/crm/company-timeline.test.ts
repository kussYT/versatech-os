import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildCompanyTimeline } from "./company-timeline";

const interaction = {
  id: "int_1",
  type: "CALL" as const,
  direction: "OUTBOUND" as const,
  result: null,
  notes: null,
  subject: null,
  occurredAt: "2026-10-05T10:00:00.000Z",
  followUpDueAt: null,
};

describe("buildCompanyTimeline", () => {
  test("mixes interactions, stage changes, and lifecycle, and ignores field edits", () => {
    const items = buildCompanyTimeline({
      interactions: [interaction],
      opportunities: [{ id: "opp_1", title: "Création site vitrine", estimatedValue: "1500" }],
      logs: [
        {
          id: "log_field",
          action: "company.updated",
          entityId: "co_1",
          createdAt: "2026-10-05T16:00:00.000Z",
          metadata: { field: "email" },
        },
        {
          id: "log_stage",
          action: "opportunity.stage_changed",
          entityId: "opp_1",
          createdAt: "2026-10-05T13:42:00.000Z",
          metadata: { fromStage: "INTERESTED", toStage: "QUOTE" },
        },
        {
          id: "log_life",
          action: "company.lifecycle_changed",
          entityId: "co_1",
          createdAt: "2026-10-05T13:42:01.000Z",
          metadata: { from: "OPPORTUNITY", to: "CLIENT" },
        },
      ],
    });

    assert.deepEqual(
      items.map((item) => item.kind),
      ["lifecycle", "stage", "interaction"],
    );
    const stage = items[1];
    assert.equal(stage?.kind, "stage");
    if (stage?.kind === "stage") {
      assert.equal(stage.title, "Création site vitrine");
      assert.equal(stage.fromStage, "INTERESTED");
      assert.equal(stage.toStage, "QUOTE");
    }
  });

  test("shows a sent quote and its follow-up without field edits", () => {
    const items = buildCompanyTimeline({
      interactions: [],
      opportunities: [],
      quotes: [{ id: "q_1", reference: "DEV-2026-001", amountIncTax: "3200.00" }],
      followUps: [
        {
          id: "fu_1",
          title: "Relancer — devis DEV-2026-001",
          dueAt: "2026-10-08T07:00:00.000Z",
          createdAt: "2026-10-05T14:21:00.000Z",
        },
      ],
      logs: [
        {
          id: "log_quote",
          action: "quote.status_changed",
          entityId: "q_1",
          createdAt: "2026-10-05T14:20:00.000Z",
          metadata: { toStatus: "SENT", reference: "DEV-2026-001", amountIncTax: "3200.00" },
        },
        {
          id: "log_viewed",
          action: "quote.status_changed",
          entityId: "q_1",
          createdAt: "2026-10-05T14:25:00.000Z",
          metadata: { toStatus: "VIEWED" },
        },
      ],
    });
    assert.deepEqual(
      items.map((item) => item.kind),
      ["followUp", "quote"],
    );
  });
});
