/**
 * Website Status V1 — état métier interne du site géré par VersaTech.
 *
 * Aucun monitoring HTTP, ping, uptime, cron, ni fetch périodique.
 * Statut dérivé (ViewModel) : pas d'enum Prisma.
 *
 * Sources V1 :
 * - URL = Company.website (pas de websiteUrl dédié)
 * - Projet principal = selectPrincipalProject (partagé avec Client Journey)
 * - LIVE métier = ProjectStatus.COMPLETED (il n'existe pas de LIVE en base)
 * - Mise en ligne effective = Project.completedAt uniquement
 *   (startDate = début projet, dueDate = deadline — ne pas les réutiliser)
 * - Maintenance = MaintenanceContract + hasMaintenanceStarted (Europe/Paris)
 *
 * V2 (types / commentaires uniquement, non implémenté) :
 * - HTTP status, disponibilité, SSL, temps de réponse, last check, incidents
 * - sélecteur explicite du projet site (Company.websiteProjectId)
 */

import type { MaintenanceStatus, ProjectStatus } from "@/generated/prisma/client";
import { hasMaintenanceStarted } from "@/lib/maintenance/mrr";
import { isActiveMaintenanceStatus } from "@/lib/maintenance/status";
import { normalizeMoney } from "@/lib/money";
import {
  contractProjectId,
  selectPrincipalProject,
  type PrincipalProjectSource,
} from "@/lib/projects/principal";

/** Équivalent métier « EN LIGNE » : le schéma n'a pas ProjectStatus.LIVE. */
export const LIVE_PROJECT_STATUS = "COMPLETED" satisfies ProjectStatus;

/** Statut site « en développement » : travail non livré, y compris PLANNED. */
export const IN_DEVELOPMENT_PROJECT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "WAITING_CLIENT",
  "REVIEW",
] as const satisfies readonly ProjectStatus[];

export const WEBSITE_STATUSES = [
  "NO_WEBSITE",
  "IN_DEVELOPMENT",
  "LIVE",
  "MAINTENANCE",
  "INACTIVE",
] as const;

export type WebsiteStatusCode = (typeof WEBSITE_STATUSES)[number];

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatusCode, string> = {
  NO_WEBSITE: "Aucun site",
  IN_DEVELOPMENT: "En développement",
  LIVE: "En ligne",
  MAINTENANCE: "En maintenance",
  INACTIVE: "Inactif",
};

export type WebsiteProjectInput = {
  id: string;
  name: string;
  status: ProjectStatus;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  startDate?: Date | string | null;
};

export type WebsiteContractInput = {
  id: string;
  status: MaintenanceStatus;
  monthlyAmount: string;
  startDate: Date | string;
  projectId?: string | null;
  project?: { id: string } | null;
};

/**
 * V2 : picker explicite du projet site. V1 n'écrit rien en base.
 * Passer `selectedProjectId` outrepasse l'heuristique (architecture prête, UI absente).
 */
export type WebsiteProjectPickerV2 = {
  selectedProjectId?: string | null;
};

/**
 * V2 monitoring — ne pas peupler en V1.
 * Interdit : HTTP, ping, cron, SSL live, temps de réponse, incidents.
 */
export type WebsiteMonitoringV2 = {
  httpStatus: number | null;
  availability: "UP" | "DOWN" | "UNKNOWN" | null;
  sslValid: boolean | null;
  sslExpiresAt: string | null;
  responseTimeMs: number | null;
  lastCheckedAt: string | null;
  incidents: ReadonlyArray<{
    id: string;
    startedAt: string;
    resolvedAt: string | null;
    summary: string;
  }>;
};

export type WebsiteUrlView = {
  href: string;
  host: string;
  raw: string;
};

export type WebsiteGoLiveView = {
  at: string;
  kind: "effective";
};

export type WebsiteMaintenanceView = {
  id: string;
  status: MaintenanceStatus;
  monthlyAmount: string;
  startDate: string;
  started: boolean;
  projectId: string | null;
};

export type WebsiteProjectView = {
  id: string;
  name: string;
  status: ProjectStatus;
  href: string;
  source: PrincipalProjectSource;
};

export type WebsiteStatusView = {
  status: WebsiteStatusCode | null;
  url: WebsiteUrlView | null;
  project: WebsiteProjectView | null;
  goLive: WebsiteGoLiveView | null;
  maintenance: WebsiteMaintenanceView | null;
  /** Toujours `null` en V1. Réservé au monitoring HTTP V2. */
  monitoring: WebsiteMonitoringV2 | null;
};

export type BuildWebsiteStatusInput = {
  website: string | null | undefined;
  projects?: readonly WebsiteProjectInput[];
  contracts?: readonly WebsiteContractInput[];
  now?: Date;
} & WebsiteProjectPickerV2;

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isInDevelopmentStatus(status: ProjectStatus) {
  return (IN_DEVELOPMENT_PROJECT_STATUSES as readonly ProjectStatus[]).includes(status);
}

function maintenanceRank(contract: WebsiteContractInput, now: Date) {
  const started = hasMaintenanceStarted(contract.startDate, now);
  if (isActiveMaintenanceStatus(contract.status) && started) {
    return 0;
  }
  if (isActiveMaintenanceStatus(contract.status)) {
    return 1;
  }
  if (contract.status === "PAUSED") {
    return 2;
  }
  if (contract.status === "ENDED") {
    return 3;
  }
  return 4;
}

function startDateMs(contract: WebsiteContractInput) {
  const time = new Date(contract.startDate).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * V1 : un contrat « site » par entreprise.
 * Priorité : lié au projet principal, puis contrat d'entreprise (sans projet), puis les autres.
 * Dans un groupe : ACTIVE commencé > ACTIVE futur > PAUSED > ENDED > CANCELED, puis startDate desc.
 */
export function selectWebsiteMaintenance(
  contracts: readonly WebsiteContractInput[],
  principalProjectId: string | null,
  now: Date,
): WebsiteContractInput | null {
  if (contracts.length === 0) {
    return null;
  }

  const ranked = [...contracts].sort((left, right) => {
    const leftLink =
      principalProjectId && contractProjectId(left) === principalProjectId
        ? 0
        : contractProjectId(left) == null
          ? 1
          : 2;
    const rightLink =
      principalProjectId && contractProjectId(right) === principalProjectId
        ? 0
        : contractProjectId(right) == null
          ? 1
          : 2;
    if (leftLink !== rightLink) {
      return leftLink - rightLink;
    }

    const rankDelta = maintenanceRank(left, now) - maintenanceRank(right, now);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return startDateMs(right) - startDateMs(left);
  });

  return ranked[0] ?? null;
}

function deriveStatus(input: {
  url: WebsiteUrlView | null;
  project: WebsiteProjectInput | null;
  maintenance: WebsiteContractInput | null;
  now: Date;
}): WebsiteStatusCode | null {
  const { url, project, maintenance, now } = input;

  if (!project) {
    return url ? null : "NO_WEBSITE";
  }

  if (project.status === "ARCHIVED") {
    return "INACTIVE";
  }

  if (project.status === LIVE_PROJECT_STATUS) {
    const liveMaintenance =
      maintenance &&
      isActiveMaintenanceStatus(maintenance.status) &&
      hasMaintenanceStarted(maintenance.startDate, now);
    return liveMaintenance ? "MAINTENANCE" : "LIVE";
  }

  if (isInDevelopmentStatus(project.status)) {
    return "IN_DEVELOPMENT";
  }

  return null;
}

function toMaintenanceView(contract: WebsiteContractInput, now: Date): WebsiteMaintenanceView {
  return {
    id: contract.id,
    status: contract.status,
    monthlyAmount: normalizeMoney(contract.monthlyAmount),
    startDate: toIso(contract.startDate),
    started: hasMaintenanceStarted(contract.startDate, now),
    projectId: contractProjectId(contract),
  };
}

export function buildWebsiteStatus(input: BuildWebsiteStatusInput): WebsiteStatusView {
  const now = input.now ?? new Date();
  const projects = input.projects ?? [];
  const contracts = input.contracts ?? [];
  const url = input.website ? displayWebsiteUrl(input.website) : null;
  const selected = selectPrincipalProject(projects, contracts, {
    selectedProjectId: input.selectedProjectId,
    now,
  });
  const project = selected?.project ?? null;
  const maintenance = selectWebsiteMaintenance(contracts, project?.id ?? null, now);
  const completedAt = project?.completedAt ?? null;
  const goLive =
    completedAt != null && completedAt !== ""
      ? { at: toIso(completedAt), kind: "effective" as const }
      : null;

  return {
    status: deriveStatus({ url, project, maintenance, now }),
    url,
    project: project
      ? {
          id: project.id,
          name: project.name,
          status: project.status,
          href: `/projets/${project.id}`,
          source: selected?.source ?? "archived",
        }
      : null,
    goLive,
    maintenance: maintenance ? toMaintenanceView(maintenance, now) : null,
    monitoring: null,
  };
}

export function displayWebsiteUrl(raw: string): WebsiteUrlView | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { href, host: trimmed, raw: trimmed };
    }

    const host = parsed.hostname.replace(/^www\./i, "") || trimmed;
    return { href, host, raw: trimmed };
  } catch {
    return { href, host: trimmed, raw: trimmed };
  }
}
