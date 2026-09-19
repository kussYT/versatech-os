import type { WebSearchDto } from "./schema";

export interface WebSearchProvider {
  search(input: unknown): Promise<WebSearchDto>;
}
