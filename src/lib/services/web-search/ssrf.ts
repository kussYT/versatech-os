import { BlockList, isIP } from "node:net";

/**
 * Nominatim uses 8s (`NOMINATIM_TIMEOUT_MS`). Same ceiling for SearXNG.
 * AbortController is created per request in the provider.
 */
export const WEB_SEARCH_TIMEOUT_MS = 8_000;
export const WEB_SEARCH_MAX_BODY_BYTES = 256 * 1024;

/** Untrusted URLs (model args, result citations): loopback + RFC1918 + link-local. */
const untrustedBlocked = new BlockList();
untrustedBlocked.addSubnet("0.0.0.0", 8, "ipv4");
untrustedBlocked.addSubnet("10.0.0.0", 8, "ipv4");
untrustedBlocked.addSubnet("127.0.0.0", 8, "ipv4");
untrustedBlocked.addSubnet("169.254.0.0", 16, "ipv4");
untrustedBlocked.addSubnet("172.16.0.0", 12, "ipv4");
untrustedBlocked.addSubnet("192.168.0.0", 16, "ipv4");
untrustedBlocked.addAddress("::1", "ipv6");
untrustedBlocked.addAddress("::", "ipv6");
untrustedBlocked.addSubnet("fe80::", 10, "ipv6");
untrustedBlocked.addSubnet("fc00::", 7, "ipv6");

/**
 * Operator `SEARXNG_BASE_URL` only: same as untrusted except loopback is allowed
 * (same-VPS SearXNG on 127.0.0.1 / localhost / ::1). RFC1918 and metadata stay out.
 */
const configuredBlocked = new BlockList();
configuredBlocked.addSubnet("0.0.0.0", 8, "ipv4");
configuredBlocked.addSubnet("10.0.0.0", 8, "ipv4");
configuredBlocked.addSubnet("169.254.0.0", 16, "ipv4");
configuredBlocked.addSubnet("172.16.0.0", 12, "ipv4");
configuredBlocked.addSubnet("192.168.0.0", 16, "ipv4");
configuredBlocked.addAddress("::", "ipv6");
configuredBlocked.addSubnet("fe80::", 10, "ipv6");
configuredBlocked.addSubnet("fc00::", 7, "ipv6");

const loopbackV4 = new BlockList();
loopbackV4.addSubnet("127.0.0.0", 8, "ipv4");

const IPV4_MAPPED_DOTTED_RE = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const IPV4_MAPPED_HEXTETS_RE = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

export type SafeSearxngOrigin = {
  /** `https://searx.example.com` (no path, includes port if non-default). */
  origin: string;
  hostname: string;
  protocol: "http:" | "https:";
  /** Configured instance search endpoint without query string. */
  searchUrl: string;
};

function stripBrackets(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function normalizeHostname(hostname: string): string {
  return stripBrackets(hostname).trim().toLowerCase().replace(/\.+$/, "");
}

function ipv4FromMappedIPv6(ip: string): string | null {
  const dotted = ip.match(IPV4_MAPPED_DOTTED_RE);
  if (dotted) {
    return dotted[1] ?? null;
  }
  const hextets = ip.match(IPV4_MAPPED_HEXTETS_RE);
  if (!hextets?.[1] || !hextets[2]) {
    return null;
  }
  const high = Number.parseInt(hextets[1], 16);
  const low = Number.parseInt(hextets[2], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) {
    return null;
  }
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function ipInList(ip: string, list: BlockList): boolean {
  const mapped = ipv4FromMappedIPv6(ip);
  if (mapped) {
    return ipInList(mapped, list);
  }
  const version = isIP(ip);
  if (version === 4) {
    return list.check(ip, "ipv4");
  }
  if (version === 6) {
    return list.check(ip, "ipv6");
  }
  return false;
}

export function isBlockedSearxngIp(ip: string): boolean {
  return ipInList(ip, untrustedBlocked);
}

function isLoopbackName(normalized: string): boolean {
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }
  if (normalized === "ip6-localhost" || normalized === "ip6-loopback") {
    return true;
  }
  const mapped = ipv4FromMappedIPv6(normalized);
  if (mapped) {
    return isLoopbackName(mapped);
  }
  if (isIP(normalized) === 4) {
    return loopbackV4.check(normalized, "ipv4");
  }
  if (isIP(normalized) === 6) {
    return normalized === "::1";
  }
  return false;
}

/** True for localhost / 127.0.0.0/8 / ::1 — never a model-chosen fetch target. */
export function isLoopbackSearxngHostname(hostname: string | undefined | null): boolean {
  if (typeof hostname !== "string" || !hostname.trim()) {
    return false;
  }
  return isLoopbackName(normalizeHostname(hostname));
}

function isNonCanonicalNumericHost(normalized: string): boolean {
  return /^[\d.]+$/.test(normalized) && isIP(normalized) === 0;
}

/**
 * Untrusted hostnames (tool args, citation URLs): loopback, RFC1918, link-local.
 * Not used to reject operator `SEARXNG_BASE_URL`.
 */
export function isBlockedSearxngHostname(hostname: string | undefined | null): boolean {
  if (typeof hostname !== "string" || !hostname.trim()) {
    return true;
  }
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return true;
  }
  if (isLoopbackName(normalized) || isNonCanonicalNumericHost(normalized)) {
    return true;
  }
  if (isIP(normalized)) {
    return isBlockedSearxngIp(normalized);
  }
  return false;
}

function isForbiddenConfiguredHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return true;
  }
  if (isLoopbackName(normalized)) {
    return false;
  }
  if (isNonCanonicalNumericHost(normalized)) {
    return true;
  }
  if (isIP(normalized)) {
    return ipInList(normalized, configuredBlocked);
  }
  return false;
}

function searchEndpoint(parsed: URL): string {
  const basePath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${basePath}/search`;
}

/**
 * Parse operator-configured `SEARXNG_BASE_URL` once. The model never supplies
 * this URL. Allows public http(s) **and same-VPS loopback** (127.0.0.1 /
 * localhost / ::1). Rejects file/ftp, credentials, RFC1918, and link-local /
 * metadata (169.254.169.254).
 */
export function parseSearxngBaseUrl(raw: string | undefined | null): SafeSearxngOrigin | null {
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
  if (!parsed.hostname || isForbiddenConfiguredHostname(parsed.hostname)) {
    return null;
  }

  const searchUrl = searchEndpoint(parsed);
  let searchParsed: URL;
  try {
    searchParsed = new URL(searchUrl);
  } catch {
    return null;
  }
  if (searchParsed.origin !== parsed.origin) {
    return null;
  }
  if (isForbiddenConfiguredHostname(searchParsed.hostname)) {
    return null;
  }

  return {
    origin: parsed.origin,
    hostname: normalizeHostname(parsed.hostname),
    protocol: parsed.protocol,
    searchUrl,
  };
}

export function isSameConfiguredOrigin(candidate: URL, origin: SafeSearxngOrigin): boolean {
  if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
    return false;
  }
  return (
    candidate.origin === origin.origin &&
    normalizeHostname(candidate.hostname) === origin.hostname
  );
}

const originCache = new Map<string, SafeSearxngOrigin | null>();

/** Parse a given base URL string once (keyed by trimmed input). */
export function resolveSearxngOrigin(raw: string | undefined | null): SafeSearxngOrigin | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (originCache.has(trimmed)) {
    return originCache.get(trimmed) ?? null;
  }
  const parsed = parseSearxngBaseUrl(trimmed);
  originCache.set(trimmed, parsed);
  return parsed;
}

/** Test helper — do not use in production code. */
export function clearSearxngOriginCache(): void {
  originCache.clear();
}
