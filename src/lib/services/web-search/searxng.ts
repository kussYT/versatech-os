import "server-only";

import {
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
  WebSearchUnavailableError,
} from "./errors";
import { mapSearxngPayload } from "./map";
import type { WebSearchProvider } from "./provider";
import { parseWebSearchInput, type WebSearchDto, type WebSearchQuery } from "./schema";
import {
  WEB_SEARCH_MAX_BODY_BYTES,
  WEB_SEARCH_TIMEOUT_MS,
  isSameConfiguredOrigin,
  parseSearxngBaseUrl,
  type SafeSearxngOrigin,
} from "./ssrf";

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export const WEB_SEARCH_USER_AGENT = "VersaTech OS (web-search)";

export type SearxngWebSearchProviderOptions = {
  origin?: SafeSearxngOrigin | string;
  baseUrl?: string;
  searxngBaseUrl?: string;
  fetch?: FetchLike;
  fetchFn?: FetchLike;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  timeout?: number;
  maxBodyBytes?: number;
  maxBytes?: number;
};

const LANGUAGE_QUERY: Record<NonNullable<WebSearchQuery["language"]>, string> = {
  fr: "fr-FR",
  en: "en-US",
};

export function buildSearxngSearchUrl(origin: SafeSearxngOrigin, input: WebSearchQuery): URL {
  const url = new URL(origin.searchUrl);
  url.searchParams.set("q", input.query);
  url.searchParams.set("format", "json");
  if (input.language) {
    url.searchParams.set("language", LANGUAGE_QUERY[input.language]);
  }
  if (input.timeRange) {
    url.searchParams.set("time_range", input.timeRange);
  }
  return url;
}

function isSafeSearxngOrigin(value: unknown): value is SafeSearxngOrigin {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.origin === "string" &&
    typeof record.searchUrl === "string" &&
    typeof record.hostname === "string" &&
    (record.protocol === "http:" || record.protocol === "https:")
  );
}

function resolveConfiguredOrigin(opts: SearxngWebSearchProviderOptions): SafeSearxngOrigin | null {
  if (isSafeSearxngOrigin(opts.origin)) {
    return opts.origin;
  }
  const raw =
    (typeof opts.origin === "string" ? opts.origin : undefined) ??
    opts.baseUrl ??
    opts.searxngBaseUrl;
  return parseSearxngBaseUrl(raw);
}

function resolveFetch(opts: SearxngWebSearchProviderOptions, fallback?: FetchLike): FetchLike {
  return opts.fetchImpl ?? opts.fetchFn ?? opts.fetch ?? fallback ?? fetch;
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes) {
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export class SearxngWebSearchProvider implements WebSearchProvider {
  private readonly origin: SafeSearxngOrigin;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxBodyBytes: number;

  constructor(
    originOrOpts: SafeSearxngOrigin | SearxngWebSearchProviderOptions,
    fetchImpl?: FetchLike,
    timeoutMs?: number,
    maxBodyBytes?: number,
  ) {
    if (isSafeSearxngOrigin(originOrOpts)) {
      this.origin = originOrOpts;
      this.fetchImpl = fetchImpl ?? fetch;
      this.timeoutMs = timeoutMs ?? WEB_SEARCH_TIMEOUT_MS;
      this.maxBodyBytes = maxBodyBytes ?? WEB_SEARCH_MAX_BODY_BYTES;
      return;
    }

    const origin = resolveConfiguredOrigin(originOrOpts);
    if (!origin) {
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }
    this.origin = origin;
    this.fetchImpl = resolveFetch(originOrOpts, fetchImpl);
    this.timeoutMs = originOrOpts.timeoutMs ?? originOrOpts.timeout ?? timeoutMs ?? WEB_SEARCH_TIMEOUT_MS;
    this.maxBodyBytes =
      originOrOpts.maxBodyBytes ?? originOrOpts.maxBytes ?? maxBodyBytes ?? WEB_SEARCH_MAX_BODY_BYTES;
  }

  async search(input: unknown): Promise<WebSearchDto> {
    const parsed = parseWebSearchInput(input);
    const requestUrl = buildSearxngSearchUrl(this.origin, parsed);
    if (!isSameConfiguredOrigin(requestUrl, this.origin)) {
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(requestUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": WEB_SEARCH_USER_AGENT,
        },
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }

    let text: string;
    try {
      text = await readBoundedText(response, this.maxBodyBytes);
    } catch (error) {
      if (error instanceof WebSearchUnavailableError) {
        throw error;
      }
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }

    const dto = mapSearxngPayload(parsed.query, payload, parsed.maxResults);
    if (!dto) {
      throw new WebSearchUnavailableError(WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }
    return dto;
  }
}

export function createSearxngWebSearchProvider(
  baseUrlOrOpts: string | SearxngWebSearchProviderOptions | undefined | null = process.env.SEARXNG_BASE_URL,
  fetchImpl?: FetchLike,
): SearxngWebSearchProvider | null {
  try {
    if (baseUrlOrOpts && typeof baseUrlOrOpts === "object") {
      return new SearxngWebSearchProvider(baseUrlOrOpts, fetchImpl);
    }
    const origin = parseSearxngBaseUrl(
      typeof baseUrlOrOpts === "string" ? baseUrlOrOpts : process.env.SEARXNG_BASE_URL,
    );
    if (!origin) {
      return null;
    }
    return new SearxngWebSearchProvider(origin, fetchImpl);
  } catch {
    return null;
  }
}
