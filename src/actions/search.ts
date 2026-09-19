"use server";

import { logServerError } from "@/lib/observability/log-error";

import {
  emptySearchResults,
  type SearchResults,
} from "@/lib/crm/search";
import { requireActor } from "@/lib/crm/actor";
import { SearchService } from "@/lib/services/search";

export async function searchGlobal(query: string): Promise<SearchResults> {
  const auth = await requireActor();
  if (!auth.ok) {
    return emptySearchResults(query);
  }

  try {
    return await SearchService.searchWorkspace({ actor: auth.actor, query });
  } catch (error) {
    logServerError("search", error);
    return emptySearchResults(query);
  }
}
