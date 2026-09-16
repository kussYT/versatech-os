import { z } from "zod";
import { OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { emptyToNull } from "@/lib/crm/form-data";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const estimatedValueSchema = z
  .string()
  .transform((value) => value.trim().replace(",", "."))
  .transform((value) => (value === "" ? "0" : value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Montant invalide");

export const createOpportunitySchema = z.object({
  companyId: z.string().min(1, "Entreprise introuvable"),
  title: z.string().trim().min(1, "Le titre est obligatoire"),
  estimatedValue: estimatedValueSchema,
  stage: z.enum(OPPORTUNITY_STAGES, { error: "Stage invalide" }),
});

export const updateOpportunityStageSchema = z.object({
  opportunityId: z.string().min(1, "Opportunité introuvable"),
  stage: z.enum(OPPORTUNITY_STAGES, { error: "Stage invalide" }),
  lostReason: z.string().transform((value) => emptyToNull(value)),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityStageInput = z.infer<typeof updateOpportunityStageSchema>;

export { fieldErrorsFromZod };
