import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { WebSearchDto, WebSearchInput } from "@/lib/services/web-search/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import {
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
  isWebSearchUnavailableError,
} from "@/lib/services/web-search/errors";

export type WebSearchFn = (input: {
  actor: SessionUser;
  query: string;
  language?: WebSearchInput["language"];
  timeRange?: WebSearchInput["timeRange"];
  maxResults?: number;
}) => Promise<WebSearchDto>;

async function defaultWebSearch(input: {
  actor: SessionUser;
  query: string;
  language?: WebSearchInput["language"];
  timeRange?: WebSearchInput["timeRange"];
  maxResults?: number;
}): Promise<WebSearchDto> {
  const { WebSearchService, WebSearchUnavailableError } = await import(
    "@/lib/services/web-search"
  );
  const result = await WebSearchService.search({
    query: input.query,
    language: input.language,
    timeRange: input.timeRange,
    maxResults: input.maxResults,
  });
  if (!result.ok) {
    throw new WebSearchUnavailableError(result.message);
  }
  return result.data;
}

/**
 * READ tool: `WebSearchService.search` via the SearXNG adapter.
 * Actor is `runtime.actor` only. Model cannot set `baseUrl` / host / url.
 * Unset adapter → `SERVICE_UNAVAILABLE` (typed `WEB_SEARCH_UNAVAILABLE` in the service).
 */
export async function executeWebSearch(
  runtime: ToolRuntime,
  input: WebSearchInput,
  searchFn: WebSearchFn = defaultWebSearch,
): Promise<ToolResult<WebSearchDto>> {
  try {
    const data = await searchFn({
      actor: runtime.actor,
      query: input.query,
      language: input.language,
      timeRange: input.timeRange,
      maxResults: input.maxResults,
    });
    return toolSuccess(data);
  } catch (error) {
    if (isWebSearchUnavailableError(error)) {
      return toolFailure("SERVICE_UNAVAILABLE", WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }
    return toolFailure("INTERNAL");
  }
}
