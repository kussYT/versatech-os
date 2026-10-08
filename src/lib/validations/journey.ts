import { z } from "zod";
import { DECLARED_JOURNEY_STEPS } from "@/lib/crm/journey-cursor";

const optionalId = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

export const setJourneyStepSchema = z.object({
  companyId: z.string().trim().min(1, "Entreprise introuvable"),
  opportunityId: optionalId,
  projectId: optionalId,
  step: z.enum(DECLARED_JOURNEY_STEPS, "Choisissez une étape du parcours"),
});

export const resetJourneyStepSchema = z.object({
  companyId: z.string().trim().min(1, "Entreprise introuvable"),
  opportunityId: optionalId,
  projectId: optionalId,
});

export type SetJourneyStepInput = z.infer<typeof setJourneyStepSchema>;
export type ResetJourneyStepInput = z.infer<typeof resetJourneyStepSchema>;
