import type { OpportunityStage } from "@/generated/prisma/client";
import { isOpenOpportunityStage } from "@/lib/crm/constants";
import {
  selectPrincipalProject,
  type PrincipalContractInput,
  type PrincipalProjectInput,
  type PrincipalProjectSource,
} from "@/lib/projects/principal";

/**
 * Prestation principale d'une entreprise. Même résultat pour Aujourd'hui,
 * la liste Entreprises et la fiche.
 *
 * 1. Le projet de `selectPrincipalProject` (développement, maintenance, puis
 *    le plus récent). S'il est lié à une opportunité, cette opportunité fait
 *    partie de la même prestation : elle n'est pas une seconde ligne.
 * 2. Sinon l'opportunité ouverte la plus récente.
 * 3. Sinon l'opportunité gagnée la plus récente.
 * 4. Sinon l'opportunité perdue la plus récente.
 * 5. Sinon aucune prestation.
 *
 * Départage : `updatedAt` desc, puis `createdAt` desc, puis `id` desc
 * (comparaison de codes, indépendante de la locale).
 * Une date absente perd le départage.
 */
export type PrestationProject = PrincipalProjectInput & {
  name: string;
  opportunityId: string | null;
};

export type PrestationOpportunity = {
  id: string;
  title: string;
  stage: OpportunityStage;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type PrincipalPrestationSource =
  | PrincipalProjectSource
  | "open_opportunity"
  | "won_opportunity"
  | "lost_opportunity";

export type PrincipalPrestation = {
  projectId: string | null;
  opportunityId: string | null;
  label: string;
  source: PrincipalPrestationSource;
};

function toMs(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(time) ? null : time;
}

function compareDesc(left: Date | string | null | undefined, right: Date | string | null | undefined) {
  const leftMs = toMs(left);
  const rightMs = toMs(right);
  if (leftMs === null && rightMs === null) {
    return 0;
  }
  return (rightMs ?? Number.NEGATIVE_INFINITY) - (leftMs ?? Number.NEGATIVE_INFINITY);
}

function newestOpportunity(left: PrestationOpportunity, right: PrestationOpportunity) {
  const byUpdated = compareDesc(left.updatedAt, right.updatedAt);
  if (byUpdated !== 0) {
    return byUpdated;
  }
  const byCreated = compareDesc(left.createdAt, right.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }
  if (left.id === right.id) {
    return 0;
  }
  return left.id < right.id ? 1 : -1;
}

function pickOpportunity(
  opportunities: readonly PrestationOpportunity[],
  source: PrincipalPrestationSource,
  match: (stage: OpportunityStage) => boolean,
): PrincipalPrestation | null {
  const candidates = opportunities.filter((item) => match(item.stage));
  const selected = [...candidates].sort(newestOpportunity)[0];
  if (!selected) {
    return null;
  }
  return {
    projectId: null,
    opportunityId: selected.id,
    label: selected.title,
    source,
  };
}

export function selectPrincipalPrestation(input: {
  projects: readonly PrestationProject[];
  opportunities: readonly PrestationOpportunity[];
  contracts?: readonly PrincipalContractInput[];
  now?: Date;
}): PrincipalPrestation | null {
  const project = selectPrincipalProject(input.projects, input.contracts ?? [], { now: input.now });
  if (project) {
    return {
      projectId: project.project.id,
      opportunityId: project.project.opportunityId,
      label: project.project.name,
      source: project.source,
    };
  }

  return (
    pickOpportunity(input.opportunities, "open_opportunity", isOpenOpportunityStage) ??
    pickOpportunity(input.opportunities, "won_opportunity", (stage) => stage === "WON") ??
    pickOpportunity(input.opportunities, "lost_opportunity", (stage) => stage === "LOST")
  );
}
