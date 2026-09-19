import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CONFIRM_ENDPOINT,
  CONFIRMATION_ALREADY_MESSAGE,
  CONFIRMATION_EXPIRED_MESSAGE,
  CONFIRMATION_FORBIDDEN_MESSAGE,
  CONFIRMATION_TITLE,
  WRITE_CONFIRMATION_MAX_PER_TURN,
  WRITE_TOOL_LABELS,
  buildConfirmRequestBody,
  canOpenWriteProposal,
  cancelProposedAction,
  confirmProposedAction,
  confirmRequestBodyKeys,
  confirmationResultFromResponse,
  createDoubleSubmitGuard,
  formatProposalDate,
  isCriticalToolName,
  isProposalExecutable,
  parseConfirmationPayload,
  shouldProposeWriteForCompanySearch,
  toolLabel,
  uniqueCompanyIdFromHits,
} from "@/components/ai/confirmation";
import {
  consumeEventStream,
  tokenFromSseData,
  tokensFromSseData,
} from "@/components/ai/chat-client";

const FOLLOW_UP_TOKEN = "opaque-follow-up-token";
const DUE_AT = "2026-09-20T08:00:00.000Z";

function followUpEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    type: "confirmation_required",
    token: FOLLOW_UP_TOKEN,
    toolName: "createFollowUp",
    humanSummary: ["Créer une relance"],
    dueAt: DUE_AT,
    companyName: "Nord Industrie",
    ...overrides,
  };
}

describe("libellés et politique de proposition", () => {
  test("maps createFollowUp to a French label and never leaves the internal name alone", () => {
    assert.equal(WRITE_TOOL_LABELS.createFollowUp, "Créer une relance");
    assert.equal(toolLabel("createFollowUp"), "Créer une relance");
    assert.equal(toolLabel("mysteryTool"), "Action métier");
    assert.notEqual(toolLabel("createFollowUp"), "createFollowUp");
    assert.equal(CONFIRMATION_TITLE, "Action proposée");
  });

  test("blocks CRITICAL tools from an executable confirmation card", () => {
    assert.equal(isCriticalToolName("updateQuoteStatus"), true);
    assert.equal(isCriticalToolName("createFollowUp"), false);
    const view = parseConfirmationPayload({
      type: "confirmation_required",
      token: "tok_quote",
      toolName: "updateQuoteStatus",
      humanSummary: ["Accepter le devis ALEX'CEPTION"],
      date: "2026-09-19",
    });
    assert.ok(view);
    assert.equal(view.executable, false);
    assert.equal(view.blockedReason, "FORBIDDEN");
    assert.equal(isProposalExecutable(view), false);
    assert.equal(view.label, "Mettre à jour un devis");
    assert.equal(view.humanSummary.includes("updateQuoteStatus"), false);
  });

  test("refuses a WRITE proposal when search hits are 0 or ambiguous", () => {
    assert.equal(shouldProposeWriteForCompanySearch([]), false);
    assert.equal(
      shouldProposeWriteForCompanySearch([
        { id: "co_1" },
        { id: "co_2" },
      ]),
      false,
    );
    assert.equal(uniqueCompanyIdFromHits([{ id: "co_1" }, { id: "co_1" }]), "co_1");
    assert.equal(shouldProposeWriteForCompanySearch([{ id: "co_1" }]), true);
    assert.equal(WRITE_CONFIRMATION_MAX_PER_TURN, 1);
    assert.equal(canOpenWriteProposal(0), true);
    assert.equal(canOpenWriteProposal(1), false);
  });
});

describe("parseConfirmationPayload", () => {
  test("parses Agent B confirmation_required SSE (humanSummary string + confirmToken)", () => {
    const view = parseConfirmationPayload({
      type: "confirmation_required",
      actionId: "act_1",
      toolName: "createFollowUp",
      humanSummary: "Créer une relance « Relance » pour l'entreprise co_1, jour civil 2026-09-20 (Europe/Paris), ISO 2026-09-20T08:00:00.000Z.",
      expiresAt: "2099-09-19T10:08:00.000Z",
      token: FOLLOW_UP_TOKEN,
    });
    assert.ok(view);
    assert.equal(view.token, FOLLOW_UP_TOKEN);
    assert.equal(view.actionId, "act_1");
    assert.equal(view.label, "Créer une relance");
    assert.notEqual(view.dateLabel, "non précisée");
    assert.equal(view.humanSummary.includes("createFollowUp"), false);
    assert.equal(view.executable, true);

    const fromConfirmToken = parseConfirmationPayload({
      proposal: {
        confirmToken: FOLLOW_UP_TOKEN,
        toolName: "createFollowUp",
        humanSummary: "Planifier une relance le 2026-09-20T08:00:00.000Z.",
        actionId: "act_2",
        expiresAt: "2099-09-19T10:08:00.000Z",
      },
    });
    assert.ok(fromConfirmToken);
    assert.equal(fromConfirmToken.token, FOLLOW_UP_TOKEN);
  });

  test("accepts confirmation_required SSE and JSON proposal/confirmation envelopes", () => {
    const fromSse = parseConfirmationPayload(followUpEnvelope());
    assert.ok(fromSse);
    assert.equal(fromSse.token, FOLLOW_UP_TOKEN);
    assert.equal(fromSse.label, "Créer une relance");
    assert.ok(fromSse.humanSummary.includes("Créer une relance"));
    assert.equal(fromSse.companyName, "Nord Industrie");
    assert.equal(fromSse.dateLabel, formatProposalDate(DUE_AT).label);
    assert.notEqual(fromSse.dateLabel, "non précisée");
    assert.equal(fromSse.executable, true);

    const fromProposalField = parseConfirmationPayload({
      message: "Confirmez cette relance.",
      proposal: {
        token: FOLLOW_UP_TOKEN,
        actionId: "act_1",
        toolName: "createFollowUp",
        dueAt: DUE_AT,
        companyName: "Nord Industrie",
      },
    });
    assert.ok(fromProposalField);
    assert.equal(fromProposalField.actionId, "act_1");

    const fromConfirmationField = parseConfirmationPayload({
      confirmation: {
        token: FOLLOW_UP_TOKEN,
        toolName: "createFollowUp",
        date: "2026-09-20",
      },
    });
    assert.ok(fromConfirmationField);
    assert.equal(fromConfirmationField.dateLabel, formatProposalDate("2026-09-20").label);
  });

  test("replaces an internal-only humanSummary with the French tool label", () => {
    const view = parseConfirmationPayload(
      followUpEnvelope({ humanSummary: ["createFollowUp"] }),
    );
    assert.ok(view);
    assert.deepEqual(view.humanSummary.filter((line) => line === "createFollowUp"), []);
    assert.ok(view.humanSummary.includes("Créer une relance"));
  });

  test("ignores LLM confirmed:true and toolName+args without an opaque token", () => {
    assert.equal(
      parseConfirmationPayload({
        type: "confirmation_required",
        confirmed: true,
        toolName: "createFollowUp",
        args: { companyId: "co_1", dueAt: DUE_AT },
      }),
      null,
    );
    assert.equal(
      parseConfirmationPayload({
        confirmed: true,
        confirmation: { confirmed: true, token: true },
        toolName: "createFollowUp",
      }),
      null,
    );
    assert.equal(
      parseConfirmationPayload({
        type: "tool-call",
        toolName: "createFollowUp",
        args: { companyId: "co_1" },
      }),
      null,
    );
  });

  test("marks an expired proposal as not executable", () => {
    const view = parseConfirmationPayload(
      followUpEnvelope({ expiresAt: "2000-01-01T00:00:00.000Z" }),
    );
    assert.ok(view);
    assert.equal(view.executable, false);
    assert.equal(view.blockedReason, "EXPIRED");
  });
});

describe("POST /api/ai/actions/confirm body", () => {
  test("sends only the opaque { token } — never toolName, args, actorId, or actionId", () => {
    const body = JSON.parse(
      buildConfirmRequestBody({
        token: FOLLOW_UP_TOKEN,
        actionId: "act_1",
        toolName: "createFollowUp",
        args: { companyId: "co_hacked", dueAt: "1999-01-01T00:00:00.000Z" },
        actorId: "user_from_model",
        confirmed: true,
      }),
    ) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body), ["token"]);
    assert.equal(body.token, FOLLOW_UP_TOKEN);
    assert.equal("actionId" in body, false);
    assert.equal("toolName" in body, false);
    assert.equal("args" in body, false);
    assert.equal("actorId" in body, false);
    assert.equal("confirmed" in body, false);
    assert.deepEqual(confirmRequestBodyKeys({ token: FOLLOW_UP_TOKEN }), ["token"]);
  });

  test("UI cancel does not fetch confirm; confirm posts credentials cookies to the confirm route", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ message: "Relance créée." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    cancelProposedAction();
    assert.equal(calls.length, 0);

    const result = await confirmProposedAction(
      {
        token: FOLLOW_UP_TOKEN,
        actionId: "act_1",
        toolName: "createFollowUp",
        args: { companyId: "co_hacked" },
        actorId: "user_from_model",
      },
      fetchFn,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.message, "Relance créée.");
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, CONFIRM_ENDPOINT);
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.credentials, "include");
    const sent = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    assert.deepEqual(Object.keys(sent), ["token"]);
    assert.equal(sent.token, FOLLOW_UP_TOKEN);
    assert.equal("actionId" in sent, false);
    assert.equal("args" in sent, false);
    assert.equal("actorId" in sent, false);
  });

  test("maps a successful confirm payload to a French outcome, not the tool name", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          actionId: "act_1",
          toolName: "createFollowUp",
          data: { followUpId: "fu_1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const result = await confirmProposedAction({ token: FOLLOW_UP_TOKEN }, fetchFn);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.message, "Relance créée.");
      assert.equal(result.message.includes("createFollowUp"), false);
    }
  });

  test("maps completeFollowUp confirm success to Relance terminée, not Relance créée", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          actionId: "act_2",
          toolName: "completeFollowUp",
          data: { followUpId: "fu_1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const result = await confirmProposedAction({ token: FOLLOW_UP_TOKEN }, fetchFn);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.message, "Relance terminée.");
    }
  });

  test("expired confirm responses tell the operator to reformulate", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { code: "EXPIRED" } }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      });
    const result = await confirmProposedAction({ token: FOLLOW_UP_TOKEN }, fetchFn);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "expired");
      assert.equal(result.message, CONFIRMATION_EXPIRED_MESSAGE);
    }
  });

  test("double-click guard runs the confirm function once, and 409 ALREADY_CONSUMED is consumed", async () => {
    const guard = createDoubleSubmitGuard();
    let runs = 0;
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = guard.run(async () => {
      runs += 1;
      await pending;
      return "ok";
    });
    const second = guard.run(async () => {
      runs += 1;
      return "nope";
    });
    assert.equal(guard.isLocked(), true);
    release();
    assert.equal(await first, "ok");
    assert.equal(await second, undefined);
    assert.equal(runs, 1);

    const replay = await confirmationResultFromResponse(
      new Response(JSON.stringify({ error: { code: "ALREADY_CONSUMED" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.reason, "consumed");
      assert.equal(replay.message, CONFIRMATION_ALREADY_MESSAGE);
    }

    const source = readFileSync(
      path.join(process.cwd(), "src", "components", "ai", "confirmation.ts"),
      "utf8",
    );
    assert.match(source, /export function createDoubleSubmitGuard/);
    assert.match(source, /code === "ALREADY_CONSUMED"/);
  });
});

describe("SSE confirmation_required", () => {
  test("does not skip confirmation_required as a tool event", () => {
    const token = tokenFromSseData(
      JSON.stringify(followUpEnvelope({ message: "Confirmez." })),
    );
    assert.equal(token.kind, "confirmation");
    if (token.kind === "confirmation") {
      assert.equal(token.proposal.token, FOLLOW_UP_TOKEN);
      assert.equal(token.proposal.label, "Créer une relance");
    }
    assert.equal(tokenFromSseData('{"toolName":"getTodayOverview"}').kind, "skip");
  });

  test("consumes deltas plus a confirmation_required event without posting confirm", async () => {
    const body = [
      `data: ${JSON.stringify({ type: "delta", text: "Voici la relance." })}\n\n`,
      `data: ${JSON.stringify(followUpEnvelope())}\n\n`,
      `data: ${JSON.stringify({ type: "done", message: "Voici la relance." })}\n\n`,
    ].join("");
    const response = new Response(body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
    const proposals: string[] = [];
    const streamed = await consumeEventStream(
      response,
      () => {},
      (proposal) => {
        proposals.push(proposal.token);
      },
    );
    assert.equal(streamed.text, "Voici la relance.");
    assert.ok(streamed.proposal);
    assert.equal(streamed.proposal?.token, FOLLOW_UP_TOKEN);
    assert.deepEqual(proposals, [FOLLOW_UP_TOKEN]);
    cancelProposedAction();
  });

  test("keeps text and proposal when a done event carries both", () => {
    const tokens = tokensFromSseData(
      JSON.stringify({
        type: "done",
        message: "Confirmez cette relance.",
        proposal: {
          token: FOLLOW_UP_TOKEN,
          toolName: "createFollowUp",
          dueAt: DUE_AT,
        },
      }),
    );
    assert.equal(tokens.some((token) => token.kind === "replace"), true);
    assert.equal(tokens.some((token) => token.kind === "confirmation"), true);
  });
});

describe("ALEX'CEPTION quote is not an executable card", () => {
  test("accept quote payload cannot produce a confirmable card", () => {
    const view = parseConfirmationPayload({
      type: "confirmation_required",
      token: "tok_alex",
      toolName: "updateQuoteStatus",
      args: { quoteId: "qu_alexception", status: "ACCEPTED", companyName: "ALEX'CEPTION" },
      humanSummary: ["Accepte le devis ALEX'CEPTION."],
      confirmed: true,
    });
    assert.ok(view);
    assert.equal(view.executable, false);
    assert.equal(view.blockedReason, "FORBIDDEN");
    assert.equal(view.label, "Mettre à jour un devis");
    const confirmBody = JSON.parse(
      buildConfirmRequestBody({
        token: view.token,
        toolName: view.toolName,
        args: { status: "ACCEPTED" },
      }),
    ) as Record<string, unknown>;
    assert.deepEqual(Object.keys(confirmBody), ["token"]);
    assert.equal(CONFIRMATION_FORBIDDEN_MESSAGE.length > 0, true);
  });
});
