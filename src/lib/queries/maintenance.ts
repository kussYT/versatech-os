import "server-only";

import type { MaintenanceStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  isUpcomingMaintenanceDue,
  nextMaintenanceDueDate,
} from "@/lib/maintenance/due";
import { computeMrr } from "@/lib/maintenance/mrr";
import { isActiveMaintenanceStatus } from "@/lib/maintenance/status";
import { normalizeMoney } from "@/lib/money";

/**
 * Payment n'a pas de relation vers MaintenanceContract.
 * V1 : le contrat porte le MRR et l'échéance indicative calculée.
 * Aucune ligne Payment n'est créée ici (pas de facturation récurrente, pas de doublon).
 */

export type MaintenanceCompanyOption = {
  id: string;
  name: string;
};

export type MaintenanceProjectOption = {
  id: string;
  name: string;
  companyId: string;
};

export type MaintenanceAssociationOptions = {
  companies: MaintenanceCompanyOption[];
  projects: MaintenanceProjectOption[];
};

export type MaintenanceContractItem = {
  id: string;
  monthlyAmount: string;
  status: MaintenanceStatus;
  startDate: string;
  endDate: string | null;
  description: string | null;
  nextDueDate: string | null;
  company: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
    companyId: string;
  } | null;
};

export type MaintenanceUpcomingDue = {
  id: string;
  companyName: string;
  monthlyAmount: string;
  nextDueDate: string;
};

export type MaintenanceOverview = {
  contracts: MaintenanceContractItem[];
  mrr: string;
  arr: string;
  activeCount: number;
  activeStatusCount: number;
  totalCount: number;
  upcomingDueCount: number;
  upcomingDues: MaintenanceUpcomingDue[];
};

const contractInclude = {
  company: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, companyId: true } },
} as const;

function toContractItem(
  contract: {
    id: string;
    monthlyAmount: { toString(): string };
    status: MaintenanceStatus;
    startDate: Date;
    endDate: Date | null;
    description: string | null;
    company: { id: string; name: string };
    project: { id: string; name: string; companyId: string } | null;
  },
  now = new Date(),
): MaintenanceContractItem {
  const nextDue = nextMaintenanceDueDate({
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
    now,
  });

  return {
    id: contract.id,
    monthlyAmount: normalizeMoney(contract.monthlyAmount.toString()),
    status: contract.status,
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate?.toISOString() ?? null,
    description: contract.description,
    nextDueDate: nextDue?.toISOString() ?? null,
    company: contract.company,
    project: contract.project,
  };
}

export async function listMaintenanceAssociationOptions(): Promise<MaintenanceAssociationOptions> {
  const [companies, projects] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
  ]);

  return { companies, projects };
}

export async function listMaintenanceOverview(now = new Date()): Promise<MaintenanceOverview> {
  const contracts = await prisma.maintenanceContract.findMany({
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: contractInclude,
  });

  const items = contracts.map((contract) => toContractItem(contract, now));
  const snapshot = computeMrr(items, now);
  const activeStatusCount = items.filter((contract) =>
    isActiveMaintenanceStatus(contract.status),
  ).length;
  const upcomingDues = items
    .filter((contract) => {
      if (!contract.nextDueDate) {
        return false;
      }
      return isUpcomingMaintenanceDue(new Date(contract.nextDueDate), now);
    })
    .map((contract) => ({
      id: contract.id,
      companyName: contract.company.name,
      monthlyAmount: contract.monthlyAmount,
      nextDueDate: contract.nextDueDate as string,
    }))
    .sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate));

  return {
    contracts: items,
    mrr: snapshot.mrr,
    arr: snapshot.arr,
    activeCount: snapshot.activeCount,
    activeStatusCount,
    totalCount: items.length,
    upcomingDueCount: upcomingDues.length,
    upcomingDues,
  };
}

export async function listMaintenanceContractsForCompany(
  companyId: string,
  now = new Date(),
): Promise<MaintenanceContractItem[]> {
  const contracts = await prisma.maintenanceContract.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: contractInclude,
  });

  return contracts.map((contract) => toContractItem(contract, now));
}
