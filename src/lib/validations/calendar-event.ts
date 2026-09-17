import { z } from "zod";
import { CALENDAR_EVENT_TYPES } from "@/lib/crm/constants";
import { emptyToNull, parseDate, parseDateTimeLocal } from "@/lib/crm/form-data";
import { endOfParisDay, startOfParisDay } from "@/lib/dates";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const optionalId = z.string().transform((value) => emptyToNull(value));

const calendarEventFields = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire"),
  type: z.enum(CALENDAR_EVENT_TYPES, { error: "Type invalide" }),
  allDay: z.boolean(),
  startsAt: z.string(),
  endsAt: z.string(),
  companyId: optionalId,
  projectId: optionalId,
});

function parseBounds(allDay: boolean, startsAt: string, endsAt: string) {
  const endValue = endsAt.trim() === "" ? startsAt : endsAt;
  const start = allDay ? parseDate(startsAt) : parseDateTimeLocal(startsAt);
  const end = allDay ? parseDate(endValue) : parseDateTimeLocal(endValue);

  if (!start || !end) {
    return { start, end };
  }

  if (allDay) {
    return { start: startOfParisDay(start), end: endOfParisDay(end) };
  }

  return { start, end };
}

export const createCalendarEventSchema = calendarEventFields
  .superRefine((value, ctx) => {
    const { start, end } = parseBounds(value.allDay, value.startsAt, value.endsAt);

    if (!start) {
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "La date de début est obligatoire",
      });
    }

    if (!end) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "La date de fin est obligatoire",
      });
    }

    if (start && end && end.getTime() < start.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "La fin doit être après le début",
      });
    }
  })
  .transform((value) => {
    const { start, end } = parseBounds(value.allDay, value.startsAt, value.endsAt);
    return {
      title: value.title,
      type: value.type,
      allDay: value.allDay,
      startsAt: start as Date,
      endsAt: end as Date,
      companyId: value.companyId,
      projectId: value.projectId,
    };
  });

export const updateCalendarEventSchema = calendarEventFields
  .extend({
    id: z.string().min(1, "Événement introuvable"),
  })
  .superRefine((value, ctx) => {
    const { start, end } = parseBounds(value.allDay, value.startsAt, value.endsAt);

    if (!start) {
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "La date de début est obligatoire",
      });
    }

    if (!end) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "La date de fin est obligatoire",
      });
    }

    if (start && end && end.getTime() < start.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "La fin doit être après le début",
      });
    }
  })
  .transform((value) => {
    const { start, end } = parseBounds(value.allDay, value.startsAt, value.endsAt);
    return {
      id: value.id,
      title: value.title,
      type: value.type,
      allDay: value.allDay,
      startsAt: start as Date,
      endsAt: end as Date,
      companyId: value.companyId,
      projectId: value.projectId,
    };
  });

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;

export { fieldErrorsFromZod };
