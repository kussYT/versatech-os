import "server-only";

import {
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
  WebSearchUnavailableError,
  isWebSearchUnavailableError,
  webSearchUnavailable,
  type WebSearchServiceResult,
} from "./errors";
import type { WebSearchProvider } from "./provider";
import { parseWebSearchInput, type WebSearchDto } from "./schema";
import {
  createSearxngWebSearchProvider,
  type FetchLike,
  type SearxngWebSearchProviderOptions,
} from "./searxng";

export type WebSearchServiceDeps = SearxngWebSearchProviderOptions & {
  provider?: WebSearchProvider | null;
};

function resolveProvider(deps: WebSearchServiceDeps): WebSearchProvider | null {
  if (deps.provider !== undefined) {
    return deps.provider;
  }
  const baseUrl =
    deps.baseUrl ??
    deps.searxngBaseUrl ??
    (typeof deps.origin === "string" ? deps.origin : undefined) ??
    process.env.SEARXNG_BASE_URL;
  return createSearxngWebSearchProvider({
    ...deps,
    baseUrl,
    fetchImpl: (deps.fetchImpl ?? deps.fetchFn ?? deps.fetch) as FetchLike | undefined,
  });
}

/**
 * Controlled web search. Fetches only the configured SearXNG `/search?format=json`.
 * Unset, RFC1918/metadata, or failing adapter → `WEB_SEARCH_UNAVAILABLE` (no invented hits).
 * Same-VPS loopback (`http://127.0.0.1:8080`) is a valid operator `SEARXNG_BASE_URL`.
 */
export async function search(
  input: unknown,
  deps: WebSearchServiceDeps = {},
): Promise<WebSearchServiceResult<WebSearchDto>> {
  const parsed = parseWebSearchInput(input);
  const provider = resolveProvider(deps);
  if (!provider) {
    return webSearchUnavailable();
  }

  try {
    const data = await provider.search(parsed);
    return { ok: true, data };
  } catch (error) {
    if (isWebSearchUnavailableError(error)) {
      return webSearchUnavailable(error.message || WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }
    return webSearchUnavailable();
  }
}

export const WebSearchService = {
  search,
};

export { WebSearchUnavailableError };
