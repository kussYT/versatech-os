"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createFollowUp } from "@/actions/follow-ups";
import { fetchOpportunityQuickView } from "@/actions/kanban";
import { QuickInteractionPanel } from "@/components/crm/quick-interaction-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  COMPANY_LIFECYCLE_LABELS,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  QUOTE_STATUS_LABELS,
} from "@/lib/crm/constants";
import { formatMoney } from "@/lib/crm/form-data";
import { INTERACTION_TYPE_LABELS } from "@/lib/crm/labels";
import { toDateTimeLocalValue } from "@/lib/dates";
import { describeQuickView, followUpCaption, kanbanFollowUpDue, type KanbanFollowUpPreset } from "@/lib/pipeline/kanban";
import type { OpportunityStage } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";

type QuickViewData = NonNullable<Awaited<ReturnType<typeof fetchOpportunityQuickView>>>;

type OpportunityQuickViewProps = {
  view: QuickViewData | null;
  currentStage: OpportunityStage;
  loading: boolean;
  error: string | null;
  onStage: (stage: OpportunityStage) => void;
  onFollowUp: (followUp: { title: string; dueAt: string }) => void;
  onReload: () => void;
};

export function OpportunityQuickView({
  view,
  currentStage,
  loading,
  error,
  onStage,
  onFollowUp,
  onReload,
}: OpportunityQuickViewProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [interaction, setInteraction] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [pending, startTransition] = useTransition();

  function schedule(preset: KanbanFollowUpPreset) {
    if (!view) {
      return;
    }
    const due = kanbanFollowUpDue(preset, new Date(), customDate);
    if (!due) {
      setNotice("Choisissez une date de relance.");
      return;
    }
    const data = new FormData();
    data.set("companyId", view.company.id);
    data.set("opportunityId", view.opportunityId);
    data.set("dueAt", toDateTimeLocalValue(due));
    data.set("note", `Relancer — ${view.title}`);
    startTransition(async () => {
      const result = await createFollowUp(idleActionResult, data);
      if (!result.ok) {
        setNotice(result.message ?? "Impossible de programmer la relance.");
        return;
      }
      onFollowUp({ title: `Relancer — ${view.title}`, dueAt: due.toISOString() });
      setNotice(result.message ?? "Relance programmée.");
      onReload();
    });
  }

  if (error) {
    return <p className="text-body text-danger" role="alert">{error}</p>;
  }
  if (loading || !view) {
    return <p className="text-body text-muted">Chargement de l’aperçu…</p>;
  }

  const interactionLabel = view.lastInteraction
    ? labelForInteraction(view.lastInteraction.type, view.lastInteraction.subject)
    : null;
  const described = describeQuickView({
    companyName: view.company.name,
    lifecycleLabel: COMPANY_LIFECYCLE_LABELS[view.company.lifecycleStatus],
    phone: view.company.phone,
    email: view.company.email,
    instagram: view.company.instagram,
    title: view.title,
    stageLabel: OPPORTUNITY_STAGE_LABELS[view.stage],
    estimatedValue: view.estimatedValue,
    quoteReference: view.latestQuote?.reference ?? null,
    quoteAmount: view.latestQuote?.amountIncTax ?? null,
    lastInteraction: interactionLabel,
    nextFollowUp: view.nextFollowUp ? followUpCaption(view.nextFollowUp.dueAt) : null,
  });

  return (
    <div className="space-y-5">
      {notice ? <p className="text-meta text-muted" role="status">{notice}</p> : null}
      <section>
        <h3 className="text-meta font-medium tracking-[0.08em] text-muted uppercase">Entreprise</h3>
        <p className="mt-2 text-body font-medium text-foreground">{described.companyName}</p>
        <p className="mt-1 text-meta text-muted">{described.lifecycleLabel}</p>
        <p className="mt-1 text-meta text-muted">{described.phone ?? "Téléphone non renseigné"}</p>
        <p className="mt-1 text-meta text-muted">{described.email ?? "E-mail non renseigné"}</p>
        <p className="mt-1 text-meta text-muted">
          {described.instagram ? `Instagram ${described.instagram}` : "Instagram non renseigné"}
        </p>
      </section>
      <section>
        <h3 className="text-meta font-medium tracking-[0.08em] text-muted uppercase">Opportunité</h3>
        <p className="mt-2 text-body text-foreground">{described.title}</p>
        <p className="mt-1 text-meta text-muted">Étape : {described.stageLabel}</p>
        <p className="mt-1 text-body text-foreground">{formatMoney(described.estimatedValue)} estimés</p>
        <p className="mt-1 text-meta text-muted">
          {described.quoteReference
            ? `Dernier devis ${described.quoteReference}${view.latestQuote ? ` · ${QUOTE_STATUS_LABELS[view.latestQuote.status]}` : ""} · ${formatMoney(described.quoteAmount ?? "0")}`
            : "Aucun devis"}
        </p>
      </section>
      <section>
        <h3 className="text-meta font-medium tracking-[0.08em] text-muted uppercase">Suivi</h3>
        <p className="mt-2 text-meta text-muted">{described.lastInteraction ?? "Aucun échange enregistré"}</p>
        <p className="mt-1 text-meta text-muted">{described.nextFollowUp ?? "Aucune relance programmée"}</p>
      </section>
      <div className="flex flex-col gap-2">
        <Button className="min-h-12" onClick={() => setInteraction((value) => !value)}>
          Ajouter une interaction
        </Button>
        {interaction ? (
          <QuickInteractionPanel
            companyId={view.company.id}
            opportunityId={view.opportunityId}
            onClose={() => setInteraction(false)}
            onOpenFullForm={() => router.push(`/entreprises/${view.company.id}`)}
            onSaved={(message) => {
              setNotice(message);
              setInteraction(false);
              onReload();
            }}
          />
        ) : null}
        <p className="text-meta text-muted">Programmer une relance</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-12" disabled={pending} onClick={() => schedule("tomorrow")}>
            Demain
          </Button>
          <Button variant="secondary" className="min-h-12" disabled={pending} onClick={() => schedule("in3Days")}>
            Dans 3 jours
          </Button>
          <Button variant="secondary" className="min-h-12" disabled={pending} onClick={() => schedule("in1Week")}>
            Dans 1 semaine
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            aria-label="Date de relance"
            className="min-h-12 flex-1 rounded-xl border border-white/70 bg-white/60 px-3 backdrop-blur-sm focus-visible:border-primary text-body"
          />
          <Button variant="secondary" className="min-h-12" disabled={pending || !customDate} onClick={() => schedule("custom")}>
            Cette date
          </Button>
        </div>
        <label className="block text-meta text-muted">
          Changer l’étape
          <select
            className="mt-1 min-h-12 w-full rounded-xl border border-white/70 bg-white/60 px-3 backdrop-blur-sm focus-visible:border-primary text-body"
            value={currentStage}
            aria-label={`Étape de ${described.title}`}
            onChange={(event) => onStage(event.target.value as OpportunityStage)}
          >
            {OPPORTUNITY_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {OPPORTUNITY_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
        <Link href={`/entreprises/${view.company.id}`} className={cn(buttonVariants({ variant: "secondary" }), "min-h-12 px-4")}>
          Voir la fiche
        </Link>
        <Link href="/devis" className={cn(buttonVariants({ variant: "secondary" }), "min-h-12 px-4")}>
          Voir les devis
        </Link>
      </div>
    </div>
  );
}

function labelForInteraction(type: string, subject: string | null) {
  const label = type in INTERACTION_TYPE_LABELS
    ? INTERACTION_TYPE_LABELS[type as keyof typeof INTERACTION_TYPE_LABELS]
    : "Échange";
  return subject ? `${label} · ${subject}` : label;
}
