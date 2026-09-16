import { z } from "zod";
import { emptyToNull, parseDate } from "@/lib/crm/form-data";
import { MAINTENANCE_STATUSES } from "@/lib/maintenance/status";
import { isPositiveMoney } from "@/lib/money";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const monthlyAmountSchema = z
  .string()
  .transform((value) => value.trim().replace(",", "."))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && isPositiveMoney(value), "Montant mensuel invalide");

const requiredDate = z
  .string()
  .transform((value) => parseDate(value))
  .pipe(z.date({ error: "Date invalide" }));

const optionalDate = z
  .string()
  .transform((value) => parseDate(value))
  .pipe(z.date().nullable());

const contractFields = z
  .object({
    companyId: z.string().min(1, "Entreprise obligatoire"),
    projectId: z.string().transform((value) => emptyToNull(value)),
    monthlyAmount: monthlyAmountSchema,
    startDate: requiredDate,
    endDate: optionalDate,
    description: z.string().transform((value) => emptyToNull(value)),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate.getTime() < value.startDate.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La date de fin doit être postérieure au début",
      });
    }
  });

export const createMaintenanceContractSchema = contractFields;

export const updateMaintenanceContractSchema = contractFields.extend({
  id: z.string().min(1, "Contrat introuvable"),
});

export const updateMaintenanceStatusSchema = z.object({
  contractId: z.string().min(1, "Contrat introuvable"),
  status: z.enum(MAINTENANCE_STATUSES, { error: "Statut invalide" }),
});

export type CreateMaintenanceContractInput = z.infer<typeof createMaintenanceContractSchema>;
export type UpdateMaintenanceContractInput = z.infer<typeof updateMaintenanceContractSchema>;
export type UpdateMaintenanceStatusInput = z.infer<typeof updateMaintenanceStatusSchema>;

export { fieldErrorsFromZod };
