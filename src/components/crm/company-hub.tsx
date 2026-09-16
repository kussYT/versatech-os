"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  CalendarClock,
  FileText,
  FolderKanban,
  Kanban,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { CreateOpportunityDialog } from "@/components/crm/create-opportunity-dialog";
import { EditCompanyDialog } from "@/components/crm/edit-company-dialog";
import { FollowUpDialog } from "@/components/crm/follow-up-dialog";
import { InteractionDialog } from "@/components/crm/interaction-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectProgress } from "@/components/projects/project-progress";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { CreateQuoteDialog } from "@/components/quotes/create-quote-dialog";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LifecycleBadge } from "@/components/ui/lifecycle-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { PageHeader } from "@/components/layout/page-header";
import { PRIORITY_LABELS } from "@/lib/crm/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/crm/form-data";
import {
  INTERACTION_DIRECTION_LABELS,
  INTERACTION_RESULT_LABELS,
  INTERACTION_TYPE_LABELS,
} from "@/lib/crm/labels";
import type { CompanyDetail } from "@/lib/queries/companies";
import type { InteractionType } from "@/generated/prisma/client";

type CompanyHubProps = {
  company: CompanyDetail;
};

export function CompanyHub({ company }: CompanyHubProps) {
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const isClient = company.lifecycleStatus === "CLIENT";
  const location = [company.city, company.postalCode].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <PageHeader
        meta="Fiche entreprise"
        title={company.name}
        description={[company.industry, location || company.city].filter(Boolean).join(" · ") || undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setInteractionOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Ajouter interaction
            </Button>
            <Button variant="secondary" onClick={() => setFollowUpOpen(true)}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Planifier relance
            </Button>
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              Modifier
            </Button>
            {!company.hasOpenOpportunity ? (
              <Button variant="secondary" onClick={() => setOpportunityOpen(true)}>
                <Kanban className="size-4" aria-hidden="true" />
                Créer une opportunité
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setQuoteOpen(true)}>
                <FileText className="size-4" aria-hidden="true" />
                Créer un devis
              </Button>
            )}
            {isClient ? (
              <Button variant="secondary" onClick={() => setProjectOpen(true)}>
                <FolderKanban className="size-4" aria-hidden="true" />
                Créer un projet
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <LifecycleBadge status={company.lifecycleStatus} />
        <PriorityBadge
          priority={company.priority.toLowerCase() as "low" | "normal" | "medium" | "high" | "urgent"}
          label={PRIORITY_LABELS[company.priority]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <CompanyInfo company={company} />
        <Card className="p-5">
          <h2 className="text-section text-foreground">Prochaine relance</h2>
          {company.nextFollowUp ? (
            <div className="mt-4">
              <p className="text-body font-medium text-foreground">
                {company.nextFollowUp.title}
              </p>
              <p className="mt-1 font-mono text-meta text-muted">
                {formatDateTime(company.nextFollowUp.dueAt)}
              </p>
            </div>
          ) : (
            <EmptyState
              title="Aucune relance planifiée"
              description="Planifiez une relance pour ne pas perdre le fil."
              action={
                <Button variant="secondary" size="sm" onClick={() => setFollowUpOpen(true)}>
                  Planifier relance
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-section text-foreground">Timeline</h2>
        {company.interactions.length === 0 ? (
          <EmptyState
            title="Aucune interaction"
            description="Enregistrez un appel, un e-mail ou une note."
            action={
              <Button size="sm" onClick={() => setInteractionOpen(true)}>
                Ajouter interaction
              </Button>
            }
          />
        ) : (
          <ol className="mt-4 space-y-3">
            {company.interactions.map((interaction) => (
              <li
                key={interaction.id}
                className="rounded-xl border border-border bg-background/60 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-muted" aria-hidden="true">
                    <InteractionIcon type={interaction.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-body font-medium text-foreground">
                        {interactionLabel(interaction.type)}
                      </p>
                      <span className="text-meta text-muted">
                        {INTERACTION_DIRECTION_LABELS[interaction.direction]}
                      </span>
                      {interaction.result ? (
                        <span className="text-meta text-muted">
                          · {INTERACTION_RESULT_LABELS[interaction.result]}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-meta text-faint">
                      {formatDateTime(interaction.occurredAt)}
                    </p>
                    {interaction.notes ? (
                      <p className="mt-2 text-body text-muted">{interaction.notes}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-section text-foreground">Devis</h2>
        {company.quotes.length === 0 ? (
          <EmptyState
            title="Aucun devis"
            description="Créez un devis dès qu'une opportunité commerciale est ouverte."
            action={
              company.quoteOpportunities.length > 0 ? (
                <Button size="sm" onClick={() => setQuoteOpen(true)}>
                  Créer un devis
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="mt-4 space-y-2">
            {company.quotes.map((quote) => (
              <li
                key={quote.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-body text-foreground">{quote.reference}</p>
                  <p className="mt-1 font-sans text-meta tabular-nums text-muted">
                    {formatMoney(quote.amountIncTax)}
                  </p>
                </div>
                <QuoteStatusBadge status={quote.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isClient ? (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-section text-foreground">Projets</h2>
            <Button size="sm" variant="secondary" onClick={() => setProjectOpen(true)}>
              Créer un projet
            </Button>
          </div>
          {company.projects.length === 0 ? (
            <EmptyState
              title="Aucun projet"
              description="Passez du suivi commercial à la production en créant un projet."
              action={
                <Button size="sm" onClick={() => setProjectOpen(true)}>
                  Créer un projet
                </Button>
              }
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {company.projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projets/${project.id}`}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-body font-medium text-foreground">{project.name}</p>
                        <ProjectStatusBadge status={project.status} />
                      </div>
                      <p className="mt-1 font-mono text-meta text-muted">
                        {project.dueDate ? formatDate(project.dueDate) : "Sans deadline"}
                      </p>
                    </div>
                    <div className="w-full sm:max-w-[12rem]">
                      <ProjectProgress value={project.progress} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <InteractionDialog
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
        companyId={company.id}
      />
      <FollowUpDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        companyId={company.id}
      />
      <EditCompanyDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        company={company}
      />
      <CreateOpportunityDialog
        open={opportunityOpen}
        onClose={() => setOpportunityOpen(false)}
        companyId={company.id}
      />
      <CreateQuoteDialog
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        companyId={company.id}
        opportunities={company.quoteOpportunities}
      />
      <CreateProjectDialog
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        companyId={company.id}
        quotes={company.acceptedQuotes}
      />
    </div>
  );
}

function CompanyInfo({ company }: { company: CompanyDetail }) {
  const contact = company.contacts[0];

  return (
    <Card className="p-5">
      <h2 className="text-section text-foreground">Informations</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoItem label="Téléphone">
          {company.phone ? (
            <a href={`tel:${company.phone}`} className="text-primary hover:text-primary-hover">
              {company.phone}
            </a>
          ) : (
            "—"
          )}
        </InfoItem>
        <InfoItem label="E-mail">
          {company.email ? (
            <a href={`mailto:${company.email}`} className="text-primary hover:text-primary-hover">
              {company.email}
            </a>
          ) : (
            "—"
          )}
        </InfoItem>
        <InfoItem label="Site">
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary hover:text-primary-hover"
            >
              {company.website}
            </a>
          ) : (
            "—"
          )}
        </InfoItem>
        <InfoItem label="Source">{company.source ?? "—"}</InfoItem>
        <InfoItem label="Contact">
          {contact
            ? `${contact.firstName} ${contact.lastName}${contact.role ? ` · ${contact.role}` : ""}`
            : "—"}
        </InfoItem>
        <InfoItem label="Contact e-mail">
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} className="text-primary hover:text-primary-hover">
              {contact.email}
            </a>
          ) : (
            "—"
          )}
        </InfoItem>
        <InfoItem label="Contact téléphone">
          {contact?.phone ? (
            <a href={`tel:${contact.phone}`} className="text-primary hover:text-primary-hover">
              {contact.phone}
            </a>
          ) : (
            "—"
          )}
        </InfoItem>
        <InfoItem label="Adresse">
          {[company.address, company.city, company.postalCode].filter(Boolean).join(", ") || "—"}
        </InfoItem>
      </dl>
      {company.description ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-meta text-faint">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-body text-muted">{company.description}</p>
        </div>
      ) : null}
    </Card>
  );
}

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-meta text-faint">{label}</dt>
      <dd className="mt-0.5 text-body text-foreground">{children}</dd>
    </div>
  );
}

function interactionLabel(type: InteractionType) {
  if (type in INTERACTION_TYPE_LABELS) {
    return INTERACTION_TYPE_LABELS[type as keyof typeof INTERACTION_TYPE_LABELS];
  }
  return type;
}

function InteractionIcon({ type }: { type: InteractionType }) {
  if (type === "CALL") {
    return <Phone className="size-4" />;
  }
  if (type === "EMAIL") {
    return <Mail className="size-4" />;
  }
  if (type === "MEETING") {
    return <CalendarClock className="size-4" />;
  }
  if (type === "MESSAGE") {
    return <MessageSquare className="size-4" />;
  }
  return <NotebookPen className="size-4" />;
}
