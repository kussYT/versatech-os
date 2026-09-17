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

function toListItem(
  followUp: Awaited<ReturnType<typeof loadFollowUps>>[number],
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

function loadFollowUps(status: FollowUpStatus, take?: number) {
  return prisma.followUp.findMany({
    where: { status },
    orderBy:
      status === "COMPLETED"
        ? [{ completedAt: "desc" }, { dueAt: "desc" }]
        : [{ dueAt: "asc" }, { createdAt: "asc" }],
    take,
    include: followUpInclude,
  });
}

function bucketForPending(dueAt: Date): Exclude<FollowUpBucket, "completed"> {
  return dueBucket(dueAt);
}

export async function listFollowUpBoard(): Promise<FollowUpBoard> {
  await requireAuthenticatedUser();
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
    board[bucketForPending(followUp.dueAt)].push(toListItem(followUp));
  }

  return board;
}

export async function getFollowUpDashboard(limit = 4) {
  await requireAuthenticatedUser();
  const board = await listFollowUpBoard();
  const dueCount = board.overdue.length + board.today.length;
  const preview = [...board.overdue, ...board.today, ...board.upcoming].slice(0, limit);

  return { dueCount, preview };
}
