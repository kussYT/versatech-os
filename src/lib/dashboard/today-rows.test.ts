import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildTodayRows } from "@/lib/dashboard/today-rows";
import type { OperationsDashboard } from "@/lib/dashboard/operations";

const emptyDashboard: OperationsDashboard = {
  today: [],
  followUps: { overdue: [], today: [], upcoming: [] },
  waitingQuotes: [],
  acceptedWithoutProject: [],
  staleOpportunities: [],
  moreProspects: [],
  kpis: {
    activeProspects: 0,
    overdueFollowUps: 0,
    todayFollowUps: 0,
    waitingQuotes: 0,
    openOpportunities: 0,
    pipelineEstimated: "0",
  },
  pipeline: [],
};

describe("buildTodayRows", () => {
  test("une relance déjà dans aujourd'hui n'est pas répétée", () => {
    const rows = buildTodayRows({
      dashboard: {
        ...emptyDashboard,
        today: [
          {
            id: "today:fu_1",
            priority: 1,
            kind: "follow_up",
            companyId: "co_1",
            companyName: "Atelier",
            title: "Rappeler",
            context: "Relance",
            whenLabel: "En retard",
            urgency: "overdue",
            followUpId: "fu_1",
            quoteId: null,
            projectDraft: null,
          },
        ],
        followUps: {
          overdue: [
            {
              id: "fu_1",
              title: "Rappeler",
              companyId: "co_1",
              companyName: "Atelier",
              opportunityTitle: null,
              dueAt: "2026-10-01T08:00:00.000Z",
              whenLabel: "En retard",
              context: "Relance",
              bucket: "overdue",
            },
          ],
          today: [],
          upcoming: [],
        },
      },
      agenda: [
        {
          id: "cal_follow",
          kind: "follow_up",
          entityId: "fu_1",
          title: "Rappeler",
          startsAt: "2026-10-01T08:00:00.000Z",
          endsAt: "2026-10-01T08:30:00.000Z",
          allDay: false,
          eventType: null,
          href: null,
          company: { id: "co_1", name: "Atelier" },
          project: null,
          editable: false,
          overdue: true,
        },
      ],
      tasks: [],
      prestations: { co_1: "Site en cours" },
    });

    assert.equal(rows.filter((row) => row.followUpId === "fu_1").length, 1);
    assert.equal(rows.some((row) => row.kind === "agenda"), false);
    assert.equal(rows[0]?.prestation, "Site en cours");
  });
});
