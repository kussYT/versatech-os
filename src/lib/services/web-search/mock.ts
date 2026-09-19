import type { WebSearchProvider } from "./provider";
import {
  parseWebSearchDto,
  parseWebSearchInput,
  type WebSearchDto,
  type WebSearchHit,
  type WebSearchQuery,
} from "./schema";

export type MockWebSearchHitsBag = {
  results?: readonly WebSearchHit[];
  hits?: readonly WebSearchHit[];
};

export type MockWebSearchProviderInit = readonly WebSearchHit[] | MockWebSearchHitsBag;

function isHitsBag(init: MockWebSearchProviderInit): init is MockWebSearchHitsBag {
  return !Array.isArray(init);
}

function resolveMockHits(init: MockWebSearchProviderInit): readonly WebSearchHit[] {
  if (isHitsBag(init)) {
    return init.hits ?? init.results ?? [];
  }
  return init;
}

/**
 * In-memory provider for unit tests. Never fetches.
 */
export class MockWebSearchProvider implements WebSearchProvider {
  readonly calls: WebSearchQuery[] = [];
  private readonly hits: readonly WebSearchHit[];

  constructor(init: MockWebSearchProviderInit = []) {
    this.hits = resolveMockHits(init);
  }

  async search(input: unknown): Promise<WebSearchDto> {
    const parsed = parseWebSearchInput(input);
    this.calls.push(parsed);
    return parseWebSearchDto({
      query: parsed.query,
      results: this.hits.slice(0, parsed.maxResults),
    });
  }
}
