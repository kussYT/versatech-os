import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { completeFollowUp, createFollowUp, type FollowUpWriteStore } from "./write";
import { decideCompleteFollowUp, resolveFollowUpTitle } from "./write-rules";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  DEFAULT_FOLLOW_UP_TITLE,
  FOLLOW_UP_NOT_FOUND_MESSAGE,
  FOLLOW_UP_NOT_PENDING_MESSAGE,
  createFollowUpInputSchema,
} from "./schema";

const actor: SessionUser = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN",
};

const dueAt = new Date("2026-09-21T08:00:00.000Z");

type CompanyPriority = "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT";

function createStore(seed: {
  companies?: Record<string, { id: string; priority: CompanyPriority }>;
  opportunities?: Array<{ id: string; companyId: string; stage: string; updatedAt: Date }>;
  followUps?: Record<string, { id: string; companyId: string; status: "PENDING" | "COMPLETED" | "CANCELED" }>;
}) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];

  const store: FollowUpWriteStore = {
    company: {
      findUnique: async ({ where }) => seed.companies?.[where.id] ?? null,
    },
    opportunity: {
      findFirst: async ({ where }) => {
        const allowed = new Set(where.stage.in);
        const matches = (seed.opportunities ?? [])
          .filter((row) => row.companyId === where.companyId && allowed.has(row.stage))
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
        const first = matches[0];
        return first ? { id: first.id } : null;
      },
    },
    followUp: {
      findUnique: async ({ where }) => seed.followUps?.[where.id] ?? null,
    },
    $transaction: async (fn) =>
      fn({
        followUp: {
          create: async ({ data }) => {
            const row = { id: "fu_created", ...data };
            created.push(row);
            return { id: row.id };
          },
          update: async ({ where, data }) => {
            updated.push({ id: where.id, ...data });
            return data;
          },
        },
        activityLog: {
          create: async ({ data }) => {
            logs.push(data);
            return data;
          },
        },
      }),
  };

  return { store, created, updated, logs };
}

describe("follow-up write rules", () => {
  test("empty or blank title becomes Relance", () => {
    assert.equal(resolveFollowUpTitle(null), DEFAULT_FOLLOW_UP_TITLE);
    assert.equal(resolveFollowUpTitle("  "), DEFAULT_FOLLOW_UP_TITLE);
    assert.equal(resolveFollowUpTitle("Relance devis"), "Relance devis");
  });

  test("complete is no-op when already COMPLETED, rejects CANCELED", () => {
    assert.deepEqual(decideCompleteFollowUp("COMPLETED"), { kind: "noop" });
    assert.deepEqual(decideCompleteFollowUp("CANCELED"), {
      kind: "reject",
      message: FOLLOW_UP_NOT_PENDING_MESSAGE,
    });
    assert.deepEqual(decideCompleteFollowUp("PENDING"), { kind: "complete" });
  });
});

describe("FollowUpService.createFollowUp", () => {
  test("creates PENDING relance, attaches latest open opportunity, logs followup.created", async () => {
    const { store, created, logs } = createStore({
      companies: { co_atelier: { id: "co_atelier", priority: "HIGH" } },
      opportunities: [
        {
          id: "opp_old",
          companyId: "co_atelier",
          stage: "TO_CONTACT",
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
        {
          id: "opp_open",
          companyId: "co_atelier",
          stage: "QUOTE",
          updatedAt: new Date("2026-09-18T00:00:00.000Z"),
        },
        {
          id: "opp_won",
          companyId: "co_atelier",
          stage: "WON",
          updatedAt: new Date("2026-09-19T00:00:00.000Z"),
        },
      ],
    });

    const result = await createFollowUp(
      { actor, companyId: "co_atelier", dueAt, title: "  Rappeler Jacques  " },
      { store },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.data, { followUpId: "fu_created", companyId: "co_atelier" });
    assert.equal(created.length, 1);
    assert.equal(created[0]?.title, "Rappeler Jacques");
    assert.equal(created[0]?.status, "PENDING");
    assert.equal(created[0]?.priority, "HIGH");
    assert.equal(created[0]?.opportunityId, "opp_open");
    assert.equal(created[0]?.dueAt, dueAt);
    assert.equal(logs[0]?.action, "followup.created");
    assert.deepEqual(logs[0]?.metadata, { companyId: "co_atelier" });
    assert.equal(JSON.stringify(logs).includes("AUTH_SECRET"), false);
    assert.equal(created[0]?.opportunityId, "opp_open");
  });

  test("defaults title to Relance and opportunityId null when none open", async () => {
    const { store, created } = createStore({
      companies: { co_atelier: { id: "co_atelier", priority: "NORMAL" } },
      opportunities: [
        {
          id: "opp_lost",
          companyId: "co_atelier",
          stage: "LOST",
          updatedAt: new Date("2026-09-18T00:00:00.000Z"),
        },
      ],
    });

    const result = await createFollowUp({ actor, companyId: "co_atelier", dueAt }, { store });
    assert.equal(result.ok, true);
    assert.equal(created[0]?.title, "Relance");
    assert.equal(created[0]?.opportunityId, null);
  });

  test("unknown company is NOT_FOUND without writing", async () => {
    const { store, created, logs } = createStore({ companies: {} });
    const result = await createFollowUp({ actor, companyId: "co_missing", dueAt }, { store });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "NOT_FOUND");
    assert.equal(result.message, COMPANY_NOT_FOUND_MESSAGE);
    assert.equal(created.length, 0);
    assert.equal(logs.length, 0);
  });

  test("metadata.source=ai is optional and never stores chat text", async () => {
    const { store, logs } = createStore({
      companies: { co_atelier: { id: "co_atelier", priority: "NORMAL" } },
    });
    const result = await createFollowUp(
      {
        actor,
        companyId: "co_atelier",
        dueAt,
        source: "ai",
      },
      { store },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(logs[0]?.metadata, { companyId: "co_atelier", source: "ai" });
    const json = JSON.stringify(logs[0]);
    assert.equal(json.includes("prompt"), false);
    assert.equal(json.includes("Rappelle Jacques demain"), false);
  });

  test("missing actor is AUTH_REQUIRED", async () => {
    const { store, created } = createStore({
      companies: { co_atelier: { id: "co_atelier", priority: "NORMAL" } },
    });
    const result = await createFollowUp(
      { actor: { ...actor, id: "" }, companyId: "co_atelier", dueAt },
      { store },
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "AUTH_REQUIRED");
    assert.equal(created.length, 0);
  });

  test("object schema rejects FormData strings for dueAt", () => {
    assert.equal(
      createFollowUpInputSchema.safeParse({
        companyId: "co_atelier",
        dueAt: "2026-09-21T10:00",
        title: "Relance",
      }).success,
      false,
    );
    assert.equal(
      createFollowUpInputSchema.safeParse({
        companyId: "co_atelier",
        dueAt,
      }).success,
      true,
    );
  });
});

describe("FollowUpService.completeFollowUp", () => {
  test("PENDING → COMPLETED with completedAt and journal", async () => {
    const now = new Date("2026-09-19T12:00:00.000Z");
    const { store, updated, logs } = createStore({
      followUps: { fu_1: { id: "fu_1", companyId: "co_atelier", status: "PENDING" } },
    });
    const result = await completeFollowUp({ actor, followUpId: "fu_1" }, { store, now });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.data, { followUpId: "fu_1", companyId: "co_atelier" });
    assert.deepEqual(updated[0], { id: "fu_1", status: "COMPLETED", completedAt: now });
    assert.equal(logs[0]?.action, "followup.completed");
    assert.deepEqual(logs[0]?.metadata, { companyId: "co_atelier" });
  });

  test("already COMPLETED is a no-op without ActivityLog", async () => {
    const { store, updated, logs } = createStore({
      followUps: { fu_1: { id: "fu_1", companyId: "co_atelier", status: "COMPLETED" } },
    });
    const result = await completeFollowUp({ actor, followUpId: "fu_1" }, { store });
    assert.equal(result.ok, true);
    assert.equal(updated.length, 0);
    assert.equal(logs.length, 0);
  });

  test("CANCELED cannot be completed", async () => {
    const { store, updated } = createStore({
      followUps: { fu_1: { id: "fu_1", companyId: "co_atelier", status: "CANCELED" } },
    });
    const result = await completeFollowUp({ actor, followUpId: "fu_1" }, { store });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "CONFLICT");
    assert.equal(result.message, FOLLOW_UP_NOT_PENDING_MESSAGE);
    assert.equal(updated.length, 0);
  });

  test("unknown follow-up is NOT_FOUND", async () => {
    const { store } = createStore({});
    const result = await completeFollowUp({ actor, followUpId: "fu_missing" }, { store });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "NOT_FOUND");
    assert.equal(result.message, FOLLOW_UP_NOT_FOUND_MESSAGE);
  });
});

describe("optional shared tx", () => {
  test("createFollowUp uses the passed tx and does not open a nested $transaction", async () => {
    const created: Array<Record<string, unknown>> = [];
    const logs: Array<Record<string, unknown>> = [];
    let nested = 0;
    const { store } = createStore({
      companies: { co_atelier: { id: "co_atelier", priority: "NORMAL" } },
    });
    store.$transaction = async (fn) => {
      nested += 1;
      return fn({
        followUp: {
          create: async ({ data }) => {
            created.push({ id: "nested", ...data });
            return { id: "nested" };
          },
          update: async () => ({}),
        },
        activityLog: {
          create: async ({ data }) => {
            logs.push(data);
            return data;
          },
        },
      });
    };

    const tx = {
      company: store.company,
      opportunity: store.opportunity,
      followUp: {
        findUnique: store.followUp.findUnique,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push({ id: "fu_shared", ...data });
          return { id: "fu_shared" };
        },
        update: async () => ({}),
      },
      activityLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          logs.push(data);
          return data;
        },
      },
    } as unknown as Prisma.TransactionClient;

    const result = await createFollowUp({ actor, companyId: "co_atelier", dueAt }, { tx });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.followUpId, "fu_shared");
    }
    assert.equal(nested, 0);
    assert.equal(created[0]?.id, "fu_shared");
    assert.equal(logs[0]?.action, "followup.created");
  });
});
