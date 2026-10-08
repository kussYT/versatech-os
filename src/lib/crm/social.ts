/**
 * Pure helpers for Company social profiles.
 * Instagram is stored as a bare lowercase handle (`maro.crea`); LinkedIn as a full https URL.
 */

export const INSTAGRAM_INVALID_MESSAGE =
  "Identifiant Instagram invalide (lettres, chiffres, points et _ uniquement)";
export const LINKEDIN_INVALID_MESSAGE = "Lien LinkedIn invalide (https://www.linkedin.com/…)";

export type SocialParseResult = { ok: true; value: string | null } | { ok: false; message: string };

const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/;
const INSTAGRAM_URL =
  /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i;

export function normalizeInstagramHandle(raw: string | null | undefined): SocialParseResult {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const fromUrl = INSTAGRAM_URL.exec(trimmed)?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/^@/, "").toLowerCase();

  if (
    !INSTAGRAM_HANDLE.test(candidate) ||
    candidate.startsWith(".") ||
    candidate.endsWith(".") ||
    candidate.includes("..")
  ) {
    return { ok: false, message: INSTAGRAM_INVALID_MESSAGE };
  }

  return { ok: true, value: candidate };
}

export function instagramProfileUrl(handle: string | null | undefined): string | null {
  const normalized = normalizeInstagramHandle(handle);
  if (!normalized.ok || !normalized.value) {
    return null;
  }
  return `https://www.instagram.com/${normalized.value}/`;
}

function isLinkedinHost(host: string) {
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

export function normalizeLinkedinUrl(raw: string | null | undefined): SocialParseResult {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, message: LINKEDIN_INVALID_MESSAGE };
  }

  const host = url.hostname.toLowerCase();
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.port ||
    !isLinkedinHost(host)
  ) {
    return { ok: false, message: LINKEDIN_INVALID_MESSAGE };
  }

  const path = url.pathname.replace(/\/+$/, "");
  if (!path) {
    return { ok: false, message: LINKEDIN_INVALID_MESSAGE };
  }

  return { ok: true, value: `https://${host}${path}` };
}
