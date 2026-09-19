"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  CONFIRMATION_EXPIRED_MESSAGE,
  CONFIRMATION_FORBIDDEN_MESSAGE,
  CONFIRMATION_TITLE,
  isProposalExecutable,
  type ConfirmationView,
} from "@/components/ai/confirmation";
import { cn } from "@/lib/cn";

export type ConfirmationCardStatus = "idle" | "confirming" | "success" | "error" | "expired";

export function VersatechAiConfirmationCard({
  proposal,
  status,
  message,
  onConfirm,
  onCancel,
}: {
  proposal: ConfirmationView;
  status: ConfirmationCardStatus;
  message?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const expired = status === "expired" || proposal.blockedReason === "EXPIRED";
  const forbidden = proposal.blockedReason === "FORBIDDEN";
  const success = status === "success";
  const confirming = status === "confirming";
  const executable = isProposalExecutable(proposal) && !expired && !forbidden && !success;
  const busy = confirming;
  const showConfirm = executable && !success;
  const statusMessage = success
    ? message
    : expired
      ? CONFIRMATION_EXPIRED_MESSAGE
      : forbidden
        ? CONFIRMATION_FORBIDDEN_MESSAGE
        : status === "error"
          ? message
          : null;

  return (
    <article
      className="vt-ai-confirm-card"
      aria-labelledby={titleId}
      aria-busy={busy}
      aria-live="polite"
    >
      <h3 id={titleId} className="vt-ai-confirm-title">
        {CONFIRMATION_TITLE}
      </h3>

      {success ? (
        <p className="vt-ai-confirm-result" role="status">
          {statusMessage}
        </p>
      ) : (
        <>
          <ul className="vt-ai-confirm-summary">
            {proposal.humanSummary.map((line, index) => (
              <li key={`${index}:${line}`}>{line}</li>
            ))}
          </ul>
          <p className="vt-ai-confirm-date">
            <span className="vt-ai-confirm-date-label">Date</span>
            <span>{proposal.dateLabel}</span>
          </p>
          {statusMessage ? (
            <p
              className={cn(
                "vt-ai-confirm-result",
                (expired || forbidden || status === "error") && "vt-ai-confirm-result-error",
              )}
              role="alert"
            >
              {statusMessage}
            </p>
          ) : null}
        </>
      )}

      {!success ? (
        <div className="vt-ai-confirm-actions pb-safe">
          <Button
            type="button"
            variant="secondary"
            className="vt-ai-confirm-button"
            disabled={busy}
            onClick={onCancel}
          >
            Annuler
          </Button>
          {showConfirm ? (
            <Button
              type="button"
              className="vt-ai-confirm-button"
              disabled={busy}
              onClick={onConfirm}
            >
              {confirming ? "Confirmation…" : "Confirmer"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
