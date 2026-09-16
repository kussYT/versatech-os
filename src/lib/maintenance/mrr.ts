import { parisDateKey } from "@/lib/dates";
import { isActiveMaintenanceStatus } from "@/lib/maintenance/status";
import { multiplyMoney, sumMoney, ZERO_MONEY } from "@/lib/money";
import type { MaintenanceStatus } from "@/generated/prisma/client";

export type MrrContractInput = {
  status: MaintenanceStatus;
  monthlyAmount: string;
  startDate?: Date | string;
};

export type MrrSnapshot = {
  mrr: string;
  arr: string;
  activeCount: number;
};

function hasStarted(startDate: Date | string | undefined, now: Date) {
  if (!startDate) {
    return true;
  }

  return parisDateKey(startDate) <= parisDateKey(now);
}

/**
 * MRR officiel = somme des monthlyAmount des contrats ACTIVE
 * dont startDate ≤ le jour civil observé (Europe/Paris).
 * ACTIVE + startDate future = hors MRR.
 * ARR indicatif = MRR × 12 (pas de prorata).
 */
export function computeMrr(contracts: readonly MrrContractInput[], now = new Date()): MrrSnapshot {
  const active = contracts.filter(
    (contract) => isActiveMaintenanceStatus(contract.status) && hasStarted(contract.startDate, now),
  );
  const mrr = active.length === 0 ? ZERO_MONEY : sumMoney(active.map((contract) => contract.monthlyAmount));

  return {
    mrr,
    arr: multiplyMoney(mrr, 12),
    activeCount: active.length,
  };
}
