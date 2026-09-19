/**
 * TodayOverview — contrat JSON du briefing « Aujourd'hui » (Europe/Paris).
 *
 * Consommé par `TodayService.getTodayOverview` (même composition que
 * `src/app/page.tsx`). Pas de Prisma, pas de `href`, pas de secrets.
 * Champs : `docs/VERSATECH-AI-TOOLS-V1.md` §3.1 + projection dashboard Agent B.
 *
 * Money = strings canoniques `centsToMoneyString` (ex. `"1234.56"`).
 * Instants = ISO 8601 (`Date.toISOString()`). Jour civil = `YYYY-MM-DD` Paris.
 *
 * Les KPI dashboard (KpiZone) se lisent sur les sous-objets : pipeline,
 * followUps.dueCount, finance, tasks.openCount, interactionsToday.
 */
import { z } from "zod";
import { isValidCivilDate } from "@/lib/dates";
import { tryParseMoneyToCents, ZERO_MONEY } from "@/lib/money";

/**
 * Plafonds des listes — dashboard `page.tsx` + mapper `map-overview.ts`.
 * (tools V1 citait 8/8/8/20 pour un tool isolé ; l'overview compose les
 * mêmes `take` que l'UI.)
 */
export const TODAY_OVERVIEW_LIMITS = {
  /** `listCompaniesToCall(5)` / `TODAY_CALLS_LIMIT` */
  calls: 5,
  /** `getFollowUpDashboard().preview` (4) */
  followUps: 4,
  /** `getTaskDashboard().preview` (5) */
  tasks: 5,
  /** `getRecentActivity(8)` */
  recentActivity: 8,
  /**
   * Journée Paris fusionnée (events + relances + tâches + jalons + TourStops).
   * L'UI n'avait pas de `take` ; 100 borne le payload sans clipper une tournée
   * (plafond stops 50) plus le reste de l'agenda. Tools V1 isolé citait 20.
   */
  agenda: 100,
  /** `getTourDashboard().nextNames` / `nextStops` */
  tourNextStops: 3,
  /** Plafond dur des stops persistés renvoyés dans `tour.stops`. */
  tourStops: 50,
} as const;

export const TODAY_OVERVIEW_TIMEZONE = "Europe/Paris" as const;

export const AGENDA_ITEM_KINDS = [
  "event",
  "follow_up",
  "task",
  "project",
  "milestone",
  "terrain_visit",
] as const;

export const VISIT_STATUSES = ["pending", "visited"] as const;

export const PRIORITIES = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"] as const;

export const FOLLOW_UP_STATUSES = ["PENDING", "COMPLETED", "CANCELED"] as const;

export const COMPANY_LIFECYCLES = [
  "LEAD",
  "CONTACTED",
  "QUALIFIED",
  "OPPORTUNITY",
  "CLIENT",
  "INACTIVE",
  "LOST",
] as const;

export const INTERACTION_TYPES = [
  "CALL",
  "EMAIL",
  "MEETING",
  "MESSAGE",
  "NOTE",
  "QUOTE",
  "PAYMENT",
  "OTHER",
] as const;

export const CALENDAR_EVENT_TYPES = [
  "CALL",
  "FOLLOW_UP",
  "MEETING",
  "TASK",
  "DEADLINE",
  "DELIVERY",
  "MAINTENANCE",
  "ADMINISTRATIVE",
] as const;

export const OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
  "WON",
  "LOST",
] as const;

export type AgendaItemKind = (typeof AGENDA_ITEM_KINDS)[number];
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
export type CompanyLifecycle = (typeof COMPANY_LIFECYCLES)[number];
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

/** Sortie `centsToMoneyString` / `normalizeMoney` — jamais un float, jamais Decimal. */
const CANONICAL_MONEY_RE = /^-?\d+\.\d{2}$/;

/** Instants UTC produits par `Date.toISOString()`. */
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const moneyStringSchema = z.string().refine((value) => {
  if (!CANONICAL_MONEY_RE.test(value)) {
    return false;
  }
  return tryParseMoneyToCents(value) !== null;
}, 'Montant invalide (string money canonique, ex. "1234.56")');

export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

export const civilDateStringSchema = z.string().refine((value) => {
  const match = CIVIL_DATE_RE.exec(value);
  if (!match) {
    return false;
  }
  return isValidCivilDate(Number(match[1]), Number(match[2]), Number(match[3]));
}, "Jour civil invalide (YYYY-MM-DD Europe/Paris)");

const nonNegativeIntSchema = z.number().int().min(0);

const namedEntitySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
});

const entityLinkSchema = namedEntitySchema.nullable();

const primaryContactSchema = z
  .strictObject({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.string().nullable(),
  })
  .nullable();

/**
 * Projection `CompanyListItem` utile au dashboard Appels.
 * Pas de téléphone (absent du list item). Pas de `href`.
 */
export const companyCallPreviewSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().nullable(),
  industry: z.string().nullable(),
  lifecycleStatus: z.enum(COMPANY_LIFECYCLES),
  source: z.string().nullable(),
  priority: z.enum(PRIORITIES),
  primaryContact: primaryContactSchema,
  lastInteractionAt: isoDateTimeStringSchema.nullable(),
  lastInteractionType: z.enum(INTERACTION_TYPES).nullable(),
  nextFollowUpAt: isoDateTimeStringSchema.nullable(),
  nextFollowUpTitle: z.string().nullable(),
});

export const followUpPreviewSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  dueAt: isoDateTimeStringSchema,
  status: z.enum(FOLLOW_UP_STATUSES),
  company: namedEntitySchema,
});

export const followUpsSummarySchema = z
  .strictObject({
    dueCount: nonNegativeIntSchema,
    overdueCount: nonNegativeIntSchema,
    todayCount: nonNegativeIntSchema,
    preview: z.array(followUpPreviewSchema).max(TODAY_OVERVIEW_LIMITS.followUps),
  })
  .superRefine((followUps, ctx) => {
    if (followUps.dueCount !== followUps.overdueCount + followUps.todayCount) {
      ctx.addIssue({
        code: "custom",
        message: "followUps.dueCount doit égaler overdueCount + todayCount.",
        path: ["dueCount"],
      });
    }
  });

export const taskPreviewSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  dueAt: isoDateTimeStringSchema.nullable(),
  priority: z.enum(PRIORITIES),
  project: namedEntitySchema.nullable(),
});

export const tasksSummarySchema = z.strictObject({
  openCount: nonNegativeIntSchema,
  preview: z.array(taskPreviewSchema).max(TODAY_OVERVIEW_LIMITS.tasks),
});

/**
 * Item d'agenda fusionné (kinds = `event | follow_up | task | project | milestone | terrain_visit`).
 *
 * `kind === "terrain_visit"` n'est **pas** un RDV commercial : c'est un
 * `TourStop` projeté (journée entière Paris, `allDay: true`). Ne pas le
 * compter dans `interactionsToday.meetings`. Pas d'heure fictive : le
 * consommateur affiche la date civile, pas `formatTime(startsAt)`.
 * Pas de `href` / `secondaryHref` (l'adapter UI les reconstruit via id + kind).
 */
export const agendaItemSchema = z
  .strictObject({
    id: z.string().min(1),
    kind: z.enum(AGENDA_ITEM_KINDS),
    entityId: z.string().min(1),
    title: z.string().min(1),
    startsAt: isoDateTimeStringSchema,
    endsAt: isoDateTimeStringSchema,
    allDay: z.boolean(),
    eventType: z.enum(CALENDAR_EVENT_TYPES).nullable(),
    company: entityLinkSchema,
    project: entityLinkSchema,
    overdue: z.boolean(),
    visitOrder: nonNegativeIntSchema.nullable(),
    visitStatus: z.enum(VISIT_STATUSES).nullable(),
  })
  .superRefine((item, ctx) => {
    const isTerrain = item.kind === "terrain_visit";
    const isEvent = item.kind === "event";

    if (isTerrain) {
      if (!item.allDay) {
        ctx.addIssue({
          code: "custom",
          message: "Une visite terrain est une journée entière Paris (allDay), sans heure fictive.",
          path: ["allDay"],
        });
      }
      if (item.eventType !== null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit n'est pas un CalendarEvent : eventType doit être null.",
          path: ["eventType"],
        });
      }
      if (item.visitStatus === null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit exige visitStatus pending|visited.",
          path: ["visitStatus"],
        });
      }
      if (item.visitOrder === null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit exige visitOrder (TourStop.order).",
          path: ["visitOrder"],
        });
      }
      if (item.company === null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit exige company id+name.",
          path: ["company"],
        });
      }
      return;
    }

    if (item.visitStatus !== null) {
      ctx.addIssue({
        code: "custom",
        message: "visitStatus est réservé à kind=terrain_visit.",
        path: ["visitStatus"],
      });
    }
    if (item.visitOrder !== null) {
      ctx.addIssue({
        code: "custom",
        message: "visitOrder est réservé à kind=terrain_visit.",
        path: ["visitOrder"],
      });
    }

    if (isEvent && item.eventType === null) {
      ctx.addIssue({
        code: "custom",
        message: "kind=event exige un eventType CalendarEvent.",
        path: ["eventType"],
      });
    }
    if (!isEvent && item.eventType !== null) {
      ctx.addIssue({
        code: "custom",
        message: "eventType n'est renseigné que pour kind=event.",
        path: ["eventType"],
      });
    }
  });

export const tourNextStopSchema = z.strictObject({
  companyId: z.string().min(1),
  name: z.string().min(1),
});

export const tourStopPreviewSchema = z.strictObject({
  id: z.string().min(1),
  order: nonNegativeIntSchema,
  visitedAt: isoDateTimeStringSchema.nullable(),
  company: namedEntitySchema,
});

export const tourSummarySchema = z
  .strictObject({
    planned: nonNegativeIntSchema,
    visited: nonNegativeIntSchema,
    remaining: nonNegativeIntSchema,
    nextNames: z.array(z.string().min(1)).max(TODAY_OVERVIEW_LIMITS.tourNextStops),
    nextStops: z.array(tourNextStopSchema).max(TODAY_OVERVIEW_LIMITS.tourNextStops),
    stops: z.array(tourStopPreviewSchema).max(TODAY_OVERVIEW_LIMITS.tourStops),
  })
  .superRefine((tour, ctx) => {
    if (tour.visited + tour.remaining !== tour.planned) {
      ctx.addIssue({
        code: "custom",
        message: "tour.visited + tour.remaining doit égaler tour.planned.",
        path: ["remaining"],
      });
    }
  });

export const pipelineCountsSchema = z.strictObject({
  TO_QUALIFY: nonNegativeIntSchema,
  TO_CONTACT: nonNegativeIntSchema,
  CONTACTED: nonNegativeIntSchema,
  INTERESTED: nonNegativeIntSchema,
  MEETING: nonNegativeIntSchema,
  QUOTE: nonNegativeIntSchema,
  WON: nonNegativeIntSchema,
  LOST: nonNegativeIntSchema,
});

/** Totaux pipeline en money string (pas les `number` de `PipelineOverview` UI). */
export const pipelineSummarySchema = z.strictObject({
  openCount: nonNegativeIntSchema,
  brutTotal: moneyStringSchema,
  weightedTotal: moneyStringSchema,
  counts: pipelineCountsSchema,
});

/**
 * Snapshot finance du dashboard Aujourd'hui (signé / encaissé / restant / retards).
 * Le tool `getFinanceSnapshot` isolé peut exposer le `FinanceTotals` complet.
 */
export const financeSnapshotSchema = z.strictObject({
  signed: moneyStringSchema,
  collected: moneyStringSchema,
  remaining: moneyStringSchema,
  overdueCount: nonNegativeIntSchema,
});

/**
 * Compteurs d'interactions du jour civil Paris.
 * `meetings` = RDV commerciaux uniquement (MEETING hors visites terrain).
 */
export const interactionCountsSchema = z.strictObject({
  calls: nonNegativeIntSchema,
  meetings: nonNegativeIntSchema,
});

export const recentActivityItemSchema = z.strictObject({
  id: z.string().min(1),
  action: z.string().min(1),
  /** `ACTIVITY_LABELS[action] ?? action` — pas de `metadata`. */
  label: z.string().min(1),
  entityType: z.string().min(1),
  createdAt: isoDateTimeStringSchema,
  actorName: z.string().nullable(),
});

/** Projection tools V1 `kpi` — dérivée des sous-objets, pas dupliquée dans le DTO. */
export const todayKpiSchema = z.strictObject({
  pipelineBrut: moneyStringSchema,
  pipelineWeighted: moneyStringSchema,
  pipelineOpenCount: nonNegativeIntSchema,
  dueFollowUps: nonNegativeIntSchema,
  signedRevenue: moneyStringSchema,
  collectedRevenue: moneyStringSchema,
  remainingRevenue: moneyStringSchema,
  overduePayments: nonNegativeIntSchema,
  openTasks: nonNegativeIntSchema,
  callsToday: nonNegativeIntSchema,
  /** Hors visites terrain (`isTerrainVisit`). */
  meetingsToday: nonNegativeIntSchema,
});

export const todayOverviewSchema = z.strictObject({
  generatedAt: isoDateTimeStringSchema,
  civilDate: civilDateStringSchema,
  timezone: z.literal(TODAY_OVERVIEW_TIMEZONE),
  tour: tourSummarySchema,
  calls: z.array(companyCallPreviewSchema).max(TODAY_OVERVIEW_LIMITS.calls),
  followUps: followUpsSummarySchema,
  tasks: tasksSummarySchema,
  agenda: z.array(agendaItemSchema).max(TODAY_OVERVIEW_LIMITS.agenda),
  pipeline: pipelineSummarySchema,
  finance: financeSnapshotSchema,
  interactionsToday: interactionCountsSchema,
  recentActivity: z.array(recentActivityItemSchema).max(TODAY_OVERVIEW_LIMITS.recentActivity),
});

export type CompanyCallPreview = z.infer<typeof companyCallPreviewSchema>;
export type FollowUpPreview = z.infer<typeof followUpPreviewSchema>;
export type FollowUpsSummary = z.infer<typeof followUpsSummarySchema>;
export type TaskPreview = z.infer<typeof taskPreviewSchema>;
export type TasksSummary = z.infer<typeof tasksSummarySchema>;
export type AgendaItem = z.infer<typeof agendaItemSchema>;
export type TourNextStop = z.infer<typeof tourNextStopSchema>;
export type TourStopPreview = z.infer<typeof tourStopPreviewSchema>;
export type TourSummary = z.infer<typeof tourSummarySchema>;
export type PipelineCounts = z.infer<typeof pipelineCountsSchema>;
export type PipelineSummary = z.infer<typeof pipelineSummarySchema>;
export type FinanceSnapshot = z.infer<typeof financeSnapshotSchema>;
export type InteractionCounts = z.infer<typeof interactionCountsSchema>;
export type RecentActivityItem = z.infer<typeof recentActivityItemSchema>;
export type TodayKpi = z.infer<typeof todayKpiSchema>;
export type TodayOverview = z.infer<typeof todayOverviewSchema>;

export const EMPTY_PIPELINE_COUNTS: PipelineCounts = {
  TO_QUALIFY: 0,
  TO_CONTACT: 0,
  CONTACTED: 0,
  INTERESTED: 0,
  MEETING: 0,
  QUOTE: 0,
  WON: 0,
  LOST: 0,
};

export function emptyTodayOverview(input?: {
  generatedAt?: string;
  civilDate?: string;
}): TodayOverview {
  const generatedAt = input?.generatedAt ?? "2026-09-19T09:00:00.000Z";
  const civilDate = input?.civilDate ?? "2026-09-19";

  return parseTodayOverview({
    generatedAt,
    civilDate,
    timezone: TODAY_OVERVIEW_TIMEZONE,
    tour: {
      planned: 0,
      visited: 0,
      remaining: 0,
      nextNames: [],
      nextStops: [],
      stops: [],
    },
    calls: [],
    followUps: { dueCount: 0, overdueCount: 0, todayCount: 0, preview: [] },
    tasks: { openCount: 0, preview: [] },
    agenda: [],
    pipeline: {
      openCount: 0,
      brutTotal: ZERO_MONEY,
      weightedTotal: ZERO_MONEY,
      counts: { ...EMPTY_PIPELINE_COUNTS },
    },
    finance: {
      signed: ZERO_MONEY,
      collected: ZERO_MONEY,
      remaining: ZERO_MONEY,
      overdueCount: 0,
    },
    interactionsToday: { calls: 0, meetings: 0 },
    recentActivity: [],
  });
}

export function toTodayKpi(overview: TodayOverview): TodayKpi {
  return {
    pipelineBrut: overview.pipeline.brutTotal,
    pipelineWeighted: overview.pipeline.weightedTotal,
    pipelineOpenCount: overview.pipeline.openCount,
    dueFollowUps: overview.followUps.dueCount,
    signedRevenue: overview.finance.signed,
    collectedRevenue: overview.finance.collected,
    remainingRevenue: overview.finance.remaining,
    overduePayments: overview.finance.overdueCount,
    openTasks: overview.tasks.openCount,
    callsToday: overview.interactionsToday.calls,
    meetingsToday: overview.interactionsToday.meetings,
  };
}

export function clampCollection<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

export function clampTodayOverviewCollections<T extends {
  calls: unknown[];
  followUps: { preview: unknown[] };
  tasks: { preview: unknown[] };
  agenda: unknown[];
  recentActivity: unknown[];
  tour: { nextStops: unknown[]; nextNames: unknown[]; stops: unknown[] };
}>(overview: T): T {
  return {
    ...overview,
    calls: clampCollection(overview.calls, TODAY_OVERVIEW_LIMITS.calls),
    followUps: {
      ...overview.followUps,
      preview: clampCollection(overview.followUps.preview, TODAY_OVERVIEW_LIMITS.followUps),
    },
    tasks: {
      ...overview.tasks,
      preview: clampCollection(overview.tasks.preview, TODAY_OVERVIEW_LIMITS.tasks),
    },
    agenda: clampCollection(overview.agenda, TODAY_OVERVIEW_LIMITS.agenda),
    recentActivity: clampCollection(
      overview.recentActivity,
      TODAY_OVERVIEW_LIMITS.recentActivity,
    ),
    tour: {
      ...overview.tour,
      nextNames: clampCollection(overview.tour.nextNames, TODAY_OVERVIEW_LIMITS.tourNextStops),
      nextStops: clampCollection(overview.tour.nextStops, TODAY_OVERVIEW_LIMITS.tourNextStops),
      stops: clampCollection(overview.tour.stops, TODAY_OVERVIEW_LIMITS.tourStops),
    },
  };
}

export function parseTodayOverview(input: unknown): TodayOverview {
  return todayOverviewSchema.parse(input);
}

export function assertTodayOverview(input: unknown): asserts input is TodayOverview {
  parseTodayOverview(input);
}

export function serializeTodayOverview(input: unknown): string {
  return JSON.stringify(parseTodayOverview(input));
}

export function isPlainJsonValue(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return true;
  }
  if (valueType === "number") {
    return Number.isFinite(value);
  }
  if (valueType !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(isPlainJsonValue);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isPlainJsonValue);
}
