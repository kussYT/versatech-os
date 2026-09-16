import { z } from "zod";
import { QUOTE_STATUSES } from "@/lib/crm/constants";
import { emptyToNull } from "@/lib/crm/form-data";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const amountSchema = z
  .string()
  .transform((value) => value.trim().replace(",", "."))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && value !== "0" && value !== "0.0" && value !== "0.00", "Montant invalide");

export const createQuoteSchema = z.object({
  companyId: z.string().min(1, "Entreprise introuvable"),
  opportunityId: z.string().min(1, "Opportunité obligatoire"),
  reference: z.string().transform((value) => emptyToNull(value)),
  amountIncTax: amountSchema,
});

export const updateQuoteStatusSchema = z.object({
  quoteId: z.string().min(1, "Devis introuvable"),
  status: z.enum(QUOTE_STATUSES, { error: "Statut invalide" }),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteStatusInput = z.infer<typeof updateQuoteStatusSchema>;

export { fieldErrorsFromZod };
