import type { ActivitySource } from "@/lib/services/_shared/result";
import {
  TASK_PROJECT_COMPANY_MISMATCH_MESSAGE,
  type TaskWriteStatus,
} from "./schema";

export type TaskAnchor =
  | { kind: "none" }
  | { kind: "company"; companyId: string }
  | { kind: "project"; projectId: string; requestedCompanyId?: string };

export type ProjectTaskRow = {
  id: string;
  companyId: string;
  opportunityId: string | null;
};

export type ResolvedTaskLinks = {
  companyId: string;
  projectId: string | null;
  opportunityId: string | null;
};

export const ALLOWED_TASK_TRANSITIONS: Record<TaskWriteStatus, TaskWriteStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["DONE", "TODO", "CANCELED"],
  DONE: [],
  CANCELED: [],
};

function presentId(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Company-only vs project-scoped. Never invents a project. */
export function classifyTaskAnchor(
  projectId?: string | null,
  companyId?: string | null,
): TaskAnchor {
  const project = presentId(projectId);
  const company = presentId(companyId);
  if (project) {
    return company
      ? { kind: "project", projectId: project, requestedCompanyId: company }
      : { kind: "project", projectId: project };
  }
  if (company) {
    return { kind: "company", companyId: company };
  }
  return { kind: "none" };
}

export function companyScopedTaskLinks(companyId: string): ResolvedTaskLinks {
  return {
    companyId,
    projectId: null,
    opportunityId: null,
  };
}

export function projectScopedTaskLinks(
  project: ProjectTaskRow,
  requestedCompanyId?: string,
): { ok: true; links: ResolvedTaskLinks } | { ok: false; message: string } {
  if (requestedCompanyId && requestedCompanyId !== project.companyId) {
    return { ok: false, message: TASK_PROJECT_COMPANY_MISMATCH_MESSAGE };
  }
  return {
    ok: true,
    links: {
      companyId: project.companyId,
      projectId: project.id,
      opportunityId: project.opportunityId,
    },
  };
}

export function canTransitionTask(from: TaskWriteStatus, to: TaskWriteStatus): boolean {
  return ALLOWED_TASK_TRANSITIONS[from].includes(to);
}

export function completedAtForTaskStatus(
  status: TaskWriteStatus,
  existingCompletedAt: Date | null,
  now: Date,
): Date | null {
  return status === "DONE" ? now : existingCompletedAt;
}

export function taskCreatedMetadata(
  links: ResolvedTaskLinks,
  source?: ActivitySource,
): Record<string, string | number | boolean | null> {
  const metadata: Record<string, string | number | boolean | null> = {};
  if (links.projectId) {
    metadata.projectId = links.projectId;
  }
  if (links.companyId) {
    metadata.companyId = links.companyId;
  }
  if (source === "ai") {
    metadata.source = "ai";
  }
  return metadata;
}
