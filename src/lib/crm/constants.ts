import type {
  CompanyLifecycle,
  FollowUpStatus,
  MilestoneStatus,
  OpportunityStage,
  Priority,
  ProjectStatus,
  QuoteStatus,
  TaskStatus,
} from "@/generated/prisma/client";

export const PROSPECT_LIFECYCLES = [
  "LEAD",
  "CONTACTED",
  "QUALIFIED",
  "OPPORTUNITY",
] as const satisfies readonly CompanyLifecycle[];

export const COMPANY_LIFECYCLE_LABELS: Record<CompanyLifecycle, string> = {
  LEAD: "Lead",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  OPPORTUNITY: "Opportunité",
  CLIENT: "Client",
  INACTIVE: "Inactif",
  LOST: "Perdu",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgent",
};

export function isProspectLifecycle(
  status: CompanyLifecycle,
): status is (typeof PROSPECT_LIFECYCLES)[number] {
  return (PROSPECT_LIFECYCLES as readonly CompanyLifecycle[]).includes(status);
}

export const OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
  "WON",
  "LOST",
] as const satisfies readonly OpportunityStage[];

export const OPEN_OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
] as const satisfies readonly OpportunityStage[];

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  TO_QUALIFY: "À qualifier",
  TO_CONTACT: "À contacter",
  CONTACTED: "Contacté",
  INTERESTED: "Intéressé",
  MEETING: "RDV",
  QUOTE: "Devis",
  WON: "Gagné",
  LOST: "Perdu",
};

export const OPPORTUNITY_STAGE_BADGE: Record<
  OpportunityStage,
  "prospect" | "contacted" | "interested" | "meeting" | "quote" | "won" | "lost"
> = {
  TO_QUALIFY: "prospect",
  TO_CONTACT: "prospect",
  CONTACTED: "contacted",
  INTERESTED: "interested",
  MEETING: "meeting",
  QUOTE: "quote",
  WON: "won",
  LOST: "lost",
};

export function isOpenOpportunityStage(stage: OpportunityStage) {
  return (OPEN_OPPORTUNITY_STAGES as readonly OpportunityStage[]).includes(stage);
}

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  PENDING: "En attente",
  COMPLETED: "Terminée",
  CANCELED: "Annulée",
};

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const satisfies readonly QuoteStatus[];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  VIEWED: "Consulté",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
};

export const PROJECT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "WAITING_CLIENT",
  "REVIEW",
  "COMPLETED",
  "ARCHIVED",
] as const satisfies readonly ProjectStatus[];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Planifié",
  ACTIVE: "Actif",
  WAITING_CLIENT: "En attente client",
  REVIEW: "Recette",
  COMPLETED: "Terminé",
  ARCHIVED: "Archivé",
};

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELED",
] as const satisfies readonly TaskStatus[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
  CANCELED: "Annulée",
};

export const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS"] as const satisfies readonly TaskStatus[];

export const MILESTONE_STATUSES = [
  "PENDING",
  "DONE",
  "CANCELED",
] as const satisfies readonly MilestoneStatus[];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: "En attente",
  DONE: "Terminé",
  CANCELED: "Annulé",
};

export function projectProgress(tasks: { status: TaskStatus }[]) {
  const active = tasks.filter((task) => task.status !== "CANCELED");
  if (active.length === 0) {
    return 0;
  }

  const done = active.filter((task) => task.status === "DONE").length;
  return Math.round((done / active.length) * 100);
}
