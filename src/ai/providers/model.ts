import "server-only";

/**
 * Swappable LLM selection for VersaTech AI.
 *
 * Mastra 1.67's model router lives in `@mastra/core` (no extra provider SDK).
 * Change provider/model via env without rewriting services or tools.
 * Never returns API keys; Mastra reads them from process.env at call time.
 */

const ALLOWED_PROVIDERS = ["openai", "anthropic", "google"] as const;

export type VersatechAiProvider = (typeof ALLOWED_PROVIDERS)[number];

export type VersatechLanguageModelId = `${VersatechAiProvider}/${string}`;

const DEFAULT_PROVIDER: VersatechAiProvider = "openai";

const DEFAULT_MODEL_BY_PROVIDER: Record<VersatechAiProvider, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-4-6",
  google: "gemini-2.5-flash",
};

const API_KEY_ENV_BY_PROVIDER: Record<VersatechAiProvider, readonly string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isAllowedProvider(value: string): value is VersatechAiProvider {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(value);
}

export function resolveVersatechAiProvider(): VersatechAiProvider {
  const raw = readEnv("VERSATECH_AI_PROVIDER") ?? DEFAULT_PROVIDER;
  const normalized = raw.toLowerCase();
  if (!isAllowedProvider(normalized)) {
    throw new Error(
      `VERSATECH_AI_PROVIDER must be one of: ${ALLOWED_PROVIDERS.join(", ")}.`,
    );
  }
  return normalized;
}

export function resolveVersatechAiModelName(
  provider: VersatechAiProvider,
): string {
  const model = readEnv("VERSATECH_AI_MODEL") ?? DEFAULT_MODEL_BY_PROVIDER[provider];
  if (model.includes("/") || model.includes("\\") || model.includes(" ")) {
    throw new Error(
      "VERSATECH_AI_MODEL must be a model name only (no provider prefix).",
    );
  }
  return model;
}

function hasProviderApiKey(provider: VersatechAiProvider): boolean {
  return API_KEY_ENV_BY_PROVIDER[provider].some((name) => Boolean(readEnv(name)));
}

/** True when the configured provider has an API key. Never returns the key. */
export function isVersatechAiConfigured(): boolean {
  try {
    return hasProviderApiKey(resolveVersatechAiProvider());
  } catch {
    return false;
  }
}

/**
 * Mastra model-router id (`provider/model`). Resolved lazily so missing keys
 * do not crash the CRM at import time — only when the agent is actually used.
 */
export function getLanguageModel(): VersatechLanguageModelId {
  const provider = resolveVersatechAiProvider();
  if (!hasProviderApiKey(provider)) {
    const names = API_KEY_ENV_BY_PROVIDER[provider].join(" or ");
    throw new Error(
      `VersaTech AI is not configured: set ${names} for provider "${provider}".`,
    );
  }
  return `${provider}/${resolveVersatechAiModelName(provider)}`;
}
