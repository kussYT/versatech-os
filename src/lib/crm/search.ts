export const SEARCH_KINDS = [
  "company",
  "contact",
  "project",
  "opportunity",
  "document",
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  company: "Entreprises",
  contact: "Contacts",
  project: "Projets",
  opportunity: "Opportunités",
  document: "Documents",
};

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;
export const SEARCH_LIMIT_PER_KIND = 6;

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchGroup = {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
};

export type SearchResults = {
  query: string;
  groups: SearchGroup[];
  total: number;
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

export function emptySearchResults(query = ""): SearchResults {
  return { query, groups: [], total: 0 };
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
  };
}

export function flattenSearchHits(results: SearchResults): SearchHit[] {
  return results.groups.flatMap((group) => group.hits);
}
