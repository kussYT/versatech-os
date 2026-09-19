import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { endOfParisDay, startOfParisDay } from "@/lib/dates";
import { ZERO_MONEY } from "@/lib/money";
import { calendarItemUiHrefs, toTodayDashboardView } from "./map-dashboard";
import { mapTodayOverview, type TodayLoaded } from "./map-overview";
import {
  TODAY_OVERVIEW_LIMITS,
  TODAY_OVERVIEW_TIMEZONE,
  agendaItemSchema,
  assertTodayOverview,
  clampTodayOverviewCollections,
  emptyTodayOverview,
  isPlainJsonValue,
  moneyStringSchema,
  parseTodayOverview,
  serializeTodayOverview,
  toTodayKpi,
  todayOverviewSchema,
  type TodayOverview,
} from "./schema";

const civilDate = "2026-09-19";
const generatedAt = "2026-09-19T09:14:00.000Z";
const parisDayStart = startOfParisDay(civilDate).toISOString();
const parisDayEnd = endOfParisDay(civilDate).toISOString();

function sampleOverview(overrides: Partial<TodayOverview> = {}): TodayOverview {
  const base = emptyTodayOverview({ generatedAt, civilDate });
  return {
    ...base,
    ...overrides,
    tour: { ...base.tour, ...overrides.tour },
    followUps: { ...base.followUps, ...overrides.followUps },
    tasks: { ...base.tasks, ...overrides.tasks },
    pipeline: {
      ...base.pipeline,
      ...overrides.pipeline,
      counts: { ...base.pipeline.counts, ...overrides.pipeline?.counts },
    },
    finance: { ...base.finance, ...overrides.finance },
    interactionsToday: { ...base.interactionsToday, ...overrides.interactionsToday },
  };
}

function populatedOverview(): TodayOverview {
  return sampleOverview({
    tour: {
      planned: 4,
      visited: 1,
      remaining: 3,
      nextNames: ["HL BEAUTY", "Artisan Mickael couvreur", "Premium auto"],
      nextStops: [
        { companyId: "co_hl", name: "HL BEAUTY" },
        { companyId: "co_m", name: "Artisan Mickael couvreur" },
        { companyId: "co_p", name: "Premium auto" },
      ],
      stops: [
        {
          id: "stop_0",
          order: 0,
          visitedAt: "2026-09-19T07:30:00.000Z",
          company: { id: "co_done", name: "Visité" },
        },
        {
          id: "stop_1",
          order: 1,
          visitedAt: null,
          company: { id: "co_hl", name: "HL BEAUTY" },
        },
      ],
    },
    calls: [
      {
        id: "co_lead",
        name: "Atelier Nord",
        city: "Lyon",
        industry: "Menuiserie",
        lifecycleStatus: "LEAD",
        source: "terrain",
        priority: "HIGH",
        primaryContact: { firstName: "Léa", lastName: "Martin", role: "Gérante" },
        lastInteractionAt: "2026-09-18T14:00:00.000Z",
        lastInteractionType: "CALL",
        nextFollowUpAt: "2026-09-19T08:00:00.000Z",
        nextFollowUpTitle: "Relance devis",
      },
    ],
    followUps: {
      dueCount: 2,
      overdueCount: 1,
      todayCount: 1,
      preview: [
        {
          id: "fu_1",
          title: "Relance devis",
          dueAt: "2026-09-19T07:00:00.000Z",
          status: "PENDING",
          company: { id: "co_lead", name: "Atelier Nord" },
        },
      ],
    },
    tasks: {
      openCount: 4,
      preview: [
        {
          id: "task_1",
          title: "Préparer maquette",
          dueAt: "2026-09-19T16:00:00.000Z",
          priority: "NORMAL",
          project: { id: "proj_1", name: "Site vitrine" },
        },
      ],
    },
    agenda: [
      {
        id: "event:evt_rdv",
        kind: "event",
        entityId: "evt_rdv",
        title: "RDV commercial",
        startsAt: "2026-09-19T08:00:00.000Z",
        endsAt: "2026-09-19T09:00:00.000Z",
        allDay: false,
        eventType: "MEETING",
        company: { id: "co_client", name: "ALEX'CEPTION" },
        project: null,
        overdue: false,
        visitOrder: null,
        visitStatus: null,
      },
      {
        id: "terrain_visit:stop_1",
        kind: "terrain_visit",
        entityId: "stop_1",
        title: "Visite terrain — HL BEAUTY",
        startsAt: parisDayStart,
        endsAt: parisDayEnd,
        allDay: true,
        eventType: null,
        company: { id: "co_hl", name: "HL BEAUTY" },
        project: null,
        overdue: false,
        visitOrder: 1,
        visitStatus: "pending",
      },
    ],
    pipeline: {
      openCount: 3,
      brutTotal: "14500.00",
      weightedTotal: "8700.00",
      counts: {
        TO_QUALIFY: 1,
        TO_CONTACT: 1,
        CONTACTED: 0,
        INTERESTED: 1,
        MEETING: 0,
        QUOTE: 0,
        WON: 2,
        LOST: 0,
      },
    },
    finance: {
      signed: "14500.00",
      collected: "5800.00",
      remaining: "8700.00",
      overdueCount: 1,
    },
    interactionsToday: { calls: 2, meetings: 1 },
    recentActivity: [
      {
        id: "act_1",
        action: "tour.stop_visited",
        label: "Visite terrain enregistrée",
        entityType: "TourStop",
        createdAt: "2026-09-19T08:30:00.000Z",
        actorName: "Marius",
      },
    ],
  });
}

describe("TodayOverview schema", () => {
  test("empty overview is valid with zero KPIs and empty arrays", () => {
    const empty = emptyTodayOverview({ generatedAt, civilDate });
    assertTodayOverview(empty);
    assert.equal(empty.timezone, TODAY_OVERVIEW_TIMEZONE);
    assert.equal(empty.pipeline.brutTotal, ZERO_MONEY);
    assert.equal(empty.interactionsToday.meetings, 0);
    assert.equal(empty.finance.overdueCount, 0);
    assert.equal(empty.followUps.dueCount, 0);
    assert.equal(empty.tasks.openCount, 0);
    assert.deepEqual(empty.calls, []);
    assert.deepEqual(empty.agenda, []);
    assert.deepEqual(empty.tour.nextNames, []);
    assert.equal(empty.pipeline.counts.TO_QUALIFY, 0);
    assert.deepEqual(toTodayKpi(empty).meetingsToday, 0);
  });

  test("JSON.parse(JSON.stringify(sample)) roundtrips", () => {
    const sample = populatedOverview();
    const roundtrip = JSON.parse(JSON.stringify(sample)) as unknown;
    assert.deepEqual(roundtrip, sample);
    assert.deepEqual(parseTodayOverview(roundtrip), sample);
  });

  test("serializeTodayOverview emits parseable JSON without Date/Decimal", () => {
    const json = serializeTodayOverview(populatedOverview());
    const parsed: unknown = JSON.parse(json);
    assert.equal(isPlainJsonValue(parsed), true);
    assertTodayOverview(parsed);
  });

  test("civilDate is YYYY-MM-DD and instants are ISO Z", () => {
    const sample = populatedOverview();
    assert.match(sample.civilDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(sample.generatedAt, /Z$/);
    assert.match(sample.followUps.preview[0].dueAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(parisDayStart, /Z$/);
  });

  test("money fields are canonical strings, never floats", () => {
    const sample = populatedOverview();
    const kpi = toTodayKpi(sample);
    assert.equal(typeof sample.pipeline.brutTotal, "string");
    assert.equal(typeof sample.finance.signed, "string");
    assert.equal(kpi.pipelineBrut, "14500.00");
    assert.equal(moneyStringSchema.safeParse(1234.56).success, false);
    assert.equal(moneyStringSchema.safeParse("14500").success, false);
    assert.equal(moneyStringSchema.safeParse("14500,00").success, false);
    assert.equal(moneyStringSchema.safeParse("10.123").success, false);
    assert.equal(moneyStringSchema.safeParse("14500.00").success, true);
    assert.equal(todayOverviewSchema.safeParse({
      ...sample,
      pipeline: { ...sample.pipeline, brutTotal: 14500 },
    }).success, false);
  });

  test("invalid civil date and ISO datetime are rejected", () => {
    assert.equal(todayOverviewSchema.safeParse(sampleOverview({ civilDate: "2026-02-31" })).success, false);
    assert.equal(todayOverviewSchema.safeParse(sampleOverview({ civilDate: "19/09/2026" })).success, false);
    assert.equal(
      todayOverviewSchema.safeParse(sampleOverview({ generatedAt: "2026-09-19T09:00:00+02:00" })).success,
      false,
    );
    assert.equal(todayOverviewSchema.safeParse(sampleOverview({ generatedAt: civilDate })).success, false);
  });

  test("Prisma Decimal-like and Date objects are rejected", () => {
    const sample = populatedOverview();
    const withDecimal = {
      ...sample,
      pipeline: {
        ...sample.pipeline,
        brutTotal: { s: 1, e: 4, d: [14500, 0] },
      },
    };
    assert.equal(todayOverviewSchema.safeParse(withDecimal).success, false);

    const withDate = { ...sample, generatedAt: new Date(generatedAt) };
    assert.equal(todayOverviewSchema.safeParse(withDate).success, false);
  });

  test("parsed object is plain JSON: no Decimal, no prisma symbols, no href", () => {
    const parsed = parseTodayOverview(populatedOverview());
    assert.equal(isPlainJsonValue(parsed), true);
    assert.equal(Object.getOwnPropertySymbols(parsed).length, 0);
    const json = JSON.stringify(parsed);
    assert.equal(json.includes('"href"'), false);
    assert.equal(json.includes("passwordHash"), false);
    assert.equal(json.includes("DATABASE_URL"), false);
    assert.equal(json.includes("AUTH_SECRET"), false);
  });

  test("href / secondaryHref on agenda items are rejected", () => {
    const sample = populatedOverview();
    const visit = sample.agenda[1];
    const withHref = {
      ...sample,
      agenda: [{ ...visit, href: "/entreprises/co_hl", secondaryHref: "/tournee" }],
    };
    assert.equal(todayOverviewSchema.safeParse(withHref).success, false);
  });

  test("collections over TODAY_OVERVIEW_LIMITS fail Zod, clamp restores validity", () => {
    const extraCall = {
      id: "co_x",
      name: "Extra",
      city: null,
      industry: null,
      lifecycleStatus: "LEAD" as const,
      source: null,
      priority: "NORMAL" as const,
      primaryContact: null,
      lastInteractionAt: null,
      lastInteractionType: null,
      nextFollowUpAt: null,
      nextFollowUpTitle: null,
    };
    const oversized = sampleOverview({
      calls: Array.from({ length: TODAY_OVERVIEW_LIMITS.calls + 1 }, (_, index) => ({
        ...extraCall,
        id: `co_${index}`,
        name: `Lead ${index}`,
      })),
    });
    assert.equal(todayOverviewSchema.safeParse(oversized).success, false);

    const clamped = clampTodayOverviewCollections(oversized);
    assert.equal(clamped.calls.length, TODAY_OVERVIEW_LIMITS.calls);
    assertTodayOverview(clamped);
  });

  test("agenda, follow-ups, tasks, activity and tour nextStops are bounded", () => {
    assert.equal(TODAY_OVERVIEW_LIMITS.calls, 5);
    assert.equal(TODAY_OVERVIEW_LIMITS.followUps, 4);
    assert.equal(TODAY_OVERVIEW_LIMITS.tasks, 5);
    assert.equal(TODAY_OVERVIEW_LIMITS.recentActivity, 8);
    assert.equal(TODAY_OVERVIEW_LIMITS.agenda, 100);
    assert.equal(TODAY_OVERVIEW_LIMITS.tourNextStops, 3);
    assert.equal(TODAY_OVERVIEW_LIMITS.tourStops, 50);

    const tooManyStops = sampleOverview({
      tour: {
        planned: 4,
        visited: 1,
        remaining: 3,
        nextNames: ["A", "B", "C", "D"],
        nextStops: [
          { companyId: "a", name: "A" },
          { companyId: "b", name: "B" },
          { companyId: "c", name: "C" },
          { companyId: "d", name: "D" },
        ],
        stops: [],
      },
    });
    assert.equal(todayOverviewSchema.safeParse(tooManyStops).success, false);
    const clamped = clampTodayOverviewCollections(tooManyStops);
    assert.equal(clamped.tour.nextStops.length, 3);
    assert.equal(clamped.tour.nextNames.length, 3);
    assertTodayOverview(clamped);
  });

  test("terrain_visit is all-day, has visitStatus, and is not a MEETING interaction", () => {
    const sample = populatedOverview();
    const visit = sample.agenda.find((item) => item.kind === "terrain_visit");
    assert.ok(visit);
    assert.equal(visit.allDay, true);
    assert.equal(visit.eventType, null);
    assert.equal(visit.visitStatus, "pending");
    assert.equal(visit.visitOrder, 1);
    assert.ok(visit.company);
    assert.equal(visit.title.includes("09:00"), false);
    assert.equal(sample.interactionsToday.meetings, 1);
    assert.equal(toTodayKpi(sample).meetingsToday, sample.interactionsToday.meetings);

    const timedVisit = {
      ...visit,
      allDay: false,
      startsAt: "2026-09-19T08:00:00.000Z",
    };
    assert.equal(agendaItemSchema.safeParse(timedVisit).success, false);
  });

  test("meetings KPI does not include terrain_visit agenda items", () => {
    const empty = emptyTodayOverview({ generatedAt, civilDate });
    const terrainOnly = sampleOverview({
      interactionsToday: { calls: 0, meetings: 0 },
      agenda: populatedOverview().agenda.filter((item) => item.kind === "terrain_visit"),
    });
    assertTodayOverview(terrainOnly);
    assert.equal(terrainOnly.interactionsToday.meetings, 0);
    assert.equal(toTodayKpi(terrainOnly).meetingsToday, 0);
    assert.equal(empty.followUps.dueCount, empty.followUps.overdueCount + empty.followUps.todayCount);
  });

  test("parseTodayOverview throws on invalid money", () => {
    const sample = populatedOverview();
    const invalid = {
      ...sample,
      pipeline: { ...sample.pipeline, brutTotal: "not-money" },
    };
    assert.throws(() => parseTodayOverview(invalid));
  });
});

function loadedFixture(): TodayLoaded {
  return {
    pipeline: {
      counts: {
        TO_QUALIFY: 1,
        TO_CONTACT: 1,
        CONTACTED: 0,
        INTERESTED: 1,
        MEETING: 0,
        QUOTE: 0,
        WON: 2,
        LOST: 0,
      },
      openCount: 3,
      brutTotal: 14500.165,
      weightedTotal: 8700.999,
      brutTotalMoney: "14500.00",
      weightedTotalMoney: "8700.00",
    },
    followUps: {
      dueCount: 2,
      overdueCount: 1,
      todayCount: 1,
      preview: [
        {
          id: "fu_1",
          title: "Relance devis",
          dueAt: "2026-09-19T07:00:00.000Z",
          status: "PENDING",
          completedAt: null,
          company: {
            id: "co_lead",
            name: "Atelier Nord",
            phone: "0102030405",
            email: "atelier@example.com",
          },
          phone: "0102030405",
          email: "atelier@example.com",
          lastInteraction: { type: "CALL", occurredAt: "2026-09-18T14:00:00.000Z" },
        },
      ],
    },
    finance: {
      signed: "14500.00",
      collected: "5800.00",
      remaining: "8700.00",
      pending: "1200.00",
      overdue: "400.00",
      pendingCount: 2,
      overdueCount: 1,
      paidCount: 3,
      paymentCount: 5,
    },
    tasks: {
      openCount: 4,
      preview: [
        {
          id: "task_1",
          title: "Préparer maquette",
          dueAt: "2026-09-19T16:00:00.000Z",
          priority: "NORMAL",
          project: { id: "proj_1", name: "Site vitrine" },
        },
      ],
    },
    agenda: [
      {
        id: "event:evt_rdv",
        kind: "event",
        entityId: "evt_rdv",
        title: "RDV commercial",
        startsAt: "2026-09-19T08:00:00.000Z",
        endsAt: "2026-09-19T09:00:00.000Z",
        allDay: false,
        eventType: "MEETING",
        href: "/entreprises/co_client",
        company: { id: "co_client", name: "ALEX'CEPTION" },
        project: null,
        editable: true,
        overdue: false,
        visitOrder: null,
        visitStatus: null,
        secondaryHref: null,
      },
      {
        id: "follow_up:fu_1",
        kind: "follow_up",
        entityId: "fu_1",
        title: "Relance devis",
        startsAt: "2026-09-19T07:00:00.000Z",
        endsAt: "2026-09-19T07:00:00.000Z",
        allDay: false,
        eventType: null,
        href: "/entreprises/co_lead",
        company: { id: "co_lead", name: "Atelier Nord" },
        project: null,
        editable: false,
        overdue: false,
        visitOrder: null,
        visitStatus: null,
        secondaryHref: null,
      },
      {
        id: "task:task_1",
        kind: "task",
        entityId: "task_1",
        title: "Préparer maquette",
        startsAt: "2026-09-19T16:00:00.000Z",
        endsAt: "2026-09-19T16:00:00.000Z",
        allDay: false,
        eventType: null,
        href: "/projets/proj_1",
        company: null,
        project: { id: "proj_1", name: "Site vitrine" },
        editable: false,
        overdue: false,
        visitOrder: null,
        visitStatus: null,
        secondaryHref: null,
      },
      {
        id: "project:proj_1",
        kind: "project",
        entityId: "proj_1",
        title: "Site vitrine",
        startsAt: parisDayStart,
        endsAt: parisDayEnd,
        allDay: true,
        eventType: null,
        href: "/projets/proj_1",
        company: { id: "co_client", name: "ALEX'CEPTION" },
        project: { id: "proj_1", name: "Site vitrine" },
        editable: false,
        overdue: false,
        visitOrder: null,
        visitStatus: null,
        secondaryHref: null,
      },
      {
        id: "milestone:ms_1",
        kind: "milestone",
        entityId: "ms_1",
        title: "Livraison maquette",
        startsAt: parisDayStart,
        endsAt: parisDayEnd,
        allDay: true,
        eventType: null,
        href: "/projets/proj_1",
        company: { id: "co_client", name: "ALEX'CEPTION" },
        project: { id: "proj_1", name: "Site vitrine" },
        editable: false,
        overdue: false,
        visitOrder: null,
        visitStatus: null,
        secondaryHref: null,
      },
      {
        id: "terrain_visit:stop_1",
        kind: "terrain_visit",
        entityId: "stop_1",
        title: "Visite terrain — HL BEAUTY",
        startsAt: parisDayStart,
        endsAt: parisDayEnd,
        allDay: true,
        eventType: null,
        href: "/entreprises/co_hl",
        company: { id: "co_hl", name: "HL BEAUTY" },
        project: null,
        editable: false,
        overdue: false,
        visitOrder: 1,
        visitStatus: "pending",
        secondaryHref: "/tournee",
      },
    ],
    calls: [
      {
        id: "co_lead",
        name: "Atelier Nord",
        city: "Lyon",
        industry: "Menuiserie",
        lifecycleStatus: "LEAD",
        source: "terrain",
        priority: "HIGH",
        primaryContact: { firstName: "Léa", lastName: "Martin", role: "Gérante" },
        lastInteractionAt: "2026-09-18T14:00:00.000Z",
        lastInteractionType: "CALL",
        nextFollowUpAt: "2026-09-19T08:00:00.000Z",
        nextFollowUpTitle: "Relance devis",
      },
    ],
    interactionCounts: { calls: 2, meetings: 1 },
    recentActivity: [
      {
        id: "act_1",
        action: "tour.stop_visited",
        entityType: "TourStop",
        createdAt: "2026-09-19T08:30:00.000Z",
        actorName: "Marius",
      },
    ],
    tour: {
      stops: [
        {
          id: "stop_0",
          order: 0,
          visitedAt: "2026-09-19T07:30:00.000Z",
          company: { id: "co_done", name: "Visité" },
        },
        {
          id: "stop_1",
          order: 1,
          visitedAt: null,
          company: { id: "co_hl", name: "HL BEAUTY" },
        },
      ],
    },
  };
}

describe("mapTodayOverview + parseTodayOverview", () => {
  const now = new Date(generatedAt);

  test("pure mapper output parses without Date/Decimal/href and uses money strings", () => {
    const mapped = mapTodayOverview(loadedFixture(), now);
    const parsed = parseTodayOverview(mapped);

    assert.equal(parsed.timezone, TODAY_OVERVIEW_TIMEZONE);
    assert.equal(parsed.civilDate, "2026-09-19");
    assert.equal(parsed.generatedAt, generatedAt);
    assert.equal(parsed.pipeline.brutTotal, "14500.00");
    assert.equal(parsed.pipeline.weightedTotal, "8700.00");
    assert.equal(typeof parsed.pipeline.brutTotal, "string");
    assert.equal(typeof parsed.finance.signed, "string");
    assert.equal(parsed.finance.overdueCount, 1);
    assert.equal(parsed.interactionsToday.meetings, 1);
    assert.equal(parsed.agenda.some((item) => item.kind === "terrain_visit"), true);
    assert.equal(isPlainJsonValue(parsed), true);
    assert.equal(JSON.stringify(parsed).includes('"href"'), false);
    assert.equal(JSON.stringify(parsed).includes("14500.165"), false);
  });

  test("pipeline UI numbers from money strings, not the loader floats", () => {
    const view = toTodayDashboardView(mapTodayOverview(loadedFixture(), now));
    assert.equal(view.pipelineOverview.brutTotal, 14500);
    assert.equal(view.pipelineOverview.weightedTotal, 8700);
    assert.notEqual(view.pipelineOverview.brutTotal, 14500.165);
  });

  test("dashboard adapter rebuilds previous calendar/query hrefs", () => {
    const view = toTodayDashboardView(mapTodayOverview(loadedFixture(), now));
    const byKind = Object.fromEntries(view.agenda.map((item) => [item.kind, item]));

    assert.equal(byKind.event.href, "/entreprises/co_client");
    assert.equal(byKind.event.secondaryHref, null);
    assert.equal(byKind.follow_up.href, "/entreprises/co_lead");
    assert.equal(byKind.task.href, "/projets/proj_1");
    assert.equal(byKind.project.href, "/projets/proj_1");
    assert.equal(byKind.milestone.href, "/projets/proj_1");
    assert.equal(byKind.terrain_visit.href, "/entreprises/co_hl");
    assert.equal(byKind.terrain_visit.secondaryHref, "/tournee");
    assert.equal(byKind.event.editable, true);
    assert.equal(byKind.terrain_visit.editable, false);

    assert.deepEqual(
      calendarItemUiHrefs({
        kind: "event",
        entityId: "evt",
        company: null,
        project: { id: "proj_x" },
      }),
      { href: "/projets/proj_x", secondaryHref: null },
    );
    assert.deepEqual(
      calendarItemUiHrefs({
        kind: "event",
        entityId: "evt",
        company: null,
        project: null,
      }),
      { href: null, secondaryHref: null },
    );
    assert.deepEqual(
      calendarItemUiHrefs({
        kind: "task",
        entityId: "t",
        company: { id: "co_a" },
        project: null,
      }),
      { href: "/entreprises/co_a", secondaryHref: null },
    );
    assert.deepEqual(
      calendarItemUiHrefs({
        kind: "task",
        entityId: "t",
        company: null,
        project: null,
      }),
      { href: "/projets", secondaryHref: null },
    );
    assert.deepEqual(
      calendarItemUiHrefs({
        kind: "milestone",
        entityId: "m",
        company: null,
        project: null,
      }),
      { href: "/projets", secondaryHref: null },
    );
    assert.deepEqual(
      calendarItemUiHrefs({
        kind: "terrain_visit",
        entityId: "s",
        company: null,
        project: null,
      }),
      { href: "/tournee", secondaryHref: "/tournee" },
    );
  });

  test("CallsFollowups/Tasks/Tour/Kpi fields used by the page survive the adapter", () => {
    const view = toTodayDashboardView(mapTodayOverview(loadedFixture(), now));
    assert.equal(view.calls[0]?.name, "Atelier Nord");
    assert.equal(view.calls[0]?.industry, "Menuiserie");
    assert.equal(view.calls[0]?.primaryContact?.firstName, "Léa");
    assert.equal(view.followUps.dueCount, 2);
    assert.equal(view.followUps.preview[0]?.company.name, "Atelier Nord");
    assert.equal(view.followUps.preview[0]?.title, "Relance devis");
    assert.equal(view.taskDashboard.preview[0]?.project?.name, "Site vitrine");
    assert.equal(view.tourDashboard.nextNames.join(" · "), "HL BEAUTY");
    assert.equal(view.tourDashboard.planned, 2);
    assert.equal(view.tourDashboard.visited, 1);
    assert.equal(view.tourDashboard.remaining, 1);
    assert.equal(view.interactionCounts.meetings, 1);
    assert.equal(view.recentActivity[0]?.action, "tour.stop_visited");
    assert.equal(view.finance.signed, "14500.00");
  });
});
