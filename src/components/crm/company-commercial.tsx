"use client";

import { useState, useTransition } from "react";
import { changeCompanyLifecycle } from "@/actions/companies";
import { updateOpportunityStage } from "@/actions/opportunities";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  COMPANY_LIFECYCLE_LABELS,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/crm/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/crm/form-data";
import type { CompanyLifecycle, OpportunityStage } from "@/generated/prisma/client";
import type { CompanyDetail } from "@/lib/queries/companies";

const QUICK_STATUSES = ["LEAD", "CONTACTED", "QUALIFIED", "OPPORTUNITY", "INACTIVE"] as const;

type CompanyCommercialProps = {
  company: CompanyDetail;
  onMessage: (message: string | null) => void;
};

export function CompanyCommercial({ company, onMessage }: CompanyCommercialProps) {
  return (
    <div className="space-y-4">
      <CompanyStatusControl company={company} onMessage={onMessage} />
      {company.opportunities.map((opportunity) => (
        <OpportunityStageControl
          key={opportunity.id}
          opportunity={opportunity}
          followUp={company.nextFollowUp}
          onMessage={onMessage}
        />
      ))}
    </div>
  );
}

function CompanyStatusControl({
  company,
  onMessage,
}: {
  company: CompanyDetail;
  onMessage: (message: string | null) => void;
}) {
  const [status, setStatus] = useState(company.lifecycleStatus);
  const [seenStatus, setSeenStatus] = useState(company.lifecycleStatus);
  const [pending, startTransition] = useTransition();
  if (seenStatus !== company.lifecycleStatus) {
    setSeenStatus(company.lifecycleStatus);
    setStatus(company.lifecycleStatus);
  }

  function selectStatus(next: CompanyLifecycle) {
    if (next === status || pending) {
      return;
    }
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const result = await changeCompanyLifecycle({
        companyId: company.id,
        lifecycleStatus: next,
      });
      if (!result.ok) {
        setStatus(previous);
        onMessage(result.message ?? "Impossible de changer le statut.");
        return;
      }
      onMessage(result.message ?? `Statut mis à jour : ${COMPANY_LIFECYCLE_LABELS[next]}`);
    });
  }

  return (
    <div>
      <p className="text-meta text-muted">Statut</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Statut entreprise">
        {QUICK_STATUSES.map((value) => {
          const allowed = company.allowedLifecycleStatuses.includes(value);
          const current = status === value;
          return (
            <Button
              key={value}
              type="button"
              variant={current ? "primary" : "secondary"}
              className="min-h-12 px-4"
              disabled={pending || (!allowed && !current)}
              aria-pressed={current}
              onClick={() => selectStatus(value)}
            >
              {COMPANY_LIFECYCLE_LABELS[value]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function OpportunityStageControl({
  opportunity,
  followUp,
  onMessage,
}: {
  opportunity: CompanyDetail["opportunities"][number];
  followUp: CompanyDetail["nextFollowUp"];
  onMessage: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState(opportunity.stage);
  const [seenStage, setSeenStage] = useState(opportunity.stage);
  const [confirm, setConfirm] = useState<"WON" | "LOST" | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  if (seenStage !== opportunity.stage) {
    setSeenStage(opportunity.stage);
    setStage(opportunity.stage);
    setConfirm(null);
    setToken(null);
  }

  function submit(next: OpportunityStage, confirmationToken: string | null, reason: string, previous: OpportunityStage) {
    const data = new FormData();
    data.set("opportunityId", opportunity.id);
    data.set("stage", next);
    data.set("lostReason", reason);
    if (confirmationToken) {
      data.set("confirmationToken", confirmationToken);
    }
    startTransition(async () => {
      const result = await updateOpportunityStage(idleActionResult, data);
      if (result.ok) {
        setConfirm(null);
        setToken(null);
        onMessage(result.message ?? `Étape mise à jour : ${OPPORTUNITY_STAGE_LABELS[next]}`);
        return;
      }
      if (result.data?.confirmationToken) {
        setToken(result.data.confirmationToken);
        onMessage(result.message ?? "Confirmation requise.");
        return;
      }
      setStage(previous);
      setToken(null);
      onMessage(result.message ?? "Impossible de changer l'étape.");
    });
  }

  function selectOpenStage(next: OpportunityStage) {
    if (pending || next === stage) {
      return;
    }
    setConfirm(null);
    setToken(null);
    setStage(next);
    submit(next, null, "", stage);
  }

  const value = Number(opportunity.estimatedValue);
  return (
    <article className="rounded-xl border border-border bg-background/60 px-4 py-4">
      <p className="text-meta text-muted">Opportunité</p>
      <p className="mt-1 text-body font-medium text-foreground">{opportunity.title}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
        {value > 0 ? <span>Valeur {formatMoney(opportunity.estimatedValue)}</span> : null}
        {followUp ? <span>Prochaine relance {formatDate(followUp.dueAt)}</span> : null}
      </div>
      <p className="mt-4 text-meta text-muted">Étape</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Étape de ${opportunity.title}`}>
        {OPEN_OPPORTUNITY_STAGES.map((valueStage) => (
          <Button
            key={valueStage}
            type="button"
            variant={stage === valueStage ? "primary" : "secondary"}
            className="min-h-12 px-4"
            disabled={pending}
            aria-pressed={stage === valueStage}
            onClick={() => selectOpenStage(valueStage)}
          >
            {OPPORTUNITY_STAGE_LABELS[valueStage]}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 px-4"
          disabled={pending || stage === "WON"}
          onClick={() => setConfirm("WON")}
        >
          Gagné
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 px-4"
          disabled={pending || stage === "LOST"}
          onClick={() => setConfirm("LOST")}
        >
          Perdu
        </Button>
      </div>
      {confirm ? (
        <div className="mt-3 space-y-2">
          {confirm === "LOST" ? (
            <label className="block text-meta text-muted">
              Raison
              <input
                value={lostReason}
                onChange={(event) => setLostReason(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-body text-foreground"
              />
            </label>
          ) : (
            <p className="text-meta text-muted">Confirmer le passage en Gagné.</p>
          )}
          <Button
            type="button"
            className="min-h-12 px-4"
            disabled={pending || (confirm === "LOST" && lostReason.trim() === "")}
            onClick={() =>
              submit(confirm, token, confirm === "LOST" ? lostReason.trim() : "", stage)
            }
          >
            {pending ? "Enregistrement…" : token ? "Confirmer" : "Demander la confirmation"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
