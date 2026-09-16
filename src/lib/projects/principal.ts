/**
 * Projet principal partagé — Client Journey + Website Status.
 *
 * Une Company peut avoir plusieurs projets. V1 choisit UN projet représentant
 * le travail actuel de VersaTech pour cette entreprise.
 * Pas de Company.websiteProjectId. Hook V2 : `selectedProjectId`.
 *
 * Ordre :
 * 1. selectedProjectId explicite s'il est fourni et présent dans la liste
 * 2. projet actuellement en développement : ACTIVE, WAITING_CLIENT, REVIEW
 * 3. COMPLETED avec MaintenanceContract ACTIVE réellement commencé
 * 4. COMPLETED le plus récent
 * 5. PLANNED le plus récent
 * 6. ARCHIVED en dernier recours
 *
 * Tie-break (dates pertinentes desc, puis createdAt desc, puis id desc) :
 * - in_development : startDate → updatedAt → createdAt → id
 * - completed_maintenance / completed / archived : completedAt → createdAt → id
 * - planned : startDate → createdAt → id
 *
 * Une date absente perd le tie-break (jamais inventée).
 */

import type { MaintenanceStatus, ProjectStatus } from "@/generated/prisma/client";
import { hasMaintenanceStarted } from "@/lib/maintenance/mrr";
import { isActiveMaintenanceStatus } from "@/lib/maintenance/status";

export const IN_PROGRESS_PROJECT_STATUSES = [
  "ACTIVE",
  "WAITING_CLIENT",
  "REVIEW",
] as const satisfies readonly ProjectStatus[];

export type PrincipalProjectInput = {
  id: string;
  status: ProjectStatus;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  startDate?: Date | string | null;
  completedAt?: Date | string | null;
};

export type PrincipalContractInput = {
  status: MaintenanceStatus;
  startDate?: Date | string;
  projectId?: string | null;
  project?: { id: string } | null;
};

export type PrincipalProjectSource =
  | "explicit"
  | "in_development"
  | "completed_maintenance"
  | "completed"
  | "planned"
  | "archived";

export type PrincipalProjectSelection<T extends PrincipalProjectInput = PrincipalProjectInput> = {
  project: T;
  source: PrincipalProjectSource;
};

export type SelectPrincipalProjectOptions = {
  selectedProjectId?: string | null;
  now?: Date;
};

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function compareDesc(left: Date | string | null | undefined, right: Date | string | null | undefined) {
  const leftMs = toMs(left) ?? Number.NEGATIVE_INFINITY;
  const rightMs = toMs(right) ?? Number.NEGATIVE_INFINITY;
  return rightMs - leftMs;
}

function compareIdDesc(left: PrincipalProjectInput, right: PrincipalProjectInput) {
  return right.id.localeCompare(left.id);
}

function newestInDevelopment(left: PrincipalProjectInput, right: PrincipalProjectInput) {
  const byStart = compareDesc(left.startDate, right.startDate);
  if (byStart !== 0) {
    return byStart;
  }

  const byUpdated = compareDesc(left.updatedAt, right.updatedAt);
  if (byUpdated !== 0) {
    return byUpdated;
  }

  const byCreated = compareDesc(left.createdAt, right.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }

  return compareIdDesc(left, right);
}

function newestCompleted(left: PrincipalProjectInput, right: PrincipalProjectInput) {
  const byCompleted = compareDesc(left.completedAt, right.completedAt);
  if (byCompleted !== 0) {
    return byCompleted;
  }

  const byCreated = compareDesc(left.createdAt, right.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }

  return compareIdDesc(left, right);
}

function newestPlanned(left: PrincipalProjectInput, right: PrincipalProjectInput) {
  const byStart = compareDesc(left.startDate, right.startDate);
  if (byStart !== 0) {
    return byStart;
  }

  const byCreated = compareDesc(left.createdAt, right.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }

  return compareIdDesc(left, right);
}

export function contractProjectId(contract: PrincipalContractInput) {
  return contract.projectId ?? contract.project?.id ?? null;
}

export function isInProgressProjectStatus(status: ProjectStatus) {
  return (IN_PROGRESS_PROJECT_STATUSES as readonly ProjectStatus[]).includes(status);
}

export function selectPrincipalProject<T extends PrincipalProjectInput>(
  projects: readonly T[],
  contracts: readonly PrincipalContractInput[] = [],
  options: SelectPrincipalProjectOptions = {},
): PrincipalProjectSelection<T> | null {
  if (projects.length === 0) {
    return null;
  }

  const now = options.now ?? new Date();
  const explicit = options.selectedProjectId
    ? projects.find((project) => project.id === options.selectedProjectId)
    : undefined;
  if (explicit) {
    return { project: explicit, source: "explicit" };
  }

  const inDevelopment = projects.filter((project) => isInProgressProjectStatus(project.status));
  if (inDevelopment[0]) {
    const sorted = [...inDevelopment].sort(newestInDevelopment);
    return { project: sorted[0]!, source: "in_development" };
  }

  const maintainedIds = new Set(
    contracts
      .filter(
        (contract) =>
          isActiveMaintenanceStatus(contract.status) && hasMaintenanceStarted(contract.startDate, now),
      )
      .map(contractProjectId)
      .filter((id): id is string => Boolean(id)),
  );

  const maintained = projects.filter(
    (project) => project.status === "COMPLETED" && maintainedIds.has(project.id),
  );
  if (maintained[0]) {
    return { project: [...maintained].sort(newestCompleted)[0]!, source: "completed_maintenance" };
  }

  const completed = projects.filter((project) => project.status === "COMPLETED");
  if (completed[0]) {
    return { project: [...completed].sort(newestCompleted)[0]!, source: "completed" };
  }

  const planned = projects.filter((project) => project.status === "PLANNED");
  if (planned[0]) {
    return { project: [...planned].sort(newestPlanned)[0]!, source: "planned" };
  }

  const archived = projects.filter((project) => project.status === "ARCHIVED");
  if (archived[0]) {
    return { project: [...archived].sort(newestCompleted)[0]!, source: "archived" };
  }

  return { project: [...projects].sort(newestCompleted)[0]!, source: "archived" };
}
