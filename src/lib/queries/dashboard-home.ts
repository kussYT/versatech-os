import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type { ProjectStatus } from "@/generated/prisma/client";
import type { CalendarItem } from "@/lib/calendar/types";
import { projectProgress } from "@/lib/crm/constants";
import type { WorkAction } from "@/lib/dashboard/operations";
import { buildDailyInsight, civilDaysSinceParis, type DailyInsight } from "@/lib/dashboard/insight";
import {
  buildMonthlyCollectionSeries,
  type MonthlyCollectionPoint,
} from "@/lib/dashboard/monthly-collections";
import {
  addCivilDays,
  endOfParisDay,
  endOfToday,
  fromParisDateTime,
  parisParts,
  startOfToday,
} from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { centsToMoneyString, parseMoneyToCents, ZERO_MONEY } from "@/lib/money";
import { IN_PROGRESS_PROJECT_STATUSES, selectPrincipalProject } from "@/lib/projects/principal";
import { loadRecentActivity, type RecentActivityItem } from "@/lib/queries/activity";
import { loadCalendarItems } from "@/lib/queries/calendar";
import { loadOperationsDashboard } from "@/lib/queries/operations";
import { loadFinanceSnapshot } from "@/lib/queries/payments";
import { loadTodayTour, type TodayTour } from "@/lib/queries/tours";

const AGENDA_DAYS = 7;
const AGENDA_LIMIT = 5;
const PRIORITY_ACTION_LIMIT = 8;
const NOTIFICATION_LIMIT = 12;
const RECENT_CLIENT_LIMIT = 6;
const ACTIVE_PROJECT_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 8;

const WAITING_QUOTE_STATUSES = ["SENT", "VIEWED"] as const;

export type DashboardFinance = {
  collected: string;
  signedUncollected: string;
  signed: string;
  scheduled: string;
};

export type DashboardWaitingQuotes = {
  count: number;
  /** Somme TTC des devis SENT|VIEWED (bigint cents → string). */
  totalAmount: string;
  /** Jours civils Paris depuis l'envoi du plus ancien devis en attente ; null si aucun `sentAt`. */
  oldestDays: number | null;
};

export type DashboardActiveProjects = {
  /** ACTIVE | WAITING_CLIENT | REVIEW. */
  count: number;
  /** ACTIVE avec une date de début renseignée et <= aujourd'hui (Paris). */
  inDevelopmentCount: number;
};

export type DashboardUrgentFollowUps = {
  /** Relances PENDING en retard (compte SQL exact). */
  count: number;
  /** Parmi les relances en retard : celles rattachées à une opportunité avec un devis SENT|VIEWED. */
  quoteCount: number;
  /** Relances PENDING dues aujourd'hui (Paris). */
  todayCount: number;
  /** Présent seulement s'il existe des échéances de paiement en retard. */
  paymentHint?: { overdueCount: number; overdueAmount: string };
};

export type MonthlyCollections = {
  year: number;
  points: MonthlyCollectionPoint[];
  /** Total de l'année, string décimale. */
  total: string;
  totalCents: bigint;
};

export type DashboardRecentClient = {
  id: string;
  name: string;
  principalProjectName: string | null;
  updatedAt: string;
  /** Devis ACCEPTED cumulés de la société. */
  signed: string;
  /** Paiements PAID cumulés de la société. */
  collected: string;
};

export type DashboardAgendaItem = Pick<
  CalendarItem,
  "id" | "kind" | "title" | "startsAt" | "endsAt" | "allDay" | "href" | "company" | "project" | "overdue"
>;

export type DashboardActiveProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  company: { id: string; name: string };
};

export type DashboardNotificationItem = {
  id: string;
  title: string;
  href: string;
  kind: "follow_up" | "action";
  whenLabel: string;
};

export type DashboardSummary = {
  /** Actions du jour (liste Opérations, plafonnée par OPERATIONS_LIMITS.today). */
  priorityActionCount: number;
  /** Rendez-vous réels du jour (CalendarEvent) ; hors visites terrain, relances, tâches. */
  agendaCount: number;
  quotesToFollowCount: number;
};

export type DashboardHome = {
  generatedAt: string;
  finance: DashboardFinance;
  waitingQuotes: DashboardWaitingQuotes;
  activeProjects: DashboardActiveProjects;
  urgentFollowUps: DashboardUrgentFollowUps;
  monthlyCollections: MonthlyCollections;
  availableCollectionYears: number[];
  recentClients: DashboardRecentClient[];
  upcomingAgenda: DashboardAgendaItem[];
  priorityActions: WorkAction[];
  activeProjectsList: DashboardActiveProject[];
  recentActivity: RecentActivityItem[];
  tour: TodayTour | null;
  insight: DailyInsight;
  notificationItems: DashboardNotificationItem[];
  summary: DashboardSummary;
};

function yearRange(year: number) {
  return {
    gte: fromParisDateTime(year, 1, 1, 0, 0, 0, 0),
    lt: fromParisDateTime(year + 1, 1, 1, 0, 0, 0, 0),
  };
}

/** Caller must authenticate. Encaissements PAID de l'année civile Paris, par mois de `paidAt`. */
export async function loadMonthlyCollections(year: number): Promise<MonthlyCollections> {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new Error(`Année invalide: ${year}`);
  }

  const payments = await prisma.payment.findMany({
    where: { status: "PAID", paidAt: yearRange(year) },
    select: { amount: true, paidAt: true },
  });

  const points = buildMonthlyCollectionSeries(
    payments.flatMap((payment) =>
      payment.paidAt ? [{ amount: payment.amount.toString(), paidAt: payment.paidAt }] : [],
    ),
    year,
  );
  const totalCents = points.reduce((sum, point) => sum + point.cents, BigInt(0));

  return { year, points, total: centsToMoneyString(totalCents), totalCents };
}

async function loadAvailableCollectionYears(currentYear: number): Promise<number[]> {
  const rows = await prisma.payment.findMany({
    where: { status: "PAID", paidAt: { not: null } },
    select: { paidAt: true },
  });
  const years = new Set<number>([currentYear]);
  for (const row of rows) {
    if (row.paidAt) {
      years.add(parisParts(row.paidAt).year);
    }
  }
  return [...years].sort((left, right) => right - left);
}

async function loadWaitingQuotes(now: Date): Promise<DashboardWaitingQuotes> {
  const quotes = await prisma.quote.findMany({
    where: { status: { in: [...WAITING_QUOTE_STATUSES] } },
    select: { amountIncTax: true, sentAt: true },
  });

  let totalCents = BigInt(0);
  let oldest: Date | null = null;
  for (const quote of quotes) {
    totalCents += parseMoneyToCents(quote.amountIncTax.toString());
    if (quote.sentAt && (!oldest || quote.sentAt.getTime() < oldest.getTime())) {
      oldest = quote.sentAt;
    }
  }

  return {
    count: quotes.length,
    totalAmount: centsToMoneyString(totalCents),
    oldestDays: oldest ? civilDaysSinceParis(oldest, now) : null,
  };
}

async function loadActiveProjectCounts(now: Date): Promise<DashboardActiveProjects> {
  const [count, inDevelopmentCount] = await Promise.all([
    prisma.project.count({ where: { status: { in: [...IN_PROGRESS_PROJECT_STATUSES] } } }),
    prisma.project.count({
      where: { status: "ACTIVE", startDate: { not: null, lte: endOfToday(now) } },
    }),
  ]);
  return { count, inDevelopmentCount };
}

async function loadActiveProjectsList(): Promise<DashboardActiveProject[]> {
  const projects = await prisma.project.findMany({
    where: { status: { in: [...IN_PROGRESS_PROJECT_STATUSES] } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    take: ACTIVE_PROJECT_LIMIT,
    select: {
      id: true,
      name: true,
      status: true,
      company: { select: { id: true, name: true } },
      tasks: { select: { status: true } },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    progress: projectProgress(project.tasks),
    company: project.company,
  }));
}

async function loadRecentClients(now: Date): Promise<DashboardRecentClient[]> {
  const companies = await prisma.company.findMany({
    where: { lifecycleStatus: "CLIENT" },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: RECENT_CLIENT_LIMIT,
    select: {
      id: true,
      name: true,
      updatedAt: true,
      projects: {
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          startDate: true,
          completedAt: true,
        },
      },
      maintenanceContracts: {
        select: { status: true, startDate: true, projectId: true },
      },
    },
  });

  if (companies.length === 0) {
    return [];
  }

  const companyIds = companies.map((company) => company.id);
  const [signedRows, collectedRows] = await Promise.all([
    prisma.quote.groupBy({
      by: ["companyId"],
      where: { companyId: { in: companyIds }, status: "ACCEPTED" },
      _sum: { amountIncTax: true },
    }),
    prisma.payment.groupBy({
      by: ["companyId"],
      where: { companyId: { in: companyIds }, status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  const signedByCompany = new Map(
    signedRows.map((row) => [row.companyId, row._sum.amountIncTax?.toString() ?? ZERO_MONEY]),
  );
  const collectedByCompany = new Map(
    collectedRows.map((row) => [row.companyId, row._sum.amount?.toString() ?? ZERO_MONEY]),
  );

  return companies.map((company) => {
    const principal = selectPrincipalProject(company.projects, company.maintenanceContracts, { now });
    return {
      id: company.id,
      name: company.name,
      principalProjectName: principal?.project.name ?? null,
      updatedAt: company.updatedAt.toISOString(),
      signed: signedByCompany.get(company.id) ?? ZERO_MONEY,
      collected: collectedByCompany.get(company.id) ?? ZERO_MONEY,
    };
  });
}

async function loadOverdueQuoteFollowUpCount(now: Date) {
  return prisma.followUp.count({
    where: {
      status: "PENDING",
      dueAt: { lt: startOfToday(now) },
      opportunity: { quotes: { some: { status: { in: [...WAITING_QUOTE_STATUSES] } } } },
    },
  });
}

async function loadAgendaWindow(now: Date): Promise<CalendarItem[]> {
  const parts = parisParts(now);
  const last = addCivilDays(parts.year, parts.month, parts.day, AGENDA_DAYS - 1);
  const rangeEnd = endOfParisDay(fromParisDateTime(last.year, last.month, last.day, 12));
  return loadCalendarItems(startOfToday(now), rangeEnd, now);
}

function toAgendaItem(item: CalendarItem): DashboardAgendaItem {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    allDay: item.allDay,
    href: item.href,
    company: item.company,
    project: item.project,
    overdue: item.overdue,
  };
}

/**
 * Rendez-vous réels du jour = CalendarEvent qui chevauchent le jour civil Paris.
 * Les visites terrain (Tour / TourStop), relances, tâches et jalons ne sont pas des RDV.
 */
function countTodayRealAppointments(items: readonly CalendarItem[], now: Date) {
  const dayStart = startOfToday(now).getTime();
  const dayEnd = endOfToday(now).getTime();
  return items.filter(
    (item) =>
      item.kind === "event" &&
      new Date(item.startsAt).getTime() <= dayEnd &&
      new Date(item.endsAt).getTime() >= dayStart,
  ).length;
}

/**
 * Prochains éléments d'agenda (aujourd'hui + 6 jours), non terminés.
 * Les visites terrain sont exclues : la tournée est exposée séparément via `tour`.
 */
function pickUpcomingAgenda(items: readonly CalendarItem[], now: Date) {
  const nowMs = now.getTime();
  return items
    .filter((item) => item.kind !== "terrain_visit" && new Date(item.endsAt).getTime() >= nowMs)
    .sort(
      (left, right) =>
        left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id),
    )
    .slice(0, AGENDA_LIMIT)
    .map(toAgendaItem);
}

/** Relances en retard + actions du jour, sans doublon, plafonné. */
function buildNotificationItems(
  overdue: readonly {
    id: string;
    title: string;
    companyId: string;
    companyName: string;
    whenLabel: string;
  }[],
  actions: readonly WorkAction[],
): DashboardNotificationItem[] {
  const items: DashboardNotificationItem[] = [];
  const seen = new Set<string>();
  const push = (item: DashboardNotificationItem) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  };

  for (const followUp of overdue) {
    push({
      id: `follow-up:${followUp.id}`,
      title: `${followUp.companyName} — ${followUp.title}`,
      href: `/entreprises/${followUp.companyId}`,
      kind: "follow_up",
      whenLabel: followUp.whenLabel,
    });
  }

  for (const action of actions) {
    push({
      id: action.id,
      title: `${action.companyName} — ${action.title}`,
      href: `/entreprises/${action.companyId}`,
      kind: action.kind === "follow_up" ? "follow_up" : "action",
      whenLabel: action.whenLabel,
    });
  }

  return items.slice(0, NOTIFICATION_LIMIT);
}

/**
 * Notifications du header (relances en retard + actions du jour). Lecture seule, authentifiée.
 * Même source et même plafond que `DashboardHome.notificationItems`.
 */
export async function loadNotificationItems(
  now: Date = new Date(),
): Promise<DashboardNotificationItem[]> {
  await requireAuthenticatedUser();

  const operations = await loadOperationsDashboard(now);
  return buildNotificationItems(operations.followUps.overdue, operations.today);
}

/**
 * Données de l'accueil « Aujourd'hui ». Lecture seule, authentifiée.
 * Aucun montant ni compteur inventé : tout vient de PostgreSQL via les loaders existants.
 */
export async function loadDashboardHome(
  now: Date = new Date(),
  collectionYear?: number,
): Promise<DashboardHome> {
  await requireAuthenticatedUser();

  const currentYear = parisParts(now).year;
  const year = collectionYear ?? currentYear;

  const [
    finance,
    operations,
    waitingQuotes,
    activeProjects,
    activeProjectsList,
    recentClients,
    agendaWindow,
    recentActivity,
    tour,
    monthlyCollections,
    availableCollectionYears,
    overdueQuoteFollowUps,
  ] = await Promise.all([
    loadFinanceSnapshot({}, now),
    loadOperationsDashboard(now),
    loadWaitingQuotes(now),
    loadActiveProjectCounts(now),
    loadActiveProjectsList(),
    loadRecentClients(now),
    loadAgendaWindow(now),
    loadRecentActivity(RECENT_ACTIVITY_LIMIT),
    loadTodayTour(now),
    loadMonthlyCollections(year),
    loadAvailableCollectionYears(currentYear),
    loadOverdueQuoteFollowUpCount(now),
  ]);

  const years = availableCollectionYears.includes(year)
    ? availableCollectionYears
    : [...availableCollectionYears, year].sort((left, right) => right - left);

  const priorityActionCount = operations.today.length;
  const agendaCount = countTodayRealAppointments(agendaWindow, now);

  const urgentFollowUps: DashboardUrgentFollowUps = {
    count: operations.kpis.overdueFollowUps,
    quoteCount: Math.min(overdueQuoteFollowUps, operations.kpis.overdueFollowUps),
    todayCount: operations.kpis.todayFollowUps,
    ...(finance.overdueCount > 0
      ? { paymentHint: { overdueCount: finance.overdueCount, overdueAmount: finance.overdue } }
      : {}),
  };

  const insight = buildDailyInsight({
    overdueFollowUps: urgentFollowUps.count,
    todayFollowUps: urgentFollowUps.todayCount,
    waitingQuotesOldestDays: waitingQuotes.oldestDays,
    todayAgendaCount: agendaCount,
    priorityActionCount,
    waitingQuotesCount: waitingQuotes.count,
  });

  return {
    generatedAt: now.toISOString(),
    finance: {
      collected: finance.collected,
      signedUncollected: finance.signedUncollected,
      signed: finance.signed,
      scheduled: finance.scheduled,
    },
    waitingQuotes,
    activeProjects,
    urgentFollowUps,
    monthlyCollections,
    availableCollectionYears: years,
    recentClients,
    upcomingAgenda: pickUpcomingAgenda(agendaWindow, now),
    priorityActions: operations.today.slice(0, PRIORITY_ACTION_LIMIT),
    activeProjectsList,
    recentActivity,
    tour,
    insight,
    notificationItems: buildNotificationItems(operations.followUps.overdue, operations.today),
    summary: {
      priorityActionCount,
      agendaCount,
      quotesToFollowCount: waitingQuotes.count,
    },
  };
}
