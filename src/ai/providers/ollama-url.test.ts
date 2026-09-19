import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isLoopbackSearxngHostname } from "@/lib/services/web-search/ssrf";
import {
  DEFAULT_OLLAMA_BASE_URL,
  parseOllamaBaseUrl,
  resolveOllamaOrigin,
} from "./ollama-url";

describe("Ollama operator URL", () => {
  test("defaults to the production loopback origin", () => {
    assert.equal(DEFAULT_OLLAMA_BASE_URL, "http://127.0.0.1:11434");
    const origin = parseOllamaBaseUrl(DEFAULT_OLLAMA_BASE_URL);
    assert.ok(origin);
    assert.equal(origin?.origin, "http://127.0.0.1:11434");
    assert.equal(origin?.openaiCompatUrl, "http://127.0.0.1:11434/v1");
    assert.equal(origin?.hostname, "127.0.0.1");
    assert.equal(isLoopbackSearxngHostname(origin?.hostname), true);
  });

  test("accepts loopback hosts and strips a redundant /v1 path", () => {
    const alreadyV1 = parseOllamaBaseUrl("http://127.0.0.1:11434/v1");
    assert.equal(alreadyV1?.openaiCompatUrl, "http://127.0.0.1:11434/v1");

    const slash = parseOllamaBaseUrl("http://127.0.0.1:11434/");
    assert.equal(slash?.openaiCompatUrl, "http://127.0.0.1:11434/v1");

    const localhost = parseOllamaBaseUrl("http://localhost:11434");
    assert.ok(localhost);
    assert.equal(localhost?.openaiCompatUrl, "http://localhost:11434/v1");

    const v6 = parseOllamaBaseUrl("http://[::1]:11434");
    assert.ok(v6);
    assert.equal(v6?.openaiCompatUrl, "http://[::1]:11434/v1");

    const mapped = parseOllamaBaseUrl("http://[::ffff:127.0.0.1]:11434");
    assert.ok(mapped);
  });

  test("resolveOllamaOrigin uses the default when the env value is empty", () => {
    const resolved = resolveOllamaOrigin(undefined);
    assert.equal(resolved?.openaiCompatUrl, "http://127.0.0.1:11434/v1");
    assert.equal(resolveOllamaOrigin("   ")?.openaiCompatUrl, "http://127.0.0.1:11434/v1");
  });

  test("rejects public, RFC1918, credentials, and non-http(s) operator URLs", () => {
    const blocked = [
      "",
      "http://ollama.example.com:11434",
      "https://api.openai.com/v1",
      "https://ollama.com",
      "http://10.1.2.3:11434",
      "http://172.16.0.1:11434",
      "http://192.168.1.1:11434",
      "http://169.254.169.254/",
      "http://[fe80::1]:11434",
      "file:///etc/passwd",
      "ftp://127.0.0.1:11434",
      "http://user:pass@127.0.0.1:11434",
      "http://127.0.0.1:11434/api/chat",
      "http://127.0.0.1:11434?redirect=1",
      "http://127.0.0.1:11434#evil",
    ];
    for (const raw of blocked) {
      assert.equal(parseOllamaBaseUrl(raw), null, raw);
    }
  });

  test("does not treat a model-supplied host as a valid operator origin", () => {
    assert.equal(parseOllamaBaseUrl("http://evil.example:11434"), null);
    assert.equal(parseOllamaBaseUrl("http://0.0.0.0:11434"), null);
  });
});
