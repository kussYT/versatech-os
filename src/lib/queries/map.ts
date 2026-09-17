import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type { CompanyLifecycle } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MapCompany } from "@/lib/prospection/map-model";

export async function listMapCompanies(): Promise<MapCompany[]> {
  await requireAuthenticatedUser();
  const companies = await prisma.company.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      lifecycleStatus: true,
      industry: true,
      website: true,
      address: true,
      city: true,
      postalCode: true,
      country: true,
      latitude: true,
      longitude: true,
      followUps: {
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: { title: true, dueAt: true },
      },
    },
  });

  return companies.map((company) => {
    const next = company.followUps[0] ?? null;
    return {
      id: company.id,
      name: company.name,
      lifecycleStatus: company.lifecycleStatus as CompanyLifecycle,
      industry: company.industry,
      website: company.website,
      address: company.address,
      city: company.city,
      postalCode: company.postalCode,
      country: company.country,
      latitude: company.latitude,
      longitude: company.longitude,
      nextFollowUpTitle: next?.title ?? null,
      nextFollowUpAt: next?.dueAt.toISOString() ?? null,
    };
  });
}
