import { z } from "zod";
import { MILESTONE_STATUSES } from "@/lib/crm/constants";
import { parseDate } from "@/lib/crm/form-data";
import { fieldErrorsFromZod } from "@/lib/validations/company";

export const createMilestoneSchema = z.object({
  projectId: z.string().min(1, "Projet introuvable"),
  name: z.string().trim().min(1, "Le titre est obligatoire"),
  dueAt: z
    .string()
    .transform((value) => parseDate(value))
    .pipe(z.date().nullable()),
});

export const updateMilestoneStatusSchema = z.object({
  milestoneId: z.string().min(1, "Jalon introuvable"),
  status: z.enum(MILESTONE_STATUSES, { error: "Statut invalide" }),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneStatusInput = z.infer<typeof updateMilestoneStatusSchema>;

export { fieldErrorsFromZod };
