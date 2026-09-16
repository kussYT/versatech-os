"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { completeFollowUp } from "@/actions/follow-ups";
import { RescheduleFollowUpDialog } from "@/components/follow-ups/reschedule-follow-up-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import { FOLLOW_UP_STATUS_LABELS } from "@/lib/crm/constants";
import { formatDateTime } from "@/lib/crm/form-data";
import { INTERACTION_TYPE_LABELS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { FollowUpBucket, FollowUpListItem } from "@/lib/queries/follow-ups";
import type { InteractionType } from "@/generated/prisma/client";

type FollowUpItemProps = {
  followUp: FollowUpListItem;
  bucket: FollowUpBucket;
};

export function FollowUpItem({ followUp, bucket }: FollowUpItemProps) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    completeFollowUp,
    idleActionResult,
  );
  const pendingFollowUp = followUp.status === "PENDING";

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-background/90 p-4",
        bucket === "overdue" && "border-danger/40",
        bucket === "today" && "border-primary/40",
        bucket === "completed" && "opacity-70",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/entreprises/${followUp.company.id}`}
            className="text-body font-medium text-foreground hover:text-primary"
          >
            {followUp.company.name}
          </Link>
          <p
            className={cn(
              "mt-1 font-mono text-meta",
              bucket === "overdue" ? "text-danger" : bucket === "today" ? "text-cyan" : "text-muted",
            )}
          >
            {formatDateTime(followUp.dueAt)}
          </p>
          <p className="mt-2 text-body text-foreground">{followUp.title}</p>
          <p className="mt-1 text-meta text-muted">
            {FOLLOW_UP_STATUS_LABELS[followUp.status]}
          </p>
          {followUp.phone || followUp.email ? (
            <p className="mt-2 text-meta text-muted">
              {followUp.phone ? (
                <a href={`tel:${followUp.phone}`} className="text-primary hover:text-primary-hover">
                  {followUp.phone}
                </a>
              ) : null}
              {followUp.phone && followUp.email ? " · " : null}
              {followUp.email ? (
                <a href={`mailto:${followUp.email}`} className="text-primary hover:text-primary-hover">
                  {followUp.email}
                </a>
              ) : null}
            </p>
          ) : null}
          {followUp.lastInteraction ? (
            <p className="mt-1 text-meta text-faint">
              {interactionLabel(followUp.lastInteraction.type)}
              {" · "}
              {formatDateTime(followUp.lastInteraction.occurredAt)}
            </p>
          ) : null}
          {state.message && !state.ok ? (
            <p className="mt-2 text-meta text-danger" role="alert">
              {state.message}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/entreprises/${followUp.company.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Ouvrir
          </Link>
          {pendingFollowUp ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setRescheduleOpen(true)}>
                Reporter
              </Button>
              <form action={formAction}>
                <input type="hidden" name="followUpId" value={followUp.id} />
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "…" : "Terminer"}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <RescheduleFollowUpDialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        followUpId={followUp.id}
        dueAt={followUp.dueAt}
      />
    </article>
  );
}

function interactionLabel(type: InteractionType) {
  if (type in INTERACTION_TYPE_LABELS) {
    return INTERACTION_TYPE_LABELS[type as keyof typeof INTERACTION_TYPE_LABELS];
  }

  return "Interaction";
}
