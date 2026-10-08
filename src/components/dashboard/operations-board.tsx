"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeFollowUp } from "@/actions/follow-ups";
import { scheduleQuoteReminder } from "@/actions/quotes";
import { QuickInteractionPanel } from "@/components/crm/quick-interaction-panel";
import { RescheduleFollowUpDialog } from "@/components/follow-ups/reschedule-follow-up-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { idleActionResult } from "@/lib/crm/action-result";
import { formatMoney } from "@/lib/crm/form-data";
import type {
  AcceptedQuoteCard,
  FollowUpCard,
  OperationsDashboard,
  StaleOpportunityCard,
  WaitingQuoteCard,
  WorkAction,
} from "@/lib/dashboard/operations";
import type { ProjectSaleDraft } from "@/lib/projects/draft";
import { cn } from "@/lib/cn";

type OperationsBoardProps = {
  dashboard: OperationsDashboard;
};

const ACTION_CLASS = "min-h-12 w-full sm:w-auto";

export function OperationsBoard({ dashboard }: OperationsBoardProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [interactionCompanyId, setInteractionCompanyId] = useState<string | null>(null);
  const [project, setProject] = useState<{
    companyId: string;
    draft: ProjectSaleDraft;
    reference: string;
  } | null>(null);

  const todayFollowUpIds = new Set(
    dashboard.today.flatMap((action) => (action.followUpId ? [action.followUpId] : [])),
  );
  const todayQuoteIds = new Set(
    dashboard.today.flatMap((action) => (action.quoteId ? [action.quoteId] : [])),
  );

  return (
    <div className="flex flex-col gap-5">
      {notice ? (
        <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-body text-foreground" role="status">
          {notice}
        </p>
      ) : null}

      <Section title="À faire aujourd'hui" hint="Les actions commerciales, avant les chiffres.">
        {dashboard.today.length === 0 && dashboard.moreProspects.length === 0 ? (
          <QuietEmpty>Rien à traiter aujourd&apos;hui.</QuietEmpty>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...dashboard.today, ...dashboard.moreProspects].map((action) => (
              <li key={action.id}>
                <ActionCard
                  action={action}
                  onInteract={() => setInteractionCompanyId(action.companyId)}
                  onCreateProject={() => {
                    if (!action.projectDraft) {
                      return;
                    }
                    setProject({
                      companyId: action.companyId,
                      draft: action.projectDraft,
                      reference: action.context,
                    });
                  }}
                  onDone={setNotice}
                />
                {interactionCompanyId === action.companyId ? (
                  <div className="mt-2">
                    <QuickInteractionPanel
                      companyId={action.companyId}
                      onClose={() => setInteractionCompanyId(null)}
                      onOpenFullForm={() => router.push(`/entreprises/${action.companyId}`)}
                      onSaved={(message) => {
                        setNotice(message);
                        setInteractionCompanyId(null);
                      }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Relances" hint="Extrait des relances. Les compteurs plus bas couvrent tout le CRM. La liste complète est sur Relances.">
        <div className="mb-4">
          <Link href="/relances" className={cn(buttonVariants({ variant: "secondary" }), "min-h-12 px-4")}>
            Ouvrir toutes les relances
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <FollowUpBucket
            title="En retard"
            empty="Aucune relance en retard."
            covered="Les relances en retard sont dans À faire aujourd'hui."
            {...preview(dashboard.followUps.overdue.filter((item) => !todayFollowUpIds.has(item.id)))}
            coveredCount={dashboard.followUps.overdue.filter((item) => todayFollowUpIds.has(item.id)).length}
            tone="overdue"
          />
          <FollowUpBucket
            title="Aujourd'hui"
            empty="Aucune relance prévue aujourd'hui."
            covered="Les relances du jour sont dans À faire aujourd'hui."
            {...preview(dashboard.followUps.today.filter((item) => !todayFollowUpIds.has(item.id)))}
            coveredCount={dashboard.followUps.today.filter((item) => todayFollowUpIds.has(item.id)).length}
            tone="today"
          />
          <FollowUpBucket
            title="À venir"
            empty="Aucune relance à venir."
            covered=""
            {...preview(dashboard.followUps.upcoming)}
            coveredCount={0}
            tone="upcoming"
          />
        </div>
      </Section>

      <Section title="Devis en attente" hint="Envoyés ou consultés. Une relance sur l'entreprise, sans opportunité, couvre tous ses devis : ce n'est pas une relance par devis.">
        {dashboard.waitingQuotes.length === 0 ? (
          <QuietEmpty>Aucun devis en attente.</QuietEmpty>
        ) : (
          <ul className="flex flex-col gap-3">
            {dashboard.waitingQuotes.map((quote) => (
              <li key={quote.id}>
                <WaitingQuoteRow quote={quote} alreadyQueued={todayQuoteIds.has(quote.id)} onDone={setNotice} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Devis acceptés sans projet" hint="Le projet n'est jamais créé tout seul.">
        <AcceptedList
          items={dashboard.acceptedWithoutProject.filter((quote) => !todayQuoteIds.has(quote.id))}
          hiddenCount={dashboard.acceptedWithoutProject.filter((quote) => todayQuoteIds.has(quote.id)).length}
          onCreate={setProject}
        />
      </Section>

      <Section title="Opportunités à suivre" hint="Inactivité affichée en jours. Ce n'est pas un retard : il n'y a pas d'échéance.">
        {dashboard.staleOpportunities.length === 0 ? (
          <QuietEmpty>Aucune opportunité ouverte sans activité récente.</QuietEmpty>
        ) : (
          <ul className="flex flex-col gap-3">
            {dashboard.staleOpportunities.map((opportunity) => (
              <li key={opportunity.id}>
                <OpportunityRow opportunity={opportunity} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Prospects actifs" value={String(dashboard.kpis.activeProspects)} hint="Leads, contactés, qualifiés, opportunités" />
        <Kpi label="Relances en retard" value={String(dashboard.kpis.overdueFollowUps)} hint="Échéance avant aujourd'hui, heure de Paris" />
        <Kpi label="Relances aujourd'hui" value={String(dashboard.kpis.todayFollowUps)} hint="Échéance dans la journée de Paris" />
        <Kpi label="Devis en attente" value={String(dashboard.kpis.waitingQuotes)} hint="Envoyés ou consultés" />
        <Kpi label="Opportunités ouvertes" value={String(dashboard.kpis.openOpportunities)} hint="Hors gagné et perdu" />
        <Kpi label="Pipeline estimé" value={formatMoney(dashboard.kpis.pipelineEstimated)} hint="Somme des estimations, pas l'encaissé" />
      </section>
      <p className="text-meta text-muted">
        Les compteurs ci-dessus portent sur l&apos;ensemble du CRM. Les listes n&apos;en montrent qu&apos;un extrait.
      </p>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-section text-foreground">Pipeline</h2>
            <p className="mt-1 text-meta text-muted">Étapes ouvertes. Valeur estimée.</p>
          </div>
          <Link href="/pipeline" className={cn(buttonVariants({ variant: "secondary" }), "min-h-12 px-4")}>
            Ouvrir
          </Link>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.pipeline.map((column) => (
            <li key={column.stage}>
              <Link
                href="/pipeline"
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 hover:border-primary/40"
              >
                <span className="text-body text-foreground">{column.label}</span>
                <span className="text-right text-meta text-muted">
                  {column.count}
                  <span className="mt-0.5 block">{formatMoney(column.estimatedValue)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <CreateProjectDialog
        open={project !== null}
        onClose={() => setProject(null)}
        companyId={project?.companyId ?? ""}
        quotes={
          project
            ? [{ id: project.draft.quoteId, reference: project.reference, amountIncTax: project.draft.amount }]
            : []
        }
        defaults={project?.draft ?? null}
      />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-section text-foreground">{title}</h2>
      <p className="mt-1 text-meta text-muted">{hint}</p>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function QuietEmpty({ children }: { children: string }) {
  return <p className="text-body text-muted">{children}</p>;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-meta font-medium tracking-[0.08em] text-muted uppercase">{label}</p>
      <p className="mt-2 text-h2 text-foreground">{value}</p>
      <p className="mt-1 text-meta text-muted">{hint}</p>
    </Card>
  );
}

function ActionCard({
  action,
  onInteract,
  onCreateProject,
  onDone,
}: {
  action: WorkAction;
  onInteract: () => void;
  onCreateProject: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-background/80 p-4",
        action.urgency === "overdue" && "border-danger/40",
        action.urgency === "today" && "border-primary/40",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <p className="text-body font-medium text-foreground">{action.companyName}</p>
          <p className="mt-1 text-body text-foreground">{action.title}</p>
          <p className="mt-1 text-meta text-muted">{action.context}</p>
          <p className="mt-1 text-meta text-muted">{action.kind === "accepted_quote" ? formatMoney(action.whenLabel) : action.whenLabel}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <CompanyLink companyId={action.companyId} />
          {action.kind === "follow_up" || action.kind === "new_prospect" ? (
            <Button variant="secondary" className={ACTION_CLASS} onClick={onInteract}>
              Interaction
            </Button>
          ) : null}
          {action.kind === "follow_up" && action.followUpId ? (
            <CompleteFollowUpButton followUpId={action.followUpId} />
          ) : null}
          {action.kind === "waiting_quote" && action.quoteId ? (
            <QuoteReminderButton quoteId={action.quoteId} onDone={onDone} />
          ) : null}
          {action.kind === "accepted_quote" && action.projectDraft ? (
            <Button className={ACTION_CLASS} onClick={onCreateProject}>
              Créer le projet
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CompanyLink({ companyId, label = "Ouvrir" }: { companyId: string; label?: string }) {
  return (
    <Link href={`/entreprises/${companyId}`} className={cn(buttonVariants({ variant: "secondary" }), ACTION_CLASS, "px-4")}>
      {label}
    </Link>
  );
}

function CompleteFollowUpButton({ followUpId }: { followUpId: string }) {
  const [state, formAction, pending] = useActionState(completeFollowUp, idleActionResult);
  return (
    <form action={formAction}>
      <input type="hidden" name="followUpId" value={followUpId} />
      <Button type="submit" className={ACTION_CLASS} disabled={pending}>
        {pending ? "…" : "Terminer"}
      </Button>
      {state.message ? (
        <p className={cn("mt-2 text-meta", state.ok ? "text-muted" : "text-danger")} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function QuoteReminderButton({ quoteId, onDone }: { quoteId: string; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function schedule(preset: "tomorrow" | "in3Days" | "in1Week" | "custom") {
    startTransition(async () => {
      const result = await scheduleQuoteReminder({
        quoteId,
        preset,
        customDueDate: preset === "custom" ? customDate : null,
      });
      const text = result.message ?? (result.ok ? "Relance programmée" : "Impossible de programmer la relance.");
      setMessage(text);
      if (result.ok) {
        onDone(text);
        setOpen(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" className={ACTION_CLASS} onClick={() => setOpen((value) => !value)}>
        Programmer une relance
      </Button>
      {open ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="secondary" className={ACTION_CLASS} disabled={pending} onClick={() => schedule("tomorrow")}>
            Demain
          </Button>
          <Button variant="secondary" className={ACTION_CLASS} disabled={pending} onClick={() => schedule("in3Days")}>
            Dans 3 jours
          </Button>
          <Button variant="secondary" className={ACTION_CLASS} disabled={pending} onClick={() => schedule("in1Week")}>
            Dans 1 semaine
          </Button>
          <input
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            className="min-h-12 rounded-xl border border-border bg-background px-3 text-body"
            aria-label="Date de relance"
          />
          <Button variant="secondary" className={ACTION_CLASS} disabled={pending || !customDate} onClick={() => schedule("custom")}>
            Cette date
          </Button>
        </div>
      ) : null}
      {message ? (
        <p className="text-meta text-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function preview<T>(items: T[], limit = 8) {
  return { items: items.slice(0, limit), omitted: Math.max(0, items.length - limit) };
}

function FollowUpBucket({
  title,
  empty,
  covered,
  items,
  omitted,
  coveredCount,
  tone,
}: {
  title: string;
  empty: string;
  covered: string;
  items: FollowUpCard[];
  omitted: number;
  coveredCount: number;
  tone: "overdue" | "today" | "upcoming";
}) {
  return (
    <div>
      <h3 className="text-body font-medium text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-meta text-muted">{coveredCount > 0 ? covered : empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <FollowUpRow item={item} tone={tone} />
            </li>
          ))}
        </ul>
      )}
      {omitted > 0 ? (
        <p className="mt-2 text-meta text-muted">{omitted} autre{omitted > 1 ? "s" : ""} sur la page Relances.</p>
      ) : null}
    </div>
  );
}

function FollowUpRow({
  item,
  tone,
}: {
  item: FollowUpCard;
  tone: "overdue" | "today" | "upcoming";
}) {
  const [reschedule, setReschedule] = useState(false);
  return (
    <article
      className={cn(
        "rounded-xl border border-border p-3",
        tone === "overdue" && "border-danger/40",
        tone === "today" && "border-primary/40",
      )}
    >
      <p className="text-body font-medium text-foreground">{item.companyName}</p>
      <p className="mt-1 text-meta text-muted">{item.title}</p>
      {item.opportunityTitle ? <p className="mt-1 text-meta text-muted">{item.opportunityTitle}</p> : null}
      <p className="mt-1 text-meta text-muted">{item.whenLabel}</p>
      <p className="mt-1 text-meta text-muted">En attente</p>
      <div className="mt-3 flex flex-col gap-2">
        <CompanyLink companyId={item.companyId} />
        <Button variant="secondary" className={ACTION_CLASS} onClick={() => setReschedule(true)}>
          Reporter
        </Button>
        <CompleteFollowUpButton followUpId={item.id} />
      </div>
      <RescheduleFollowUpDialog
        open={reschedule}
        onClose={() => setReschedule(false)}
        followUpId={item.id}
        dueAt={item.dueAt}
      />
    </article>
  );
}

function WaitingQuoteRow({
  quote,
  alreadyQueued,
  onDone,
}: {
  quote: WaitingQuoteCard;
  alreadyQueued: boolean;
  onDone: (message: string) => void;
}) {
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium text-foreground">{quote.companyName}</p>
        <p className="font-mono text-meta text-muted">{quote.reference}</p>
        <p className="text-body text-foreground">{formatMoney(quote.amountIncTax)}</p>
        <p className="text-meta text-muted">{quote.ageLabel}</p>
        <p className={cn("text-meta", quote.missingFollowUp ? "text-danger" : "text-muted")}>
          {quote.missingFollowUp ? "Pas de relance programmée" : quote.followUpLabel}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <CompanyLink companyId={quote.companyId} />
        <Link href="/devis" className={cn(buttonVariants({ variant: "secondary" }), ACTION_CLASS, "px-4")}>
          Voir les devis
        </Link>
        {quote.missingFollowUp && !alreadyQueued ? <QuoteReminderButton quoteId={quote.id} onDone={onDone} /> : null}
      </div>
    </article>
  );
}

function AcceptedList({
  items,
  hiddenCount,
  onCreate,
}: {
  items: AcceptedQuoteCard[];
  hiddenCount: number;
  onCreate: (project: { companyId: string; draft: ProjectSaleDraft; reference: string }) => void;
}) {
  if (items.length === 0) {
    return (
      <QuietEmpty>
        {hiddenCount > 0
          ? "Ces devis sont dans À faire aujourd'hui."
          : "Aucun devis accepté sans projet."}
      </QuietEmpty>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((quote) => (
        <li key={quote.id}>
          <article className="rounded-xl border border-border p-4">
            <p className="text-body font-medium text-foreground">{quote.companyName}</p>
            <p className="mt-1 font-mono text-meta text-muted">{quote.reference}</p>
            <p className="mt-1 text-body text-foreground">{formatMoney(quote.amountIncTax)}</p>
            <div className="mt-3">
              <Button
                className={ACTION_CLASS}
                onClick={() =>
                  onCreate({
                    companyId: quote.companyId,
                    draft: quote.projectDraft,
                    reference: quote.reference,
                  })
                }
              >
                Créer le projet
              </Button>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function OpportunityRow({ opportunity }: { opportunity: StaleOpportunityCard }) {
  return (
    <article className="rounded-xl border border-border p-4">
      <p className="text-body font-medium text-foreground">{opportunity.title}</p>
      <p className="mt-1 text-meta text-muted">{opportunity.companyName}</p>
      <p className="mt-1 text-meta text-muted">Étape : {opportunity.stageLabel}</p>
      <p className="mt-1 text-meta text-muted">
        Dernière activité : il y a {opportunity.daysSinceActivity} jour
        {opportunity.daysSinceActivity > 1 ? "s" : ""}
      </p>
      <p className="mt-1 text-meta text-muted">Estimation {formatMoney(opportunity.estimatedValue)}</p>
      <div className="mt-3">
        <CompanyLink companyId={opportunity.companyId} label="Voir l'opportunité" />
      </div>
    </article>
  );
}
