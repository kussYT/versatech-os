import type { CalendarItem } from "@/lib/calendar/types";
import { dueBucket } from "@/lib/dates";
import type { OperationsDashboard, WorkAction } from "@/lib/dashboard/operations";
import type { DashboardTaskItem } from "@/lib/queries/projects";
import type { ProjectSaleDraft } from "@/lib/projects/draft";

export type TodayFilter = "today" | "overdue" | "upcoming";

export type TodayRow = {
  id: string;
  filter: TodayFilter;
  priority: string;
  companyId: string;
  companyName: string;
  action: string;
  due: string;
  status: string;
  prestation: string | null;
  kind: WorkAction["kind"] | "follow_up" | "agenda" | "task" | "stale";
  followUpId: string | null;
  followUpDueAt: string | null;
  quoteId: string | null;
  projectDraft: ProjectSaleDraft | null;
  href: string;
};

const PRIORITY_LABEL: Record<WorkAction["priority"], string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
};

function workRow(
  action: WorkAction,
  filter: TodayFilter,
  followUpDueAt: string | null,
  prestation: string | null,
): TodayRow {
  return {
    id: action.id,
    filter,
    priority: PRIORITY_LABEL[action.priority],
    companyId: action.companyId,
    companyName: action.companyName,
    action: action.title,
    due: action.whenLabel,
    status: action.context,
    prestation,
    kind: action.kind,
    followUpId: action.followUpId,
    followUpDueAt,
    quoteId: action.quoteId,
    projectDraft: action.projectDraft,
    href: `/entreprises/${action.companyId}`,
  };
}

export function companyIdsInDashboard(dashboard: OperationsDashboard) {
  const ids = new Set<string>();
  for (const action of [...dashboard.today, ...dashboard.moreProspects]) {
    ids.add(action.companyId);
  }
  for (const bucket of ["overdue", "today", "upcoming"] as const) {
    for (const followUp of dashboard.followUps[bucket]) {
      ids.add(followUp.companyId);
    }
  }
  for (const quote of [...dashboard.waitingQuotes, ...dashboard.acceptedWithoutProject]) {
    ids.add(quote.companyId);
  }
  for (const opportunity of dashboard.staleOpportunities) {
    ids.add(opportunity.companyId);
  }
  ids.delete("");
  return [...ids];
}

export function buildTodayRows(input: {
  dashboard: OperationsDashboard;
  agenda: CalendarItem[];
  tasks: DashboardTaskItem[];
  prestations?: Record<string, string | null>;
  now?: Date;
}): TodayRow[] {
  const prestations = input.prestations ?? {};
  const labelFor = (companyId: string) => (companyId ? (prestations[companyId] ?? null) : null);
  const now = input.now ?? new Date();
  const rows: TodayRow[] = [];
  const seenFollowUps = new Set<string>();
  const followUpDueAt = new Map<string, string>();
  for (const bucket of ["overdue", "today", "upcoming"] as const) {
    for (const followUp of input.dashboard.followUps[bucket]) {
      followUpDueAt.set(followUp.id, followUp.dueAt);
    }
  }

  for (const action of input.dashboard.today) {
    const filter: TodayFilter = action.urgency === "overdue" ? "overdue" : "today";
    if (action.followUpId) {
      seenFollowUps.add(action.followUpId);
    }
    rows.push(
      workRow(
        action,
        filter,
        action.followUpId ? (followUpDueAt.get(action.followUpId) ?? null) : null,
        labelFor(action.companyId),
      ),
    );
  }

  for (const prospect of input.dashboard.moreProspects) {
    rows.push(workRow(prospect, "today", null, labelFor(prospect.companyId)));
  }

  for (const bucket of ["overdue", "today", "upcoming"] as const) {
    for (const followUp of input.dashboard.followUps[bucket]) {
      if (seenFollowUps.has(followUp.id)) {
        continue;
      }
      rows.push({
        id: `follow-up:${followUp.id}`,
        filter: bucket,
        priority: bucket === "overdue" ? "1" : bucket === "today" ? "2" : "3",
        companyId: followUp.companyId,
        companyName: followUp.companyName,
        action: followUp.title,
        due: followUp.whenLabel,
        status: followUp.opportunityTitle ?? "Relance",
        prestation: labelFor(followUp.companyId),
        kind: "follow_up",
        followUpId: followUp.id,
        followUpDueAt: followUp.dueAt,
        quoteId: null,
        projectDraft: null,
        href: `/entreprises/${followUp.companyId}`,
      });
    }
  }

  for (const quote of input.dashboard.acceptedWithoutProject) {
    if (rows.some((row) => row.quoteId === quote.id)) {
      continue;
    }
    rows.push({
      id: `accepted:${quote.id}`,
      filter: "today",
      priority: "3",
      companyId: quote.companyId,
      companyName: quote.companyName,
      action: "Créer le projet",
      due: quote.amountIncTax,
      status: quote.reference,
      prestation: labelFor(quote.companyId),
      kind: "accepted_quote",
      followUpId: null,
      followUpDueAt: null,
      quoteId: quote.id,
      projectDraft: quote.projectDraft,
      href: `/entreprises/${quote.companyId}`,
    });
  }

  for (const quote of input.dashboard.waitingQuotes) {
    if (rows.some((row) => row.quoteId === quote.id)) {
      continue;
    }
    rows.push({
      id: `waiting:${quote.id}`,
      filter: "today",
      priority: "3",
      companyId: quote.companyId,
      companyName: quote.companyName,
      action: quote.reference,
      due: quote.ageLabel,
      status: quote.missingFollowUp ? "Pas de relance programmée" : (quote.followUpLabel ?? "Relance prévue"),
      prestation: labelFor(quote.companyId),
      kind: "waiting_quote",
      followUpId: null,
      followUpDueAt: null,
      quoteId: quote.id,
      projectDraft: null,
      href: `/entreprises/${quote.companyId}`,
    });
  }

  for (const opportunity of input.dashboard.staleOpportunities) {
    rows.push({
      id: `stale:${opportunity.id}`,
      filter: "today",
      priority: "4",
      companyId: opportunity.companyId,
      companyName: opportunity.companyName,
      action: opportunity.title,
      due: `Il y a ${opportunity.daysSinceActivity} jours`,
      status: opportunity.stageLabel,
      prestation: labelFor(opportunity.companyId),
      kind: "stale",
      followUpId: null,
      followUpDueAt: null,
      quoteId: null,
      projectDraft: null,
      href: `/entreprises/${opportunity.companyId}`,
    });
  }

  for (const item of input.agenda) {
    if (item.kind === "follow_up" || item.kind === "task" || item.kind === "terrain_visit") {
      continue;
    }
    rows.push({
      id: `agenda:${item.id}`,
      filter: item.overdue ? "overdue" : "today",
      priority: item.overdue ? "1" : "2",
      companyId: item.company?.id ?? "",
      companyName: item.company?.name ?? item.project?.name ?? "Agenda",
      action: item.title,
      due: item.startsAt,
      status: item.kind === "milestone" ? "Jalon" : "Rendez-vous",
      prestation: labelFor(item.company?.id ?? ""),
      kind: "agenda",
      followUpId: null,
      followUpDueAt: null,
      quoteId: null,
      projectDraft: null,
      href: item.href ?? "/calendrier",
    });
  }

  for (const task of input.tasks) {
    const filter = task.dueAt ? dueBucket(new Date(task.dueAt), now) : "today";
    rows.push({
      id: `task:${task.id}`,
      filter,
      priority: filter === "overdue" ? "2" : "3",
      companyId: "",
      companyName: task.project?.name ?? "Tâche",
      action: task.title,
      due: task.dueAt ?? "Sans échéance",
      status: "Tâche",
      prestation: null,
      kind: "task",
      followUpId: null,
      followUpDueAt: null,
      quoteId: null,
      projectDraft: null,
      href: task.project ? `/projets/${task.project.id}` : "/taches",
    });
  }

  return rows;
}
