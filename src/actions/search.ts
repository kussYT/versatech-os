"use server";

import {
  emptySearchResults,
  type SearchResults,
} from "@/lib/crm/search";
import { requireActor } from "@/lib/crm/actor";
import { searchWorkspace } from "@/lib/queries/search";

export async function searchGlobal(query: string): Promise<SearchResults> {
  const auth = await requireActor();
  if (!auth.ok) {
    return emptySearchResults(query);
  }

  try {
    return await searchWorkspace(query);
  } catch (error) {
    console.error(error);
    return emptySearchResults(query);
  }
}
