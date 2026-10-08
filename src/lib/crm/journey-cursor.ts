/** Même ordre que le parcours dérivé des faits (`JOURNEY_STEP_KEYS`). */
export const DECLARED_JOURNEY_STEPS = [
  "CONTACT",
  "RDV",
  "DEVIS",
  "SIGNATURE",
  "ACOMPTE",
  "DEVELOPPEMENT",
  "MISE_EN_LIGNE",
  "SOLDE",
  "MAINTENANCE",
] as const;

export type DeclaredJourneyStep = (typeof DECLARED_JOURNEY_STEPS)[number];

export const DECLARED_JOURNEY_STEP_LABELS: Record<DeclaredJourneyStep, string> = {
  CONTACT: "Contact",
  RDV: "RDV",
  DEVIS: "Devis",
  SIGNATURE: "Signature",
  ACOMPTE: "Acompte",
  DEVELOPPEMENT: "Développement",
  MISE_EN_LIGNE: "Mise en ligne",
  SOLDE: "Solde",
  MAINTENANCE: "Maintenance",
};

export type JourneyContextIds = {
  companyId: string;
  opportunityId: string | null;
  projectId: string | null;
};

export type JourneyContextOption = JourneyContextIds & {
  contextKey: string;
  label: string;
};

export type JourneyAnchor = {
  project: { id: string; opportunityId: string | null; companyId: string } | null;
  opportunity: { id: string; companyId: string } | null;
};

const blank = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

export function journeyContextKey(input: JourneyContextIds) {
  if (input.projectId) {
    return `project:${input.projectId}`;
  }
  if (input.opportunityId) {
    return `opportunity:${input.opportunityId}`;
  }
  return `company:${input.companyId}`;
}

/**
 * Un projet prime : le curseur suit la prestation livrée, avec l'opportunité du projet.
 * Sans projet, le curseur suit l'opportunité. Sans les deux, il suit la relation.
 */
export function alignJourneyContext(input: {
  companyId: string;
  opportunityId?: string | null;
  projectId?: string | null;
  anchor: JourneyAnchor;
}): { ok: true; context: JourneyContextIds & { contextKey: string } } | { ok: false; message: string } {
  const companyId = input.companyId.trim();
  const requestedProjectId = blank(input.projectId);
  const requestedOpportunityId = blank(input.opportunityId);

  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  if (requestedProjectId) {
    const project = input.anchor.project;
    if (!project || project.id !== requestedProjectId || project.companyId !== companyId) {
      return { ok: false, message: "Ce projet n'appartient pas à l'entreprise." };
    }
    if (project.opportunityId && requestedOpportunityId && requestedOpportunityId !== project.opportunityId) {
      return { ok: false, message: "L'opportunité ne correspond pas à ce projet." };
    }
    if (!project.opportunityId && requestedOpportunityId) {
      return { ok: false, message: "Ce projet n'est pas lié à une opportunité." };
    }
    const opportunityId = project.opportunityId;
    if (opportunityId) {
      const opportunity = input.anchor.opportunity;
      if (!opportunity || opportunity.id !== opportunityId || opportunity.companyId !== companyId) {
        return { ok: false, message: "L'opportunité de ce projet est introuvable." };
      }
    }
    const context = { companyId, opportunityId, projectId: project.id };
    return { ok: true, context: { ...context, contextKey: journeyContextKey(context) } };
  }

  if (requestedOpportunityId) {
    const opportunity = input.anchor.opportunity;
    if (!opportunity || opportunity.id !== requestedOpportunityId || opportunity.companyId !== companyId) {
      return { ok: false, message: "Cette opportunité n'appartient pas à l'entreprise." };
    }
    const context = { companyId, opportunityId: opportunity.id, projectId: null };
    return { ok: true, context: { ...context, contextKey: journeyContextKey(context) } };
  }

  const context = { companyId, opportunityId: null, projectId: null };
  return { ok: true, context: { ...context, contextKey: journeyContextKey(context) } };
}

export function isDeclaredJourneyStep(value: string): value is DeclaredJourneyStep {
  return (DECLARED_JOURNEY_STEPS as readonly string[]).includes(value);
}

export type JourneyCursorView = {
  contextKey: string;
  step: DeclaredJourneyStep;
  updatedAt: string;
};

export type JourneyCursorEventView = {
  id: string;
  contextKey: string;
  fromStep: DeclaredJourneyStep | null;
  toStep: DeclaredJourneyStep | null;
  action: "set" | "reset" | "adopt";
  changedAt: string;
};

export type JourneyBoard = {
  schemaReady: boolean;
  cursors: JourneyCursorView[];
  events: JourneyCursorEventView[];
};

export type JourneyContextSource = {
  opportunities: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; name: string; opportunityId: string | null }>;
};

export function listJourneyContexts(companyId: string, source: JourneyContextSource): JourneyContextOption[] {
  const opportunityTitle = new Map(source.opportunities.map((item) => [item.id, item.title]));
  const coveredOpportunityIds = new Set(
    source.projects.flatMap((project) => (project.opportunityId ? [project.opportunityId] : [])),
  );
  const contexts: JourneyContextOption[] = [];

  if (source.opportunities.length === 0 && source.projects.length === 0) {
    contexts.push({
      companyId,
      opportunityId: null,
      projectId: null,
      contextKey: journeyContextKey({ companyId, opportunityId: null, projectId: null }),
      label: "Relation, sans prestation",
    });
  }

  for (const opportunity of source.opportunities) {
    if (coveredOpportunityIds.has(opportunity.id)) {
      continue;
    }
    contexts.push({
      companyId,
      opportunityId: opportunity.id,
      projectId: null,
      contextKey: journeyContextKey({ companyId, opportunityId: opportunity.id, projectId: null }),
      label: `Opportunité · ${opportunity.title}`,
    });
  }

  for (const project of source.projects) {
    const opportunityTitleForProject = project.opportunityId ? opportunityTitle.get(project.opportunityId) : null;
    contexts.push({
      companyId,
      opportunityId: project.opportunityId,
      projectId: project.id,
      contextKey: journeyContextKey({
        companyId,
        opportunityId: project.opportunityId,
        projectId: project.id,
      }),
      label: opportunityTitleForProject
        ? `Projet · ${project.name} · ${opportunityTitleForProject}`
        : `Projet · ${project.name}`,
    });
  }

  return contexts;
}

export function defaultJourneyContextKey(
  contexts: JourneyContextOption[],
  principal: { projectId: string | null; opportunityId: string | null },
) {
  if (principal.projectId) {
    const match = contexts.find((item) => item.projectId === principal.projectId);
    if (match) {
      return match.contextKey;
    }
  }
  if (principal.opportunityId) {
    const match = contexts.find((item) => item.opportunityId === principal.opportunityId && !item.projectId);
    if (match) {
      return match.contextKey;
    }
  }
  return contexts[0]?.contextKey ?? "";
}

/** Événements du contexte, plus ceux posés sur l'opportunité avant la création du projet. */
export function eventsForJourneyContext(
  events: readonly JourneyCursorEventView[],
  context: { contextKey: string; opportunityId: string | null; projectId: string | null },
) {
  const predecessor =
    context.projectId && context.opportunityId
      ? journeyContextKey({
          companyId: "",
          opportunityId: context.opportunityId,
          projectId: null,
        })
      : null;
  return events.filter(
    (event) => event.contextKey === context.contextKey || (predecessor !== null && event.contextKey === predecessor),
  );
}

/**
 * Curseur affiché. Un projet lié reprend le curseur encore posé sur son opportunité
 * tant que le transfert n'a pas réécrit la clé.
 */
export function visibleJourneyCursor(
  cursors: readonly JourneyCursorView[],
  context: { contextKey: string; opportunityId: string | null; projectId: string | null },
) {
  const direct = cursors.find((cursor) => cursor.contextKey === context.contextKey);
  if (direct) {
    return direct;
  }
  if (!context.projectId || !context.opportunityId) {
    return null;
  }
  const predecessor = journeyContextKey({
    companyId: "",
    opportunityId: context.opportunityId,
    projectId: null,
  });
  return cursors.find((cursor) => cursor.contextKey === predecessor) ?? null;
}
