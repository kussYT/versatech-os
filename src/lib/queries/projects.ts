import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type {
  MilestoneStatus,
  Priority,
  ProjectStatus,
  QuoteStatus,
  TaskStatus,
} from "@/generated/prisma/client";
import { OPEN_TASK_STATUSES, projectProgress } from "@/lib/crm/constants";
import { computeFinanceTotals, effectivePaymentStatus, type FinanceTotals } from "@/lib/finance";
import { prisma } from "@/lib/db/prisma";
import {
  listDocumentsForProject,
  type DocumentRecord,
} from "@/lib/queries/documents";
import type { PaymentListItem } from "@/lib/queries/payments";

export type ProjectListItem = {
  id: string;
  name: string;
  status: ProjectStatus;
  dueDate: string | null;
  progress: number;
  openTaskCount: number;
  company: {
    id: string;
    name: string;
  };
};

export type ProjectDetail = {
  id: string;
  name: string;
  status: ProjectStatus;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  amount: string | null;
  progress: number;
  company: {
    id: string;
    name: string;
  };
  tasks: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Priority;
    dueAt: string | null;
  }[];
  milestones: {
    id: string;
    name: string;
    status: MilestoneStatus;
    dueAt: string | null;
  }[];
  activity: {
    id: string;
    action: string;
    createdAt: string;
  }[];
  repositories: {
    id: string;
    owner: string;
    name: string;
    url: string;
    defaultBranch: string;
  }[];
  quotes: {
    id: string;
    reference: string;
    status: QuoteStatus;
    amountIncTax: string;
  }[];
  payments: PaymentListItem[];
  finance: FinanceTotals;
  documents: DocumentRecord[];
};

export type TaskListItem = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: Priority;
  status: TaskStatus;
  project: {
    id: string;
    name: string;
  } | null;
  company: {
    id: string;
    name: string;
  } | null;
};

export async function listOpenTasks(): Promise<TaskListItem[]> {
  await requireAuthenticatedUser();
  const tasks = await prisma.task.findMany({
    where: { status: { in: [...OPEN_TASK_STATUSES] } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      dueAt: true,
      priority: true,
      status: true,
      project: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueAt: task.dueAt?.toISOString() ?? null,
    priority: task.priority,
    status: task.status,
    project: task.project,
    company: task.company,
  }));
}

export type DashboardTaskItem = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: Priority;
  project: {
    id: string;
    name: string;
  } | null;
};

export async function listProjects(): Promise<ProjectListItem[]> {
  await requireAuthenticatedUser();
  const projects = await prisma.project.findMany({
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    include: {
      company: { select: { id: true, name: true } },
      tasks: { select: { status: true } },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    dueDate: project.dueDate?.toISOString() ?? null,
    progress: projectProgress(project.tasks),
    openTaskCount: project.tasks.filter((task) =>
      (OPEN_TASK_STATUSES as readonly TaskStatus[]).includes(task.status),
    ).length,
    company: project.company,
  }));
}

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  await requireAuthenticatedUser();
  const [project, documents] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] },
        milestones: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] },
        repositories: { orderBy: [{ createdAt: "asc" }] },
        quotes: {
          orderBy: { createdAt: "desc" },
          select: { id: true, reference: true, status: true, amountIncTax: true },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          include: {
            quote: { select: { id: true, reference: true, status: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    }),
    listDocumentsForProject(id),
  ]);

  if (!project) {
    return null;
  }

  const activity = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entityType: "Project", entityId: project.id },
        { entityType: "Task", entityId: { in: project.tasks.map((task) => task.id) } },
        {
          entityType: "Milestone",
          entityId: { in: project.milestones.map((milestone) => milestone.id) },
        },
        {
          entityType: "Repository",
          entityId: { in: project.repositories.map((repository) => repository.id) },
        },
        {
          entityType: "Document",
          entityId: { in: documents.map((document) => document.id) },
        },
        {
          entityType: "Payment",
          entityId: { in: project.payments.map((payment) => payment.id) },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, action: true, createdAt: true },
  });

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    description: project.description,
    startDate: project.startDate?.toISOString() ?? null,
    dueDate: project.dueDate?.toISOString() ?? null,
    amount: project.amount?.toString() ?? null,
    progress: projectProgress(project.tasks),
    company: project.company,
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
    })),
    milestones: project.milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
      dueAt: milestone.dueAt?.toISOString() ?? null,
    })),
    activity: activity.map((item) => ({
      id: item.id,
      action: item.action,
      createdAt: item.createdAt.toISOString(),
    })),
    repositories: project.repositories
      .filter((repository) => repository.provider === "github")
      .map((repository) => ({
        id: repository.id,
        owner: repository.owner,
        name: repository.name,
        url: repository.url,
        defaultBranch: repository.defaultBranch,
      })),
    quotes: project.quotes.map((quote) => ({
      id: quote.id,
      reference: quote.reference,
      status: quote.status,
      amountIncTax: quote.amountIncTax.toString(),
    })),
    payments: project.payments.map((payment) => ({
      id: payment.id,
      label: payment.label,
      amount: payment.amount.toString(),
      status: payment.status,
      effectiveStatus: effectivePaymentStatus(payment.status, payment.dueAt),
      dueAt: payment.dueAt?.toISOString() ?? null,
      paidAt: payment.paidAt?.toISOString() ?? null,
      externalReference: payment.externalReference,
      createdAt: payment.createdAt.toISOString(),
      company: project.company,
      quote: payment.quote,
      project: payment.project,
    })),
    finance: computeFinanceTotals(
      project.quotes
        .filter((quote) => quote.status === "ACCEPTED")
        .map((quote) => quote.amountIncTax.toString()),
      project.payments.map((payment) => ({
        amount: payment.amount.toString(),
        status: payment.status,
        dueAt: payment.dueAt,
      })),
    ),
    documents,
  };
}

export async function getTaskDashboard(limit = 5) {
  await requireAuthenticatedUser();
  const [openCount, preview] = await Promise.all([
    prisma.task.count({
      where: { status: { in: [...OPEN_TASK_STATUSES] } },
    }),
    prisma.task.findMany({
      where: { status: { in: [...OPEN_TASK_STATUSES] } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    openCount,
    preview: preview.map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt?.toISOString() ?? null,
      priority: task.priority,
      project: task.project,
    })),
  };
}
