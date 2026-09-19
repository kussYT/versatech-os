import "server-only";

import type { MastraModelConfig, OpenAICompatibleConfig } from "@mastra/core/llm";

import {
  DEFAULT_OLLAMA_BASE_URL,
  resolveOllamaOrigin,
} from "@/ai/providers/ollama-url";

/**
 * Swappable LLM selection for VersaTech AI.
 *
 * Mastra 1.67 has no local `ollama/…` models.dev id (only paid `ollama-cloud`).
 * Local Ollama is Mastra's native `OpenAICompatibleConfig`: `{ id, url }` so
 * `ModelRouterLanguageModel` calls `createOpenAICompatible` against the
 * operator loopback `/v1` — never api.openai.com, never ollama.com.
 *
 * Cloud providers stay optional explicit config. There is no automatic
 * fallback from Ollama to a paid API. Never returns API keys or env secrets.
 */

const ALLOWED_PROVIDERS = ["ollama", "openai", "anthropic", "google"] as const;

export type VersatechAiProvider = (typeof ALLOWED_PROVIDERS)[number];

export const DEFAULT_VERSATECH_AI_PROVIDER: VersatechAiProvider = "ollama";
export const DEFAULT_VERSATECH_AI_MODEL_BY_PROVIDER: Record<VersatechAiProvider, string> = {
  ollama: "qwen3:1.7b",
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-4-6",
  google: "gemini-2.5-flash",
};

const API_KEY_ENV_BY_PROVIDER: Record<
  Exclude<VersatechAiProvider, "ollama">,
  readonly string[]
> = {
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
  const raw = readEnv("VERSATECH_AI_PROVIDER") ?? DEFAULT_VERSATECH_AI_PROVIDER;
  const normalized = raw.toLowerCase();
  if (!isAllowedProvider(normalized)) {
    throw new Error(
      `VERSATECH_AI_PROVIDER must be one of: ${ALLOWED_PROVIDERS.join(", ")}.`,
    );
  }
  return normalized;
}

export function resolveVersatechAiModelName(provider: VersatechAiProvider): string {
  const model =
    readEnv("VERSATECH_AI_MODEL") ?? DEFAULT_VERSATECH_AI_MODEL_BY_PROVIDER[provider];
  if (model.includes("/") || model.includes("\\") || model.includes(" ")) {
    throw new Error("VERSATECH_AI_MODEL must be a model name only (no provider prefix).");
  }
  return model;
}

function hasCloudApiKey(provider: Exclude<VersatechAiProvider, "ollama">): boolean {
  return API_KEY_ENV_BY_PROVIDER[provider].some((name) => Boolean(readEnv(name)));
}

function ollamaOriginOrNull() {
  return resolveOllamaOrigin(readEnv("OLLAMA_BASE_URL") ?? DEFAULT_OLLAMA_BASE_URL);
}

function isProviderReady(provider: VersatechAiProvider): boolean {
  if (provider === "ollama") {
    return ollamaOriginOrNull() !== null;
  }
  return hasCloudApiKey(provider);
}

/** True when the selected provider can run. Never returns a key or base URL. */
export function isVersatechAiConfigured(): boolean {
  try {
    const provider = resolveVersatechAiProvider();
    resolveVersatechAiModelName(provider);
    return isProviderReady(provider);
  } catch {
    return false;
  }
}

function ollamaLanguageModel(
  modelName: string,
): OpenAICompatibleConfig {
  const origin = ollamaOriginOrNull();
  if (!origin) {
    throw new Error(
      'VersaTech AI is not configured: set OLLAMA_BASE_URL to a loopback origin (e.g. "http://127.0.0.1:11434").',
    );
  }
  return {
    id: `ollama/${modelName}`,
    url: origin.openaiCompatUrl,
  };
}

/**
 * Mastra model config. Resolved lazily so a missing cloud key does not crash
 * the CRM at import — only when the agent is used. Ollama needs no API key.
 */
export function getLanguageModel(): MastraModelConfig {
  const provider = resolveVersatechAiProvider();
  const modelName = resolveVersatechAiModelName(provider);

  if (provider === "ollama") {
    return ollamaLanguageModel(modelName);
  }

  if (!hasCloudApiKey(provider)) {
    const names = API_KEY_ENV_BY_PROVIDER[provider].join(" or ");
    throw new Error(
      `VersaTech AI is not configured: set ${names} for provider "${provider}".`,
    );
  }

  return `${provider}/${modelName}`;
}
