/**
 * Parcours client V1 — vue dérivée des faits CRM / Finance / Projets / Maintenance.
 * Pas de checklist manuelle, pas de dates inventées, pas de statut LIVE (n'existe pas).
 *
 * Contexte principal (V1 auto, V2 = `principalProjectId`) :
 * 1. selectPrincipalProject (partagé avec Website Status)
 * 2. devis associé au projet (projectId, sinon même opportunité)
 * 3. opportunité associée
 * 4. sinon l'activité commerciale la plus pertinente (devis, puis opportunité)
 *
 * CONTACT / RDV restent au niveau entreprise (début de relation).
 * Devis, paiements, projet et maintenance sont scopés au contexte principal :
 * on ne fusionne pas plusieurs devis / projets en une seule timeline.
 *
 * CURRENT = première étape non COMPLETED dans l'ordre métier, même si une étape
 * plus tardive est déjà COMPLETED (données historiques imparfaites conservées).
 */

import type {
  InteractionDirection,
  InteractionResult,
  InteractionType,
  MaintenanceStatus,
  OpportunityStage,
  PaymentStatus,
  ProjectStatus,
  QuoteStatus,
} from "@/generated/prisma/client";
import { isOpenOpportunityStage, PROJECT_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/lib/crm/constants";
import { hasMaintenanceStarted } from "@/lib/maintenance/mrr";
import { isActiveMaintenanceStatus } from "@/lib/maintenance/status";
import { parseMoneyToCents } from "@/lib/money";
import { selectPrincipalProject, type PrincipalProjectSource } from "@/lib/projects/principal";
import { isTerrainVisit } from "@/lib/prospection/visit";

export const JOURNEY_STEP_KEYS = [
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

export type JourneyStepKey = (typeof JOURNEY_STEP_KEYS)[number];
export type JourneyStepStatus = "COMPLETED" | "CURRENT" | "UPCOMING";

export const JOURNEY_STEP_LABELS: Record<JourneyStepKey, string> = {
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

const CONTACT_TYPES: ReadonlySet<InteractionType> = new Set(["CALL", "EMAIL", "MEETING", "MESSAGE"]);

const STARTED_PROJECT_STATUSES: ReadonlySet<ProjectStatus> = new Set([
  "ACTIVE",
  "WAITING_CLIENT",
  "REVIEW",
  "COMPLETED",
  "ARCHIVED",
]);

/** Pas de ProjectStatus LIVE : la mise en ligne métier = Terminé (puis Archivé). */
const LIVE_PROJECT_STATUSES: ReadonlySet<ProjectStatus> = new Set(["COMPLETED", "ARCHIVED"]);

const PRINCIPAL_REASON: Record<PrincipalProjectSource, string> = {
  explicit: "Projet choisi",
  in_development: "Projet actif",
  completed_maintenance: "Projet en maintenance",
  completed: "Projet livré",
  planned: "Projet planifié",
  archived: "Projet archivé",
};

export type ClientJourneyInteraction = {
  id: string;
  type: InteractionType;
  direction?: InteractionDirection | null;
  result?: InteractionResult | null;
  notes?: string | null;
  subject?: string | null;
  occurredAt: Date | string;
  opportunityId?: string | null;
};

export type ClientJourneyQuote = {
  id: string;
  reference: string;
  status: QuoteStatus;
  amountIncTax: string;
  createdAt: Date | string;
  sentAt: Date | string | null;
  acceptedAt: Date | string | null;
  projectId: string | null;
  opportunityId: string;
};

export type ClientJourneyProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  startDate: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  opportunityId: string | null;
};

export type ClientJourneyPayment = {
  id: string;
  amount: string;
  status: PaymentStatus;
  paidAt: Date | string | null;
  createdAt?: Date | string | null;
  quoteId: string | null;
  projectId: string | null;
};

export type ClientJourneyContract = {
  id: string;
  status: MaintenanceStatus;
  monthlyAmount: string;
  startDate: Date | string;
  projectId: string | null;
};

export type ClientJourneyOpportunity = {
  id: string;
  title: string;
  stage: OpportunityStage;
  updatedAt?: Date | string | null;
};

export type ClientJourneyInput = {
  interactions: readonly ClientJourneyInteraction[];
  quotes: readonly ClientJourneyQuote[];
  projects: readonly ClientJourneyProject[];
  payments: readonly ClientJourneyPayment[];
  contracts: readonly ClientJourneyContract[];
  opportunities: readonly ClientJourneyOpportunity[];
};

export type BuildClientJourneyOptions = {
  now?: Date;
  /** V2 : choisir un projet. V1 dérive le contexte principal. */
  principalProjectId?: string;
};

export type ClientJourneyStep = {
  key: JourneyStepKey;
  label: string;
  status: JourneyStepStatus;
  date: string | null;
  source: string | null;
  link: string | null;
  context: string | null;
};

export type ClientJourneyPrincipal = {
  project: { id: string; name: string; status: ProjectStatus } | null;
  quote: { id: string; reference: string; status: QuoteStatus } | null;
  opportunity: { id: string; title: string } | null;
  reason: string;
};

export type ClientJourney = {
  steps: ClientJourneyStep[];
  complete: boolean;
  principal: ClientJourneyPrincipal;
};

type Evidence = {
  completed: boolean;
  date: Date | null;
  source: string | null;
  link: string | null;
  context: string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function time(value: Date | string | null | undefined): number {
  return toDate(value)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

function compareDesc(left: Date | string | null | undefined, right: Date | string | null | undefined) {
  return time(right) - time(left);
}

function emptyEvidence(): Evidence {
  return {
    completed: false,
    date: null,
    source: null,
    link: null,
    context: null,
  };
}

function isCommercialContact(interaction: ClientJourneyInteraction) {
  if (interaction.type === "NOTE") {
    return false;
  }

  if (isTerrainVisit(interaction)) {
    return true;
  }

  return CONTACT_TYPES.has(interaction.type);
}

function isCommercialMeeting(interaction: ClientJourneyInteraction) {
  return interaction.type === "MEETING" && !isTerrainVisit(interaction);
}

function pickQuoteForProject(
  quotes: readonly ClientJourneyQuote[],
  project: ClientJourneyProject,
): ClientJourneyQuote | null {
  const linked = quotes.filter((quote) => quote.projectId === project.id);
  const sameOpportunity = project.opportunityId
    ? quotes.filter((quote) => quote.opportunityId === project.opportunityId && quote.projectId == null)
    : [];
  const pool = linked.length > 0 ? linked : sameOpportunity;
  return pickMostRelevantQuote(pool);
}

function quoteRank(status: QuoteStatus) {
  if (status === "ACCEPTED") {
    return 0;
  }
  if (status === "SENT" || status === "VIEWED") {
    return 1;
  }
  if (status === "DRAFT") {
    return 2;
  }
  return 3;
}

function pickMostRelevantQuote(quotes: readonly ClientJourneyQuote[]): ClientJourneyQuote | null {
  if (quotes.length === 0) {
    return null;
  }

  return [...quotes].sort((left, right) => {
    const byStatus = quoteRank(left.status) - quoteRank(right.status);
    if (byStatus !== 0) {
      return byStatus;
    }

    const leftDate = left.acceptedAt ?? left.sentAt ?? left.createdAt;
    const rightDate = right.acceptedAt ?? right.sentAt ?? right.createdAt;
    return compareDesc(leftDate, rightDate);
  })[0];
}

function pickMostRelevantOpportunity(
  opportunities: readonly ClientJourneyOpportunity[],
): ClientJourneyOpportunity | null {
  if (opportunities.length === 0) {
    return null;
  }

  return [...opportunities].sort((left, right) => {
    const leftOpen = isOpenOpportunityStage(left.stage) ? 0 : left.stage === "WON" ? 1 : 2;
    const rightOpen = isOpenOpportunityStage(right.stage) ? 0 : right.stage === "WON" ? 1 : 2;
    if (leftOpen !== rightOpen) {
      return leftOpen - rightOpen;
    }

    return compareDesc(left.updatedAt, right.updatedAt);
  })[0];
}

export function selectPrincipalJourneyContext(
  input: ClientJourneyInput,
  options: Pick<BuildClientJourneyOptions, "principalProjectId" | "now"> = {},
) {
  const selected = selectPrincipalProject(input.projects, input.contracts, {
    selectedProjectId: options.principalProjectId,
    now: options.now,
  });
  const project = selected?.project ?? null;
  const quoteFromProject = project ? pickQuoteForProject(input.quotes, project) : null;
  const quote = quoteFromProject ?? (project ? null : pickMostRelevantQuote(input.quotes));
  const opportunityId = project?.opportunityId ?? quote?.opportunityId ?? null;
  const opportunity =
    (opportunityId ? (input.opportunities.find((item) => item.id === opportunityId) ?? null) : null) ??
    (project || quote ? null : pickMostRelevantOpportunity(input.opportunities));

  let reason = "Activité commerciale la plus récente";
  if (selected) {
    reason = PRINCIPAL_REASON[selected.source];
  } else if (quote?.status === "ACCEPTED") {
    reason = "Devis accepté";
  } else if (quote) {
    reason = "Devis associé";
  } else if (opportunity) {
    reason = "Opportunité associée";
  }

  return { project, quote, opportunity, reason, source: selected?.source ?? null };
}

function paymentsInContext(
  payments: readonly ClientJourneyPayment[],
  quote: ClientJourneyQuote | null,
  project: ClientJourneyProject | null,
) {
  return payments.filter((payment) => {
    if (quote && payment.quoteId === quote.id) {
      return true;
    }
    if (project && payment.projectId === project.id) {
      return true;
    }
    return false;
  });
}

function paidPayments(payments: readonly ClientJourneyPayment[]) {
  return payments
    .filter((payment) => payment.status === "PAID")
    .sort((left, right) => time(left.paidAt ?? left.createdAt) - time(right.paidAt ?? right.createdAt));
}

function contractsInContext(
  contracts: readonly ClientJourneyContract[],
  project: ClientJourneyProject | null,
) {
  if (project) {
    const linked = contracts.filter((contract) => contract.projectId === project.id);
    if (linked.length > 0) {
      return linked;
    }
    return contracts.filter((contract) => contract.projectId == null);
  }

  return [...contracts];
}

function earliest(
  interactions: readonly ClientJourneyInteraction[],
  predicate: (item: ClientJourneyInteraction) => boolean,
) {
  return (
    interactions
      .filter(predicate)
      .sort((left, right) => time(left.occurredAt) - time(right.occurredAt))[0] ?? null
  );
}

function contactEvidence(interactions: readonly ClientJourneyInteraction[]): Evidence {
  const interaction = earliest(interactions, isCommercialContact);
  if (!interaction) {
    return emptyEvidence();
  }

  const terrain = isTerrainVisit(interaction);
  return {
    completed: true,
    date: toDate(interaction.occurredAt),
    source: terrain ? "Visite terrain" : interaction.type,
    link: null,
    context: terrain ? "Visite terrain" : null,
  };
}

function rdvEvidence(interactions: readonly ClientJourneyInteraction[]): Evidence {
  const interaction = earliest(interactions, isCommercialMeeting);
  if (!interaction) {
    return emptyEvidence();
  }

  return {
    completed: true,
    date: toDate(interaction.occurredAt),
    source: "MEETING",
    link: null,
    context: "RDV commercial",
  };
}

function devisEvidence(quote: ClientJourneyQuote | null): Evidence {
  if (!quote) {
    return emptyEvidence();
  }

  return {
    completed: true,
    date: toDate(quote.sentAt) ?? toDate(quote.createdAt),
    source: quote.status,
    link: "/devis",
    context: `${quote.reference} · ${QUOTE_STATUS_LABELS[quote.status]}`,
  };
}

function signatureEvidence(quote: ClientJourneyQuote | null): Evidence {
  if (!quote || quote.status !== "ACCEPTED") {
    return emptyEvidence();
  }

  return {
    completed: true,
    date: toDate(quote.acceptedAt),
    source: "ACCEPTED",
    link: "/devis",
    context: quote.reference,
  };
}

/**
 * Payment n'a pas de type acompte/solde : le libellé est libre.
 * Règle déterministe : premier paiement PAID rattaché au devis/projet principal = acompte.
 * Un paiement d'entreprise non rattaché n'est jamais un acompte.
 * Un paiement unique à 100 % du TTC complète Acompte et Solde (même paiement).
 */
function acompteEvidence(
  payments: readonly ClientJourneyPayment[],
  quote: ClientJourneyQuote | null,
  project: ClientJourneyProject | null,
): Evidence {
  const firstPaid = paidPayments(paymentsInContext(payments, quote, project))[0];
  if (!firstPaid) {
    return emptyEvidence();
  }

  return {
    completed: true,
    date: toDate(firstPaid.paidAt),
    source: "PAID",
    link: "/finances",
    context: `${firstPaid.amount} €`,
  };
}

function developpementEvidence(project: ClientJourneyProject | null): Evidence {
  if (!project || !STARTED_PROJECT_STATUSES.has(project.status)) {
    return emptyEvidence();
  }

  return {
    completed: true,
    date: toDate(project.startDate),
    source: project.status,
    link: `/projets/${project.id}`,
    context: `${project.name} · ${PROJECT_STATUS_LABELS[project.status]}`,
  };
}

function miseEnLigneEvidence(project: ClientJourneyProject | null): Evidence {
  if (!project || !LIVE_PROJECT_STATUSES.has(project.status)) {
    return emptyEvidence();
  }

  return {
    completed: true,
    date: toDate(project.completedAt),
    source: project.status,
    link: `/projets/${project.id}`,
    context: `${project.name} · ${PROJECT_STATUS_LABELS[project.status]}`,
  };
}

/**
 * Solde = paiements PAID du contexte dont la somme (centimes) couvre le TTC du devis accepté.
 */
function soldeEvidence(
  payments: readonly ClientJourneyPayment[],
  quote: ClientJourneyQuote | null,
  project: ClientJourneyProject | null,
): Evidence {
  if (!quote || quote.status !== "ACCEPTED") {
    return emptyEvidence();
  }

  const quoteCents = parseMoneyToCents(quote.amountIncTax);
  let collected = BigInt(0);
  let crossedAt: Date | null = null;

  for (const payment of paidPayments(paymentsInContext(payments, quote, project))) {
    collected += parseMoneyToCents(payment.amount);
    if (collected >= quoteCents) {
      crossedAt = toDate(payment.paidAt);
      break;
    }
  }

  if (collected < quoteCents) {
    return emptyEvidence();
  }

  return {
    completed: true,
    date: crossedAt,
    source: "PAID",
    link: "/finances",
    context: `${quote.reference} soldé`,
  };
}

function maintenanceEvidence(
  contracts: readonly ClientJourneyContract[],
  project: ClientJourneyProject | null,
  now: Date,
): Evidence {
  const scoped = contractsInContext(contracts, project);
  const started = scoped.filter(
    (contract) =>
      isActiveMaintenanceStatus(contract.status) && hasMaintenanceStarted(contract.startDate, now),
  );

  if (started.length > 0) {
    const contract = [...started].sort((left, right) => time(left.startDate) - time(right.startDate))[0];
    return {
      completed: true,
      date: toDate(contract.startDate),
      source: contract.status,
      link: "/maintenance",
      context: `${contract.monthlyAmount} € / mois`,
    };
  }

  const upcoming = scoped
    .filter((contract) => isActiveMaintenanceStatus(contract.status))
    .sort((left, right) => time(left.startDate) - time(right.startDate))[0];

  if (!upcoming) {
    return emptyEvidence();
  }

  return {
    completed: false,
    date: toDate(upcoming.startDate),
    source: upcoming.status,
    link: "/maintenance",
    context: "Contrat actif, démarrage à venir",
  };
}

export function buildClientJourney(
  input: ClientJourneyInput,
  options: BuildClientJourneyOptions = {},
): ClientJourney {
  const now = options.now ?? new Date();
  const selected = selectPrincipalJourneyContext(input, options);
  const evidences: Record<JourneyStepKey, Evidence> = {
    CONTACT: contactEvidence(input.interactions),
    RDV: rdvEvidence(input.interactions),
    DEVIS: devisEvidence(selected.quote),
    SIGNATURE: signatureEvidence(selected.quote),
    ACOMPTE: acompteEvidence(input.payments, selected.quote, selected.project),
    DEVELOPPEMENT: developpementEvidence(selected.project),
    MISE_EN_LIGNE: miseEnLigneEvidence(selected.project),
    SOLDE: soldeEvidence(input.payments, selected.quote, selected.project),
    MAINTENANCE: maintenanceEvidence(input.contracts, selected.project, now),
  };

  let currentAssigned = false;
  const steps: ClientJourneyStep[] = JOURNEY_STEP_KEYS.map((key) => {
    const evidence = evidences[key];
    let status: JourneyStepStatus;
    if (evidence.completed) {
      status = "COMPLETED";
    } else if (!currentAssigned) {
      status = "CURRENT";
      currentAssigned = true;
    } else {
      status = "UPCOMING";
    }

    return {
      key,
      label: JOURNEY_STEP_LABELS[key],
      status,
      date: toIso(evidence.date),
      source: evidence.source,
      link: evidence.link,
      context: evidence.context,
    };
  });

  return {
    steps,
    complete: steps.every((step) => step.status === "COMPLETED"),
    principal: {
      project: selected.project
        ? { id: selected.project.id, name: selected.project.name, status: selected.project.status }
        : null,
      quote: selected.quote
        ? {
            id: selected.quote.id,
            reference: selected.quote.reference,
            status: selected.quote.status,
          }
        : null,
      opportunity: selected.opportunity
        ? { id: selected.opportunity.id, title: selected.opportunity.title }
        : null,
      reason: selected.reason,
    },
  };
}

export function toClientJourneyInput(snapshot: {
  interactions: readonly (ClientJourneyInteraction & { occurredAt: Date | string })[];
  quotes: readonly ClientJourneyQuote[];
  projects: readonly ClientJourneyProject[];
  payments: readonly ClientJourneyPayment[];
  contracts: readonly (Omit<ClientJourneyContract, "projectId"> & {
    projectId?: string | null;
    project?: { id: string } | null;
  })[];
  opportunities: readonly ClientJourneyOpportunity[];
}): ClientJourneyInput {
  return {
    interactions: snapshot.interactions,
    quotes: snapshot.quotes,
    projects: snapshot.projects,
    payments: snapshot.payments,
    contracts: snapshot.contracts.map((contract) => ({
      id: contract.id,
      status: contract.status,
      monthlyAmount: contract.monthlyAmount,
      startDate: contract.startDate,
      projectId: contract.projectId ?? contract.project?.id ?? null,
    })),
    opportunities: snapshot.opportunities,
  };
}
