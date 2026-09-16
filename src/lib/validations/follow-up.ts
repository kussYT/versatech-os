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

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
