import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CompanyLifecycle, OpportunityStage } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { signSensitiveIntent } from "@/lib/crm/sensitive-confirmation";
import { changeOpportunityStage, type OpportunityStageStore, type OpportunityStageTx } from "./stage";

const actor: SessionUser = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN",
};
const secret = "test-secret-at-least-32-characters";
const now = new Date("2026-10-05T13:42:00.000Z");

type Opp = {
  id: string;
  companyId: string;
  stage: OpportunityStage;
  lostReason: string | null;
  title: string;
  probability: number;
  wonAt: Date | null;
  lostAt: Date | null;
};

function createStore(seed: { opportunity: Opp; lifecycle: CompanyLifecycle }) {
  const opportunity = { ...seed.opportunity };
  const company = { id: opportunity.companyId, lifecycleStatus: seed.lifecycle };
  const history: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];
  let companyUpdates = 0;

  const tx = {
    opportunity: {
      findUnique: async () => ({
        ...opportunity,
        company: { lifecycleStatus: company.lifecycleStatus },
      }),
      update: async ({ data }: { data: Partial<Opp> }) => {
        Object.assign(opportunity, data);
        return opportunity;
      },
      count: async ({ where }: { where: { companyId: string; stage: OpportunityStage | { in: OpportunityStage[] } } }) => {
        if (where.companyId !== opportunity.companyId) {
          return 0;
        }
        const stage = where.stage;
        if (typeof stage === "string") {
          return opportunity.stage === stage ? 1 : 0;
        }
        return stage.in.includes(opportunity.stage) ? 1 : 0;
      },
    },
    quote: { count: async () => 0 },
    project: { count: async () => 0 },
    company: {
      update: async ({ data }: { data: { lifecycleStatus: CompanyLifecycle } }) => {
        company.lifecycleStatus = data.lifecycleStatus;
        companyUpdates += 1;
        return company;
      },
    },
    activityLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data);
        return data;
      },
    },
    opportunityStageHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        history.push(data);
        return data;
      },
    },
  } as unknown as OpportunityStageTx;

  const store: OpportunityStageStore = {
    $transaction: async (fn) => fn(tx),
  };

  return {
    store,
    opportunity: () => opportunity,
    company: () => company,
    history: () => history,
    logs: () => logs,
    companyUpdates: () => companyUpdates,
  };
}

function token(stage: "WON" | "LOST", lostReason: string | null, opportunityId = "opp_1") {
  return signSensitiveIntent(
    {
      kind: "opportunity-stage",
      actorId: actor.id,
      opportunityId,
      stage,
      lostReason,
      exp: now.getTime() + 60_000,
    },
    secret,
  );
}

const baseOpp: Opp = {
  id: "opp_1",
  companyId: "co_maro",
  stage: "INTERESTED",
  lostReason: null,
  title: "Création site vitrine",
  probability: 45,
  wonAt: null,
  lostAt: null,
};

describe("changeOpportunityStage", () => {
  test("INTERESTED → QUOTE writes the stage, history, and moves a lead company to OPPORTUNITY", async () => {
    const env = createStore({ opportunity: { ...baseOpp }, lifecycle: "LEAD" });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "QUOTE", lostReason: null },
      actor,
      { store: env.store, secret, now },
    );
    assert.equal(result.ok, true);
    assert.equal(env.opportunity().stage, "QUOTE");
    assert.equal(env.company().lifecycleStatus, "OPPORTUNITY");
    assert.equal(env.history().length, 1);
    assert.equal(env.history()[0]?.fromStage, "INTERESTED");
    assert.equal(env.history()[0]?.toStage, "QUOTE");
    assert.equal(
      env.logs().some((row) => row.action === "opportunity.stage_changed"),
      true,
    );
    assert.equal(
      env.logs().some((row) => row.action === "company.lifecycle_changed"),
      true,
    );
  });

  test("WON without a valid server confirmation is refused and writes nothing", async () => {
    const env = createStore({ opportunity: { ...baseOpp, stage: "QUOTE" }, lifecycle: "OPPORTUNITY" });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "WON", lostReason: null, confirmed: true } as never,
      actor,
      { store: env.store, secret, now, confirmationToken: "true" },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "CONFIRMATION_REQUIRED");
    }
    assert.equal(env.opportunity().stage, "QUOTE");
    assert.equal(env.history().length, 0);
    assert.equal(env.companyUpdates(), 0);
  });

  test("WON with a valid confirmation sets the stage and the company to CLIENT", async () => {
    const env = createStore({ opportunity: { ...baseOpp, stage: "QUOTE" }, lifecycle: "OPPORTUNITY" });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "WON", lostReason: null },
      actor,
      { store: env.store, secret, now, confirmationToken: token("WON", null) },
    );
    assert.equal(result.ok, true);
    assert.equal(env.opportunity().stage, "WON");
    assert.equal(env.company().lifecycleStatus, "CLIENT");
    assert.equal(env.history().length, 1);
  });

  test("replaying WON does not add another history row", async () => {
    const env = createStore({ opportunity: { ...baseOpp, stage: "WON" }, lifecycle: "CLIENT" });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "WON", lostReason: null },
      actor,
      { store: env.store, secret, now },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.unchanged, true);
    }
    assert.equal(env.history().length, 0);
    assert.equal(env.companyUpdates(), 0);
  });

  test("LOST without a valid confirmation is refused", async () => {
    const env = createStore({ opportunity: { ...baseOpp, stage: "QUOTE" }, lifecycle: "OPPORTUNITY" });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "LOST", lostReason: "Budget" },
      actor,
      { store: env.store, secret, now },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "CONFIRMATION_REQUIRED");
    }
    assert.equal(env.opportunity().stage, "QUOTE");
    assert.equal(env.company().lifecycleStatus, "OPPORTUNITY");
  });

  test("LOST with a valid confirmation does not mark the company as lost", async () => {
    const env = createStore({ opportunity: { ...baseOpp, stage: "QUOTE" }, lifecycle: "OPPORTUNITY" });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "LOST", lostReason: "Budget" },
      actor,
      { store: env.store, secret, now, confirmationToken: token("LOST", "Budget") },
    );
    assert.equal(result.ok, true);
    assert.equal(env.opportunity().stage, "LOST");
    assert.equal(env.opportunity().lostReason, "Budget");
    assert.equal(env.company().lifecycleStatus, "OPPORTUNITY");
    assert.equal(env.history().length, 1);
  });

  test("a stage change works when the company has no email, phone, or address", async () => {
    const env = createStore({
      opportunity: { ...baseOpp, stage: "TO_QUALIFY" },
      lifecycle: "LEAD",
    });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "QUOTE", lostReason: null },
      actor,
      { store: env.store, secret, now },
    );
    assert.equal(result.ok, true);
    assert.equal(env.opportunity().stage, "QUOTE");
    assert.ok(OPEN_OPPORTUNITY_STAGES.includes("QUOTE"));
  });

  test("a token for another stage is refused", async () => {
    const env = createStore({ opportunity: { ...baseOpp, stage: "QUOTE" }, lifecycle: "OPPORTUNITY" });
    const result = await changeOpportunityStage(
      { opportunityId: "opp_1", stage: "WON", lostReason: null },
      actor,
      { store: env.store, secret, now, confirmationToken: token("LOST", "Budget") },
    );
    assert.equal(result.ok, false);
    assert.equal(env.opportunity().stage, "QUOTE");
  });
});
