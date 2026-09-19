import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { loadCompanyExists } from "@/lib/queries/companies";
import { loadMaintenanceMrrSnapshot } from "@/lib/queries/maintenance";
import { loadFinanceSnapshot } from "@/lib/queries/payments";
import { loadProjectExists } from "@/lib/queries/projects";
import { mapFinanceSnapshot } from "./map";
import {
  parseGetFinanceSnapshotInput,
  requireServiceActor,
  type FinanceSnapshotDto,
} from "./schema";

export const COMPANY_NOT_FOUND_MESSAGE = "Entreprise introuvable.";
export const PROJECT_NOT_FOUND_MESSAGE = "Projet introuvable.";

export type GetFinanceSnapshotInput = {
  actor: SessionUser;
  companyId?: string;
  projectId?: string;
  now?: Date;
};

/**
 * Agrégats CA (signé / encaissé / restant / retards) + MRR/ARR `computeMrr`.
 * READ only — no payment write, no redirect, no ActivityLog.
 */
export async function getFinanceSnapshot({
  actor,
  companyId,
  projectId,
  now = new Date(),
}: GetFinanceSnapshotInput): Promise<FinanceSnapshotDto> {
  requireServiceActor(actor);
  const input = parseGetFinanceSnapshotInput({ companyId, projectId });

  if (input.companyId) {
    const exists = await loadCompanyExists(input.companyId);
    if (!exists) {
      throw new Error(COMPANY_NOT_FOUND_MESSAGE);
    }
  }

  if (input.projectId) {
    const exists = await loadProjectExists(input.projectId);
    if (!exists) {
      throw new Error(PROJECT_NOT_FOUND_MESSAGE);
    }
  }

  const scope = {
    ...(input.companyId ? { companyId: input.companyId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
  };

  const [totals, mrr] = await Promise.all([
    loadFinanceSnapshot(scope, now),
    loadMaintenanceMrrSnapshot(scope, now),
  ]);

  return mapFinanceSnapshot({
    totals,
    mrr,
    companyId: input.companyId,
    projectId: input.projectId,
  });
}

export const FinanceService = {
  getFinanceSnapshot,
};
