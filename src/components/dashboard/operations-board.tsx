"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeFollowUp } from "@/actions/follow-ups";
import { scheduleQuoteReminder } from "@/actions/quotes";
import { QuickInteractionPanel } from "@/components/crm/quick-interaction-panel";
import { RescheduleFollowUpDialog } from "@/components/follow-ups/reschedule-follow-up-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import { formatDateTime } from "@/lib/crm/form-data";
import type { OperationsDashboard } from "@/lib/dashboard/operations";
import type { ProjectSaleDraft } from "@/lib/projects/draft";
import { buildTodayRows, type TodayFilter, type TodayRow } from "@/lib/dashboard/today-rows";
import type { CalendarItem } from "@/lib/calendar/types";
import type { DashboardTaskItem } from "@/lib/queries/projects";
import { cn } from "@/lib/cn";

type OperationsBoardProps = {
  dashboard: OperationsDashboard;
  agenda?: CalendarItem[];
  tasks?: DashboardTaskItem[];
  prestations?: Record<string, string | null>;
};

const FILTERS: { id: TodayFilter; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "overdue", label: "En retard" },
  { id: "upcoming", label: "À venir" },
];

const ACTION_CLASS = "min-h-12 w-full sm:w-auto";

export function OperationsBoard({
  dashboard,
  agenda = [],
  tasks = [],
  prestations = {},
}: OperationsBoardProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [interactionCompanyId, setInteractionCompanyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TodayFilter>("today");
  const [project, setProject] = useState<{
    companyId: string;
    draft: ProjectSaleDraft;
    reference: string;
  } | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {notice ? (
        <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-body text-foreground" role="status">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les actions">
        {FILTERS.map((item) => (
          <Button
            key={item.id}
            variant={filter === item.id ? "primary" : "secondary"}
            className="min-h-12"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <TodayRows
        rows={buildTodayRows({ dashboard, agenda, tasks, prestations }).filter((row) => row.filter === filter)}
        onInteract={setInteractionCompanyId}
        onCreateProject={(row) => {
          if (!row.projectDraft) {
            return;
          }
          setProject({
            companyId: row.companyId,
            draft: row.projectDraft,
            reference: row.status,
          });
        }}
        onDone={setNotice}
        interactionCompanyId={interactionCompanyId}
        onCloseInteraction={() => setInteractionCompanyId(null)}
        onOpenCompany={(companyId) => router.push(`/entreprises/${companyId}`)}
      />
      <p className="text-meta text-muted">
        Les compteurs détaillés sont dans{" "}
        <Link href="/analytics" className="text-primary">Analytics</Link>
        {" · "}
        <Link href="/relances" className="text-primary">Relances</Link>
        {" · "}
        <Link href="/calendrier" className="text-primary">Calendrier</Link>
        {" · "}
        <Link href="/taches" className="text-primary">Tâches</Link>
        {" · "}
        <Link href="/pipeline" className="text-primary">Pipeline</Link>
      </p>
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

function dueLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? formatDateTime(value) : value;
}

function TodayRows({
  rows,
  onInteract,
  onCreateProject,
  onDone,
  interactionCompanyId,
  onCloseInteraction,
  onOpenCompany,
}: {
  rows: TodayRow[];
  onInteract: (companyId: string) => void;
  onCreateProject: (row: TodayRow) => void;
  onDone: (message: string) => void;
  interactionCompanyId: string | null;
  onCloseInteraction: () => void;
  onOpenCompany: (companyId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-body text-muted">Rien dans ce filtre.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-meta text-muted">
            <th className="px-3 py-2 font-medium">Priorité</th>
            <th className="px-3 py-2 font-medium">Entreprise</th>
            <th className="px-3 py-2 font-medium">Prestation</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Échéance</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Action rapide</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border align-top">
              <td className="px-3 py-3 text-body text-foreground">{row.priority}</td>
              <td className="px-3 py-3 text-body font-medium text-foreground">{row.companyName}</td>
              <td className="px-3 py-3 text-body text-foreground">{row.prestation ?? "—"}</td>
              <td className="px-3 py-3 text-body text-foreground">{row.action}</td>
              <td className="px-3 py-3 text-meta text-muted">{dueLabel(row.due)}</td>
              <td className="px-3 py-3 text-meta text-muted">{row.status}</td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-2">
                  {row.companyId ? <CompanyLink companyId={row.companyId} /> : (
                    <Link href={row.href} className={cn(buttonVariants({ variant: "secondary" }), ACTION_CLASS, "px-4")}>
                      Ouvrir
                    </Link>
                  )}
                  {row.kind === "follow_up" || row.kind === "new_prospect" ? (
                    <Button variant="secondary" className={ACTION_CLASS} onClick={() => onInteract(row.companyId)}>
                      Interaction
                    </Button>
                  ) : null}
                  {row.followUpId ? <CompleteFollowUpButton followUpId={row.followUpId} /> : null}
                  {row.followUpId && row.followUpDueAt ? (
                    <RescheduleButton followUpId={row.followUpId} dueAt={row.followUpDueAt} />
                  ) : null}
                  {row.kind === "waiting_quote" && row.quoteId ? (
                    <QuoteReminderButton quoteId={row.quoteId} onDone={onDone} />
                  ) : null}
                  {row.kind === "accepted_quote" && row.projectDraft ? (
                    <Button className={ACTION_CLASS} onClick={() => onCreateProject(row)}>
                      Créer le projet
                    </Button>
                  ) : null}
                  {interactionCompanyId === row.companyId && (row.kind === "follow_up" || row.kind === "new_prospect") ? (
                    <QuickInteractionPanel
                      companyId={row.companyId}
                      onClose={onCloseInteraction}
                      onOpenFullForm={() => onOpenCompany(row.companyId)}
                      onSaved={(message) => {
                        onDone(message);
                        onCloseInteraction();
                      }}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyLink({ companyId, label = "Ouvrir" }: { companyId: string; label?: string }) {
  return (
    <Link href={`/entreprises/${companyId}`} className={cn(buttonVariants({ variant: "secondary" }), ACTION_CLASS, "px-4")}>
      {label}
    </Link>
  );
}

function RescheduleButton({ followUpId, dueAt }: { followUpId: string; dueAt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className={ACTION_CLASS} onClick={() => setOpen(true)}>
        Reporter
      </Button>
      <RescheduleFollowUpDialog
        open={open}
        onClose={() => setOpen(false)}
        followUpId={followUpId}
        dueAt={dueAt}
      />
    </>
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
