export const WEB_SEARCH_UNAVAILABLE = "WEB_SEARCH_UNAVAILABLE" as const;

export const WEB_SEARCH_UNAVAILABLE_MESSAGE = "Recherche web indisponible.";

export type WebSearchUnavailableCode = typeof WEB_SEARCH_UNAVAILABLE;

export class WebSearchUnavailableError extends Error {
  readonly code: WebSearchUnavailableCode = WEB_SEARCH_UNAVAILABLE;

  constructor(message = WEB_SEARCH_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "WebSearchUnavailableError";
  }

  toJSON() {
    return { name: this.name, message: this.message, code: this.code };
  }
}

export function isWebSearchUnavailableError(error: unknown): error is WebSearchUnavailableError {
  return error instanceof WebSearchUnavailableError;
}

export type WebSearchServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: WebSearchUnavailableCode; message: string };

export function webSearchUnavailable(
  message = WEB_SEARCH_UNAVAILABLE_MESSAGE,
): WebSearchServiceResult<never> {
  return { ok: false, code: WEB_SEARCH_UNAVAILABLE, message };
}
