"use server";

import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateGithub } from "@/lib/crm/revalidate";
import { fetchGitHubRepository, isGitHubConfigured } from "@/lib/integrations/github";
import { prisma } from "@/lib/db/prisma";
import {
  associateRepositorySchema,
  fieldErrorsFromZod,
  parseGitHubRepositoryRef,
  unlinkRepositorySchema,
} from "@/lib/validations/repository";

export async function associateGitHubRepository(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = associateRepositorySchema.safeParse({
    projectId: readString(formData, "projectId"),
    repository: readString(formData, "repository"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const ref = parseGitHubRepositoryRef(parsed.data.repository);
  if (!ref) {
    return {
      ok: false,
      message: "Indiquez un dépôt au format owner/nom ou une URL github.com.",
      fieldErrors: {
        repository: ["Format attendu : owner/nom ou https://github.com/owner/nom"],
      },
    };
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { id: true, companyId: true, name: true },
    });

    if (!project) {
      return { ok: false, message: "Projet introuvable." };
    }

    const existing = await prisma.repository.findFirst({
      where: {
        provider: "github",
        owner: { equals: ref.owner, mode: "insensitive" },
        name: { equals: ref.name, mode: "insensitive" },
      },
      include: { project: { select: { id: true, name: true } } },
    });

    if (existing) {
      if (existing.projectId === project.id) {
        return { ok: false, message: "Ce repository est déjà associé à ce projet." };
      }

      return {
        ok: false,
        message: `Ce repository est déjà associé au projet « ${existing.project.name} ».`,
      };
    }

    const live = isGitHubConfigured() ? await fetchGitHubRepository(ref.owner, ref.name) : null;

    if (live && !live.ok) {
      return { ok: false, message: live.error.message };
    }

    const owner = live?.data.owner ?? ref.owner;
    const name = live?.data.name ?? ref.name;
    const url = live?.data.url ?? `https://github.com/${owner}/${name}`;
    const defaultBranch = live?.data.defaultBranch ?? "main";

    const repository = await prisma.$transaction(async (tx) => {
      const created = await tx.repository.create({
        data: {
          projectId: project.id,
          provider: "github",
          owner,
          name,
          url,
          defaultBranch,
          externalId: live?.data.externalId ?? null,
          lastSyncedAt: live ? new Date() : null,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Project",
          entityId: project.id,
          action: "repository.linked",
          metadata: {
            repositoryId: created.id,
            owner,
            name,
            url,
          },
        },
      });

      return created;
    });

    revalidateGithub(project.companyId, project.id);
    return {
      ok: true,
      data: {
        repositoryId: repository.id,
        projectId: project.id,
        companyId: project.companyId,
      },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "Ce repository est déjà associé à un projet." };
    }

    console.error(error);
    return { ok: false, message: "Impossible d'associer le repository. Réessayez." };
  }
}

export async function unlinkGitHubRepository(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = unlinkRepositorySchema.safeParse({
    repositoryId: readString(formData, "repositoryId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Repository introuvable.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const existing = await prisma.repository.findUnique({
      where: { id: parsed.data.repositoryId },
      include: { project: { select: { id: true, companyId: true } } },
    });

    if (!existing) {
      return { ok: false, message: "Repository introuvable." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.repository.delete({ where: { id: existing.id } });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Project",
          entityId: existing.project.id,
          action: "repository.unlinked",
          metadata: {
            repositoryId: existing.id,
            owner: existing.owner,
            name: existing.name,
            url: existing.url,
          },
        },
      });
    });

    revalidateGithub(existing.project.companyId, existing.project.id);
    return {
      ok: true,
      data: {
        repositoryId: existing.id,
        projectId: existing.project.id,
        companyId: existing.project.companyId,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de retirer le repository. Réessayez." };
  }
}
