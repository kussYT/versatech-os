import { z } from "zod";
import { DOCUMENT_TYPES } from "@/lib/crm/constants";
import { emptyToNull, normalizeWebsite } from "@/lib/crm/form-data";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const optionalId = z.string().transform((value) => emptyToNull(value));

const documentUrlSchema = z
  .string()
  .trim()
  .min(1, "L'URL est obligatoire")
  .transform((value) => normalizeWebsite(value) ?? value)
  .pipe(z.url("URL invalide"))
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "Seules les URL http(s) sont acceptées",
  );

const documentFieldsSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  type: z.enum(DOCUMENT_TYPES, { error: "Type invalide" }),
  url: documentUrlSchema,
  companyId: optionalId,
  projectId: optionalId,
});

export const createDocumentSchema = documentFieldsSchema;

export const updateDocumentSchema = documentFieldsSchema.extend({
  id: z.string().min(1, "Document introuvable"),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export { fieldErrorsFromZod };
