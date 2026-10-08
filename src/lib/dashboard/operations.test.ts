import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fromParisDateTime } from "@/lib/dates";
import {
  buildOperationsDashboard,
  type OperationsFollowUp,
  type OperationsInput,
  type OperationsOpportunity,
  type OperationsProspect,
  type OperationsQuote,
} from "./operations";

const now = fromParisDateTime(2026, 10, 5, 12, 0);

function followUp(overrides: Partial<OperationsFollowUp> = {}): OperationsFollowUp {
  return {
    id: "fu_1",
    title: "Relancer Maro",
    dueAt: fromParisDateTime(2026, 10, 5, 9, 0).toISOString(),
    status: "PENDING",
    companyId: "co_maro",
    companyName: "Maro Créa",
    opportunityId: "opp_maro",
    opportunityTitle: "Site vitrine",
    lastInteractionType: "MESSAGE",
    lastInteractionSubject: "Instagram",
    ...overrides,
  };
}

function quote(overrides: Partial<OperationsQuote> = {}): OperationsQuote {
  return {
    id: "q_1",
    reference: "DEV-2026-001",
    status: "SENT",
    amountIncTax: "3200.00",
    sentAt: fromParisDateTime(2026, 10, 1, 14, 0).toISOString(),
    acceptedAt: null,
    projectId: null,
    companyId: "co_alex",
    companyName: "Alex'ception",
    opportunityId: "opp_alex",
    opportunityTitle: "Refonte site internet",
    ...overrides,
  };
}

function prospect(overrides: Partial<OperationsProspect> = {}): OperationsProspect {
  return {
    id: "co_greg",
    name: "Chez Greg",
    lifecycleStatus: "LEAD",
    createdAt: fromParisDateTime(2026, 10, 4, 11, 0).toISOString(),
    interactionCount: 0,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OperationsOpportunity> = {}): OperationsOpportunity {
  return {
    id: "opp_alex",
    title: "Refonte site internet",
    stage: "QUOTE",
    estimatedValue: "1500.00",
    companyId: "co_alex",
    companyName: "Alex'ception",
    updatedAt: fromParisDateTime(2026, 9, 20, 10, 0).toISOString(),
    lastInteractionAt: null,
    ...overrides,
  };
}

function input(overrides: Partial<OperationsInput> = {}): OperationsInput {
  return {
    followUps: [],
    quotes: [],
    prospects: [],
    opportunities: [],
    pipeline: [
      { stage: "QUOTE", count: 2, estimatedValue: "4700.00" },
      { stage: "TO_QUALIFY", count: 1, estimatedValue: "800.00" },
      { stage: "WON", count: 4, estimatedValue: "9999.00" },
    ],
    activeProspects: 3,
    ...overrides,
  };
}

describe("buildOperationsDashboard", () => {
  test("an overdue follow-up is the first action and a future one is not overdue", () => {
    const view = buildOperationsDashboard(
      input({
        followUps: [
          followUp({ id: "fu_future", dueAt: fromParisDateTime(2026, 10, 6, 9, 0).toISOString() }),
          followUp({ id: "fu_late", dueAt: fromParisDateTime(2026, 10, 4, 9, 0).toISOString() }),
          followUp(),
        ],
      }),
      now,
    );

    assert.equal(view.today[0]?.id, "follow-up:fu_late");
    assert.equal(view.today[0]?.priority, 1);
    assert.equal(view.today[0]?.urgency, "overdue");
    assert.equal(view.followUps.overdue.length, 1);
    assert.equal(view.followUps.today.length, 1);
    assert.equal(view.followUps.upcoming.length, 1);
    assert.equal(view.kpis.overdueFollowUps, 1);
    assert.equal(view.kpis.todayFollowUps, 1);
  });

  test("the five commercial priorities stay in a fixed order", () => {
    const view = buildOperationsDashboard(
      input({
        followUps: [
          followUp({ id: "fu_late", dueAt: fromParisDateTime(2026, 10, 4, 9, 0).toISOString() }),
          followUp({ id: "fu_today", companyId: "co_today", companyName: "Aujourd'hui" }),
        ],
        quotes: [
          quote({
            id: "q_acc",
            status: "ACCEPTED",
            companyId: "co_acc",
            companyName: "Signé",
            opportunityId: "opp_acc",
          }),
          quote({ id: "q_sent", companyId: "co_sent", companyName: "Envoyé", opportunityId: "opp_sent" }),
        ],
        prospects: [prospect()],
      }),
      now,
    );

    assert.deepEqual(
      view.today.map((action) => action.priority),
      [1, 2, 3, 4, 5],
    );
  });

  test("a lead without an interaction is a prospect to contact, not a follow-up", () => {
    const view = buildOperationsDashboard(input({ prospects: [prospect()] }), now);
    assert.equal(view.today[0]?.kind, "new_prospect");
    assert.equal(view.today[0]?.companyName, "Chez Greg");
    assert.equal(view.today[0]?.context, "Aucun échange enregistré");
    assert.equal(view.followUps.overdue.length, 0);

    const skipped = buildOperationsDashboard(
      input({
        prospects: [
          prospect({ id: "lost", name: "Perdu", lifecycleStatus: "LOST" }),
          prospect({ id: "talked", name: "Déjà", interactionCount: 1 }),
          prospect({ id: "contacted", name: "Contacté", lifecycleStatus: "CONTACTED" }),
          prospect({ id: "covered", name: "Couvert" }),
        ],
        followUps: [followUp({ companyId: "covered", opportunityId: null })],
      }),
      now,
    );
    assert.equal(skipped.today.length, 1);
    assert.equal(skipped.today[0]?.kind, "follow_up");
  });

  test("a sent quote without a follow-up proposes one, and a covered quote does not warn", () => {
    const view = buildOperationsDashboard(
      input({
        quotes: [
          quote({ id: "q_open", opportunityId: "opp_open" }),
          quote({ id: "q_covered", opportunityId: "opp_covered", companyId: "co_maro", companyName: "Maro Créa" }),
          quote({ id: "q_seen", status: "VIEWED", opportunityId: "opp_seen", companyId: "co_seen", companyName: "Vue" }),
        ],
        followUps: [followUp({ opportunityId: "opp_covered", companyId: "co_maro" })],
      }),
      now,
    );

    const open = view.waitingQuotes.find((item) => item.id === "q_open");
    const covered = view.waitingQuotes.find((item) => item.id === "q_covered");
    const seen = view.waitingQuotes.find((item) => item.id === "q_seen");
    assert.equal(open?.missingFollowUp, true);
    assert.equal(open?.followUpLabel, null);
    assert.equal(covered?.missingFollowUp, false);
    assert.match(covered?.followUpLabel ?? "", /Relance le/);
    assert.equal(seen?.missingFollowUp, true);
    assert.equal(view.today.some((item) => item.id === "waiting:q_covered"), false);
    assert.equal(view.today.some((item) => item.id === "waiting:q_open"), true);
    assert.equal(view.today.some((item) => item.id === "waiting:q_seen"), true);
  });

  test("an accepted quote without a project can start one, and a linked quote cannot", () => {
    const view = buildOperationsDashboard(
      input({
        quotes: [
          quote({
            id: "q_yes",
            status: "ACCEPTED",
            acceptedAt: now.toISOString(),
            projectId: null,
            amountIncTax: "3200.00",
          }),
          quote({
            id: "q_done",
            status: "ACCEPTED",
            projectId: "prj_1",
            opportunityId: "opp_done",
          }),
          quote({
            id: "q_other",
            status: "SENT",
            opportunityId: "opp_alex",
            amountIncTax: "1500.00",
          }),
        ],
      }),
      now,
    );

    assert.equal(view.acceptedWithoutProject.length, 1);
    assert.equal(view.acceptedWithoutProject[0]?.id, "q_yes");
    assert.equal(view.acceptedWithoutProject[0]?.projectDraft.name, "Refonte site internet — Alex'ception");
    assert.equal(view.acceptedWithoutProject[0]?.projectDraft.amount, "3200.00");
    assert.equal(view.today.some((item) => item.quoteId === "q_done"), false);
    assert.equal(view.waitingQuotes.some((item) => item.id === "q_other"), true);
    assert.equal(view.kpis.pipelineEstimated, "5500.00");
    assert.equal(view.pipeline.find((column) => column.stage === "WON"), undefined);
    assert.equal(view.kpis.openOpportunities, 3);
    assert.equal(view.kpis.activeProspects, 3);
  });

  test("several actions on one company do not invent a second follow-up warning", () => {
    const view = buildOperationsDashboard(
      input({
        followUps: [followUp({ id: "fu_late", dueAt: fromParisDateTime(2026, 10, 4, 9, 0).toISOString() })],
        quotes: [quote({ id: "q_maro", companyId: "co_maro", companyName: "Maro Créa", opportunityId: "opp_maro" })],
        opportunities: [opportunity({ id: "opp_maro", companyId: "co_maro", companyName: "Maro Créa" })],
      }),
      now,
    );

    const maro = view.today.filter((item) => item.companyId === "co_maro");
    assert.deepEqual(maro.map((item) => item.kind), ["follow_up"]);
    assert.equal(view.waitingQuotes[0]?.missingFollowUp, false);
    assert.equal(view.staleOpportunities.length, 0);
  });

  test("a name-only prospect still appears, and an empty board stays empty", () => {
    const partial = buildOperationsDashboard(
      input({
        prospects: [prospect({ id: "co_maro", name: "Maro Créa" })],
        activeProspects: 1,
        pipeline: [],
      }),
      now,
    );
    assert.equal(partial.today[0]?.companyName, "Maro Créa");
    assert.equal(partial.pipeline.length, 6);
    assert.equal(partial.kpis.pipelineEstimated, "0.00");

    const empty = buildOperationsDashboard(
      input({ activeProspects: 0, pipeline: [] }),
      now,
    );
    assert.equal(empty.today.length, 0);
    assert.equal(empty.followUps.overdue.length, 0);
    assert.equal(empty.waitingQuotes.length, 0);
    assert.equal(empty.acceptedWithoutProject.length, 0);
    assert.equal(empty.kpis.overdueFollowUps, 0);
  });

  test("Paris civil days keep yesterday overdue and tomorrow upcoming across month, year and DST", () => {
    const month = buildOperationsDashboard(
      input({
        followUps: [followUp({ dueAt: fromParisDateTime(2026, 9, 30, 9, 0).toISOString() })],
      }),
      fromParisDateTime(2026, 10, 1, 8, 0),
    );
    assert.equal(month.followUps.overdue.length, 1);

    const year = buildOperationsDashboard(
      input({
        followUps: [
          followUp({ id: "old", dueAt: fromParisDateTime(2026, 12, 31, 9, 0).toISOString() }),
          followUp({ id: "next", dueAt: fromParisDateTime(2027, 1, 2, 9, 0).toISOString() }),
        ],
      }),
      fromParisDateTime(2027, 1, 1, 10, 0),
    );
    assert.equal(year.followUps.overdue.map((item) => item.id).includes("old"), true);
    assert.equal(year.followUps.upcoming.map((item) => item.id).includes("next"), true);

    const duringFallback = buildOperationsDashboard(
      input({
        followUps: [
          followUp({ id: "morning", dueAt: fromParisDateTime(2026, 10, 25, 9, 0).toISOString() }),
          followUp({ id: "previous", dueAt: fromParisDateTime(2026, 10, 24, 9, 0).toISOString() }),
        ],
      }),
      fromParisDateTime(2026, 10, 25, 12, 0),
    );
    assert.equal(duringFallback.followUps.today.map((item) => item.id).includes("morning"), true);
    assert.equal(duringFallback.followUps.overdue.map((item) => item.id).includes("previous"), true);
    assert.equal(duringFallback.followUps.overdue.map((item) => item.id).includes("morning"), false);

    const justAfterMidnight = buildOperationsDashboard(
      input({
        followUps: [followUp({ id: "morning", dueAt: fromParisDateTime(2026, 10, 25, 9, 0).toISOString() })],
      }),
      fromParisDateTime(2026, 10, 25, 0, 30),
    );
    assert.equal(justAfterMidnight.followUps.today.length, 1);
    assert.equal(justAfterMidnight.followUps.overdue.length, 0);

    const stillTheDayBefore = buildOperationsDashboard(
      input({
        followUps: [followUp({ id: "morning", dueAt: fromParisDateTime(2026, 10, 25, 9, 0).toISOString() })],
      }),
      fromParisDateTime(2026, 10, 24, 23, 0),
    );
    assert.equal(stillTheDayBefore.followUps.upcoming.length, 1);
    assert.equal(stillTheDayBefore.followUps.overdue.length, 0);
  });

  test("building the board does not mutate its input", () => {
    const source = input({
      followUps: [followUp()],
      quotes: [quote()],
      prospects: [prospect()],
    });
    const before = JSON.stringify(source);
    buildOperationsDashboard(source, now);
    assert.equal(JSON.stringify(source), before);
  });

  test("the dashboard query does not write", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "lib", "queries", "operations.ts"),
      "utf8",
    );
    assert.equal(source.includes(".update("), false);
    assert.equal(source.includes(".create("), false);
    assert.equal(source.includes(".delete("), false);
    assert.equal(source.includes(".upsert("), false);
  });
});
