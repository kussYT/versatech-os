import { z } from "zod";
import { emptyToNull, parseDateTimeLocal } from "@/lib/crm/form-data";

export const createFollowUpSchema = z.object({
  companyId: z.string().min(1, "Entreprise introuvable"),
  dueAt: z
    .string()
    .transform((value) => parseDateTimeLocal(value))
    .pipe(z.date("La date de relance est obligatoire")),
  note: z
    .string()
    .transform((value) => emptyToNull(value)),
});

export const completeFollowUpSchema = z.object({
  followUpId: z.string().min(1, "Relance introuvable"),
});

export const rescheduleFollowUpSchema = z.object({
  followUpId: z.string().min(1, "Relance introuvable"),
  dueAt: z
    .string()
    .transform((value) => parseDateTimeLocal(value))
    .pipe(z.date("La nouvelle date est obligatoire")),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;
export type RescheduleFollowUpInput = z.infer<typeof rescheduleFollowUpSchema>;
