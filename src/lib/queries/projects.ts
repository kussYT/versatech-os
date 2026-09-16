import "server-only";

import type {
  MilestoneStatus,
  Priority,
  ProjectStatus,
  TaskStatus,
} from "@/generated/prisma/client";
import { OPEN_TASK_STATUSES, projectProgress } from "@/lib/crm/constants";
import { endOfToday, startOfToday } from "@/lib/crm/form-data";
import { prisma } from "@/lib/db/prisma";

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
};

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

export type AgendaItem = {
  id: string;
  title: string;
  at: string;
  href: string;
};

export async function listProjects(): Promise<ProjectListItem[]> {
  const projects = await prisma.project.findMany({
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
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
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] },
      milestones: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] },
    },
  });

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
  };
}

export async function getTaskDashboard(limit = 5) {
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

export async function getTodayDeadlines(): Promise<AgendaItem[]> {
  const start = startOfToday();
  const end = endOfToday();
  const range = { gte: start, lte: end };

  const [tasks, milestones, projects] = await Promise.all([
    prisma.task.findMany({
      where: { status: { in: [...OPEN_TASK_STATUSES] }, dueAt: range },
      select: {
        id: true,
        title: true,
        dueAt: true,
        projectId: true,
      },
    }),
    prisma.milestone.findMany({
      where: { status: "PENDING", dueAt: range },
      select: { id: true, name: true, dueAt: true, projectId: true },
    }),
    prisma.project.findMany({
      where: {
        status: { notIn: ["COMPLETED", "ARCHIVED"] },
        dueDate: range,
      },
      select: { id: true, name: true, dueDate: true },
    }),
  ]);

  return [
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      at: task.dueAt?.toISOString() ?? start.toISOString(),
      href: task.projectId ? `/projets/${task.projectId}` : "/projets",
    })),
    ...milestones.map((milestone) => ({
      id: `milestone-${milestone.id}`,
      title: milestone.name,
      at: milestone.dueAt?.toISOString() ?? start.toISOString(),
      href: `/projets/${milestone.projectId}`,
    })),
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      at: project.dueDate?.toISOString() ?? start.toISOString(),
      href: `/projets/${project.id}`,
    })),
  ].sort((left, right) => left.at.localeCompare(right.at));
}
