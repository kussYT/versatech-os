import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseOllamaBaseUrl } from "@/ai/providers/ollama-url";

/**
 * Live Ollama check. CI stays green without a local daemon.
 * Enable with VERSATECH_AI_OLLAMA_LIVE=1 (and a running qwen3:1.7b).
 *
 * Hits the operator loopback OpenAI-compatible /v1 only — never OpenAI cloud.
 */
const LIVE = process.env.VERSATECH_AI_OLLAMA_LIVE === "1";
const ORIGIN = parseOllamaBaseUrl(
  process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
);

describe("optional live Ollama tool calling", () => {
  test(
    "qwen3:1.7b emits getTodayOverview when given VersaTech tool definitions",
    { skip: !LIVE || !ORIGIN, timeout: 60_000 },
    async () => {
      assert.ok(ORIGIN);
      assert.equal(ORIGIN.openaiCompatUrl.endsWith("/v1"), true);
      assert.equal(ORIGIN.openaiCompatUrl.includes("api.openai.com"), false);
      assert.equal(ORIGIN.openaiCompatUrl.includes("ollama.com"), false);

      const response = await fetch(`${ORIGIN.openaiCompatUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "qwen3:1.7b",
          messages: [
            {
              role: "user",
              content: "Qu'est-ce que j'ai de prévu aujourd'hui ?",
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "getTodayOverview",
                description:
                  "Briefing du jour civil Europe/Paris : tournée, KPI, relances, tâches.",
                parameters: {
                  type: "object",
                  properties: {},
                  additionalProperties: false,
                },
              },
            },
            {
              type: "function",
              function: {
                name: "webSearch",
                description: "Recherche web actuelle via SearXNG.",
                parameters: {
                  type: "object",
                  properties: { query: { type: "string" } },
                  required: ["query"],
                },
              },
            },
          ],
          tool_choice: "auto",
          stream: false,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      assert.equal(response.ok, true, `Ollama HTTP ${response.status}`);
      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            tool_calls?: Array<{ function?: { name?: string } }>;
          };
        }>;
      };
      const names =
        payload.choices?.[0]?.message?.tool_calls
          ?.map((call) => call.function?.name)
          .filter((name): name is string => typeof name === "string") ?? [];
      assert.equal(names.includes("getTodayOverview"), true, JSON.stringify(names));
    },
  );
});
