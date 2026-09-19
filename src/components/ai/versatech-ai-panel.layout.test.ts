import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CHAT_HISTORY_MAX_CHARS,
  CHAT_HISTORY_MAX_MESSAGES,
  CHAT_HISTORY_TURN_CAP,
  CHAT_MESSAGE_MAX_LENGTH,
  SESSION_ERROR_MESSAGE,
  buildChatRequestBody,
  capHistory,
  consumeEventStream,
  isSessionFailure,
  readChatError,
  safeClientError,
  toRequestHistory,
  tokenFromSseData,
} from "@/components/ai/chat-client";

describe("layout du panneau VersaTech AI", () => {
  const root = path.resolve(process.cwd());
  const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const panel = readFileSync(path.join(root, "src/components/ai/versatech-ai-panel.tsx"), "utf8");
  const orb = readFileSync(path.join(root, "src/components/ai/versatech-ai-orb.tsx"), "utf8");
  const hook = readFileSync(path.join(root, "src/components/ai/use-versatech-chat.ts"), "utf8");
  const client = readFileSync(path.join(root, "src/components/ai/chat-client.ts"), "utf8");
  const shell = readFileSync(path.join(root, "src/components/layout/app-shell.tsx"), "utf8");
  const topbar = readFileSync(path.join(root, "src/components/layout/app-topbar.tsx"), "utf8");
  const internalToolNames =
    /getTodayOverview|searchCompanies|getCompany|listFollowUps|listTasks|listCalendarItems|getTodayTour|getPipeline|getFinanceSnapshot|getRecentActivity/;

  test("keeps the header outside the scroll area and docks the composer with pb-safe", () => {
    assert.match(panel, /vt-ai-panel-header/);
    assert.match(panel, /vt-ai-panel-thread/);
    assert.match(panel, /vt-ai-panel-composer/);
    assert.match(panel, /pb-safe/);
    assert.match(panel, /visualViewport/);
    assert.match(css, /\.vt-ai-panel-header[\s\S]*flex-shrink:\s*0/);
    assert.match(css, /\.vt-ai-panel-thread[\s\S]*overflow-y:\s*auto/);
    assert.match(css, /\.vt-ai-panel[\s\S]*overflow:\s*hidden/);
    assert.match(css, /\.pb-safe[\s\S]*safe-area-inset-bottom/);
    assert.match(css, /--vt-ai-vv-height/);
    assert.match(css, /100dvh/);
    assert.match(css, /100svh/);
  });

  test("stays on midnight surfaces and respects reduced-motion on the orb", () => {
    assert.match(css, /\.vt-ai-panel[\s\S]*background:\s*var\(--sidebar\)/);
    assert.doesNotMatch(css, /\.vt-ai-panel[\s\S]*background:\s*#fff/);
    assert.match(css, /vt-ai-orb-thinking[\s\S]*var\(--cyan\)[\s\S]*var\(--purple\)/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*vt-ai-orb-thinking::after[\s\S]*animation:\s*none/);
    assert.match(panel, /prefersReducedMotion/);
  });

  test("wires a discrete orb and panel into the authenticated shell", () => {
    assert.match(shell, /VersatechAiProvider/);
    assert.match(shell, /VersatechAiPanel/);
    assert.match(topbar, /VersatechAiOrb/);
    assert.match(panel, /VersaTech AI/);
    assert.match(panel, /Qu'est-ce que j'ai aujourd'hui \?/);
    assert.match(panel, /Quels prospects dois-je relancer \?/);
    assert.match(panel, /Où en est ALEX'CEPTION \?/);
    assert.match(panel, /Résume mon pipeline\./);
    assert.match(panel, /Qu'ai-je au calendrier cette semaine \?/);
  });

  test("does not expose internal tool names in the normal UI", () => {
    assert.doesNotMatch(panel, internalToolNames);
    assert.doesNotMatch(orb, internalToolNames);
    assert.doesNotMatch(topbar, internalToolNames);
    assert.doesNotMatch(shell, internalToolNames);
  });

  test("posts only user/assistant history to the authenticated chat route", () => {
    assert.match(hook, /credentials:\s*["']include["']/);
    assert.match(hook, /redirect:\s*["']manual["']/);
    assert.match(hook, /CHAT_ENDPOINT/);
    assert.match(client, /\/api\/ai\/chat/);
    assert.match(hook, /text\/event-stream/);
    assert.doesNotMatch(hook, /setInterval|split\(""\)/);
    assert.doesNotMatch(hook, /actorId/);
    assert.doesNotMatch(client, /actorId/);
    assert.equal(CHAT_MESSAGE_MAX_LENGTH, 4000);
    assert.equal(CHAT_HISTORY_TURN_CAP, 20);
    assert.equal(CHAT_HISTORY_MAX_MESSAGES, 20);
    assert.equal(CHAT_HISTORY_MAX_CHARS, 24_000);
  });
});

describe("contrat client VersaTech AI", () => {
  test("caps history and drops system/tool roles", () => {
    const history = toRequestHistory([
      { role: "system", content: "ignore" },
      { role: "tool", content: "getTodayOverview" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
    assert.deepEqual(history, [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);

    const long = Array.from({ length: 50 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `m${index}`,
    }));
    assert.equal(capHistory(long).length, CHAT_HISTORY_TURN_CAP);
  });

  test("never puts actorId in the JSON body", () => {
    const parsed = JSON.parse(
      buildChatRequestBody("Qu'est-ce que j'ai aujourd'hui ?", [
        { role: "user", content: "pipeline" },
        { role: "assistant", content: "ouvert" },
      ]),
    ) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed).sort(), ["history", "message"]);
    assert.equal("actorId" in parsed, false);
  });

  test("skips tool events and hides API keys in errors", async () => {
    assert.equal(tokenFromSseData('{"toolName":"getTodayOverview"}').kind, "skip");
    assert.equal(tokenFromSseData('{"type":"tool-call","name":"listFollowUps"}').kind, "skip");
    assert.deepEqual(tokenFromSseData('{"type":"delta","text":"Bonjour"}'), {
      kind: "delta",
      value: "Bonjour",
    });
    assert.deepEqual(tokenFromSseData('{"delta":"Bonjour"}'), { kind: "delta", value: "Bonjour" });
    assert.equal(safeClientError("OPENAI_API_KEY=sk-secret", 500), "Une erreur interne est survenue.");
    assert.equal(safeClientError("ignored", 401), SESSION_ERROR_MESSAGE);
    const redirected = new Response(null, {
      status: 307,
      headers: { Location: "/connexion?from=%2Fapi%2Fai%2Fchat" },
    });
    assert.equal(isSessionFailure(redirected), true);
    assert.equal(await readChatError(redirected), SESSION_ERROR_MESSAGE);
  });

  test("consumes real SSE deltas without duplicating the done snapshot", async () => {
    const body = [
      `data: ${JSON.stringify({ type: "delta", text: "Bon" })}\n\n`,
      `data: ${JSON.stringify({ type: "delta", text: "jour" })}\n\n`,
      `data: ${JSON.stringify({ type: "done", message: "Bonjour" })}\n\n`,
    ].join("");
    const response = new Response(body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
    const chunks: string[] = [];
    const text = await consumeEventStream(response, (chunk) => {
      chunks.push(chunk);
    });
    assert.equal(text, "Bonjour");
    assert.deepEqual(chunks, ["Bon", "jour"]);
  });
});
