"use server";

import { logServerError } from "@/lib/observability/log-error";

import { recordTerrainVisit } from "@/actions/visit";
import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  addCompanyToStops,
  moveStop,
  removeCompanyFromStops,
  tourDateFor,
} from "@/lib/prospection/tour";

function revalidateTour(companyId?: string) {
  revalidateCrm(companyId);
}

export async function ensureTodayTour(): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const date = tourDateFor();

  try {
    const tour = await prisma.tour.upsert({
      where: { date },
      update: {},
      create: { date, createdById: actor.id },
    });

    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        entityType: "Tour",
        entityId: tour.id,
        action: "tour.ensured",
        metadata: { date: date.toISOString() },
      },
    });

    revalidateTour();
    return { ok: true, data: { tourId: tour.id } };
  } catch (error) {
    logServerError("tours", error);
    return { ok: false, message: "Impossible de créer la tournée du jour." };
  }
}

export async function addCompanyToTodayTour(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const companyId = readString(formData, "companyId");
  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    const date = tourDateFor();
    const result = await prisma.$transaction(async (tx) => {
      const tour = await tx.tour.upsert({
        where: { date },
        update: {},
        create: { date, createdById: actor.id },
      });
      const existing = await tx.tourStop.findMany({
        where: { tourId: tour.id },
        orderBy: { order: "asc" },
      });
      const next = addCompanyToStops(
        existing.map((stop) => ({
          companyId: stop.companyId,
          order: stop.order,
          visitedAt: stop.visitedAt,
        })),
        companyId,
      );
      const added = next.find((stop) => stop.companyId === companyId);
      if (!existing.some((stop) => stop.companyId === companyId) && added) {
        await tx.tourStop.create({
          data: {
            tourId: tour.id,
            companyId,
            order: added.order,
          },
        });
        await tx.activityLog.create({
          data: {
            actorId: actor.id,
            entityType: "Tour",
            entityId: tour.id,
            action: "tour.stop_added",
            metadata: { companyId },
          },
        });
      }
      return tour;
    });

    revalidateTour(companyId);
    return { ok: true, data: { companyId, name: result.id } };
  } catch (error) {
    logServerError("tours", error);
    return { ok: false, message: "Impossible d'ajouter cette entreprise." };
  }
}

export async function removeCompanyFromTodayTour(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const companyId = readString(formData, "companyId");
  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  try {
    const date = tourDateFor();
    await prisma.$transaction(async (tx) => {
      const tour = await tx.tour.findUnique({
        where: { date },
        include: { stops: { orderBy: { order: "asc" } } },
      });
      if (!tour) {
        return;
      }
      await tx.tourStop.deleteMany({ where: { tourId: tour.id, companyId } });
      const remaining = removeCompanyFromStops(
        tour.stops.map((stop) => ({
          companyId: stop.companyId,
          order: stop.order,
          visitedAt: stop.visitedAt,
        })),
        companyId,
      );
      for (const stop of remaining) {
        await tx.tourStop.update({
          where: { tourId_companyId: { tourId: tour.id, companyId: stop.companyId } },
          data: { order: stop.order },
        });
      }
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Tour",
          entityId: tour.id,
          action: "tour.stop_removed",
          metadata: { companyId },
        },
      });
    });
    revalidateTour(companyId);
    return { ok: true, data: { companyId } };
  } catch (error) {
    logServerError("tours", error);
    return { ok: false, message: "Impossible de retirer cette entreprise." };
  }
}

export async function moveTourStop(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const companyId = readString(formData, "companyId");
  const direction = readString(formData, "direction") === "up" ? -1 : 1;
  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  try {
    const date = tourDateFor();
    await prisma.$transaction(async (tx) => {
      const tour = await tx.tour.findUnique({
        where: { date },
        include: { stops: { orderBy: { order: "asc" } } },
      });
      if (!tour) {
        return;
      }
      const next = moveStop(
        tour.stops.map((stop) => ({
          companyId: stop.companyId,
          order: stop.order,
          visitedAt: stop.visitedAt,
        })),
        companyId,
        direction,
      );
      for (const stop of next) {
        await tx.tourStop.update({
          where: { tourId_companyId: { tourId: tour.id, companyId: stop.companyId } },
          data: { order: stop.order },
        });
      }
    });
    revalidateTour(companyId);
    return { ok: true, data: { companyId } };
  } catch (error) {
    logServerError("tours", error);
    return { ok: false, message: "Impossible de réordonner la tournée." };
  }
}

export async function markTourStopVisited(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const companyId = readString(formData, "companyId");
  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  const interaction = await recordTerrainVisit(companyId);
  if (!interaction.ok) {
    return interaction;
  }

  try {
    const date = tourDateFor();
    const tour = await prisma.tour.findUnique({ where: { date } });
    if (tour) {
      await prisma.tourStop.updateMany({
        where: { tourId: tour.id, companyId },
        data: { visitedAt: new Date() },
      });
      await prisma.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Tour",
          entityId: tour.id,
          action: "tour.stop_visited",
          metadata: { companyId, interactionId: interaction.data?.interactionId },
        },
      });
    }
    revalidateTour(companyId);
    return interaction;
  } catch (error) {
    logServerError("tours", error);
    return { ok: false, message: "Visite enregistrée mais la tournée n'a pas pu être mise à jour." };
  }
}

export async function addCompanyToTodayTourForm(formData: FormData) {
  await addCompanyToTodayTour({ ok: false }, formData);
}

export async function removeCompanyFromTodayTourForm(formData: FormData) {
  await removeCompanyFromTodayTour({ ok: false }, formData);
}

export async function moveTourStopForm(formData: FormData) {
  await moveTourStop({ ok: false }, formData);
}

export async function markTourStopVisitedForm(formData: FormData) {
  await markTourStopVisited({ ok: false }, formData);
}

export async function ensureTodayTourForm(formData?: FormData) {
  void formData;
  await ensureTodayTour();
}
