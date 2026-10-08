import type { OpportunityStage } from "@/generated/prisma/client";
import { OPEN_OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABELS } from "@/lib/crm/constants";

export const SEARCH_KINDS = [
  "company",
  "opportunity",
  "quote",
  "contact",
  "project",
  "document",
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  company: "Entreprises",
  opportunity: "Opportunités",
  quote: "Devis",
  contact: "Contacts",
  project: "Projets",
  document: "Documents",
};

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;
export const SEARCH_LIMIT_PER_KIND = 6;
export const SEARCH_DEBOUNCE_MS = 180;

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  companyId?: string;
  opportunityId?: string;
  stage?: OpportunityStage;
};

export type SearchGroup = {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
};

export type SearchStatus = "ok" | "empty" | "unauthenticated" | "error";

export type SearchResults = {
  query: string;
  groups: SearchGroup[];
  total: number;
  status: SearchStatus;
};

export function normalizeSearchQuery(raw: string) {
  return raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX_LENGTH);
}

export function searchQueryTokens(query: string) {
  return normalizeSearchQuery(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function isSearchableQuery(query: string) {
  return normalizeSearchQuery(query).length >= SEARCH_MIN_LENGTH;
}

export function emptySearchResults(query = "", status: SearchStatus = "empty"): SearchResults {
  return { query, groups: [], total: 0, status };
}

export function groupSearchHits(query: string, hits: SearchHit[]): SearchResults {
  const groups: SearchGroup[] = [];

  for (const kind of SEARCH_KINDS) {
    const kindHits = hits.filter((hit) => hit.kind === kind);
    if (kindHits.length === 0) {
      continue;
    }

    groups.push({
      kind,
      label: SEARCH_KIND_LABELS[kind],
      hits: kindHits,
    });
  }

  return {
    query,
    groups,
    total: hits.length,
    status: "ok",
  };
}

/** Une réponse n'est affichée que si aucune recherche plus récente n'a démarré. */
export function isCurrentSearch(requestId: number, latestId: number) {
  return requestId === latestId;
}

export function movePaletteIndex(index: number, key: "ArrowDown" | "ArrowUp", length: number) {
  if (length <= 0) {
    return 0;
  }
  if (key === "ArrowDown") {
    return (index + 1) % length;
  }
  return (index - 1 + length) % length;
}

export type PaletteScreen = "search" | "pick-company" | "interaction" | "follow-up" | "stage";

export function screenAfterEscape(screen: PaletteScreen): { screen: PaletteScreen; close: boolean } {
  if (screen === "search") {
    return { screen, close: true };
  }
  return { screen: "search", close: false };
}

/** Retire un @ initial pour retrouver un identifiant Instagram stocké sans @. */
export function searchNeedles(query: string) {
  const normalized = normalizeSearchQuery(query);
  const bare = normalized.replace(/^@+/, "");
  if (bare.length >= SEARCH_MIN_LENGTH && bare !== normalized) {
    return [normalized, bare];
  }
  return [normalized];
}

export function formatCompanySubtitle(company: {
  instagram?: string | null;
  email?: string | null;
  phone?: string | null;
  lifecycleLabel?: string | null;
  industry?: string | null;
  city?: string | null;
}) {
  const instagram = company.instagram?.trim().replace(/^@+/, "");
  if (instagram) {
    return `Instagram : @${instagram}`;
  }
  const email = company.email?.trim();
  if (email) {
    return email;
  }
  const phone = company.phone?.trim();
  if (phone) {
    return phone;
  }
  return [company.lifecycleLabel, company.industry, company.city].filter(Boolean).join(" · ");
}

export function formatOpportunityHit(title: string, companyName: string) {
  return `${title.trim()} — ${companyName.trim()}`;
}

export function formatQuoteHit(reference: string, companyName: string) {
  return `${reference.trim()} — ${companyName.trim()}`;
}

export type PaletteCommand = {
  id: string;
  title: string;
  hint: string;
  action:
    | { type: "navigate"; href: string }
    | { type: "create-prospect" }
    | { type: "interaction" }
    | { type: "follow-up" }
    | { type: "open-stage"; opportunityId: string }
    | { type: "set-stage"; opportunityId: string; stage: OpportunityStage };
};

export const EMPTY_PALETTE_COMMANDS: PaletteCommand[] = [
  { id: "new-prospect", title: "Nouveau prospect", hint: "Nom seul suffisant", action: { type: "create-prospect" } },
  { id: "new-interaction", title: "Nouvelle interaction", hint: "Appel, message, e-mail, RDV, note", action: { type: "interaction" } },
  { id: "new-follow-up", title: "Nouvelle relance", hint: "Demain, 3 jours, 1 semaine", action: { type: "follow-up" } },
  { id: "nav-dashboard", title: "Dashboard", hint: "Aujourd'hui", action: { type: "navigate", href: "/" } },
  { id: "nav-companies", title: "Entreprises", hint: "Liste", action: { type: "navigate", href: "/entreprises" } },
  { id: "nav-pipeline", title: "Pipeline", hint: "Kanban", action: { type: "navigate", href: "/pipeline" } },
  { id: "nav-quotes", title: "Devis", hint: "Liste", action: { type: "navigate", href: "/devis" } },
  { id: "nav-projects", title: "Projets", hint: "Liste", action: { type: "navigate", href: "/projets" } },
];

export function contextualCommands(hit: SearchHit): PaletteCommand[] {
  if (hit.kind === "company") {
    return [
      { id: `${hit.id}-open`, title: "Ouvrir la fiche", hint: hit.title, action: { type: "navigate", href: hit.href } },
      { id: `${hit.id}-interaction`, title: "Ajouter une interaction", hint: hit.title, action: { type: "interaction" } },
      { id: `${hit.id}-follow-up`, title: "Programmer une relance", hint: hit.title, action: { type: "follow-up" } },
    ];
  }
  if (hit.kind === "opportunity" && hit.companyId) {
    return [
      {
        id: `${hit.id}-open`,
        title: "Ouvrir la fiche",
        hint: hit.title,
        action: { type: "navigate", href: hit.href },
      },
      {
        id: `${hit.id}-pipeline`,
        title: "Ouvrir le pipeline",
        hint: hit.title,
        action: { type: "navigate", href: "/pipeline" },
      },
      {
        id: `${hit.id}-follow-up`,
        title: "Programmer une relance",
        hint: hit.title,
        action: { type: "follow-up" },
      },
      {
        id: `${hit.id}-stage`,
        title: "Changer l'étape",
        hint: "Étapes ouvertes",
        action: { type: "open-stage", opportunityId: hit.opportunityId ?? hit.id },
      },
    ];
  }
  if (hit.kind === "quote") {
    return [
      {
        id: `${hit.id}-quotes`,
        title: "Voir les devis",
        hint: hit.title,
        action: { type: "navigate", href: "/devis" },
      },
      ...(hit.companyId
        ? [
            {
              id: `${hit.id}-company`,
              title: "Ouvrir l'entreprise",
              hint: hit.title,
              action: { type: "navigate" as const, href: `/entreprises/${hit.companyId}` },
            },
          ]
        : []),
    ];
  }
  return [
    {
      id: `${hit.id}-open`,
      title: "Ouvrir",
      hint: hit.title,
      action: { type: "navigate", href: hit.href },
    },
  ];
}

export function openStageCommands(opportunityId: string): PaletteCommand[] {
  return OPEN_OPPORTUNITY_STAGES.map((stage) => ({
    id: `stage-${opportunityId}-${stage}`,
    title: OPPORTUNITY_STAGE_LABELS[stage],
    hint: "Étape ouverte",
    action: { type: "set-stage" as const, opportunityId, stage },
  }));
}

export function flattenSearchHits(results: SearchResults): SearchHit[] {
  return results.groups.flatMap((group) => group.hits);
}
