import { z } from "zod";
import { PROJECT_STATUSES } from "@/lib/crm/constants";
import { emptyToNull, parseDate } from "@/lib/crm/form-data";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const optionalAmount = z
  .string()
  .transform((value) => value.trim().replace(",", "."))
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || /^\d+(\.\d{1,2})?$/.test(value), "Montant invalide");

const optionalDate = z
  .string()
  .transform((value) => parseDate(value))
  .pipe(z.date().nullable());

export const createProjectSchema = z.object({
  companyId: z.string().min(1, "Entreprise introuvable"),
  name: z.string().trim().min(1, "Le nom du projet est obligatoire"),
  status: z.enum(PROJECT_STATUSES, { error: "Statut invalide" }),
  startDate: optionalDate,
  dueDate: optionalDate,
  amount: optionalAmount,
  description: z.string().transform((value) => emptyToNull(value)),
  quoteId: z.string().transform((value) => emptyToNull(value)),
});

export const updateProjectStatusSchema = z.object({
  projectId: z.string().min(1, "Projet introuvable"),
  status: z.enum(PROJECT_STATUSES, { error: "Statut invalide" }),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;

export { fieldErrorsFromZod };
