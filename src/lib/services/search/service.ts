import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { SearchResults } from "@/lib/crm/search";
import { loadSearchWorkspace } from "@/lib/queries/search";

export type SearchWorkspaceInput = {
  actor: SessionUser;
  query: string;
};

/**
 * Workspace search (companies, contacts, projects, opportunities, documents).
 * READ only — no redirect. Same hits as `searchGlobal` (hrefs kept for UI).
 * `actor` is required (auth happens upstream); V1 queries are not user-scoped.
 */
export async function searchWorkspace({
  actor,
  query,
}: SearchWorkspaceInput): Promise<SearchResults> {
  if (!actor.id) {
    throw new Error("Acteur requis.");
  }

  return loadSearchWorkspace(query);
}

export const SearchService = {
  searchWorkspace,
};
