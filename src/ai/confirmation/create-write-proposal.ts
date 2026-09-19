import "server-only";

import { WRITE_PROPOSAL_TTL_MS } from "./intent";
import { createWriteProposal as signWriteProposal } from "./proposal";
import type { CreateRegistryWriteProposalInput, WriteProposal } from "./types";

export { WRITE_PROPOSAL_TTL_MS };

/**
 * Registry adapter (Agent C): same signing as `createWriteProposal({ actor, toolName, args })`.
 * Returns the full server proposal. Do not send the session user id to the model.
 */
export async function createRegistryWriteProposal(
  input: CreateRegistryWriteProposalInput,
): Promise<WriteProposal> {
  const sessionUserId = input.actorId;
  const signed = await signWriteProposal({
    actor: { id: sessionUserId },
    toolName: input.toolName,
    args: input.args,
    humanSummary: input.humanSummary,
  });

  if (!signed.ok) {
    throw new Error(signed.code);
  }

  return {
    toolName: signed.view.toolName,
    args: signed.args as Record<string, unknown>,
    humanSummary: signed.view.humanSummary,
    actorId: sessionUserId,
    requestId: input.requestId,
    issuedAt: signed.createdAt,
    expiresAt: signed.view.expiresAt,
    actionId: signed.view.actionId,
    confirmToken: signed.token,
    token: signed.token,
  };
}

/** @deprecated Import `createWriteProposal` from `@/ai/confirmation` (signed Result API). */
export const createWriteProposal = createRegistryWriteProposal;
