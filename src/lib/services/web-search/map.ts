import {
  WEB_SEARCH_RESULTS_MAX,
  WEB_SEARCH_TEXT_MAX_CHARS,
  WEB_SEARCH_URL_MAX_CHARS,
  parseWebSearchDto,
  type WebSearchDto,
  type WebSearchHit,
} from "./schema";

const RAW_RESULTS_SCAN_MAX = 20;

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

/** Collapse markup/control chars so web text cannot look like a new prompt. */
export function sanitizeUntrustedWebText(value: string, max = WEB_SEARCH_TEXT_MAX_CHARS): string {
  return clip(
    stripTags(value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    max,
  );
}

function citationUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > WEB_SEARCH_URL_MAX_CHARS) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return clip(parsed.toString(), WEB_SEARCH_URL_MAX_CHARS);
}

function publishedAtFromUnknown(raw: unknown): string | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") {
    return undefined;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function sourceFromUnknown(row: Record<string, unknown>): string | undefined {
  if (typeof row.engine === "string") {
    const source = sanitizeUntrustedWebText(row.engine);
    return source || undefined;
  }
  if (Array.isArray(row.engines) && typeof row.engines[0] === "string") {
    const source = sanitizeUntrustedWebText(row.engines[0]);
    return source || undefined;
  }
  return undefined;
}

function mapHit(row: unknown): WebSearchHit | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }
  const record = row as Record<string, unknown>;
  const url = citationUrl(record.url);
  const title = typeof record.title === "string" ? sanitizeUntrustedWebText(record.title) : "";
  if (!url || !title) {
    return null;
  }
  const snippet =
    typeof record.content === "string" ? sanitizeUntrustedWebText(record.content) : "";
  const hit: WebSearchHit = { title, url, snippet };
  const source = sourceFromUnknown(record);
  if (source) {
    hit.source = source;
  }
  const publishedAt = publishedAtFromUnknown(record.publishedDate);
  if (publishedAt) {
    hit.publishedAt = publishedAt;
  }
  return hit;
}

/**
 * Project SearXNG JSON onto the tool DTO. Extra keys (infoboxes, answers,
 * scores, thumbnails, unresponsive_engines) are dropped — never forwarded.
 */
export function mapSearxngPayload(
  query: string,
  payload: unknown,
  maxResults: number,
): WebSearchDto | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return null;
  }

  const limit = Math.min(Math.max(1, maxResults), WEB_SEARCH_RESULTS_MAX);
  const hits: WebSearchHit[] = [];
  for (const row of results.slice(0, RAW_RESULTS_SCAN_MAX)) {
    if (hits.length >= limit) {
      break;
    }
    const hit = mapHit(row);
    if (hit) {
      hits.push(hit);
    }
  }

  return parseWebSearchDto({ query, results: hits });
}
