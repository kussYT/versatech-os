import type {
  CompanyLifecycle,
  OpportunityStage,
  Priority,
} from "@/generated/prisma/client";

export const PROSPECT_LIFECYCLES = [
  "LEAD",
  "CONTACTED",
  "QUALIFIED",
  "OPPORTUNITY",
] as const satisfies readonly CompanyLifecycle[];

export const COMPANY_LIFECYCLE_LABELS: Record<CompanyLifecycle, string> = {
  LEAD: "Lead",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  OPPORTUNITY: "Opportunité",
  CLIENT: "Client",
  INACTIVE: "Inactif",
  LOST: "Perdu",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgent",
};

export function isProspectLifecycle(
  status: CompanyLifecycle,
): status is (typeof PROSPECT_LIFECYCLES)[number] {
  return (PROSPECT_LIFECYCLES as readonly CompanyLifecycle[]).includes(status);
}

export const OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
  "WON",
  "LOST",
] as const satisfies readonly OpportunityStage[];

export const OPEN_OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
] as const satisfies readonly OpportunityStage[];

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  TO_QUALIFY: "À qualifier",
  TO_CONTACT: "À contacter",
  CONTACTED: "Contacté",
  INTERESTED: "Intéressé",
  MEETING: "RDV",
  QUOTE: "Devis",
  WON: "Gagné",
  LOST: "Perdu",
};

export const OPPORTUNITY_STAGE_BADGE: Record<
  OpportunityStage,
  "prospect" | "contacted" | "interested" | "meeting" | "quote" | "won" | "lost"
> = {
  TO_QUALIFY: "prospect",
  TO_CONTACT: "prospect",
  CONTACTED: "contacted",
  INTERESTED: "interested",
  MEETING: "meeting",
  QUOTE: "quote",
  WON: "won",
  LOST: "lost",
};

export function isOpenOpportunityStage(stage: OpportunityStage) {
  return (OPEN_OPPORTUNITY_STAGES as readonly OpportunityStage[]).includes(stage);
}
