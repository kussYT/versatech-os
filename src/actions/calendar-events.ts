"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCalendar } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createCalendarEventSchema,
  fieldErrorsFromZod,
  updateCalendarEventSchema,
} from "@/lib/validations/calendar-event";

function readAllDay(formData: FormData) {
  return readString(formData, "allDay") === "on";
}

async function resolveLinks(companyId: string | null, projectId: string | null) {
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } })
    : null;

  if (companyId && !company) {
    return { error: "Entreprise introuvable." as const };
  }

  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, companyId: true },
      })
    : null;

  if (projectId && !project) {
    return { error: "Projet introuvable." as const };
  }

  if (company && project && project.companyId !== company.id) {
    return { error: "Ce projet n'appartient pas à l'entreprise sélectionnée." as const };
  }

  return {
    companyId: company?.id ?? project?.companyId ?? null,
    projectId: project?.id ?? null,
  };
}

export async function createCalendarEvent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = createCalendarEventSchema.safeParse({
    title: readString(formData, "title"),
    type: readString(formData, "type"),
    allDay: readAllDay(formData),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    companyId: readString(formData, "companyId"),
    projectId: readString(formData, "projectId"),
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
    const links = await resolveLinks(input.companyId, input.projectId);
    if ("error" in links) {
      return { ok: false, message: links.error };
    }

    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.calendarEvent.create({
        data: {
          title: input.title,
          type: input.type,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          allDay: input.allDay,
          companyId: links.companyId,
          projectId: links.projectId,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "CalendarEvent",
          entityId: event.id,
          action: "calendar.created",
          metadata: {
            type: input.type,
            ...(links.companyId ? { companyId: links.companyId } : {}),
            ...(links.projectId ? { projectId: links.projectId } : {}),
          },
        },
      });

      return event;
    });

    revalidateCalendar(links.companyId ?? undefined, links.projectId ?? undefined);
    return {
      ok: true,
      data: {
        calendarEventId: created.id,
        companyId: links.companyId ?? undefined,
        projectId: links.projectId ?? undefined,
      },
    };
  } catch (error) {
    logServerError("calendar-events", error);
    return { ok: false, message: "Impossible de créer l'événement. Réessayez." };
  }
}

export async function updateCalendarEvent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateCalendarEventSchema.safeParse({
    id: readString(formData, "id"),
    title: readString(formData, "title"),
    type: readString(formData, "type"),
    allDay: readAllDay(formData),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    companyId: readString(formData, "companyId"),
    projectId: readString(formData, "projectId"),
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
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      return { ok: false, message: "Événement introuvable." };
    }

    const links = await resolveLinks(input.companyId, input.projectId);
    if ("error" in links) {
      return { ok: false, message: links.error };
    }

    await prisma.$transaction(async (tx) => {
      await tx.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          type: input.type,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          allDay: input.allDay,
          companyId: links.companyId,
          projectId: links.projectId,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "CalendarEvent",
          entityId: existing.id,
          action: "calendar.updated",
          metadata: {
            type: input.type,
            ...(links.companyId ? { companyId: links.companyId } : {}),
            ...(links.projectId ? { projectId: links.projectId } : {}),
          },
        },
      });
    });

    revalidateCalendar(links.companyId ?? undefined, links.projectId ?? undefined);
    return {
      ok: true,
      data: {
        calendarEventId: existing.id,
        companyId: links.companyId ?? undefined,
        projectId: links.projectId ?? undefined,
      },
    };
  } catch (error) {
    logServerError("calendar-events", error);
    return { ok: false, message: "Impossible de modifier l'événement. Réessayez." };
  }
}
