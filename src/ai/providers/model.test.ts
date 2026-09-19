import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_VERSATECH_AI_MODEL_BY_PROVIDER,
  DEFAULT_VERSATECH_AI_PROVIDER,
  getLanguageModel,
  isVersatechAiConfigured,
  resolveVersatechAiModelName,
  resolveVersatechAiProvider,
} from "./model";

const ENV_KEYS = [
  "VERSATECH_AI_PROVIDER",
  "VERSATECH_AI_MODEL",
  "OLLAMA_BASE_URL",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OLLAMA_API_KEY",
  "VERSATECH_AI_OLLAMA_URL",
] as const;

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function assertNoSecrets(serialized: string) {
  const secretEnv = [
    "AUTH_SECRET",
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "GITHUB_TOKEN",
  ] as const;
  for (const name of secretEnv) {
    const value = process.env[name]?.trim();
    if (value && value.length >= 8) {
      assert.equal(serialized.includes(value), false, `leaked ${name}`);
    }
    assert.equal(serialized.includes(name), false, `named ${name}`);
  }
  assert.equal(serialized.includes("sk-"), false);
  assert.equal(serialized.includes("ollama-cloud"), false);
  assert.equal(serialized.includes("api.openai.com"), false);
  assert.equal(serialized.includes("ollama.com"), false);
}

describe("VersaTech AI provider", () => {
  test("defaults to self-hosted Ollama qwen3:1.7b without an API key", () => {
    withEnv({}, () => {
      assert.equal(DEFAULT_VERSATECH_AI_PROVIDER, "ollama");
      assert.equal(DEFAULT_VERSATECH_AI_MODEL_BY_PROVIDER.ollama, "qwen3:1.7b");
      assert.equal(resolveVersatechAiProvider(), "ollama");
      assert.equal(resolveVersatechAiModelName("ollama"), "qwen3:1.7b");
      assert.equal(isVersatechAiConfigured(), true);
      assert.equal(getLanguageModel.length, 0);

      const model = getLanguageModel();
      assert.equal(typeof model, "object");
      assert.ok(model && typeof model === "object");
      assert.equal("id" in model && model.id, "ollama/qwen3:1.7b");
      assert.equal("url" in model && model.url, "http://127.0.0.1:11434/v1");
      assert.equal("apiKey" in model, false);
      assertNoSecrets(JSON.stringify(model));
    });
  });

  test("Ollama is selected and configured when only OLLAMA_BASE_URL is set", () => {
    withEnv(
      {
        VERSATECH_AI_PROVIDER: "ollama",
        VERSATECH_AI_MODEL: "qwen3:1.7b",
        OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      },
      () => {
        assert.equal(isVersatechAiConfigured(), true);
        const model = getLanguageModel();
        assert.ok(model && typeof model === "object" && "url" in model);
        assert.equal(model.url, "http://127.0.0.1:11434/v1");
        assert.equal("apiKey" in model, false);
      },
    );
  });

  test("user/model env aliases cannot override the operator Ollama host", () => {
    withEnv(
      {
        VERSATECH_AI_PROVIDER: "ollama",
        OLLAMA_BASE_URL: "http://127.0.0.1:11434",
        VERSATECH_AI_OLLAMA_URL: "http://evil.example:11434",
      },
      () => {
        const model = getLanguageModel();
        assert.ok(model && typeof model === "object" && "url" in model);
        assert.equal(model.url, "http://127.0.0.1:11434/v1");
        assert.equal(String(model.url).includes("evil.example"), false);
      },
    );
  });

  test("OLLAMA_BASE_URL is server-controlled and cannot be a public or RFC1918 host", () => {
    withEnv(
      {
        VERSATECH_AI_PROVIDER: "ollama",
        OLLAMA_BASE_URL: "http://10.1.2.3:11434",
        OPENAI_API_KEY: "sk-would-pay-if-we-fell-back",
      },
      () => {
        assert.equal(isVersatechAiConfigured(), false);
        assert.throws(() => getLanguageModel(), /not configured/);
      },
    );

    withEnv(
      {
        VERSATECH_AI_PROVIDER: "ollama",
        OLLAMA_BASE_URL: "https://api.openai.com/v1",
      },
      () => {
        assert.equal(isVersatechAiConfigured(), false);
        assert.throws(() => getLanguageModel(), /not configured/);
      },
    );
  });

  test("does not auto-fallback from Ollama to a paid cloud provider", () => {
    withEnv(
      {
        VERSATECH_AI_PROVIDER: "ollama",
        OLLAMA_BASE_URL: "http://192.168.1.9:11434",
        OPENAI_API_KEY: "sk-test-openai",
        ANTHROPIC_API_KEY: "sk-ant-test",
        GOOGLE_API_KEY: "AIzaTest",
      },
      () => {
        assert.equal(resolveVersatechAiProvider(), "ollama");
        assert.equal(isVersatechAiConfigured(), false);
        assert.throws(() => getLanguageModel(), /OLLAMA_BASE_URL/);
      },
    );
  });

  test("OpenAI / Anthropic / Google remain valid when their API key is set", () => {
    withEnv(
      {
        VERSATECH_AI_PROVIDER: "openai",
        VERSATECH_AI_MODEL: "gpt-5-mini",
        OPENAI_API_KEY: "sk-test-openai",
      },
      () => {
        assert.equal(isVersatechAiConfigured(), true);
        assert.equal(getLanguageModel(), "openai/gpt-5-mini");
        assertNoSecrets(String(getLanguageModel()));
      },
    );

    withEnv(
      {
        VERSATECH_AI_PROVIDER: "anthropic",
        VERSATECH_AI_MODEL: "claude-sonnet-4-6",
        ANTHROPIC_API_KEY: "sk-ant-test",
      },
      () => {
        assert.equal(isVersatechAiConfigured(), true);
        assert.equal(getLanguageModel(), "anthropic/claude-sonnet-4-6");
      },
    );

    withEnv(
      {
        VERSATECH_AI_PROVIDER: "google",
        VERSATECH_AI_MODEL: "gemini-2.5-flash",
        GOOGLE_GENERATIVE_AI_API_KEY: "AIzaAlt",
      },
      () => {
        assert.equal(isVersatechAiConfigured(), true);
        assert.equal(getLanguageModel(), "google/gemini-2.5-flash");
      },
    );
  });

  test("missing cloud API key fails closed and does not leak secrets", () => {
    withEnv({ VERSATECH_AI_PROVIDER: "openai" }, () => {
      assert.equal(isVersatechAiConfigured(), false);
      assert.throws(() => getLanguageModel(), /not configured/);
    });

    withEnv({ VERSATECH_AI_PROVIDER: "anthropic" }, () => {
      assert.equal(isVersatechAiConfigured(), false);
      assert.throws(() => getLanguageModel(), /ANTHROPIC_API_KEY/);
    });

    withEnv({ VERSATECH_AI_PROVIDER: "google" }, () => {
      assert.equal(isVersatechAiConfigured(), false);
      assert.throws(() => getLanguageModel(), /GOOGLE_API_KEY/);
    });
  });

  test("isVersatechAiConfigured never returns a key", () => {
    withEnv({}, () => {
      const configured = isVersatechAiConfigured();
      assert.equal(typeof configured, "boolean");
      assert.equal(configured, true);
    });
  });

  test("rejects an unknown provider and a model name with a provider prefix", () => {
    withEnv({ VERSATECH_AI_PROVIDER: "ollama-cloud" }, () => {
      assert.throws(() => resolveVersatechAiProvider(), /must be one of/);
      assert.equal(isVersatechAiConfigured(), false);
    });

    withEnv({ VERSATECH_AI_MODEL: "ollama/qwen3:1.7b" }, () => {
      assert.throws(() => resolveVersatechAiModelName("ollama"), /model name only/);
      assert.equal(isVersatechAiConfigured(), false);
    });
  });
});
