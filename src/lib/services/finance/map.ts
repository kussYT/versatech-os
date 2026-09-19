import "server-only";

import type { FinanceTotals } from "@/lib/finance";
import type { MrrSnapshot } from "@/lib/maintenance/mrr";
import { parseFinanceSnapshot, type FinanceSnapshotDto } from "./schema";

export function mapFinanceSnapshot(input: {
  totals: FinanceTotals;
  mrr: MrrSnapshot;
  companyId?: string;
  projectId?: string;
}): FinanceSnapshotDto {
  return parseFinanceSnapshot({
    scope: {
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
    },
    signed: input.totals.signed,
    collected: input.totals.collected,
    remaining: input.totals.remaining,
    pending: input.totals.pending,
    overdue: input.totals.overdue,
    pendingCount: input.totals.pendingCount,
    overdueCount: input.totals.overdueCount,
    paidCount: input.totals.paidCount,
    paymentCount: input.totals.paymentCount,
    mrr: input.mrr.mrr,
    arr: input.mrr.arr,
  });
}
