import { z } from "zod";
import { emptyToNull, parseDate } from "@/lib/crm/form-data";
import { CREATE_PAYMENT_STATUSES, PAYMENT_STATUSES } from "@/lib/finance";
import { isPositiveMoneyString } from "@/lib/money";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const optionalId = z.string().transform((value) => emptyToNull(value));

const amountSchema = z
  .string()
  .transform((value) => value.trim().replace(",", "."))
  .refine((value) => isPositiveMoneyString(value), "Montant invalide");

const optionalDate = z
  .string()
  .transform((value) => parseDate(value))
  .pipe(z.date().nullable());

export const createPaymentSchema = z.object({
  companyId: z.string().min(1, "Entreprise introuvable"),
  quoteId: optionalId,
  projectId: optionalId,
  label: z.string().trim().min(1, "Le libellé est obligatoire"),
  amount: amountSchema,
  status: z.enum(CREATE_PAYMENT_STATUSES, { error: "Statut invalide" }),
  dueAt: optionalDate,
  paidAt: optionalDate,
  externalReference: z.string().transform((value) => emptyToNull(value)),
});

export const updatePaymentStatusSchema = z.object({
  paymentId: z.string().min(1, "Paiement introuvable"),
  status: z.enum(PAYMENT_STATUSES, { error: "Statut invalide" }),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;

export { fieldErrorsFromZod };
