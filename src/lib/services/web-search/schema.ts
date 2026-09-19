/**
 * Controlled web-search DTO — extraits sourcés, jamais le JSON SearXNG brut.
 */
import { z } from "zod";

export const WEB_SEARCH_QUERY_MAX_CHARS = 200;
export const WEB_SEARCH_RESULTS_DEFAULT = 5;
export const WEB_SEARCH_RESULTS_MAX = 10;
export const WEB_SEARCH_TEXT_MAX_CHARS = 400;
export const WEB_SEARCH_URL_MAX_CHARS = 2_000;

export const WEB_SEARCH_LANGUAGES = ["fr", "en"] as const;
export const WEB_SEARCH_TIME_RANGES = ["day", "month", "year"] as const;

export type WebSearchLanguage = (typeof WEB_SEARCH_LANGUAGES)[number];
export type WebSearchTimeRange = (typeof WEB_SEARCH_TIME_RANGES)[number];

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const webSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(WEB_SEARCH_QUERY_MAX_CHARS),
  language: z.enum(WEB_SEARCH_LANGUAGES).optional(),
  timeRange: z.enum(WEB_SEARCH_TIME_RANGES).optional(),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(WEB_SEARCH_RESULTS_MAX)
    .default(WEB_SEARCH_RESULTS_DEFAULT),
});

export const webSearchHitSchema = z.strictObject({
  title: z.string().min(1).max(WEB_SEARCH_TEXT_MAX_CHARS),
  url: z.string().max(WEB_SEARCH_URL_MAX_CHARS),
  snippet: z.string().max(WEB_SEARCH_TEXT_MAX_CHARS),
  source: z.string().min(1).max(WEB_SEARCH_TEXT_MAX_CHARS).optional(),
  publishedAt: z
    .string()
    .refine((value) => ISO_INSTANT_RE.test(value) && !Number.isNaN(Date.parse(value)))
    .optional(),
});

export const webSearchDtoSchema = z.strictObject({
  query: z.string().min(1).max(WEB_SEARCH_QUERY_MAX_CHARS),
  results: z.array(webSearchHitSchema).max(WEB_SEARCH_RESULTS_MAX),
});

export type WebSearchInput = z.input<typeof webSearchInputSchema>;
export type WebSearchQuery = z.output<typeof webSearchInputSchema>;
export type WebSearchHit = z.infer<typeof webSearchHitSchema>;
export type WebSearchDto = z.infer<typeof webSearchDtoSchema>;

export function parseWebSearchInput(input: unknown): WebSearchQuery {
  return webSearchInputSchema.parse(input);
}

export function parseWebSearchDto(input: unknown): WebSearchDto {
  return webSearchDtoSchema.parse(input);
}

export function emptyWebSearch(query: string): WebSearchDto {
  return parseWebSearchDto({ query, results: [] });
}
