import "server-only";

/**
 * Server confirmation protocol (ADR-014).
 * The LLM cannot confirm. Signed ActionIntent + actor HMAC + TTL + single-use.
 */
export {
  ACTION_INTENT_TTL_SECONDS,
  CONFIRM_TOKEN_AUDIENCE,
  CONFIRM_TOKEN_ISSUER,
  CONFIRM_TOKEN_TYP,
  WRITE_PROPOSAL_TTL_MS,
  bindIntentToActor,
  computeActorBinding,
  signActionIntent,
  verifySignedIntent,
  type ActionIntent,
  type SignedActionIntent,
} from "./intent";
export {
  createWriteProposal,
  type CreateWriteProposalInput,
  type CreateWriteProposalResult,
  type WriteProposalView,
} from "./proposal";
export {
  createRegistryWriteProposal,
  WRITE_PROPOSAL_TTL_MS as REGISTRY_WRITE_PROPOSAL_TTL_MS,
} from "./create-write-proposal";
export {
  writeProposalSchema,
  type WriteProposal,
  type CreateRegistryWriteProposalInput,
  type CreateWriteProposalInput as CreateRegistryWriteProposalLegacyInput,
} from "./types";
export {
  CONFIRM_ERROR_MESSAGES,
  CONFIRM_TOKEN_MAX_LENGTH,
  confirmActionBodySchema,
  confirmWriteAction,
  consumeWriteProposal,
  extractConfirmToken,
  handleConfirmActionRequest,
  type ConfirmWriteResult,
} from "./confirm";
export {
  executeConfirmedWrite,
  toConfirmedWriteInput,
  type ConfirmedWriteInput,
  type ExecuteConfirmedWrite,
} from "./execute";
export {
  CONFIRMABLE_WRITE_TOOL_NAMES,
  humanSummaryForWrite,
  isConfirmableWriteToolName,
  isCriticalToolName,
  parseConfirmableWriteArgs,
  type CompleteFollowUpWriteArgs,
  type ConfirmableWriteArgs,
  type ConfirmableWriteToolName,
  type CreateFollowUpWriteArgs,
  type CreateTaskWriteArgs,
} from "./tools";
