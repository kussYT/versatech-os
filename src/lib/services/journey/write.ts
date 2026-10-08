import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import {
  alignJourneyContext,
  journeyContextKey,
  type DeclaredJourneyStep,
  type JourneyAnchor,
} from "@/lib/crm/journey-cursor";
import { serviceFail, serviceOk, type ServiceResult } from "@/lib/services/_shared/result";

export type JourneyCursorRow = {
  id: string;
  step: DeclaredJourneyStep;
  contextKey: string;
  opportunityId?: string | null;
  projectId?: string | null;
};

type ActivityMetadata = Record<string, string | number | boolean | null>;

export type JourneyWriteTx = {
  journeyCursor: {
    findUnique: (args: { where: { contextKey: string } }) => Promise<JourneyCursorRow | null>;
    create: (args: {
      data: {
        companyId: string;
        opportunityId: string | null;
        projectId: string | null;
        contextKey: string;
        step: DeclaredJourneyStep;
        setById: string;
      };
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: {
        step: DeclaredJourneyStep;
        setById: string;
        projectId?: string | null;
        opportunityId?: string | null;
        contextKey?: string;
      };
    }) => Promise<{ id: string }>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  journeyCursorEvent: {
    create: (args: {
      data: {
        cursorId: string | null;
        companyId: string;
        opportunityId: string | null;
        projectId: string | null;
        contextKey: string;
        fromStep: DeclaredJourneyStep | null;
        toStep: DeclaredJourneyStep | null;
        action: "set" | "reset" | "adopt";
        changedById: string;
      };
    }) => Promise<unknown>;
  };
  activityLog: {
    create: (args: {
      data: {
        actorId: string;
        entityType: "Company";
        entityId: string;
        action: "journey.step_set" | "journey.step_reset" | "journey.step_adopt";
        metadata: ActivityMetadata;
      };
    }) => Promise<unknown>;
  };
};

export type JourneyWriteDb = {
  company: {
    findUnique: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  };
  opportunity: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; companyId: true };
    }) => Promise<{ id: string; companyId: string } | null>;
  };
  project: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; companyId: true; opportunityId: true };
    }) => Promise<{ id: string; companyId: string; opportunityId: string | null } | null>;
  };
  $transaction: <T>(fn: (tx: JourneyWriteTx) => Promise<T>) => Promise<T>;
};

export type SetDeclaredJourneyStepInput = {
  actor: SessionUser;
  companyId: string;
  opportunityId: string | null;
  projectId: string | null;
  step: DeclaredJourneyStep;
};

async function loadAnchor(db: JourneyWriteDb, input: {
  opportunityId: string | null;
  projectId: string | null;
}): Promise<JourneyAnchor> {
  const project = input.projectId
    ? await db.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, companyId: true, opportunityId: true },
      })
    : null;
  const opportunityId = input.opportunityId ?? project?.opportunityId ?? null;
  const opportunity = opportunityId
    ? await db.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, companyId: true },
      })
    : null;
  return { project, opportunity };
}

async function resolveContext(
  db: JourneyWriteDb,
  input: { companyId: string; opportunityId: string | null; projectId: string | null },
) {
  const company = await db.company.findUnique({ where: { id: input.companyId }, select: { id: true } });
  if (!company) {
    return serviceFail("NOT_FOUND", "Entreprise introuvable.");
  }
  const anchor = await loadAnchor(db, input);
  const aligned = alignJourneyContext({ ...input, anchor });
  if (!aligned.ok) {
    return serviceFail("VALIDATION", aligned.message);
  }
  return serviceOk(aligned.context);
}

export function isMissingJourneySchema(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return error.code === "P2021" || error.code === "P2022";
}

/**
 * Un projet lié reprend le curseur de son opportunité : même étape, même ligne,
 * nouvelle clé. Les événements déjà écrits restent.
 */
export async function adoptDeclaredJourneyForProject(
  tx: JourneyWriteTx,
  input: {
    actorId: string;
    companyId: string;
    opportunityId: string;
    projectId: string;
  },
): Promise<boolean> {
  const projectKey = journeyContextKey({
    companyId: input.companyId,
    opportunityId: input.opportunityId,
    projectId: input.projectId,
  });
  const opportunityKey = journeyContextKey({
    companyId: input.companyId,
    opportunityId: input.opportunityId,
    projectId: null,
  });
  const existingProject = await tx.journeyCursor.findUnique({ where: { contextKey: projectKey } });
  if (existingProject) {
    return false;
  }
  const current = await tx.journeyCursor.findUnique({ where: { contextKey: opportunityKey } });
  if (!current) {
    return false;
  }
  await tx.journeyCursor.update({
    where: { id: current.id },
    data: {
      step: current.step,
      setById: input.actorId,
      projectId: input.projectId,
      opportunityId: input.opportunityId,
      contextKey: projectKey,
    },
  });
  await tx.journeyCursorEvent.create({
    data: {
      cursorId: current.id,
      companyId: input.companyId,
      opportunityId: input.opportunityId,
      projectId: input.projectId,
      contextKey: projectKey,
      fromStep: current.step,
      toStep: current.step,
      action: "adopt",
      changedById: input.actorId,
    },
  });
  await tx.activityLog.create({
    data: {
      actorId: input.actorId,
      entityType: "Company",
      entityId: input.companyId,
      action: "journey.step_adopt",
      metadata: {
        contextKey: projectKey,
        fromContextKey: opportunityKey,
        opportunityId: input.opportunityId,
        projectId: input.projectId,
        fromStep: current.step,
        toStep: current.step,
      },
    },
  });
  return true;
}

export async function setDeclaredJourneyStep(
  input: SetDeclaredJourneyStepInput,
  db: JourneyWriteDb,
): Promise<ServiceResult<{ companyId: string; contextKey: string }>> {
  const resolved = await resolveContext(db, input);
  if (!resolved.ok) {
    return resolved;
  }
  const context = resolved.data;

  await db.$transaction(async (tx) => {
    if (context.projectId && context.opportunityId) {
      await adoptDeclaredJourneyForProject(tx, {
        actorId: input.actor.id,
        companyId: context.companyId,
        opportunityId: context.opportunityId,
        projectId: context.projectId,
      });
    }
    const current = await tx.journeyCursor.findUnique({ where: { contextKey: context.contextKey } });
    const fromStep = current?.step ?? null;
    const saved = current
      ? await tx.journeyCursor.update({
          where: { id: current.id },
          data: { step: input.step, setById: input.actor.id },
        })
      : await tx.journeyCursor.create({
          data: {
            companyId: context.companyId,
            opportunityId: context.opportunityId,
            projectId: context.projectId,
            contextKey: context.contextKey,
            step: input.step,
            setById: input.actor.id,
          },
        });
    await tx.journeyCursorEvent.create({
      data: {
        cursorId: saved.id,
        companyId: context.companyId,
        opportunityId: context.opportunityId,
        projectId: context.projectId,
        contextKey: context.contextKey,
        fromStep,
        toStep: input.step,
        action: "set",
        changedById: input.actor.id,
      },
    });
    await tx.activityLog.create({
      data: {
        actorId: input.actor.id,
        entityType: "Company",
        entityId: context.companyId,
        action: "journey.step_set",
        metadata: {
          contextKey: context.contextKey,
          opportunityId: context.opportunityId,
          projectId: context.projectId,
          fromStep,
          toStep: input.step,
        },
      },
    });
  });

  return serviceOk({ companyId: context.companyId, contextKey: context.contextKey });
}

export async function resetDeclaredJourneyStep(
  input: Omit<SetDeclaredJourneyStepInput, "step">,
  db: JourneyWriteDb,
): Promise<ServiceResult<{ companyId: string; contextKey: string }>> {
  const resolved = await resolveContext(db, input);
  if (!resolved.ok) {
    return resolved;
  }
  const context = resolved.data;
  const missing = await db.$transaction(async (tx) => {
    if (context.projectId && context.opportunityId) {
      await adoptDeclaredJourneyForProject(tx, {
        actorId: input.actor.id,
        companyId: context.companyId,
        opportunityId: context.opportunityId,
        projectId: context.projectId,
      });
    }
    const current = await tx.journeyCursor.findUnique({ where: { contextKey: context.contextKey } });
    if (!current) {
      return true;
    }
    await tx.journeyCursorEvent.create({
      data: {
        cursorId: current.id,
        companyId: context.companyId,
        opportunityId: context.opportunityId,
        projectId: context.projectId,
        contextKey: context.contextKey,
        fromStep: current.step,
        toStep: null,
        action: "reset",
        changedById: input.actor.id,
      },
    });
    await tx.journeyCursor.delete({ where: { id: current.id } });
    await tx.activityLog.create({
      data: {
        actorId: input.actor.id,
        entityType: "Company",
        entityId: context.companyId,
        action: "journey.step_reset",
        metadata: {
          contextKey: context.contextKey,
          opportunityId: context.opportunityId,
          projectId: context.projectId,
          fromStep: current.step,
          toStep: null,
        },
      },
    });
    return false;
  });
  if (missing) {
    return serviceFail("NOT_FOUND", "Cette prestation suit déjà les faits.");
  }

  return serviceOk({ companyId: context.companyId, contextKey: context.contextKey });
}

export const JourneyService = {
  async setDeclaredJourneyStep(input: SetDeclaredJourneyStepInput) {
    const { prisma } = await import("@/lib/db/prisma");
    return setDeclaredJourneyStep(input, prisma);
  },
  async resetDeclaredJourneyStep(input: Omit<SetDeclaredJourneyStepInput, "step">) {
    const { prisma } = await import("@/lib/db/prisma");
    return resetDeclaredJourneyStep(input, prisma);
  },
};
