import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { RecentActivityItem } from "@/lib/queries/activity";
import { mapRecentActivity, mapRecentActivityItem } from "./map";
import {
  RECENT_ACTIVITY_LIMITS,
  emptyRecentActivity,
  getRecentActivityInputSchema,
  isPlainJsonValue,
  parseGetRecentActivityInput,
  parseRecentActivity,
  recentActivityAgentSchema,
  recentActivityListSchema,
  requireServiceActor,
  serializeRecentActivity,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

function sampleItem(): RecentActivityItem {
  return {
    id: "act_1",
    action: "followup.created",
    entityType: "FollowUp",
    createdAt: "2026-09-19T08:30:00.000Z",
    actorName: "Camille Durand",
  };
}

describe("ActivityService getRecentActivity schema", () => {
  test("empty list is valid", () => {
    const empty = emptyRecentActivity();
    assert.deepEqual(empty.items, []);
    assert.equal(recentActivityListSchema.safeParse(empty).success, true);
  });

  test("JSON roundtrip uses labels and omits metadata", () => {
    const mapped = mapRecentActivity([sampleItem()], 8);
    const roundtrip = JSON.parse(JSON.stringify(mapped)) as unknown;
    assert.deepEqual(roundtrip, mapped);
    assert.deepEqual(parseRecentActivity(roundtrip), mapped);
    assert.equal(isPlainJsonValue(mapped), true);
    assert.equal(mapped.items[0]?.label, "Relance planifiée");
    const json = serializeRecentActivity(mapped);
    assert.equal(json.includes("metadata"), false);
    assert.equal(json.includes("entityId"), false);
  });

  test("limit default 8 max 20; oversized items fail", () => {
    assert.equal(RECENT_ACTIVITY_LIMITS.default, 8);
    assert.equal(RECENT_ACTIVITY_LIMITS.max, 20);
    assert.equal(parseGetRecentActivityInput({}).limit, 8);
    assert.equal(getRecentActivityInputSchema.safeParse({ limit: 21 }).success, false);

    const tooMany = {
      items: Array.from({ length: 21 }, (_, index) => ({
        id: `act_${index}`,
        action: "company.created",
        label: "Entreprise créée",
        entityType: "Company",
        createdAt: "2026-09-19T08:30:00.000Z",
        actorName: null,
      })),
    };
    assert.equal(recentActivityListSchema.safeParse(tooMany).success, false);
  });

  test("raw metadata on an item is rejected", () => {
    const agent = mapRecentActivityItem(sampleItem());
    assert.equal("metadata" in agent, false);
    assert.equal(
      recentActivityAgentSchema.safeParse({
        ...agent,
        metadata: { source: "ai", amount: "10.00" },
      }).success,
      false,
    );
  });

  test("requireServiceActor throws when actor id is missing, without redirect", () => {
    assert.throws(() => requireServiceActor({ ...actor, id: "" }), /Acteur requis/);
    assert.throws(() => requireServiceActor(null), /Acteur requis/);
    assert.doesNotThrow(() => requireServiceActor(actor));
  });
});
