import "server-only";

export { WebSearchService, search } from "./service";
export type { WebSearchServiceDeps } from "./service";
export type { WebSearchProvider } from "./provider";
export { MockWebSearchProvider } from "./mock";
export {
  SearxngWebSearchProvider,
  createSearxngWebSearchProvider,
  buildSearxngSearchUrl,
  WEB_SEARCH_USER_AGENT,
  type FetchLike,
  type SearxngWebSearchProviderOptions,
} from "./searxng";
export {
  parseSearxngBaseUrl,
  resolveSearxngOrigin,
  isBlockedSearxngHostname,
  isBlockedSearxngIp,
  isLoopbackSearxngHostname,
  WEB_SEARCH_TIMEOUT_MS,
  WEB_SEARCH_MAX_BODY_BYTES,
} from "./ssrf";
export { mapSearxngPayload, sanitizeUntrustedWebText } from "./map";
export {
  WEB_SEARCH_UNAVAILABLE,
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
  WebSearchUnavailableError,
  isWebSearchUnavailableError,
  webSearchUnavailable,
} from "./errors";
export * from "./schema";
