import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { nextLifecycleAfterOpportunityStageChange } from "@/lib/crm/lifecycle";
import { fromParisDateTime } from "@/lib/dates";
import {
  acceptMove,
  cancelConfirmation,
  cardMatchesQuery,
  createMoves,
  describeQuickView,
  followUpCaption,
  hiddenCardCount,
  kanbanFollowUpDue,
  openEstimatedValue,
  rejectMove,
  requestStageChange,
  shiftColumnTallies,
  stagesForFilter,
  storeConfirmationToken,
  type ColumnTally,
} from "./kanban";

const columns: ColumnTally[] = [
  { stage: "INTERESTED", count: 1, estimatedValue: "600.00" },
  { stage: "QUOTE", count: 1, estimatedValue: "3200.00" },
  { stage: "WON", count: 1, estimatedValue: "1500.00" },
  { stage: "LOST", count: 0, estimatedValue: "0.00" },
  { stage: "TO_QUALIFY", count: 0, estimatedValue: "0.00" },
  { stage: "TO_CONTACT", count: 0, estimatedValue: "0.00" },
  { stage: "CONTACTED", count: 0, estimatedValue: "0.00" },
  { stage: "MEETING", count: 0, estimatedValue: "0.00" },
];

function read(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("kanban moves", () => {
  test("an open move updates the card immediately and a failure puts it back", () => {
    const start = createMoves([{ id: "opp_maro", stage: "INTERESTED" }]);
    const requested = requestStageChange(start, "opp_maro", "QUOTE");
    assert.equal(requested.status, "submit");
    if (requested.status !== "submit") {
      return;
    }
    assert.equal(requested.confirmationToken, null);
    assert.equal(requested.state.cards[0]?.stage, "QUOTE");
    const moved = shiftColumnTallies(columns, "INTERESTED", "QUOTE", "600.00");
    assert.equal(moved.find((column) => column.stage === "QUOTE")?.count, 2);
    assert.equal(moved.find((column) => column.stage === "QUOTE")?.estimatedValue, "3800.00");

    const rolled = rejectMove(requested.state, "opp_maro", requested.generation, "Refusé");
    assert.equal(rolled.cards[0]?.stage, "INTERESTED");
    assert.equal(rolled.cards[0]?.lock, null);
    const restored = shiftColumnTallies(moved, "QUOTE", "INTERESTED", "600.00");
    assert.equal(restored.find((column) => column.stage === "INTERESTED")?.estimatedValue, "600.00");
  });

  test("won and lost wait for confirmation and a cancel writes nothing", () => {
    const start = createMoves([{ id: "opp_maro", stage: "QUOTE" }]);
    const won = requestStageChange(start, "opp_maro", "WON");
    assert.equal(won.status, "confirm");
    if (won.status !== "confirm") {
      return;
    }
    assert.equal(won.state.cards[0]?.stage, "QUOTE");
    const cancelled = cancelConfirmation(won.state, "opp_maro");
    assert.equal(cancelled.cards[0]?.stage, "QUOTE");
    assert.equal(cancelled.cards[0]?.lock, null);

    const lost = requestStageChange(start, "opp_maro", "LOST");
    assert.equal(lost.status, "confirm");
    if (lost.status !== "confirm") {
      return;
    }
    const withToken = storeConfirmationToken(lost.state, "opp_maro", lost.state.cards[0]?.generation ?? 0, "signed");
    assert.equal(withToken.cards[0]?.lock?.kind, "confirm");
    const committed = acceptMove(withToken, "opp_maro", withToken.cards[0]?.generation ?? 0);
    assert.equal(committed.cards[0]?.stage, "LOST");
  });

  test("a locked card ignores a second move and a stale response does not overwrite it", () => {
    const start = createMoves([{ id: "opp_maro", stage: "INTERESTED" }]);
    const first = requestStageChange(start, "opp_maro", "QUOTE");
    assert.equal(first.status, "submit");
    if (first.status !== "submit") {
      return;
    }
    const second = requestStageChange(first.state, "opp_maro", "MEETING");
    assert.equal(second.status, "blocked");
    const stale = acceptMove(first.state, "opp_maro", first.generation + 5);
    assert.equal(stale.cards[0]?.stage, "QUOTE");
    assert.equal(stale.cards[0]?.lock?.kind, "optimistic");
    const current = acceptMove(first.state, "opp_maro", first.generation);
    assert.equal(current.cards[0]?.lock, null);
    const lateReject = rejectMove(current, "opp_maro", first.generation, "trop tard");
    assert.equal(lateReject.cards[0]?.stage, "QUOTE");
  });

  test("terminal opportunities stay reachable and unloaded cards are counted", () => {
    assert.deepEqual(stagesForFilter("won"), ["WON"]);
    assert.deepEqual(stagesForFilter("lost"), ["LOST"]);
    assert.equal(stagesForFilter("all").includes("WON"), true);
    assert.equal(stagesForFilter("active").includes("WON"), false);
    assert.equal(hiddenCardCount(50, 40), 10);
    assert.equal(hiddenCardCount(3, 3), 0);
    assert.equal(cardMatchesQuery({ companyName: "Maro Créa", title: "Site vitrine" }, "maro"), true);
    assert.equal(cardMatchesQuery({ companyName: "Maro Créa", title: "Site vitrine" }, "boutique"), false);
    assert.equal(openEstimatedValue(columns), "3800.00");
  });

  test("a partial company and a follow-up preset stay displayable", () => {
    const view = describeQuickView({
      companyName: "Maro Créa",
      lifecycleLabel: "Lead",
      phone: null,
      email: "  ",
      instagram: "marocrea",
      title: "Site vitrine",
      stageLabel: "Intéressé",
      estimatedValue: "600.00",
      quoteReference: null,
      quoteAmount: null,
      lastInteraction: null,
      nextFollowUp: null,
    });
    assert.equal(view.companyName, "Maro Créa");
    assert.equal(view.instagram, "marocrea");
    assert.equal(view.phone, null);
    assert.equal(view.email, null);

    const now = fromParisDateTime(2026, 10, 5, 12, 0);
    const due = kanbanFollowUpDue("in3Days", now, null);
    assert.ok(due);
    assert.equal(followUpCaption(due?.toISOString() ?? "", now).startsWith("Relance"), true);
    assert.equal(kanbanFollowUpDue("custom", now, ""), null);
  });

  test("a client with another won sale or a project stays a client", () => {
    assert.equal(
      nextLifecycleAfterOpportunityStageChange({
        currentCompany: "CLIENT",
        fromStage: "WON",
        toStage: "QUOTE",
        factsAfterChange: {
          current: "CLIENT",
          wonOpportunityCount: 1,
          acceptedQuoteCount: 0,
          projectCount: 0,
          openOpportunityCount: 1,
        },
      }),
      null,
    );
  });

  test("the board reuses the stage action, the token, and the existing quick actions", () => {
    const board = read("src/components/pipeline/pipeline-board.tsx");
    const card = read("src/components/pipeline/opportunity-card.tsx");
    const quick = read("src/components/pipeline/opportunity-quick-view.tsx");
    const drawer = read("src/components/pipeline/pipeline-drawer.tsx");
    const action = read("src/actions/opportunities.ts");
    assert.match(board, /confirmationInDrawer/);
    assert.match(board, /Parmi les cartes chargées/);
    assert.match(board, /updateOpportunityStage/);
    assert.match(board, /confirmationToken/);
    assert.match(board, /cancelConfirmation/);
    assert.equal(board.includes("confirmed:"), false);
    assert.equal(board.includes("prisma."), false);
    assert.equal(board.includes("lifecycleStatus"), false);
    assert.match(card, /Changer l'étape/);
    assert.match(card, /<select/);
    assert.match(quick, /QuickInteractionPanel/);
    assert.match(quick, /opportunityId/);
    assert.match(quick, /createFollowUp/);
    assert.match(drawer, /showModal/);
    assert.match(action, /changeOpportunityStage/);
    assert.match(action, /confirmationToken/);
    const query = read("src/lib/queries/opportunities.ts");
    assert.match(query, /hiddenCardCount|KANBAN_PAGE_SIZE/);
    assert.match(query, /groupBy/);
  });
});
