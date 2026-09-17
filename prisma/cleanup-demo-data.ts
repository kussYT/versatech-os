import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getDatabaseUrl } from "../src/lib/db/env";
import {
  DEMO_COMPANY_IDS,
  PROTECTED_COMPANY_ID,
  PROTECTED_USER_ID,
  assertDemoCleanupExecuteAllowed,
  assertDemoCleanupNotProduction,
  isDemoCleanupExecuteAllowed,
  validateDemoCleanupAllowlist,
} from "../src/lib/db/demo-cleanup-guard";

type CleanupPlan = {
  companies: string[];
  contacts: string[];
  interactions: string[];
  followUps: string[];
  opportunities: string[];
  opportunityStageHistory: string[];
  quotes: string[];
  projects: string[];
  tasks: string[];
  milestones: string[];
  repositories: string[];
  documents: string[];
  payments: string[];
  maintenanceContracts: string[];
  calendarEvents: string[];
  tourStops: string[];
  tours: string[];
  activityLogs: string[];
};

const DELETE_ORDER = [
  "tourStops",
  "tours",
  "calendarEvents",
  "documents",
  "payments",
  "maintenanceContracts",
  "milestones",
  "repositories",
  "tasks",
  "followUps",
  "opportunityStageHistory",
  "quotes",
  "interactions",
  "contacts",
  "projects",
  "opportunities",
  "activityLogs",
  "companies",
] as const satisfies readonly (keyof CleanupPlan)[];

function countsFromPlan(plan: CleanupPlan) {
  return Object.fromEntries(
    DELETE_ORDER.map((key) => [key, plan[key].length]),
  ) as Record<(typeof DELETE_ORDER)[number], number>;
}

async function collectPlan(
  prisma: PrismaClient,
  companyIds: string[],
): Promise<CleanupPlan> {
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, name: true },
  });

  if (companies.length !== companyIds.length) {
    const found = new Set(companies.map((company) => company.id));
    const missing = companyIds.filter((id) => !found.has(id));
    throw new Error(`Allowlist ids not found in database: ${missing.join(", ")}`);
  }

  const [
    contacts,
    interactions,
    followUps,
    opportunities,
    quotes,
    projects,
    tasks,
    documents,
    payments,
    maintenanceContracts,
    calendarEvents,
    tourStops,
  ] = await Promise.all([
    prisma.contact.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } }),
    prisma.interaction.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.followUp.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.opportunity.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.quote.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } }),
    prisma.project.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } }),
    prisma.task.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } }),
    prisma.document.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.payment.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } }),
    prisma.maintenanceContract.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.calendarEvent.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.tourStop.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true, tourId: true },
    }),
  ]);

  const opportunityIds = opportunities.map((row) => row.id);
  const projectIds = projects.map((row) => row.id);

  const [stageHistory, milestones, repositories] = await Promise.all([
    opportunityIds.length
      ? prisma.opportunityStageHistory.findMany({
          where: { opportunityId: { in: opportunityIds } },
          select: { id: true },
        })
      : [],
    projectIds.length
      ? prisma.milestone.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true },
        })
      : [],
    projectIds.length
      ? prisma.repository.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true },
        })
      : [],
  ]);

  const tours = await prisma.tour.findMany({
    select: {
      id: true,
      stops: { select: { companyId: true } },
    },
  });
  const companySet = new Set(companyIds);
  const toursToDelete = tours
    .filter(
      (tour) =>
        tour.stops.length > 0 && tour.stops.every((stop) => companySet.has(stop.companyId)),
    )
    .map((tour) => tour.id);

  const entityIds = [
    ...companyIds,
    ...contacts.map((row) => row.id),
    ...interactions.map((row) => row.id),
    ...followUps.map((row) => row.id),
    ...opportunityIds,
    ...stageHistory.map((row) => row.id),
    ...quotes.map((row) => row.id),
    ...projectIds,
    ...tasks.map((row) => row.id),
    ...milestones.map((row) => row.id),
    ...repositories.map((row) => row.id),
    ...documents.map((row) => row.id),
    ...payments.map((row) => row.id),
    ...maintenanceContracts.map((row) => row.id),
    ...calendarEvents.map((row) => row.id),
    ...tourStops.map((row) => row.id),
    ...toursToDelete,
  ];

  const activityLogs = entityIds.length
    ? await prisma.activityLog.findMany({
        where: { entityId: { in: entityIds } },
        select: { id: true, entityType: true, entityId: true },
      })
    : [];

  return {
    companies: companyIds,
    contacts: contacts.map((row) => row.id),
    interactions: interactions.map((row) => row.id),
    followUps: followUps.map((row) => row.id),
    opportunities: opportunityIds,
    opportunityStageHistory: stageHistory.map((row) => row.id),
    quotes: quotes.map((row) => row.id),
    projects: projectIds,
    tasks: tasks.map((row) => row.id),
    milestones: milestones.map((row) => row.id),
    repositories: repositories.map((row) => row.id),
    documents: documents.map((row) => row.id),
    payments: payments.map((row) => row.id),
    maintenanceContracts: maintenanceContracts.map((row) => row.id),
    calendarEvents: calendarEvents.map((row) => row.id),
    tourStops: tourStops.map((row) => row.id),
    tours: toursToDelete,
    activityLogs: activityLogs.map((row) => row.id),
  };
}

async function assertProtectedRowsExist(prisma: PrismaClient) {
  const [company, user, quote, project, repository] = await Promise.all([
    prisma.company.findUnique({
      where: { id: PROTECTED_COMPANY_ID },
      select: { id: true, name: true, lifecycleStatus: true },
    }),
    prisma.user.findUnique({
      where: { id: PROTECTED_USER_ID },
      select: { id: true, email: true },
    }),
    prisma.quote.findFirst({
      where: { companyId: PROTECTED_COMPANY_ID, reference: "DEV-2026-003" },
      select: { id: true, status: true, amountIncTax: true },
    }),
    prisma.project.findFirst({
      where: { companyId: PROTECTED_COMPANY_ID },
      select: { id: true, status: true, name: true },
    }),
    prisma.repository.findFirst({
      where: { project: { companyId: PROTECTED_COMPANY_ID } },
      select: { owner: true, name: true },
    }),
  ]);

  if (!company || company.name !== "ALEX'CEPTION") {
    throw new Error("Protected company ALEX'CEPTION is missing.");
  }
  if (!user || user.email !== "mariusfranck20@gmail.com") {
    throw new Error("Protected admin user is missing.");
  }
  if (!quote || quote.status !== "ACCEPTED") {
    throw new Error("Protected quote DEV-2026-003 is missing.");
  }
  if (!project || project.status !== "ACTIVE") {
    throw new Error("Protected ALEX'CEPTION project is missing.");
  }
  if (!repository || repository.owner !== "kussYT" || repository.name !== "alex-eption") {
    throw new Error("Protected GitHub repository kussYT/alex-eption is missing.");
  }

  return { company, user, quote, project, repository };
}

async function deletePlan(db: PrismaClient, plan: CleanupPlan) {
  const deleteIfAny = async (ids: string[], run: () => Promise<unknown>) => {
    if (ids.length === 0) {
      return;
    }
    await run();
  };

  await deleteIfAny(plan.tourStops, () =>
    db.tourStop.deleteMany({ where: { id: { in: plan.tourStops } } }),
  );
  await deleteIfAny(plan.tours, () =>
    db.tour.deleteMany({ where: { id: { in: plan.tours } } }),
  );
  await deleteIfAny(plan.calendarEvents, () =>
    db.calendarEvent.deleteMany({ where: { id: { in: plan.calendarEvents } } }),
  );
  await deleteIfAny(plan.documents, () =>
    db.document.deleteMany({ where: { id: { in: plan.documents } } }),
  );
  await deleteIfAny(plan.payments, () =>
    db.payment.deleteMany({ where: { id: { in: plan.payments } } }),
  );
  await deleteIfAny(plan.maintenanceContracts, () =>
    db.maintenanceContract.deleteMany({
      where: { id: { in: plan.maintenanceContracts } },
    }),
  );
  await deleteIfAny(plan.milestones, () =>
    db.milestone.deleteMany({ where: { id: { in: plan.milestones } } }),
  );
  await deleteIfAny(plan.repositories, () =>
    db.repository.deleteMany({ where: { id: { in: plan.repositories } } }),
  );
  await deleteIfAny(plan.tasks, () =>
    db.task.deleteMany({ where: { id: { in: plan.tasks } } }),
  );
  await deleteIfAny(plan.followUps, () =>
    db.followUp.deleteMany({ where: { id: { in: plan.followUps } } }),
  );
  await deleteIfAny(plan.opportunityStageHistory, () =>
    db.opportunityStageHistory.deleteMany({
      where: { id: { in: plan.opportunityStageHistory } },
    }),
  );
  await deleteIfAny(plan.quotes, () =>
    db.quote.deleteMany({ where: { id: { in: plan.quotes } } }),
  );
  await deleteIfAny(plan.interactions, () =>
    db.interaction.deleteMany({ where: { id: { in: plan.interactions } } }),
  );
  await deleteIfAny(plan.contacts, () =>
    db.contact.deleteMany({ where: { id: { in: plan.contacts } } }),
  );
  await deleteIfAny(plan.projects, () =>
    db.project.deleteMany({ where: { id: { in: plan.projects } } }),
  );
  await deleteIfAny(plan.opportunities, () =>
    db.opportunity.deleteMany({ where: { id: { in: plan.opportunities } } }),
  );
  await deleteIfAny(plan.activityLogs, () =>
    db.activityLog.deleteMany({ where: { id: { in: plan.activityLogs } } }),
  );
  await deleteIfAny(plan.companies, () =>
    db.company.deleteMany({
      where: {
        id: { in: plan.companies },
        NOT: { id: PROTECTED_COMPANY_ID },
      },
    }),
  );
}

async function main() {
  assertDemoCleanupNotProduction();
  const companyIds = validateDemoCleanupAllowlist();
  const execute = isDemoCleanupExecuteAllowed();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  });

  try {
    const before = await assertProtectedRowsExist(prisma);
    const plan = await collectPlan(prisma, companyIds);
    const protectedIds = new Set(
      Object.values(
        await collectPlan(prisma, [PROTECTED_COMPANY_ID]),
      ).flat(),
    );

    for (const id of Object.values(plan).flat()) {
      if (protectedIds.has(id) || id === PROTECTED_COMPANY_ID || id === PROTECTED_USER_ID) {
        throw new Error(`Cleanup plan overlaps a protected id: ${id}`);
      }
    }

    console.info(
      JSON.stringify(
        {
          mode: execute ? "execute" : "dry-run",
          protected: {
            company: before.company,
            user: { id: before.user.id, email: before.user.email },
            quote: {
              reference: "DEV-2026-003",
              status: before.quote.status,
              amountIncTax: before.quote.amountIncTax.toString(),
            },
            project: before.project,
            repository: `${before.repository.owner}/${before.repository.name}`,
          },
          deleteOrder: DELETE_ORDER,
          counts: countsFromPlan(plan),
        },
        null,
        2,
      ),
    );

    if (!execute) {
      console.info(
        "DRY-RUN: no rows deleted. Re-run with ALLOW_DEMO_CLEANUP=true to execute inside a transaction.",
      );
      return;
    }

    assertDemoCleanupExecuteAllowed();

    await prisma.$transaction(async (tx) => {
      await deletePlan(tx as PrismaClient, plan);
      await assertProtectedRowsExist(tx as PrismaClient);
    });

    await assertProtectedRowsExist(prisma);
    console.info("Demo cleanup executed. ALEX'CEPTION and admin user still present.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
