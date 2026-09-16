import { z } from "zod";
import {
  InteractionDirection,
  InteractionResult,
  InteractionType,
} from "@/generated/prisma/client";
import { emptyToNull, parseDateTimeLocal } from "@/lib/crm/form-data";

const INTERACTION_FORM_TYPES = [
  "CALL",
  "EMAIL",
  "MEETING",
  "MESSAGE",
  "NOTE",
] as const satisfies readonly InteractionType[];

export const createInteractionSchema = z.object({
  companyId: z.string().min(1, "Entreprise introuvable"),
  type: z.enum(INTERACTION_FORM_TYPES, {
    error: "Type d'interaction invalide",
  }),
  direction: z.enum(InteractionDirection, {
    error: "Direction invalide",
  }),
  result: z
    .string()
    .transform((value) => emptyToNull(value))
    .pipe(z.enum(InteractionResult).nullable()),
  occurredAt: z
    .string()
    .transform((value) => parseDateTimeLocal(value))
    .pipe(z.date("La date de l'interaction est obligatoire")),
  notes: z.string().transform((value) => emptyToNull(value)),
});

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;
