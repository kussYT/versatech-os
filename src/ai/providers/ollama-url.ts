import { isLoopbackSearxngHostname } from "@/lib/services/web-search/ssrf";

/**
 * Operator `OLLAMA_BASE_URL` only. Loopback HTTP(S) on the same host.
 * The model never supplies this URL. Public, RFC1918, credentials, and
 * non-http(s) schemes are rejected. No Caddy / UFW exposure of :11434.
 */
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export type SafeOllamaOrigin = {
  origin: string;
  hostname: string;
  protocol: "http:" | "https:";
  /** OpenAI-compatible base (`…/v1`) for Mastra `createOpenAICompatible`. */
  openaiCompatUrl: string;
};

function openaiCompatUrl(parsed: URL): string | null {
  const basePath = parsed.pathname.replace(/\/+$/, "");
  if (basePath !== "" && basePath !== "/v1") {
    return null;
  }
  return `${parsed.origin}/v1`;
}

/**
 * Parse operator-configured `OLLAMA_BASE_URL`. Allows same-VPS loopback
 * (127.0.0.1 / localhost / ::1). Rejects file/ftp, credentials, RFC1918,
 * link-local, metadata IPs, and any public hostname.
 */
export function parseOllamaBaseUrl(raw: string | undefined | null): SafeOllamaOrigin | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
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
  if (parsed.username || parsed.password) {
    return null;
  }
  if (parsed.search || parsed.hash) {
    return null;
  }
  if (!parsed.hostname || !isLoopbackSearxngHostname(parsed.hostname)) {
    return null;
  }

  const compat = openaiCompatUrl(parsed);
  if (!compat) {
    return null;
  }

  let compatParsed: URL;
  try {
    compatParsed = new URL(compat);
  } catch {
    return null;
  }
  if (compatParsed.origin !== parsed.origin) {
    return null;
  }
  if (!isLoopbackSearxngHostname(compatParsed.hostname)) {
    return null;
  }

  return {
    origin: parsed.origin,
    hostname: parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase(),
    protocol: parsed.protocol,
    openaiCompatUrl: compat,
  };
}

export function resolveOllamaOrigin(raw: string | undefined | null): SafeOllamaOrigin | null {
  const trimmed = raw?.trim();
  return parseOllamaBaseUrl(trimmed ? trimmed : DEFAULT_OLLAMA_BASE_URL);
}
