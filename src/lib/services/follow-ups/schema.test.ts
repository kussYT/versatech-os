import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FollowUpListItem } from "@/lib/queries/follow-ups";
import { mapFollowUpAgent, mapFollowUpList } from "./map";
import {
  LIST_FOLLOW_UPS_LIMITS,
  emptyFollowUpList,
  followUpAgentSchema,
  followUpListSchema,
  isPlainJsonValue,
  listFollowUpsInputSchema,
  parseFollowUpList,
  parseListFollowUpsInput,
  requireServiceActor,
  serializeFollowUpList,
  type FollowUpListDto,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

function sampleItem(): FollowUpListItem {
  return {
    id: "fu_1",
    title: "Relance devis",
    dueAt: "2026-09-19T07:00:00.000Z",
    status: "PENDING",
    completedAt: null,
    company: {
      id: "co_lead",
      name: "Atelier Nord",
      phone: "0472000000",
      email: "atelier@example.com",
    },
    phone: "0472000000",
    email: "atelier@example.com",
    lastInteraction: { type: "CALL", occurredAt: "2026-09-18T14:00:00.000Z" },
  };
}

function sampleList(overrides: Partial<FollowUpListDto> = {}): FollowUpListDto {
  return parseFollowUpList({
    items: [
      {
        id: "fu_1",
        title: "Relance devis",
        dueAt: "2026-09-19T07:00:00.000Z",
        status: "PENDING",
        completedAt: null,
        bucket: "today",
        company: { id: "co_lead", name: "Atelier Nord" },
        lastInteraction: { type: "CALL", occurredAt: "2026-09-18T14:00:00.000Z" },
      },
    ],
    returned: 1,
    limit: 15,
    ...overrides,
  });
}

describe("FollowUpService listFollowUps schema", () => {
  test("empty list is valid", () => {
    const empty = emptyFollowUpList();
    assert.deepEqual(empty.items, []);
    assert.equal(empty.returned, 0);
    assert.equal(empty.limit, LIST_FOLLOW_UPS_LIMITS.default);
    assert.equal(followUpListSchema.safeParse(empty).success, true);
  });

  test("JSON roundtrip uses ISO dates and omits phone/email/href", () => {
    const sample = sampleList();
    const roundtrip = JSON.parse(JSON.stringify(sample)) as unknown;
    assert.deepEqual(roundtrip, sample);
    assert.deepEqual(parseFollowUpList(roundtrip), sample);
    assert.equal(isPlainJsonValue(sample), true);
    const json = serializeFollowUpList(sample);
    assert.equal(json.includes('"href"'), false);
    assert.equal(json.includes('"phone"'), false);
    assert.equal(json.includes('"email"'), false);
    assert.match(sample.items[0]!.dueAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  test("limit default 15 max 30; oversized items fail", () => {
    assert.equal(LIST_FOLLOW_UPS_LIMITS.default, 15);
    assert.equal(LIST_FOLLOW_UPS_LIMITS.max, 30);
    assert.equal(parseListFollowUpsInput({}).limit, 15);
    assert.equal(listFollowUpsInputSchema.safeParse({ limit: 31 }).success, false);
    assert.equal(listFollowUpsInputSchema.safeParse({ bucket: "later" }).success, false);
    assert.equal(listFollowUpsInputSchema.safeParse({ companyId: "" }).success, false);

    const tooMany = {
      items: Array.from({ length: 31 }, (_, index) => ({
        id: `fu_${index}`,
        title: "Relance",
        dueAt: "2026-09-19T07:00:00.000Z",
        status: "PENDING" as const,
        completedAt: null,
        bucket: "upcoming" as const,
        company: { id: "co_x", name: "X" },
        lastInteraction: null,
      })),
      returned: 31,
      limit: 30,
    };
    assert.equal(followUpListSchema.safeParse(tooMany).success, false);
  });

  test("phone, email and href on agent items are rejected", () => {
    const base = sampleList().items[0]!;
    assert.equal(
      followUpAgentSchema.safeParse({ ...base, phone: "0102030405" }).success,
      false,
    );
    assert.equal(
      followUpAgentSchema.safeParse({ ...base, email: "a@b.c" }).success,
      false,
    );
    assert.equal(
      followUpAgentSchema.safeParse({ ...base, href: "/entreprises/co_lead" }).success,
      false,
    );
    assert.equal(
      followUpAgentSchema.safeParse({
        ...base,
        company: { ...base.company, phone: "0102030405" },
      }).success,
      false,
    );
  });

  test("Date objects are rejected", () => {
    const sample = sampleList();
    assert.equal(
      followUpListSchema.safeParse({
        ...sample,
        items: [{ ...sample.items[0]!, dueAt: new Date("2026-09-19T07:00:00.000Z") }],
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

describe("mapFollowUpList", () => {
  test("drops coordinates from FollowUpListItem and keeps ISO dueAt", () => {
    const mapped = mapFollowUpList([{ item: sampleItem(), bucket: "overdue" }], 15);
    assert.equal(mapped.returned, 1);
    assert.equal(mapped.items[0]?.bucket, "overdue");
    assert.equal(mapped.items[0]?.company.name, "Atelier Nord");
    assert.equal(mapped.items[0]?.lastInteraction?.type, "CALL");
    const json = JSON.stringify(mapped);
    assert.equal(json.includes("0472000000"), false);
    assert.equal(json.includes("atelier@example.com"), false);
    assert.equal(json.includes('"href"'), false);
    assert.equal(mapped.items[0]?.dueAt, "2026-09-19T07:00:00.000Z");
  });

  test("clamp respects limit", () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      item: { ...sampleItem(), id: `fu_${index}` },
      bucket: "today" as const,
    }));
    const mapped = mapFollowUpList(items, 3);
    assert.equal(mapped.items.length, 3);
    assert.equal(mapped.returned, 3);
    assert.equal(mapped.limit, 3);
  });

  test("mapFollowUpAgent never copies phone/email", () => {
    const agent = mapFollowUpAgent(sampleItem(), "today");
    assert.equal("phone" in agent, false);
    assert.equal("email" in agent, false);
    assert.deepEqual(Object.keys(agent.company).sort(), ["id", "name"]);
  });
});
