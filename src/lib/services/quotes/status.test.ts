import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CompanyLifecycle, OpportunityStage, QuoteStatus } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { parisParts } from "@/lib/dates";
import { projectDraftFromSale } from "@/lib/projects/draft";
import type { FollowUpWriteStore } from "@/lib/services/follow-ups/write";
import { scheduleQuoteFollowUp, updateQuoteStatus, type QuoteStatusStore, type QuoteStatusTx } from "./status";

const actor: SessionUser = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN",
};
const now = new Date("2026-10-05T12:00:00.000Z");

type Quote = {
  id: string;
  companyId: string;
  opportunityId: string;
  projectId: string | null;
  reference: string;
  amountIncTax: string;
  status: QuoteStatus;
  sentAt: Date | null;
  acceptedAt: Date | null;
};

type Opp = {
  id: string;
  companyId: string;
  stage: OpportunityStage;
  lostReason: string | null;
  title: string;
};

function createEnv(seed: {
  quotes: Quote[];
  opportunity: Opp;
  lifecycle: CompanyLifecycle;
  companyName?: string;
}) {
  const quotes = new Map(seed.quotes.map((quote) => [quote.id, { ...quote }]));
  const opportunity = { ...seed.opportunity };
  const company = {
    id: opportunity.companyId,
    name: seed.companyName ?? "Alex'ception",
    lifecycleStatus: seed.lifecycle,
  };
  const history: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];
  const projects: Array<Record<string, unknown>> = [];
  let companyUpdates = 0;

  function tx(): QuoteStatusTx {
    return {
      quote: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const quote = quotes.get(where.id);
          if (!quote) {
            return null;
          }
          return {
            ...quote,
            company: { ...company },
            opportunity: { id: opportunity.id, stage: opportunity.stage },
          };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Quote> }) => {
          const quote = quotes.get(where.id);
          if (quote) {
            Object.assign(quote, data);
          }
          return quote;
        },
        count: async () => 0,
      },
      opportunity: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id !== opportunity.id) {
            return null;
          }
          return {
            ...opportunity,
            company: { lifecycleStatus: company.lifecycleStatus },
          };
        },
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
      project: { count: async () => projects.length },
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
    } as unknown as QuoteStatusTx;
  }

  const store: QuoteStatusStore = {
    $transaction: async (fn) => {
      const snapshot = {
        quotes: [...quotes.entries()].map(([id, row]) => [id, { ...row }] as const),
        stage: opportunity.stage,
        lifecycle: company.lifecycleStatus,
        history: history.map((row) => ({ ...row })),
        logs: logs.map((row) => ({ ...row })),
        companyUpdates,
      };
      try {
        return await fn(tx());
      } catch (error) {
        quotes.clear();
        for (const [id, row] of snapshot.quotes) {
          quotes.set(id, { ...row });
        }
        opportunity.stage = snapshot.stage;
        company.lifecycleStatus = snapshot.lifecycle;
        history.splice(0, history.length, ...snapshot.history);
        logs.splice(0, logs.length, ...snapshot.logs);
        companyUpdates = snapshot.companyUpdates;
        throw error;
      }
    },
  };

  return {
    store,
    quotes: () => [...quotes.values()],
    opportunity: () => opportunity,
    company: () => company,
    history: () => history,
    logs: () => logs,
    projects: () => projects,
    companyUpdates: () => companyUpdates,
  };
}

const alexQuote: Quote = {
  id: "q_1",
  companyId: "co_alex",
  opportunityId: "opp_1",
  projectId: null,
  reference: "DEV-2026-001",
  amountIncTax: "3200.00",
  status: "SENT",
  sentAt: now,
  acceptedAt: null,
};

describe("updateQuoteStatus", () => {
  test("ACCEPTED wins the opportunity, makes the company a client, and does not create a project", async () => {
    const env = createEnv({
      quotes: [alexQuote],
      opportunity: { id: "opp_1", companyId: "co_alex", stage: "QUOTE", lostReason: null, title: "Refonte site internet" },
      lifecycle: "OPPORTUNITY",
    });
    const result = await updateQuoteStatus({ quoteId: "q_1", status: "ACCEPTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.data.becameClient, true);
    assert.equal(result.data.offerProject, true);
    assert.equal(env.quotes()[0]?.status, "ACCEPTED");
    assert.equal(env.opportunity().stage, "WON");
    assert.equal(env.company().lifecycleStatus, "CLIENT");
    assert.equal(env.history().length, 1);
    assert.equal(env.projects().length, 0);
    assert.equal(
      env.logs().some((row) => row.action === "quote.status_changed"),
      true,
    );
    assert.equal(
      env.logs().some((row) => row.action === "opportunity.stage_changed"),
      true,
    );
  });

  test("accepting a quote on an already won opportunity does not duplicate history", async () => {
    const env = createEnv({
      quotes: [{ ...alexQuote }],
      opportunity: { id: "opp_1", companyId: "co_alex", stage: "WON", lostReason: null, title: "Refonte site internet" },
      lifecycle: "CLIENT",
    });
    const result = await updateQuoteStatus({ quoteId: "q_1", status: "ACCEPTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, true);
    assert.equal(env.quotes()[0]?.status, "ACCEPTED");
    assert.equal(env.history().length, 0);
    assert.equal(env.companyUpdates(), 0);
    assert.equal(
      env.logs().filter((row) => row.action === "opportunity.stage_changed").length,
      0,
    );
  });

  test("replaying an accepted quote writes nothing more", async () => {
    const env = createEnv({
      quotes: [{ ...alexQuote, status: "ACCEPTED", acceptedAt: now }],
      opportunity: { id: "opp_1", companyId: "co_alex", stage: "WON", lostReason: null, title: "Refonte site internet" },
      lifecycle: "CLIENT",
    });
    const result = await updateQuoteStatus({ quoteId: "q_1", status: "ACCEPTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.unchanged, true);
      assert.equal(result.data.offerProject, true);
    }
    assert.equal(env.logs().length, 0);
    assert.equal(env.history().length, 0);
    assert.equal(env.projects().length, 0);
  });

  test("REJECTED leaves the opportunity and the company untouched", async () => {
    const env = createEnv({
      quotes: [{ ...alexQuote }],
      opportunity: { id: "opp_1", companyId: "co_alex", stage: "QUOTE", lostReason: null, title: "Refonte site internet" },
      lifecycle: "OPPORTUNITY",
    });
    const result = await updateQuoteStatus({ quoteId: "q_1", status: "REJECTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, true);
    assert.equal(env.quotes()[0]?.status, "REJECTED");
    assert.equal(env.opportunity().stage, "QUOTE");
    assert.equal(env.company().lifecycleStatus, "OPPORTUNITY");
    assert.equal(env.history().length, 0);
  });

  test("a second open quote stays untouched and the accepted amount feeds the project draft", async () => {
    const env = createEnv({
      quotes: [
        { ...alexQuote, id: "q_old", reference: "DEV-2026-001", amountIncTax: "1500.00", status: "SENT" },
        { ...alexQuote, id: "q_final", reference: "DEV-2026-002", amountIncTax: "3200.00", status: "SENT" },
      ],
      opportunity: { id: "opp_1", companyId: "co_alex", stage: "QUOTE", lostReason: null, title: "Refonte site internet" },
      lifecycle: "OPPORTUNITY",
    });
    const result = await updateQuoteStatus({ quoteId: "q_final", status: "ACCEPTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, true);
    assert.equal(env.quotes().find((quote) => quote.id === "q_old")?.status, "SENT");
    assert.equal(env.quotes().find((quote) => quote.id === "q_final")?.status, "ACCEPTED");
    assert.equal(env.opportunity().stage, "WON");
    const draft = projectDraftFromSale({
      companyId: "co_alex",
      companyName: "Alex'ception",
      opportunityTitle: "Refonte site internet",
      quoteAmountIncTax: "3200.00",
      quoteId: "q_final",
    });
    assert.equal(draft.name, "Refonte site internet — Alex'ception");
    assert.equal(draft.amount, "3200.00");
    assert.equal(draft.quoteId, "q_final");
    assert.equal(env.projects().length, 0);
  });

  test("a company that is already a client is not rewritten", async () => {
    const env = createEnv({
      quotes: [{ ...alexQuote, id: "q_next", opportunityId: "opp_2" }],
      opportunity: { id: "opp_2", companyId: "co_alex", stage: "QUOTE", lostReason: null, title: "Maintenance" },
      lifecycle: "CLIENT",
      companyName: "Alex'ception",
    });
    const result = await updateQuoteStatus({ quoteId: "q_next", status: "ACCEPTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.becameClient, false);
    }
    assert.equal(env.opportunity().stage, "WON");
    assert.equal(env.company().lifecycleStatus, "CLIENT");
    assert.equal(env.companyUpdates(), 0);
  });

  test("a name-only company can still accept a quote", async () => {
    const env = createEnv({
      quotes: [{ ...alexQuote, companyId: "co_maro" }],
      opportunity: { id: "opp_1", companyId: "co_maro", stage: "QUOTE", lostReason: null, title: "Création site vitrine" },
      lifecycle: "OPPORTUNITY",
      companyName: "Maro Créa",
    });
    const result = await updateQuoteStatus({ quoteId: "q_1", status: "ACCEPTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, true);
    assert.equal(env.company().lifecycleStatus, "CLIENT");
    assert.equal(env.opportunity().stage, "WON");
  });

  test("a missing opportunity rolls the quote acceptance back", async () => {
    const env = createEnv({
      quotes: [{ ...alexQuote, opportunityId: "opp_missing" }],
      opportunity: { id: "opp_1", companyId: "co_alex", stage: "QUOTE", lostReason: null, title: "Refonte site internet" },
      lifecycle: "OPPORTUNITY",
    });
    const result = await updateQuoteStatus({ quoteId: "q_1", status: "ACCEPTED" }, actor, {
      store: env.store,
      now,
    });
    assert.equal(result.ok, false);
    assert.equal(env.quotes()[0]?.status, "SENT");
    assert.equal(env.opportunity().stage, "QUOTE");
    assert.equal(env.logs().length, 0);
  });
});

describe("scheduleQuoteFollowUp", () => {
  test("a sent quote can schedule a follow-up in 3 days on its opportunity", async () => {
    const followUps: Array<Record<string, unknown>> = [];
    const followUpStore: FollowUpWriteStore = {
      company: {
        findUnique: async () => ({ id: "co_alex", priority: "NORMAL" }),
      },
      opportunity: {
        findFirst: async ({ where }) =>
          where.id === "opp_1" && where.companyId === "co_alex" ? { id: "opp_1" } : null,
      },
      followUp: { findUnique: async () => null },
      $transaction: async (fn) =>
        fn({
          followUp: {
            create: async ({ data }) => {
              followUps.push(data);
              return { id: "fu_1" };
            },
            update: async () => ({}),
          },
          activityLog: { create: async () => ({}) },
        }),
    };
    const result = await scheduleQuoteFollowUp(
      { quoteId: "q_1", preset: "in3Days" },
      actor,
      {
        now,
        quote: {
          findUnique: async () => ({
            id: "q_1",
            status: "SENT",
            companyId: "co_alex",
            opportunityId: "opp_1",
            reference: "DEV-2026-001",
          }),
        },
        followUps: followUpStore,
      },
    );
    assert.equal(result.ok, true);
    assert.equal(followUps[0]?.opportunityId, "opp_1");
    assert.equal(followUps[0]?.title, "Relancer — devis DEV-2026-001");
    const due = followUps[0]?.dueAt as Date;
    assert.equal(parisParts(due).day, 8);
    assert.equal(parisParts(due).hour, 9);
  });
});

