import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type { FollowUpStatus, InteractionType } from "@/generated/prisma/client";
import { dueBucket } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "completed";

export type FollowUpListItem = {
  id: string;
  title: string;
  dueAt: string;
  status: FollowUpStatus;
  completedAt: string | null;
  company: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  phone: string | null;
  email: string | null;
  lastInteraction: {
    type: InteractionType;
    occurredAt: string;
  } | null;
};

export type FollowUpBoard = Record<FollowUpBucket, FollowUpListItem[]>;

const followUpInclude = {
  company: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      interactions: {
        orderBy: { occurredAt: "desc" as const },
        take: 1,
        select: { type: true, occurredAt: true },
      },
    },
  },
  contact: {
    select: {
      phone: true,
      email: true,
    },
  },
};

export type LoadFollowUpItemsInput = {
  status: FollowUpStatus;
  take?: number;
  companyId?: string;
  dueAt?: {
    lt?: Date;
    lte?: Date;
    gt?: Date;
    gte?: Date;
  };
};

function toListItem(
  followUp: Awaited<ReturnType<typeof loadFollowUpsQuery>>[number],
): FollowUpListItem {
  const lastInteraction = followUp.company.interactions[0] ?? null;

  return {
    id: followUp.id,
    title: followUp.title,
    dueAt: followUp.dueAt.toISOString(),
    status: followUp.status,
    completedAt: followUp.completedAt?.toISOString() ?? null,
    company: {
      id: followUp.company.id,
      name: followUp.company.name,
      phone: followUp.company.phone,
      email: followUp.company.email,
    },
    phone: followUp.contact?.phone ?? followUp.company.phone,
    email: followUp.contact?.email ?? followUp.company.email,
    lastInteraction: lastInteraction
      ? {
          type: lastInteraction.type,
          occurredAt: lastInteraction.occurredAt.toISOString(),
        }
      : null,
  };
}

function loadFollowUpsQuery(input: LoadFollowUpItemsInput) {
  return prisma.followUp.findMany({
    where: {
      status: input.status,
      ...(input.companyId ? { companyId: input.companyId } : {}),
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    },
    orderBy:
      input.status === "COMPLETED"
        ? [{ completedAt: "desc" }, { dueAt: "desc" }]
        : [{ dueAt: "asc" }, { createdAt: "asc" }],
    take: input.take,
    include: followUpInclude,
  });
}

function loadFollowUps(status: FollowUpStatus, take?: number) {
  return loadFollowUpsQuery({ status, take });
}

/** Caller must authenticate. SQL `take` — do not dump then slice. */
export async function loadFollowUpItems(
  input: LoadFollowUpItemsInput,
): Promise<FollowUpListItem[]> {
  const rows = await loadFollowUpsQuery(input);
  return rows.map(toListItem);
}

function bucketForPending(dueAt: Date, now: Date): Exclude<FollowUpBucket, "completed"> {
  return dueBucket(dueAt, now);
}

export type FollowUpDashboard = {
  dueCount: number;
  overdueCount: number;
  todayCount: number;
  preview: FollowUpListItem[];
};

/** Caller must authenticate. */
export async function loadFollowUpBoard(now = new Date()): Promise<FollowUpBoard> {
  const [pending, completed] = await Promise.all([
    loadFollowUps("PENDING"),
    loadFollowUps("COMPLETED", 40),
  ]);

  const board: FollowUpBoard = {
    overdue: [],
    today: [],
    upcoming: [],
    completed: completed.map(toListItem),
  };

  for (const followUp of pending) {
    board[bucketForPending(followUp.dueAt, now)].push(toListItem(followUp));
  }

  return board;
}

export async function listFollowUpBoard(): Promise<FollowUpBoard> {
  await requireAuthenticatedUser();
  return loadFollowUpBoard();
}

/** Caller must authenticate. Preview order: overdue → today → upcoming. */
export async function loadFollowUpDashboard(limit = 4, now = new Date()): Promise<FollowUpDashboard> {
  const board = await loadFollowUpBoard(now);
  const overdueCount = board.overdue.length;
  const todayCount = board.today.length;
  const preview = [...board.overdue, ...board.today, ...board.upcoming].slice(0, limit);

  return {
    dueCount: overdueCount + todayCount,
    overdueCount,
    todayCount,
    preview,
  };
}

export async function getFollowUpDashboard(limit = 4) {
  await requireAuthenticatedUser();
  const dashboard = await loadFollowUpDashboard(limit);
  return { dueCount: dashboard.dueCount, preview: dashboard.preview };
}
