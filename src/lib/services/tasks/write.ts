import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import {
  fieldErrorsFromZod,
  serviceFail,
  serviceOk,
  withActivitySource,
  type ActivitySource,
  type ServiceResult,
} from "@/lib/services/_shared/result";
import {
  canTransitionTask,
  classifyTaskAnchor,
  companyScopedTaskLinks,
  completedAtForTaskStatus,
  emptyToNull,
  projectScopedTaskLinks,
  taskCreatedMetadata,
  type ProjectTaskRow,
  type ResolvedTaskLinks,
} from "./write-rules";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  PROJECT_NOT_FOUND_MESSAGE,
  TASK_CREATE_VALIDATION_MESSAGE,
  TASK_NOT_FOUND_MESSAGE,
  TASK_STATUS_VALIDATION_MESSAGE,
  TASK_TRANSITION_NOT_ALLOWED_MESSAGE,
  createTaskInputSchema,
  updateTaskStatusInputSchema,
  type Priority,
  type TaskWriteStatus,
} from "./schema";

export type CreateTaskInput = {
  actor: SessionUser;
  title: string;
  priority?: Priority;
  dueAt?: Date | null;
  description?: string | null;
  projectId?: string | null;
  companyId?: string | null;
  source?: ActivitySource;
};

export type UpdateTaskStatusInput = {
  actor: SessionUser;
  taskId: string;
  status: TaskWriteStatus;
  source?: ActivitySource;
};

export type TaskWriteResult = {
  taskId: string;
  projectId?: string;
  companyId?: string;
};

type TaskRow = {
  id: string;
  status: TaskWriteStatus;
  completedAt: Date | null;
  projectId: string | null;
  companyId: string | null;
};

export type TaskWriteTx = {
  task: {
    create: (args: {
      data: {
        title: string;
        description: string | null;
        status: "TODO";
        priority: Priority;
        dueAt: Date | null;
        companyId: string | null;
        opportunityId: string | null;
        projectId: string | null;
        assignedToId: string;
      };
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: { status: TaskWriteStatus; completedAt: Date | null };
    }) => Promise<unknown>;
  };
  activityLog: {
    create: (args: {
      data: {
        actorId: string;
        entityType: "Task";
        entityId: string;
        action: string;
        metadata: Record<string, string | number | boolean | null>;
      };
    }) => Promise<unknown>;
  };
};

export type TaskWriteStore = {
  project: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; companyId: true; opportunityId: true };
    }) => Promise<ProjectTaskRow | null>;
  };
  company: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  task: {
    findUnique: (args: { where: { id: string } }) => Promise<TaskRow | null>;
  };
  $transaction: <T>(fn: (tx: TaskWriteTx) => Promise<T>) => Promise<T>;
};

export type TaskWriteDeps = {
  store?: TaskWriteStore;
  now?: Date;
  /**
   * Shared `Prisma.TransactionClient` (AI confirm). When set, reads, mutation
   * and ActivityLog use this client — no nested `$transaction`.
   * UI Server Actions omit `tx`; the service opens its own transaction as today.
   */
  tx?: Prisma.TransactionClient;
};

async function resolveStore(store?: TaskWriteStore): Promise<TaskWriteStore> {
  if (store) {
    return store;
  }
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as TaskWriteStore;
}

type TaskWriteClients = {
  read: Pick<TaskWriteStore, "project" | "company" | "task">;
  runWrite: <T>(fn: (tx: TaskWriteTx) => Promise<T>) => Promise<T>;
};

async function resolveWriteClients(deps: TaskWriteDeps): Promise<TaskWriteClients> {
  if (deps.tx) {
    const shared = deps.tx as unknown as TaskWriteStore & TaskWriteTx;
    return {
      read: shared,
      runWrite: (fn) => fn(shared),
    };
  }
  const db = await resolveStore(deps.store);
  return {
    read: db,
    runWrite: (fn) => db.$transaction(fn),
  };
}

function requireActorId(actor: SessionUser | null | undefined): ServiceResult<never> | null {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }
  return null;
}

function toWriteResult(taskId: string, links: Pick<ResolvedTaskLinks, "companyId" | "projectId">): TaskWriteResult {
  return {
    taskId,
    ...(links.projectId ? { projectId: links.projectId } : {}),
    ...(links.companyId ? { companyId: links.companyId } : {}),
  };
}

async function resolveCreateLinks(
  db: Pick<TaskWriteStore, "project" | "company">,
  projectId?: string | null,
  companyId?: string | null,
): Promise<ServiceResult<ResolvedTaskLinks>> {
  const anchor = classifyTaskAnchor(projectId, companyId);

  if (anchor.kind === "none") {
    return serviceFail("VALIDATION", TASK_CREATE_VALIDATION_MESSAGE);
  }

  if (anchor.kind === "company") {
    const company = await db.company.findUnique({
      where: { id: anchor.companyId },
      select: { id: true },
    });
    if (!company) {
      return serviceFail("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }
    return serviceOk(companyScopedTaskLinks(company.id));
  }

  const project = await db.project.findUnique({
    where: { id: anchor.projectId },
    select: { id: true, companyId: true, opportunityId: true },
  });
  if (!project) {
    return serviceFail("NOT_FOUND", PROJECT_NOT_FOUND_MESSAGE);
  }

  const scoped = projectScopedTaskLinks(project, anchor.requestedCompanyId);
  if (!scoped.ok) {
    return serviceFail("CONFLICT", scoped.message);
  }
  return serviceOk(scoped.links);
}

/**
 * Crée une tâche TODO.
 * Projet : company / opportunity copiés depuis le projet (comportement UI actuel).
 * Entreprise seule : `Task.companyId` sans `projectId` — pas de projet fantôme.
 */
export async function createTask(
  input: CreateTaskInput,
  deps: TaskWriteDeps = {},
): Promise<ServiceResult<TaskWriteResult>> {
  const authError = requireActorId(input.actor);
  if (authError) {
    return authError;
  }

  const parsed = createTaskInputSchema.safeParse({
    title: input.title,
    priority: input.priority,
    dueAt: input.dueAt,
    description: input.description,
    projectId: input.projectId,
    companyId: input.companyId,
  });
  if (!parsed.success) {
    return serviceFail(
      "VALIDATION",
      TASK_CREATE_VALIDATION_MESSAGE,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const { read, runWrite } = await resolveWriteClients(deps);
  const linksResult = await resolveCreateLinks(read, parsed.data.projectId, parsed.data.companyId);
  if (!linksResult.ok) {
    return linksResult;
  }
  const links = linksResult.data;

  const task = await runWrite(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: parsed.data.title,
        description: emptyToNull(parsed.data.description),
        status: "TODO",
        priority: parsed.data.priority,
        dueAt: parsed.data.dueAt ?? null,
        companyId: links.companyId,
        opportunityId: links.opportunityId,
        projectId: links.projectId,
        assignedToId: input.actor.id,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: input.actor.id,
        entityType: "Task",
        entityId: created.id,
        action: "task.created",
        metadata: taskCreatedMetadata(links, input.source),
      },
    });

    return created;
  });

  return serviceOk(toWriteResult(task.id, links));
}

/**
 * Transitions TODO → IN_PROGRESS | CANCELED ; IN_PROGRESS → DONE | TODO | CANCELED.
 * DONE pose `completedAt`. Même statut = no-op.
 */
export async function updateTaskStatus(
  input: UpdateTaskStatusInput,
  deps: TaskWriteDeps = {},
): Promise<ServiceResult<TaskWriteResult>> {
  const authError = requireActorId(input.actor);
  if (authError) {
    return authError;
  }

  const parsed = updateTaskStatusInputSchema.safeParse({
    taskId: input.taskId,
    status: input.status,
  });
  if (!parsed.success) {
    return serviceFail(
      "VALIDATION",
      TASK_STATUS_VALIDATION_MESSAGE,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const { read, runWrite } = await resolveWriteClients(deps);
  const existing = await read.task.findUnique({
    where: { id: parsed.data.taskId },
  });
  if (!existing) {
    return serviceFail("NOT_FOUND", TASK_NOT_FOUND_MESSAGE);
  }

  const resultPayload = toWriteResult(existing.id, {
    companyId: existing.companyId ?? "",
    projectId: existing.projectId,
  });

  if (existing.status === parsed.data.status) {
    return serviceOk(resultPayload);
  }

  if (!canTransitionTask(existing.status, parsed.data.status)) {
    return serviceFail("CONFLICT", TASK_TRANSITION_NOT_ALLOWED_MESSAGE);
  }

  const now = deps.now ?? new Date();
  const completedAt = completedAtForTaskStatus(parsed.data.status, existing.completedAt, now);

  await runWrite(async (tx) => {
    await tx.task.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        completedAt,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: input.actor.id,
        entityType: "Task",
        entityId: existing.id,
        action: "task.status_changed",
        metadata: withActivitySource(
          {
            projectId: existing.projectId,
            fromStatus: existing.status,
            toStatus: parsed.data.status,
          },
          input.source,
        ),
      },
    });
  });

  return serviceOk(resultPayload);
}
