"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  CalendarClock,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { ClientJourneySection } from "@/components/crm/client-journey";
import { CommercialBriefSection } from "@/components/crm/commercial-brief-section";
import { CompanyWebsiteSection } from "@/components/crm/company-website-section";
import { TerrainBar } from "@/components/crm/terrain-bar";
import { CreateOpportunityDialog } from "@/components/crm/create-opportunity-dialog";
import { EditCompanyDialog } from "@/components/crm/edit-company-dialog";
import { FollowUpDialog } from "@/components/crm/follow-up-dialog";
import { InteractionDialog } from "@/components/crm/interaction-dialog";
import { QuickInteractionPanel } from "@/components/crm/quick-interaction-panel";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectProgress } from "@/components/projects/project-progress";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { DocumentSection } from "@/components/documents/document-section";
import { CreateQuoteDialog } from "@/components/quotes/create-quote-dialog";
import { QuoteStatusActions } from "@/components/quotes/quote-status-actions";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { FinanceSection } from "@/components/finances/finance-section";
import { CompanyMaintenanceSection } from "@/components/maintenance/company-maintenance-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LifecycleBadge } from "@/components/ui/lifecycle-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  COMPANY_LIFECYCLE_LABELS,
  OPPORTUNITY_STAGE_LABELS,
  PRIORITY_LABELS,
} from "@/lib/crm/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/crm/form-data";
import { CompanyCommercial } from "@/components/crm/company-commercial";
import { CompanyInlineFields } from "@/components/crm/company-inline-fields";
import { companyProfileCompleteness } from "@/lib/crm/company-profile";
import {
  INTERACTION_DIRECTION_LABELS,
  INTERACTION_RESULT_LABELS,
  INTERACTION_TYPE_LABELS,
} from "@/lib/crm/labels";
import type { JourneyBoard } from "@/lib/crm/journey-cursor";
import type { CompanyDetail } from "@/lib/queries/companies";
import type { PaymentFormOptions } from "@/lib/queries/payments";
import type { InteractionType } from "@/generated/prisma/client";
import { projectDraftFromSale } from "@/lib/projects/draft";
import { parseCommercialBrief } from "@/lib/prospection/brief";
import { isTerrainVisit } from "@/lib/prospection/visit";

type FicheTab = "overview" | "project" | "documents" | "maintenance" | "history";

const FICHE_TABS: { id: FicheTab; label: string }[] = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "project", label: "Projet" },
  { id: "documents", label: "Documents" },
  { id: "maintenance", label: "Maintenance" },
  { id: "history", label: "Historique" },
];

type CompanyHubProps = {
  company: CompanyDetail;
  paymentOptions: PaymentFormOptions;
  journeyBoard: JourneyBoard;
};

export function CompanyHub({ company, paymentOptions, journeyBoard }: CompanyHubProps) {
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ReturnType<typeof projectDraftFromSale> | null>(null);
  const [tab, setTab] = useState<FicheTab>("overview");
  const isClient = company.lifecycleStatus === "CLIENT";
  const location = [company.city, company.postalCode].filter(Boolean).join(" ");
  const brief = parseCommercialBrief(company.commercialBrief);
  const contact = company.contacts.find((item) => item.isPrimary) ?? company.contacts[0] ?? null;
  const contactName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : null;

  return (
    <div className="space-y-6">
      <TerrainBar
        company={company}
        brief={brief}
        onCall={() => {
          if (company.phone) {
            window.location.href = `tel:${company.phone}`;
          }
          setQuickOpen(true);
        }}
        onInteraction={() => setQuickOpen(true)}
        onFollowUp={() => setFollowUpOpen(true)}
        onOpportunity={() => setOpportunityOpen(true)}
      />
      <Card className="p-4 sm:p-5">
        <PageHeader
          meta="Fiche entreprise"
          title={company.name}
          description={[
            isClient ? "Client" : "Prospect",
            COMPANY_LIFECYCLE_LABELS[company.lifecycleStatus],
            contactName,
            company.principalPrestation?.label ?? null,
            location || null,
          ].filter(Boolean).join(" · ") || undefined}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setQuickOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Interaction
              </Button>
              <Button variant="secondary" onClick={() => setFollowUpOpen(true)}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Relance
              </Button>
              <Button variant="ghost" onClick={() => setEditOpen(true)}>
                Modifier
              </Button>
              {company.phone ? (
                <a
                  href={`tel:${company.phone}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/45 px-4 text-body text-foreground transition-colors hover:bg-white/70"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  Appeler
                </a>
              ) : null}
              {company.email ? (
                <a
                  href={`mailto:${company.email}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/45 px-4 text-body text-foreground transition-colors hover:bg-white/70"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  E-mail
                </a>
              ) : null}
            </div>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LifecycleBadge status={company.lifecycleStatus} />
          <PriorityBadge
            priority={company.priority.toLowerCase() as "low" | "normal" | "medium" | "high" | "urgent"}
            label={PRIORITY_LABELS[company.priority]}
          />
          {company.nextFollowUp ? (
            <span className="rounded-full border border-white/70 bg-white/50 px-3 py-1 text-meta text-muted">
              Relance · {formatDateTime(company.nextFollowUp.dueAt)}
            </span>
          ) : null}
        </div>
      </Card>

      {quickMessage ? (
        <p className="text-meta text-muted" role="status">
          {quickMessage}
        </p>
      ) : null}

      {quickOpen ? (
        <QuickInteractionPanel
          companyId={company.id}
          onClose={() => setQuickOpen(false)}
          onOpenFullForm={() => {
            setQuickOpen(false);
            setInteractionOpen(true);
          }}
          onSaved={setQuickMessage}
        />
      ) : null}

      <div
        className="flex flex-wrap gap-1.5 rounded-[1.25rem] border border-white/70 bg-white/40 p-1.5 backdrop-blur-sm"
        role="tablist"
        aria-label="Fiche entreprise"
      >
        {FICHE_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-selected={tab === item.id}
            role="tab"
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? "rounded-full bg-white/85 px-3.5 py-2 text-meta font-medium text-foreground shadow-[0_1px_3px_rgb(31_41_80/0.08)]"
                : "rounded-full px-3.5 py-2 text-meta text-muted transition-colors hover:bg-white/50 hover:text-foreground"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
      <>
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

      <ClientJourneySection
        journey={company.journey}
        companyId={company.id}
        opportunities={company.opportunities.map((opportunity) => ({
          id: opportunity.id,
          title: opportunity.title,
        }))}
        projects={company.projects.map((project) => ({
          id: project.id,
          name: project.name,
          opportunityId: project.opportunityId,
        }))}
        board={journeyBoard}
        journeyViews={company.journeyViews}
        principalPrestation={company.principalPrestation}
      />
      {company.timeline[0] ? (
        <p className="text-meta text-muted">
          Dernière activité le {formatDateTime(company.timeline[0].at)}
        </p>
      ) : null}
      <details className="glass-card rounded-[1.25rem] px-4 py-3.5">
        <summary className="cursor-pointer text-body font-medium text-foreground">
          Fiche et brief commercial
        </summary>
        <div className="mt-4 space-y-4">
          <CompanyInfo company={company} />
          <CommercialBriefSection
            companyId={company.id}
            industry={company.industry}
            description={company.description}
            website={company.website}
            brief={brief}
          />
        </div>
      </details>
      </>
      ) : null}

      {tab === "maintenance" ? (
        <CompanyWebsiteSection model={company.websiteStatus} />
      ) : null}

      {tab === "history" ? (
      <Card className="p-5">
        <h2 className="text-section text-foreground">Historique</h2>
        {company.timeline.length === 0 ? (
          <EmptyState
            title="Aucune interaction"
            description="Enregistrez un appel, un e-mail ou une note."
            action={
              <Button size="sm" onClick={() => setQuickOpen(true)}>
                + Interaction
              </Button>
            }
          />
        ) : (
          <ol className="mt-4 space-y-3">
            {company.timeline.map((item) =>
              item.kind === "interaction" ? (
                <li
                  key={item.interaction.id}
                  className="rounded-xl border border-white/70 bg-white/50 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-muted" aria-hidden="true">
                      <InteractionIcon type={item.interaction.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-body font-medium text-foreground">
                          {isTerrainVisit(item.interaction)
                            ? "Visite terrain"
                            : interactionLabel(item.interaction.type)}
                        </p>
                        <span className="text-meta text-muted">
                          {INTERACTION_DIRECTION_LABELS[item.interaction.direction]}
                        </span>
                        {item.interaction.subject ? (
                          <span className="text-meta text-muted">· {item.interaction.subject}</span>
                        ) : null}
                        {item.interaction.result && !isTerrainVisit(item.interaction) ? (
                          <span className="text-meta text-muted">
                            · {INTERACTION_RESULT_LABELS[item.interaction.result]}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-mono text-meta text-faint">
                        {formatDateTime(item.at)}
                      </p>
                      {item.interaction.followUpDueAt ? (
                        <p className="mt-1 text-meta text-muted">
                          Relance prévue le {formatDate(item.interaction.followUpDueAt)}
                        </p>
                      ) : null}
                      {item.interaction.notes ? (
                        <p className="mt-2 text-body text-muted">{item.interaction.notes}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ) : item.kind === "quote" ? (
                <li key={item.id} className="rounded-xl border border-white/70 bg-white/50 px-4 py-3">
                  <p className="text-body font-medium text-foreground">
                    {item.toStatus === "SENT"
                      ? "Devis envoyé"
                      : item.toStatus === "ACCEPTED"
                        ? "Devis accepté"
                        : "Devis refusé"}
                  </p>
                  <p className="mt-1 text-meta text-muted">
                    {item.reference}
                    {item.amount && Number(item.amount) > 0 ? ` · ${formatMoney(item.amount)}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-meta text-faint">{formatDateTime(item.at)}</p>
                </li>
              ) : item.kind === "followUp" ? (
                <li key={item.id} className="rounded-xl border border-white/70 bg-white/50 px-4 py-3">
                  <p className="text-body font-medium text-foreground">Relance prévue</p>
                  <p className="mt-1 text-meta text-muted">
                    {item.title} · {formatDate(item.dueAt)}
                  </p>
                </li>
              ) : (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/70 bg-white/50 px-4 py-3"
                >
                  <p className="text-body font-medium text-foreground">
                    {item.kind === "stage"
                      ? item.toStage === "WON"
                        ? "Opportunité gagnée"
                        : item.toStage === "LOST"
                          ? "Opportunité perdue"
                          : "Étape commerciale"
                      : "Statut entreprise"}
                  </p>
                  <p className="mt-1 text-meta text-muted">
                    {item.kind === "stage"
                      ? `${item.title} · ${OPPORTUNITY_STAGE_LABELS[item.fromStage]} → ${OPPORTUNITY_STAGE_LABELS[item.toStage]}`
                      : `${COMPANY_LIFECYCLE_LABELS[item.from]} → ${COMPANY_LIFECYCLE_LABELS[item.to]}`}
                  </p>
                  {item.kind === "stage" && item.value && Number(item.value) > 0 ? (
                    <p className="mt-1 text-meta text-muted">{formatMoney(item.value)}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-meta text-faint">{formatDateTime(item.at)}</p>
                </li>
              ),
            )}
          </ol>
        )}
      </Card>
      ) : null}

      {tab === "project" ? (
      <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-section text-foreground">Opportunités</h2>
          <Button size="sm" variant="secondary" onClick={() => setOpportunityOpen(true)}>
            Créer
          </Button>
        </div>
        <div className="mt-4">
          <CompanyCommercial company={company} onMessage={setQuickMessage} />
        </div>
        {company.opportunities.length === 0 ? (
          <EmptyState
            title="Aucune opportunité"
            description="Une entreprise peut avoir plusieurs opportunités dans le temps."
            action={
              <Button size="sm" onClick={() => setOpportunityOpen(true)}>
                Créer une opportunité
              </Button>
            }
          />
        ) : (
          <p className="mt-3 text-meta text-muted">
            <Link href="/pipeline" className="text-primary hover:text-primary-hover">
              Voir le pipeline
            </Link>
          </p>
        )}
      </Card>

      {isClient || company.projects.length > 0 ? (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-section text-foreground">Projets</h2>
            {isClient ? (
              <Button size="sm" variant="secondary" onClick={() => {
                setProjectDraft(null);
                setProjectOpen(true);
              }}>
                Créer un projet
              </Button>
            ) : null}
          </div>
          {company.projects.length === 0 ? (
            <EmptyState
              title="Aucun projet"
              description="Passez du suivi commercial à la production en créant un projet."
              action={
                isClient ? (
                  <Button size="sm" onClick={() => {
                    setProjectDraft(null);
                    setProjectOpen(true);
                  }}>
                    Créer un projet
                  </Button>
                ) : null
              }
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {company.projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projets/${project.id}`}
                    className="flex flex-col gap-3 rounded-xl border border-white/70 bg-white/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
      </>
      ) : null}

      {tab === "documents" ? (
      <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-section text-foreground">Devis</h2>
          {company.quoteOpportunities.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setQuoteOpen(true)}>
              Créer un devis
            </Button>
          ) : null}
        </div>
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
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/50 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-body text-foreground">{quote.reference}</p>
                  <p className="mt-1 text-meta text-muted">{quote.opportunityTitle}</p>
                  <p className="mt-1 font-sans text-meta tabular-nums text-muted">
                    {formatMoney(quote.amountIncTax)}
                    {quote.sentAt ? ` · Envoyé ${formatDate(quote.sentAt)}` : ""}
                    {quote.acceptedAt ? ` · Accepté ${formatDate(quote.acceptedAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <QuoteStatusBadge status={quote.status} />
                  <QuoteStatusActions
                    quoteId={quote.id}
                    status={quote.status}
                    projectId={quote.projectId}
                    onCreateProject={
                      quote.status === "ACCEPTED" && !quote.projectId
                        ? () => {
                            setProjectDraft(
                              projectDraftFromSale({
                                companyId: company.id,
                                companyName: company.name,
                                opportunityTitle: quote.opportunityTitle,
                                quoteAmountIncTax: quote.amountIncTax,
                                quoteId: quote.id,
                              }),
                            );
                            setProjectOpen(true);
                          }
                        : undefined
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {company.lifecycleStatus === "CLIENT" ||
      company.quotes.some((quote) => quote.status === "ACCEPTED") ||
      company.payments.length > 0 ? (
        <FinanceSection
          totals={company.finance}
          payments={company.payments}
          options={paymentOptions}
          defaultCompanyId={company.id}
          hideCompany
        />
      ) : null}

      <DocumentSection
        documents={company.documents}
        companies={[{ id: company.id, name: company.name }]}
        projects={company.projects.map((project) => ({
          id: project.id,
          name: project.name,
          companyId: company.id,
        }))}
        defaultCompanyId={company.id}
      />
      </>
      ) : null}

      {tab === "maintenance" ? (
        <CompanyMaintenanceSection
          companyId={company.id}
          companyName={company.name}
          contracts={company.maintenanceContracts}
          projects={company.projects.map((project) => ({
            id: project.id,
            name: project.name,
            companyId: company.id,
          }))}
        />
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
        defaults={projectDraft}
      />
    </div>
  );
}

function CompanyInfo({ company }: { company: CompanyDetail }) {
  const contact = company.contacts[0];

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section text-foreground">Informations</h2>
        <p className="text-meta text-faint">Profil {companyProfileCompleteness(company)} %</p>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <CompanyInlineFields
          companyId={company.id}
          values={{
            email: company.email,
            phone: company.phone,
            website: company.website,
            address: company.address,
            city: company.city,
            postalCode: company.postalCode,
            instagram: company.instagram,
            linkedin: company.linkedin,
            industry: company.industry,
            source: company.source,
          }}
        />
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
