export const WEB_SEARCH_TOOL_NAME = "webSearch";
export const WEB_SEARCH_STATUS_LABEL = "Recherche sur le Web…";
export const WEB_SEARCH_UNAVAILABLE_MESSAGE = "Recherche web indisponible.";

export const CHAT_SOURCES_MAX = 8;
export const CHAT_SOURCE_TITLE_MAX = 80;

export type ChatSourceLink = {
  url: string;
  title?: string;
};

const WEB_ERROR_RE =
  /searxng|searx\b|websearch|web search|recherche web|recherche sur le web/i;
const SEARX_RE = /searxng|searx/i;
const TRAILING_URL_PUNCT_RE = /[),.;!?]+$/;
const MARKDOWN_LINK_RE = /\[([^\]]{0,120})\]\((https?:\/\/[^)\s]+)\)/gi;
const BARE_HTTP_RE = /https?:\/\/[^\s<>"'`)\]]+/gi;

export function isWebSearchToolName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }
  return name.replace(/[^a-z]/gi, "").toLowerCase() === "websearch";
}

export function statusLabelForTool(name: string | null | undefined): string | null {
  return isWebSearchToolName(name) ? WEB_SEARCH_STATUS_LABEL : null;
}

export function isPublicHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  if (parsed.username || parsed.password) {
    return false;
  }
  if (SEARX_RE.test(parsed.hostname) || SEARX_RE.test(value)) {
    return false;
  }
  return true;
}

export function sanitizeSourceTitle(raw: unknown, url: string): string | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (trimmed && !SEARX_RE.test(trimmed)) {
      return trimmed.slice(0, CHAT_SOURCE_TITLE_MAX);
    }
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function cleanUrlCandidate(raw: string): string | null {
  const cleaned = raw.trim().replace(TRAILING_URL_PUNCT_RE, "");
  return isPublicHttpUrl(cleaned) ? cleaned : null;
}

function pushSource(
  bucket: ChatSourceLink[],
  seen: Set<string>,
  urlRaw: string,
  titleRaw?: unknown,
) {
  if (bucket.length >= CHAT_SOURCES_MAX) {
    return;
  }
  const url = cleanUrlCandidate(urlRaw);
  if (!url || seen.has(url)) {
    return;
  }
  seen.add(url);
  const title = sanitizeSourceTitle(titleRaw, url);
  bucket.push(title ? { url, title } : { url });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function looksLikeWebSearchHits(node: Record<string, unknown>): boolean {
  const rows = node.results ?? node.items ?? node.hits ?? node.organic;
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }
  const first = asRecord(rows[0]);
  if (!first) {
    return false;
  }
  if (typeof first.lifecycleStatus === "string" || typeof first.companyId === "string") {
    return false;
  }
  return typeof first.url === "string" || typeof first.href === "string" || typeof first.link === "string";
}

function walkForHttpUrls(node: unknown, bucket: ChatSourceLink[], seen: Set<string>, depth: number) {
  if (bucket.length >= CHAT_SOURCES_MAX || node == null || depth > 8) {
    return;
  }
  if (typeof node === "string") {
    if (node.startsWith("http://") || node.startsWith("https://")) {
      pushSource(bucket, seen, node);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      walkForHttpUrls(item, bucket, seen, depth + 1);
    }
    return;
  }
  const record = asRecord(node);
  if (!record) {
    return;
  }
  const url = record.url ?? record.href ?? record.link;
  if (typeof url === "string") {
    pushSource(bucket, seen, url, record.title ?? record.name ?? record.label);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "url" || key === "href" || key === "link") {
      continue;
    }
    walkForHttpUrls(value, bucket, seen, depth + 1);
  }
}

/** Collect http(s) links from a webSearch DTO (or any JSON that embeds them). */
export function extractHttpsSources(payload: unknown): ChatSourceLink[] {
  const bucket: ChatSourceLink[] = [];
  const seen = new Set<string>();
  walkForHttpUrls(payload, bucket, seen, 0);
  return bucket;
}

function toolNameFromUnknown(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const payload = asRecord(record.payload);
  const nested = payload ?? record;
  const candidates = [nested.toolName, nested.tool, nested.name, nested.id, record.toolName, record.tool, record.name];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

function toolResultPayload(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  const payload = asRecord(record.payload) ?? record;
  if ("result" in payload) {
    return payload.result;
  }
  if ("data" in payload) {
    return payload.data;
  }
  if ("output" in payload) {
    return payload.output;
  }
  return payload;
}

function isWebSearchToolResult(value: unknown): boolean {
  if (isWebSearchToolName(toolNameFromUnknown(value))) {
    return true;
  }
  const record = asRecord(value);
  const payload = record ? (asRecord(record.payload) ?? record) : null;
  const result = asRecord(toolResultPayload(value));
  return Boolean((payload && looksLikeWebSearchHits(payload)) || (result && looksLikeWebSearchHits(result)));
}

/**
 * Sources from Mastra `toolResults` / executeTool envelopes.
 * Only the last webSearch DTO (not CRM `searchCompanies` websites).
 */
export function extractHttpsSourcesFromToolResults(results: unknown): ChatSourceLink[] {
  if (results == null) {
    return [];
  }

  const rows = Array.isArray(results) ? results : [results];
  let lastWeb: unknown = null;
  for (const row of rows) {
    if (isWebSearchToolResult(row)) {
      lastWeb = toolResultPayload(row);
    }
  }

  if (lastWeb != null) {
    return extractHttpsSources(lastWeb);
  }

  const root = asRecord(results);
  if (root && looksLikeWebSearchHits(root)) {
    return extractHttpsSources(results);
  }
  const data = asRecord(root?.data);
  if (data && looksLikeWebSearchHits(data)) {
    return extractHttpsSources(data);
  }
  return [];
}

export function extractHttpsSourcesFromMarkdown(text: string): ChatSourceLink[] {
  const bucket: ChatSourceLink[] = [];
  const seen = new Set<string>();
  MARKDOWN_LINK_RE.lastIndex = 0;
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const title = match[1];
    const url = match[2];
    if (url) {
      pushSource(bucket, seen, url, title);
    }
  }
  BARE_HTTP_RE.lastIndex = 0;
  for (const match of text.matchAll(BARE_HTTP_RE)) {
    pushSource(bucket, seen, match[0] ?? "");
  }
  return bucket;
}

export function mergeChatSources(
  current: ChatSourceLink[] | undefined,
  incoming: ChatSourceLink[],
): ChatSourceLink[] {
  const bucket: ChatSourceLink[] = [];
  const seen = new Set<string>();
  for (const item of [...(current ?? []), ...incoming]) {
    pushSource(bucket, seen, item.url, item.title);
  }
  return bucket;
}

export function parseSourcesPayload(payload: unknown): ChatSourceLink[] {
  const record = asRecord(payload);
  if (!record) {
    return [];
  }
  const type = String(record.type ?? record.event ?? "");
  if (type === "confirmation_required" || type === "proposal" || type === "confirmation") {
    return [];
  }
  if (type === "sources" || Array.isArray(record.sources)) {
    return extractHttpsSources({ sources: record.sources });
  }
  if (isWebSearchToolName(toolNameFromUnknown(record)) && (type === "tool-result" || type === "tool_result")) {
    return extractHttpsSources(toolResultPayload(record));
  }
  return [];
}

export type ChatStatusToken = {
  label: string;
};

export function parseStatusPayload(payload: unknown): ChatStatusToken | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  const type = String(record.type ?? record.event ?? "");
  if (type === "confirmation_required" || type === "proposal" || type === "confirmation") {
    return null;
  }
  if (record.searching === true || record.searching === "true") {
    return { label: WEB_SEARCH_STATUS_LABEL };
  }
  if (record.searching === false || record.searching === "false") {
    return { label: "" };
  }
  if (type === "status") {
    if (typeof record.label === "string") {
      const trimmed = record.label.trim();
      if (SEARX_RE.test(trimmed) || isWebSearchToolName(trimmed)) {
        return { label: WEB_SEARCH_STATUS_LABEL };
      }
      return { label: trimmed };
    }
    return null;
  }

  const toolName = toolNameFromUnknown(record);
  if (!isWebSearchToolName(toolName) && !isWebSearchToolName(type)) {
    return null;
  }
  if (
    type === "tool-result" ||
    type === "tool_result" ||
    /^(end|result|done|complete|finish)$/i.test(String(record.phase ?? record.state ?? ""))
  ) {
    return { label: "" };
  }
  return { label: WEB_SEARCH_STATUS_LABEL };
}

export function isWebSearchErrorText(raw: string): boolean {
  return WEB_ERROR_RE.test(raw) || SEARX_RE.test(raw);
}

export function safeWebSearchError(raw: string): string {
  if (isWebSearchErrorText(raw)) {
    return WEB_SEARCH_UNAVAILABLE_MESSAGE;
  }
  return raw;
}
