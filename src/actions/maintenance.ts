"use server";

import type { MaintenanceStatus } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString, startOfToday } from "@/lib/crm/form-data";
import { revalidateMaintenance } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import { canTransitionMaintenanceStatus, maintenanceTerminationDate } from "@/lib/maintenance/status";
import { normalizeMoney } from "@/lib/money";
import {
  createMaintenanceContractSchema,
  fieldErrorsFromZod,
  updateMaintenanceContractSchema,
  updateMaintenanceStatusSchema,
} from "@/lib/validations/maintenance";

async function resolveProject(
  companyId: string,
  projectId: string | null,
): Promise<{ projectId: string | null } | { error: string }> {
  if (!projectId) {
    return { projectId: null };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true },
  });

  if (!project) {
    return { error: "Projet introuvable." };
  }

  if (project.companyId !== companyId) {
    return { error: "Ce projet n'appartient pas à l'entreprise sélectionnée." };
  }

  return { projectId: project.id };
}

export async function createMaintenanceContract(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = createMaintenanceContractSchema.safeParse({
    companyId: readString(formData, "companyId"),
    projectId: readString(formData, "projectId"),
    monthlyAmount: readString(formData, "monthlyAmount"),
    startDate: readString(formData, "startDate"),
    endDate: readString(formData, "endDate"),
    description: readString(formData, "description"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });

    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    const project = await resolveProject(company.id, input.projectId);
    if ("error" in project) {
      return { ok: false, message: project.error };
    }

    const monthlyAmount = normalizeMoney(input.monthlyAmount);

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceContract.create({
        data: {
          companyId: company.id,
          projectId: project.projectId,
          monthlyAmount,
          status: "ACTIVE",
          startDate: input.startDate,
          endDate: input.endDate,
          description: input.description,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "MaintenanceContract",
          entityId: created.id,
          action: "maintenance.created",
          metadata: {
            companyId: company.id,
            projectId: project.projectId,
            monthlyAmount,
            status: "ACTIVE",
          },
        },
      });

      return created;
    });

    revalidateMaintenance(company.id, project.projectId);
    return {
      ok: true,
      data: {
        maintenanceContractId: contract.id,
        companyId: company.id,
        projectId: project.projectId ?? undefined,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de créer le contrat. Réessayez." };
  }
}

export async function updateMaintenanceContract(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateMaintenanceContractSchema.safeParse({
    id: readString(formData, "id"),
    companyId: readString(formData, "companyId"),
    projectId: readString(formData, "projectId"),
    monthlyAmount: readString(formData, "monthlyAmount"),
    startDate: readString(formData, "startDate"),
    endDate: readString(formData, "endDate"),
    description: readString(formData, "description"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.maintenanceContract.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      return { ok: false, message: "Contrat introuvable." };
    }

    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });

    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    const project = await resolveProject(company.id, input.projectId);
    if ("error" in project) {
      return { ok: false, message: project.error };
    }

    const monthlyAmount = normalizeMoney(input.monthlyAmount);

    await prisma.$transaction(async (tx) => {
      await tx.maintenanceContract.update({
        where: { id: existing.id },
        data: {
          companyId: company.id,
          projectId: project.projectId,
          monthlyAmount,
          startDate: input.startDate,
          endDate: input.endDate,
          description: input.description,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "MaintenanceContract",
          entityId: existing.id,
          action: "maintenance.updated",
          metadata: {
            companyId: company.id,
            projectId: project.projectId,
            monthlyAmount,
            previousAmount: existing.monthlyAmount.toString(),
          },
        },
      });
    });

    revalidateMaintenance(company.id, project.projectId ?? existing.projectId);
    if (existing.companyId !== company.id) {
      revalidateMaintenance(existing.companyId, existing.projectId);
    }

    return {
      ok: true,
      data: {
        maintenanceContractId: existing.id,
        companyId: company.id,
        projectId: project.projectId ?? undefined,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de mettre à jour le contrat. Réessayez." };
  }
}

export async function updateMaintenanceStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateMaintenanceStatusSchema.safeParse({
    contractId: readString(formData, "contractId"),
    status: readString(formData, "status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Transition de statut invalide.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.maintenanceContract.findUnique({
      where: { id: input.contractId },
    });

    if (!existing) {
      return { ok: false, message: "Contrat introuvable." };
    }

    if (existing.status === input.status) {
      return {
        ok: true,
        data: {
          maintenanceContractId: existing.id,
          companyId: existing.companyId,
          projectId: existing.projectId ?? undefined,
        },
      };
    }

    if (!canTransitionMaintenanceStatus(existing.status, input.status)) {
      return { ok: false, message: "Cette transition n'est pas autorisée." };
    }

    const nextStatus = input.status as MaintenanceStatus;
    const endDate =
      nextStatus === "ENDED"
        ? maintenanceTerminationDate(existing.endDate, startOfToday())
        : existing.endDate;

    await prisma.$transaction(async (tx) => {
      await tx.maintenanceContract.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          endDate,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "MaintenanceContract",
          entityId: existing.id,
          action: "maintenance.status_changed",
          metadata: {
            companyId: existing.companyId,
            fromStatus: existing.status,
            toStatus: nextStatus,
          },
        },
      });
    });

    revalidateMaintenance(existing.companyId, existing.projectId);
    return {
      ok: true,
      data: {
        maintenanceContractId: existing.id,
        companyId: existing.companyId,
        projectId: existing.projectId ?? undefined,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de changer le statut. Réessayez." };
  }
}
