import type { CompanyLifecycle } from "@/generated/prisma/client";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import type { CompanyLifecycleFacts } from "@/lib/crm/lifecycle";
import { prisma } from "@/lib/db/prisma";

type LifecycleDb = Pick<
  typeof prisma,
  "opportunity" | "quote" | "project" | "company" | "activityLog"
>;

export async function countCompanyLifecycleFacts(
  db: LifecycleDb,
  companyId: string,
  current: CompanyLifecycle,
): Promise<CompanyLifecycleFacts> {
  const [wonOpportunityCount, acceptedQuoteCount, projectCount, openOpportunityCount] =
    await Promise.all([
      db.opportunity.count({ where: { companyId, stage: "WON" } }),
      db.quote.count({ where: { companyId, status: "ACCEPTED" } }),
      db.project.count({ where: { companyId } }),
      db.opportunity.count({
        where: { companyId, stage: { in: [...OPEN_OPPORTUNITY_STAGES] } },
      }),
    ]);

  return {
    current,
    wonOpportunityCount,
    acceptedQuoteCount,
    projectCount,
    openOpportunityCount,
  };
}

export async function applyCompanyLifecycleChange(
  db: LifecycleDb,
  params: {
    companyId: string;
    from: CompanyLifecycle;
    to: CompanyLifecycle | null;
    actorId: string;
    reason: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  if (!params.to || params.to === params.from) {
    return false;
  }

  await db.company.update({
    where: { id: params.companyId },
    data: { lifecycleStatus: params.to },
  });

  await db.activityLog.create({
    data: {
      actorId: params.actorId,
      entityType: "Company",
      entityId: params.companyId,
      action: "company.lifecycle_changed",
      metadata: {
        from: params.from,
        to: params.to,
        reason: params.reason,
        ...params.metadata,
      },
    },
  });

  return true;
}
