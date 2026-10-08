import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SessionUser } from "@/lib/auth/types";
import { parisParts } from "@/lib/dates";
import {
  INTERACTION_COMPANY_NOT_FOUND_MESSAGE,
  createInteraction,
  recordQuickInteraction,
  type InteractionWriteStore,
  type InteractionWriteTx,
  type QuickInteractionWriteStore,
  type QuickInteractionWriteTx,
} from "./write";

const actor: SessionUser = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN",
};

const occurredAt = new Date("2026-10-03T15:00:00.000Z");

type Lifecycle = "LEAD" | "CONTACTED" | "QUALIFIED" | "OPPORTUNITY" | "CLIENT" | "INACTIVE" | "LOST";

function createStore(seed: {
  companies?: Record<string, { id: string; lifecycleStatus: Lifecycle }>;
  opportunities?: Array<{ id: string; companyId: string; stage: string; updatedAt: Date }>;
}) {
  const companies = new Map(Object.entries(seed.companies ?? {}).map(([id, row]) => [id, { ...row }]));
  const interactions: Array<Record<string, unknown>> = [];
  const companyUpdates: Array<{ id: string; lifecycleStatus: Lifecycle }> = [];
  const logs: Array<Record<string, unknown>> = [];
  const reads: string[] = [];
  let inTransaction = false;

  const tx: InteractionWriteTx = {
    company: {
      findUnique: async ({ where }) => {
        reads.push(inTransaction ? "company:tx" : "company:outside");
        return companies.get(where.id) ?? null;
      },
      update: async ({ where, data }) => {
        companyUpdates.push({ id: where.id, lifecycleStatus: data.lifecycleStatus });
        const row = companies.get(where.id);
        if (row) {
          row.lifecycleStatus = data.lifecycleStatus;
        }
        return row;
      },
    },
    opportunity: {
      findFirst: async ({ where }) => {
        reads.push(inTransaction ? "opportunity:tx" : "opportunity:outside");
        if (where.id) {
          const match = (seed.opportunities ?? []).find(
            (row) => row.companyId === where.companyId && row.id === where.id,
          );
          return match ? { id: match.id } : null;
        }
        const allowed = new Set(where.stage?.in ?? []);
        const first = (seed.opportunities ?? [])
          .filter((row) => row.companyId === where.companyId && allowed.has(row.stage))
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
        return first ? { id: first.id } : null;
      },
    },
    interaction: {
      create: async ({ data }) => {
        const row = { id: `int_${interactions.length + 1}`, ...data };
        interactions.push(row);
        return { id: row.id, type: data.type };
      },
    },
    activityLog: {
      create: async ({ data }) => {
        logs.push(data);
        return data;
      },
    },
  };

  const store: InteractionWriteStore = {
    $transaction: async (fn) => {
      inTransaction = true;
      try {
        return await fn(tx);
      } finally {
        inTransaction = false;
      }
    },
  };

  return { store, companies, interactions, companyUpdates, logs, reads };
}

describe("InteractionWriteService.createInteraction", () => {
  test("CALL on a name-only LEAD company: interaction, LEAD → CONTACTED, journal", async () => {
    const env = createStore({
      companies: { co_maro: { id: "co_maro", lifecycleStatus: "LEAD" } },
    });

    const result = await createInteraction(
      {
        companyId: "co_maro",
        type: "CALL",
        direction: "OUTBOUND",
        result: null,
        occurredAt,
        notes: null,
      },
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.data, { interactionId: "int_1", companyId: "co_maro" });
    assert.deepEqual(env.interactions[0], {
      id: "int_1",
      companyId: "co_maro",
      opportunityId: null,
      type: "CALL",
      direction: "OUTBOUND",
      result: null,
      notes: null,
      occurredAt,
      createdById: "user_1",
    });
    assert.deepEqual(env.companyUpdates, [{ id: "co_maro", lifecycleStatus: "CONTACTED" }]);
    assert.deepEqual(env.logs, [
      {
        actorId: "user_1",
        entityType: "Company",
        entityId: "co_maro",
        action: "company.lifecycle_changed",
        metadata: { from: "LEAD", to: "CONTACTED", reason: "interaction.created", type: "CALL" },
      },
      {
        actorId: "user_1",
        entityType: "Interaction",
        entityId: "int_1",
        action: "interaction.created",
        metadata: { type: "CALL", companyId: "co_maro" },
      },
    ]);
    assert.deepEqual(env.reads, ["company:tx", "opportunity:tx"]);
  });

  test("NOTE does not change lifecycle; latest open opportunity is attached", async () => {
    const env = createStore({
      companies: { co_maro: { id: "co_maro", lifecycleStatus: "LEAD" } },
      opportunities: [
        { id: "opp_won", companyId: "co_maro", stage: "WON", updatedAt: new Date("2026-10-02") },
        { id: "opp_open", companyId: "co_maro", stage: "QUOTE", updatedAt: new Date("2026-10-01") },
      ],
    });

    const result = await createInteraction(
      {
        companyId: "co_maro",
        type: "NOTE",
        direction: "INTERNAL",
        result: null,
        occurredAt,
        notes: "Besoin : site vitrine",
      },
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, true);
    assert.equal(env.interactions[0]?.opportunityId, "opp_open");
    assert.equal(env.companyUpdates.length, 0);
    assert.deepEqual(env.logs.map((log) => log.action), ["interaction.created"]);
  });

  test("missing company is NOT_FOUND with no write", async () => {
    const env = createStore({ companies: {} });
    const result = await createInteraction(
      {
        companyId: "co_missing",
        type: "CALL",
        direction: "OUTBOUND",
        result: null,
        occurredAt,
        notes: null,
      },
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "NOT_FOUND");
      assert.equal(result.message, INTERACTION_COMPANY_NOT_FOUND_MESSAGE);
    }
    assert.equal(env.interactions.length, 0);
    assert.equal(env.companyUpdates.length, 0);
    assert.equal(env.logs.length, 0);
  });

  test("invalid type or missing actor writes nothing", async () => {
    const env = createStore({
      companies: { co_maro: { id: "co_maro", lifecycleStatus: "LEAD" } },
    });
    const invalid = await createInteraction(
      {
        companyId: "co_maro",
        type: "QUOTE" as never,
        direction: "OUTBOUND",
        result: null,
        occurredAt,
        notes: null,
      },
      actor,
      { store: env.store },
    );
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.code, "VALIDATION");
    }

    const anonymous = await createInteraction(
      {
        companyId: "co_maro",
        type: "CALL",
        direction: "OUTBOUND",
        result: null,
        occurredAt,
        notes: null,
      },
      { ...actor, id: "" },
      { store: env.store },
    );
    assert.equal(anonymous.ok, false);
    if (!anonymous.ok) {
      assert.equal(anonymous.code, "AUTH_REQUIRED");
    }
    assert.equal(env.interactions.length, 0);
    assert.equal(env.logs.length, 0);
  });
});

type QuickCompany = {
  id: string;
  lifecycleStatus: Lifecycle;
  priority: "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT";
};

function createQuickStore(seed: {
  companies?: Record<string, QuickCompany>;
  failFollowUp?: boolean;
  opportunities?: { id: string; companyId: string }[];
}) {
  const companies = new Map(Object.entries(seed.companies ?? {}).map(([id, row]) => [id, { ...row }]));
  let interactions: Array<Record<string, unknown>> = [];
  let followUps: Array<Record<string, unknown>> = [];
  let companyUpdates: Array<{ id: string; lifecycleStatus: Lifecycle }> = [];
  let logs: Array<Record<string, unknown>> = [];

  const tx: QuickInteractionWriteTx = {
    company: {
      findUnique: async ({ where }) => companies.get(where.id) ?? null,
      update: async ({ where, data }) => {
        companyUpdates.push({ id: where.id, lifecycleStatus: data.lifecycleStatus });
        const row = companies.get(where.id);
        if (row) {
          row.lifecycleStatus = data.lifecycleStatus;
        }
        return row;
      },
    },
    opportunity: {
      findFirst: async ({ where }) => {
        const rows = seed.opportunities ?? [];
        if (where.id) {
          const match = rows.find((row) => row.id === where.id && row.companyId === where.companyId);
          return match ? { id: match.id } : null;
        }
        const first = rows.find((row) => row.companyId === where.companyId);
        return first ? { id: first.id } : null;
      },
    },
    interaction: {
      create: async ({ data }) => {
        const row = { id: `int_${interactions.length + 1}`, ...data };
        interactions.push(row);
        return { id: row.id, type: data.type };
      },
    },
    followUp: {
      create: async ({ data }) => {
        if (seed.failFollowUp) {
          throw new Error("follow-up failed");
        }
        const row = { id: `fu_${followUps.length + 1}`, ...data };
        followUps.push(row);
        return { id: row.id };
      },
    },
    activityLog: {
      create: async ({ data }) => {
        logs.push(data);
        return data;
      },
    },
  };

  const store: QuickInteractionWriteStore = {
    $transaction: async (fn) => {
      const snapshot = {
        interactions: interactions.map((row) => ({ ...row })),
        followUps: followUps.map((row) => ({ ...row })),
        companyUpdates: companyUpdates.map((row) => ({ ...row })),
        logs: logs.map((row) => ({ ...row })),
        lifecycles: new Map([...companies.entries()].map(([id, row]) => [id, row.lifecycleStatus])),
      };
      try {
        return await fn(tx);
      } catch (error) {
        interactions = snapshot.interactions;
        followUps = snapshot.followUps;
        companyUpdates = snapshot.companyUpdates;
        logs = snapshot.logs;
        for (const [id, lifecycleStatus] of snapshot.lifecycles) {
          const row = companies.get(id);
          if (row) {
            row.lifecycleStatus = lifecycleStatus;
          }
        }
        throw error;
      }
    },
  };

  return {
    store,
    interactions: () => interactions,
    followUps: () => followUps,
    companyUpdates: () => companyUpdates,
    logs: () => logs,
  };
}

const maro: QuickCompany = { id: "co_maro", lifecycleStatus: "LEAD", priority: "NORMAL" };
const now = new Date("2026-10-05T12:00:00.000Z");

describe("recordQuickInteraction", () => {
  test("an explicit opportunity id is attached instead of another open opportunity", async () => {
    const env = createQuickStore({
      companies: { co_maro: { ...maro } },
      opportunities: [
        { id: "opp_other", companyId: "co_maro" },
        { id: "opp_maro", companyId: "co_maro" },
      ],
    });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        opportunityId: "opp_maro",
        type: "NOTE",
        callOutcome: null,
        channel: null,
        notes: "Appel depuis le kanban",
        followUp: "none",
        customDueDate: null,
      },
      actor,
      { store: env.store, now },
    );
    assert.equal(result.ok, true);
    assert.equal(env.interactions()[0]?.opportunityId, "opp_maro");
  });

  test("unanswered call in 3 days creates the interaction and the follow-up, and stays LEAD", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } } });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        type: "CALL",
        callOutcome: "no_answer",
        channel: null,
        notes: null,
        followUp: "in3Days",
        customDueDate: null,
      },
      actor,
      { store: env.store, now },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(env.interactions()[0]?.result, "NO_ANSWER");
    assert.equal(env.interactions()[0]?.companyId, "co_maro");
    assert.equal(env.interactions()[0]?.type, "CALL");
    assert.equal(env.followUps()[0]?.sourceInteractionId, "int_1");
    assert.equal(env.followUps()[0]?.companyId, "co_maro");
    assert.equal(env.followUps()[0]?.title, "Relancer — appel sans réponse");
    const due = env.followUps()[0]?.dueAt as Date;
    assert.equal(parisParts(due).year, 2026);
    assert.equal(parisParts(due).month, 10);
    assert.equal(parisParts(due).day, 8);
    assert.equal(parisParts(due).hour, 9);
    assert.equal(env.companyUpdates().length, 0);
    assert.equal(result.data.followUpId, "fu_1");
    assert.match(result.data.message, /Relance le 08\/10/);
  });

  test("answered call without follow-up marks LEAD as CONTACTED", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } } });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        type: "CALL",
        callOutcome: "answered",
        channel: null,
        notes: "Intéressée, veut une proposition.",
        followUp: "none",
        customDueDate: null,
      },
      actor,
      { store: env.store, now },
    );

    assert.equal(result.ok, true);
    assert.equal(env.followUps().length, 0);
    assert.equal(env.interactions()[0]?.result, null);
    assert.equal(env.interactions()[0]?.notes, "Intéressée, veut une proposition.");
    assert.deepEqual(env.companyUpdates(), [{ id: "co_maro", lifecycleStatus: "CONTACTED" }]);
  });

  test("message with a note and a follow-up tomorrow stores the channel in subject", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } } });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        type: "MESSAGE",
        callOutcome: null,
        channel: "Instagram",
        notes: "Présentation envoyée.",
        followUp: "tomorrow",
        customDueDate: null,
      },
      actor,
      { store: env.store, now },
    );

    assert.equal(result.ok, true);
    assert.equal(env.interactions()[0]?.subject, "Instagram");
    assert.equal(env.interactions()[0]?.notes, "Présentation envoyée.");
    assert.equal(env.companyUpdates().length, 0);
    assert.equal(env.followUps().length, 1);
    const due = env.followUps()[0]?.dueAt as Date;
    assert.equal(parisParts(due).day, 6);
    assert.equal(parisParts(due).hour, 9);
  });

  test("a note alone does not create a follow-up", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } } });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        type: "NOTE",
        callOutcome: null,
        channel: null,
        notes: "À revoir le brief.",
        followUp: "none",
        customDueDate: null,
      },
      actor,
      { store: env.store, now },
    );

    assert.equal(result.ok, true);
    assert.equal(env.interactions()[0]?.direction, "INTERNAL");
    assert.equal(env.followUps().length, 0);
    assert.equal(env.companyUpdates().length, 0);
  });

  test("a custom follow-up date is 09:00 Paris on that civil day", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } } });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        type: "EMAIL",
        callOutcome: null,
        channel: null,
        notes: "Devis envoyé par email",
        followUp: "custom",
        customDueDate: "2026-11-02",
      },
      actor,
      { store: env.store, now },
    );

    assert.equal(result.ok, true);
    const due = env.followUps()[0]?.dueAt as Date;
    assert.equal(parisParts(due).year, 2026);
    assert.equal(parisParts(due).month, 11);
    assert.equal(parisParts(due).day, 2);
    assert.equal(parisParts(due).hour, 9);
    assert.equal(env.companyUpdates().length, 0);
  });

  test("a follow-up failure rolls the interaction back", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } }, failFollowUp: true });
    await assert.rejects(
      () =>
        recordQuickInteraction(
          {
            companyId: "co_maro",
            type: "CALL",
            callOutcome: "no_answer",
            channel: null,
            notes: null,
            followUp: "in3Days",
            customDueDate: null,
          },
          actor,
          { store: env.store, now },
        ),
      /follow-up failed/,
    );
    assert.equal(env.interactions().length, 0);
    assert.equal(env.followUps().length, 0);
    assert.equal(env.logs().length, 0);
    assert.equal(env.companyUpdates().length, 0);
  });

  test("name-only company can still log an interaction", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } } });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        type: "CALL",
        callOutcome: "no_answer",
        channel: null,
        notes: null,
        followUp: "none",
        customDueDate: null,
      },
      actor,
      { store: env.store, now },
    );
    assert.equal(result.ok, true);
    assert.equal(env.interactions()[0]?.companyId, "co_maro");
    assert.equal(env.followUps().length, 0);
  });

  test("a meeting marks a LEAD as CONTACTED", async () => {
    const env = createQuickStore({ companies: { co_maro: { ...maro } } });
    const result = await recordQuickInteraction(
      {
        companyId: "co_maro",
        type: "MEETING",
        callOutcome: null,
        channel: null,
        notes: "RDV effectué",
        followUp: "none",
        customDueDate: null,
      },
      actor,
      { store: env.store, now },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(env.companyUpdates(), [{ id: "co_maro", lifecycleStatus: "CONTACTED" }]);
  });
});
