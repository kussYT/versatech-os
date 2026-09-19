import "server-only";

import {
  webSearchDtoSchema,
  webSearchHitSchema,
  webSearchInputSchema,
  type WebSearchDto,
  type WebSearchHit,
  type WebSearchInput,
} from "@/lib/services/web-search/schema";

/**
 * Tool input: unknown keys (`host`, `url`, `baseUrl`, `actorId`, …) are stripped.
 * Output DTO = `WebSearchService.search` — extraits sourcés, jamais le JSON SearXNG brut.
 */
export { webSearchInputSchema, webSearchHitSchema };

export const webSearchOutputSchema = webSearchDtoSchema;

export type { WebSearchInput, WebSearchHit };
export type WebSearchOutput = WebSearchDto;
