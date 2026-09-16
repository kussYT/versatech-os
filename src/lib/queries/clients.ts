import "server-only";

import { startOfToday } from "@/lib/crm/form-data";
import { prisma } from "@/lib/db/prisma";

export type ClientListItem = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  primaryContact: {
    firstName: string;
    lastName: string;
    role: string | null;
  } | null;
  signedRevenue: string;
  activeProject: {
    id: string;
    name: string;
  } | null;
  nextDeadline: string | null;
};

function earliestUpcoming(values: (Date | null | undefined)[]) {
  const start = startOfToday();
  const dates = values.filter(
    (value): value is Date => value instanceof Date && value >= start,
  );
  if (dates.length === 0) {
    return null;
  }

  return dates.reduce((min, date) => (date < min ? date : min));
}

export async function listClientCompanies(): Promise<ClientListItem[]> {
  const companies = await prisma.company.findMany({
    where: { lifecycleStatus: "CLIENT" },
    orderBy: { name: "asc" },
    include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: { firstName: true, lastName: true, role: true, isPrimary: true },
      },
      quotes: {
        where: { status: "ACCEPTED" },
        select: { amountIncTax: true },
      },
      projects: {
        select: {
          id: true,
          name: true,
          status: true,
          dueDate: true,
          tasks: { select: { dueAt: true, status: true } },
          milestones: { select: { dueAt: true, status: true } },
        },
      },
    },
  });

  return companies.map((company) => {
    const signed = company.quotes.reduce(
      (sum, quote) => sum + Number(quote.amountIncTax.toString()),
      0,
    );
    const activeProject =
      company.projects.find((project) => project.status === "ACTIVE") ??
      company.projects.find(
        (project) => project.status !== "COMPLETED" && project.status !== "ARCHIVED",
      ) ??
      null;
    const nextDeadline = earliestUpcoming([
      ...company.projects.map((project) => project.dueDate),
      ...company.projects.flatMap((project) =>
        project.tasks
          .filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS")
          .map((task) => task.dueAt),
      ),
      ...company.projects.flatMap((project) =>
        project.milestones
          .filter((milestone) => milestone.status === "PENDING")
          .map((milestone) => milestone.dueAt),
      ),
    ]);

    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      city: company.city,
      primaryContact: company.contacts[0]
        ? {
            firstName: company.contacts[0].firstName,
            lastName: company.contacts[0].lastName,
            role: company.contacts[0].role,
          }
        : null,
      signedRevenue: String(signed),
      activeProject: activeProject
        ? { id: activeProject.id, name: activeProject.name }
        : null,
      nextDeadline: nextDeadline?.toISOString() ?? null,
    };
  });
}
