import {
  DEFAULT_FOLLOW_UP_TITLE,
  FOLLOW_UP_NOT_PENDING_MESSAGE,
  type FollowUpStatus,
} from "./schema";

export function resolveFollowUpTitle(title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : DEFAULT_FOLLOW_UP_TITLE;
}

export type CompleteFollowUpDecision =
  | { kind: "noop" }
  | { kind: "complete" }
  | { kind: "reject"; message: string };

export function decideCompleteFollowUp(status: FollowUpStatus): CompleteFollowUpDecision {
  if (status === "COMPLETED") {
    return { kind: "noop" };
  }
  if (status !== "PENDING") {
    return { kind: "reject", message: FOLLOW_UP_NOT_PENDING_MESSAGE };
  }
  return { kind: "complete" };
}
