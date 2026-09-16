import type { CompanyLifecycle, InteractionType, OpportunityStage } from "@/generated/prisma/client";
import { isOpenOpportunityStage } from "@/lib/crm/constants";

export type CompanyLifecycleFacts = {
  current: CompanyLifecycle;
  wonOpportunityCount: number;
  acceptedQuoteCount: number;
  projectCount: number;
  openOpportunityCount: number;
};

const ALL_LIFECYCLES: CompanyLifecycle[] = [
  "LEAD",
  "CONTACTED",
  "QUALIFIED",
  "OPPORTUNITY",
  "CLIENT",
  "INACTIVE",
  "LOST",
];

const INTERACTION_MARKS_CONTACTED: ReadonlySet<InteractionType> = new Set([
  "CALL",
  "EMAIL",
  "MEETING",
  "MESSAGE",
]);

export function isClientJustified(facts: Pick<
  CompanyLifecycleFacts,
  "wonOpportunityCount" | "acceptedQuoteCount" | "projectCount"
>) {
  return (
    facts.wonOpportunityCount > 0 ||
    facts.acceptedQuoteCount > 0 ||
    facts.projectCount > 0
  );
}

export function lifecycleAfterInteraction(
  current: CompanyLifecycle,
  type: InteractionType,
): CompanyLifecycle | null {
  if (current !== "LEAD") {
    return null;
  }

  if (!INTERACTION_MARKS_CONTACTED.has(type)) {
    return null;
  }

  return "CONTACTED";
}

export function lifecycleAfterOpportunityCreated(
  current: CompanyLifecycle,
): CompanyLifecycle | null {
  if (current === "LEAD" || current === "CONTACTED" || current === "QUALIFIED") {
    return "OPPORTUNITY";
  }

  return null;
}

export function lifecycleAfterWon(current: CompanyLifecycle): CompanyLifecycle | null {
  return current === "CLIENT" ? null : "CLIENT";
}

/**
 * Politique rollback WON (H14)
 *
 * Quitter WON n'efface un CLIENT que s'il n'est plus justifié.
 * Justification CLIENT : autre opportunité WON, devis ACCEPTED, ou projet existant.
 * Un vrai client (projet / devis accepté / autre WON) n'est jamais rétrogradé
 * sur le seul changement de stage. INACTIVE n'est jamais réécrit ici
 * (pause manuelle).
 */
export function lifecycleAfterLeavingWon(
  current: CompanyLifecycle,
  factsAfterChange: CompanyLifecycleFacts,
): CompanyLifecycle | null {
  if (current !== "CLIENT") {
    return null;
  }

  if (isClientJustified(factsAfterChange)) {
    return null;
  }

  if (factsAfterChange.openOpportunityCount > 0) {
    return "OPPORTUNITY";
  }

  return "QUALIFIED";
}

export function nextLifecycleAfterOpportunityStageChange(params: {
  currentCompany: CompanyLifecycle;
  fromStage: OpportunityStage;
  toStage: OpportunityStage;
  factsAfterChange: CompanyLifecycleFacts;
}): CompanyLifecycle | null {
  const { currentCompany, fromStage, toStage, factsAfterChange } = params;

  if (toStage === "WON") {
    return lifecycleAfterWon(currentCompany);
  }

  if (fromStage === "WON") {
    return lifecycleAfterLeavingWon(currentCompany, factsAfterChange);
  }

  if (
    isOpenOpportunityStage(toStage) &&
    (currentCompany === "LEAD" ||
      currentCompany === "CONTACTED" ||
      currentCompany === "QUALIFIED")
  ) {
    return "OPPORTUNITY";
  }

  return null;
}

function addProspectTargets(
  allowed: Set<CompanyLifecycle>,
  facts: CompanyLifecycleFacts,
) {
  allowed.add("LEAD");
  allowed.add("CONTACTED");
  allowed.add("QUALIFIED");
  allowed.add("LOST");
  allowed.add("INACTIVE");

  if (facts.openOpportunityCount > 0) {
    allowed.add("OPPORTUNITY");
  }
}

/**
 * Transitions manuelles autorisées (H15).
 * CLIENT n'est proposable que s'il est justifié (WON / devis accepté / projet).
 * Un CLIENT justifié ne peut aller qu'en INACTIVE (jamais LEAD/LOST par le formulaire).
 */
export function allowedManualLifecycles(facts: CompanyLifecycleFacts): CompanyLifecycle[] {
  const allowed = new Set<CompanyLifecycle>([facts.current]);
  const justified = isClientJustified(facts);

  switch (facts.current) {
    case "LEAD":
    case "CONTACTED":
    case "QUALIFIED":
    case "OPPORTUNITY":
      addProspectTargets(allowed, facts);
      if (justified) {
        allowed.add("CLIENT");
      }
      break;
    case "CLIENT":
      allowed.add("INACTIVE");
      if (!justified) {
        addProspectTargets(allowed, facts);
      }
      break;
    case "INACTIVE":
      if (justified) {
        allowed.add("CLIENT");
      } else {
        addProspectTargets(allowed, facts);
      }
      break;
    case "LOST":
      addProspectTargets(allowed, facts);
      if (justified) {
        allowed.add("CLIENT");
      }
      break;
  }

  return ALL_LIFECYCLES.filter((status) => allowed.has(status));
}

export function validateManualLifecycle(
  to: CompanyLifecycle,
  facts: CompanyLifecycleFacts,
): { ok: true } | { ok: false; message: string } {
  if (to === facts.current) {
    return { ok: true };
  }

  const allowed = allowedManualLifecycles(facts);
  if (allowed.includes(to)) {
    return { ok: true };
  }

  if (to === "CLIENT" && !isClientJustified(facts)) {
    return {
      ok: false,
      message:
        "Un client doit avoir une opportunité gagnée, un devis accepté ou un projet.",
    };
  }

  if (facts.current === "CLIENT" && isClientJustified(facts)) {
    return {
      ok: false,
      message:
        "Client actif : conservez le statut ou passez en inactif. Un projet, un devis accepté ou une opportunité gagnée justifie encore le statut client.",
    };
  }

  if (to === "OPPORTUNITY" && facts.openOpportunityCount === 0) {
    return {
      ok: false,
      message: "Le statut Opportunité nécessite une opportunité ouverte.",
    };
  }

  return {
    ok: false,
    message: "Cette transition de cycle de vie n'est pas autorisée.",
  };
}
