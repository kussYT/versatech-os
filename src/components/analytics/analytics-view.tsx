import {
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FolderKanban,
  Handshake,
  Phone,
  Send,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { BarList } from "@/components/analytics/bar-list";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AnalyticsReport } from "@/lib/analytics/compute";
import { formatRate } from "@/lib/analytics/rates";
import { OPPORTUNITY_STAGE_BADGE, OPPORTUNITY_STAGE_LABELS } from "@/lib/crm/constants";
import { formatMoney } from "@/lib/crm/form-data";
import { ANALYTICS_PERIOD_LABELS, formatDateTime } from "@/lib/dates";

type AnalyticsViewProps = {
  report: AnalyticsReport;
};

const STAGE_TONES = {
  TO_QUALIFY: "primary",
  TO_CONTACT: "primary",
  CONTACTED: "purple",
  INTERESTED: "warning",
  MEETING: "orange",
  QUOTE: "cyan",
  WON: "success",
  LOST: "danger",
} as const;

function SectionTitle({
  id,
  title,
  hint,
}: {
  id: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-section text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-meta text-muted">{hint}</p>
    </div>
  );
}

export function AnalyticsView({ report }: AnalyticsViewProps) {
  const { commercial, pipeline, clients, finance } = report;
  const rangeLabel =
    report.range.start && report.range.end
      ? `${formatDateTime(report.range.start)} → ${formatDateTime(report.range.end)}`
      : "Toutes les données persistées";

  const stageItems = pipeline.stages.map((stage) => ({
    key: stage.stage,
    label: OPPORTUNITY_STAGE_LABELS[stage.stage],
    display: `${stage.count} · ${formatMoney(stage.brut)}`,
    value: stage.count,
    tone: STAGE_TONES[stage.stage],
  }));

  const quoteItems = [
    {
      key: "sent",
      label: "Envoyés",
      display: String(commercial.quotesSent),
      value: commercial.quotesSent,
      tone: "cyan" as const,
    },
    {
      key: "accepted",
      label: "Acceptés",
      display: String(commercial.quotesAccepted),
      value: commercial.quotesAccepted,
      tone: "success" as const,
    },
    {
      key: "rejected",
      label: "Refusés",
      display: String(commercial.quotesRejected),
      value: commercial.quotesRejected,
      tone: "danger" as const,
    },
  ];

  const activityItems = [
    {
      key: "calls",
      label: "Appels",
      display: String(commercial.calls),
      value: commercial.calls,
      tone: "cyan" as const,
    },
    {
      key: "meetings",
      label: "RDV",
      display: String(commercial.meetings),
      value: commercial.meetings,
      tone: "orange" as const,
    },
    {
      key: "other",
      label: "Autres contacts",
      display: String(Math.max(0, commercial.contactsMade - commercial.calls - commercial.meetings)),
      value: Math.max(0, commercial.contactsMade - commercial.calls - commercial.meetings),
      tone: "purple" as const,
    },
  ];

  const financeItems = [
    {
      key: "signed",
      label: "CA signé (période)",
      display: formatMoney(finance.signedRevenue),
      value: Number(finance.signedRevenue),
      tone: "success" as const,
    },
    {
      key: "collected",
      label: "Encaissé (période)",
      display: formatMoney(finance.collected),
      value: Number(finance.collected),
      tone: "cyan" as const,
    },
    {
      key: "remaining",
      label: "Restant actuel",
      display: formatMoney(finance.remaining),
      value: Number(finance.remaining),
      tone: "warning" as const,
    },
    {
      key: "expected",
      label: "Paiements attendus",
      display: formatMoney(finance.expectedPayments),
      value: Number(finance.expectedPayments),
      tone: "orange" as const,
    },
  ];

  return (
    <div className="space-y-8">
      <p className="text-meta text-muted">
        Lecture seule · {ANALYTICS_PERIOD_LABELS[report.period]} · {rangeLabel}
      </p>

      <section aria-labelledby="analytics-commercial">
        <SectionTitle
          id="analytics-commercial"
          title="Commercial"
          hint="Flux de la période : créations, contacts et devis."
        />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 md:grid-cols-3">
          <KpiCard
            label="Prospects créés"
            icon={Building2}
            value={String(commercial.prospectsCreated)}
            hint="Entreprises créées"
            tone="cyan"
          />
          <KpiCard
            label="Contacts réalisés"
            icon={Users}
            value={String(commercial.contactsMade)}
            hint="Appels, e-mails, RDV, messages"
            tone="violet"
          />
          <KpiCard
            label="Appels"
            icon={Phone}
            value={String(commercial.calls)}
            hint="Interactions appel"
            tone="blue"
          />
          <KpiCard
            label="RDV"
            icon={Handshake}
            value={String(commercial.meetings)}
            hint="Interactions réunion"
            tone="orange"
          />
          <KpiCard
            label="Opportunités"
            icon={Target}
            value={String(commercial.opportunitiesCreated)}
            hint="Créées dans la période"
          />
          <KpiCard
            label="Devis envoyés"
            icon={Send}
            value={String(commercial.quotesSent)}
            hint="Date d'envoi"
            tone="cyan"
          />
          <KpiCard
            label="Devis acceptés"
            icon={CheckCircle2}
            value={String(commercial.quotesAccepted)}
            hint="Date d'acceptation"
            tone="prism"
          />
          <KpiCard
            label="Devis refusés"
            icon={XCircle}
            value={String(commercial.quotesRejected)}
            hint="Statut refusé, dernière MAJ"
          />
          <KpiCard
            label="Taux devis → accepté"
            icon={TrendingUp}
            value={formatRate(commercial.quoteAcceptedRate)}
            hint="Cohorte des devis envoyés"
            premium
            tone="gold"
          />
          <KpiCard
            label="Taux prospect → client"
            icon={Users}
            value={formatRate(commercial.prospectToClientRate)}
            hint="Créées dans la période, statut client"
            premium
            tone="prism"
          />
        </div>
      </section>

      <section aria-labelledby="analytics-pipeline">
        <SectionTitle
          id="analytics-pipeline"
          title="Pipeline"
          hint="Photo actuelle du pipeline, hors WON/LOST pour le brut. Gagné / perdu selon la période."
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Pipeline brut"
            icon={Briefcase}
            value={formatMoney(pipeline.brut)}
            hint={`${pipeline.openCount} opportunité${pipeline.openCount > 1 ? "s" : ""} ouverte${pipeline.openCount > 1 ? "s" : ""}`}
            premium
            tone="prism"
          />
          <KpiCard
            label="Pipeline pondéré"
            icon={TrendingUp}
            value={formatMoney(pipeline.weighted)}
            hint="Valeur × probabilité effective"
            premium
            tone="gold"
          />
          <KpiCard
            label="Gagnées"
            icon={CheckCircle2}
            value={String(pipeline.won)}
            hint="wonAt dans la période"
            tone="cyan"
          />
          <KpiCard
            label="Perdues"
            icon={XCircle}
            value={String(pipeline.lost)}
            hint="lostAt dans la période"
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <InteractiveCard className="p-4 sm:p-5">
            <h3 className="text-section text-foreground">Mix de stages</h3>
            <p className="mt-1 text-meta text-muted">Volume actuel, toutes colonnes.</p>
            <div className="mt-4">
              <BarList items={stageItems} emptyLabel="Aucune opportunité" />
            </div>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {pipeline.stages.map((stage) => (
                <li key={stage.stage}>
                  <StatusBadge
                    status={OPPORTUNITY_STAGE_BADGE[stage.stage]}
                    label={`${OPPORTUNITY_STAGE_LABELS[stage.stage]} · ${stage.count}`}
                  />
                </li>
              ))}
            </ul>
          </InteractiveCard>
          <InteractiveCard className="p-4 sm:p-5">
            <h3 className="text-section text-foreground">Activité commerciale</h3>
            <p className="mt-1 text-meta text-muted">Contacts de la période, par type.</p>
            <div className="mt-4">
              <BarList items={activityItems} emptyLabel="Aucun contact sur la période" />
            </div>
          </InteractiveCard>
        </div>
      </section>

      <section aria-labelledby="analytics-clients">
        <SectionTitle
          id="analytics-clients"
          title="Clients et projets"
          hint="Clients et projets actifs en stock ; terminés et devis moyens selon la période."
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Clients"
            icon={Building2}
            value={String(clients.clients)}
            hint="Statut client actuel"
            tone="cyan"
          />
          <KpiCard
            label="Projets actifs"
            icon={FolderKanban}
            value={String(clients.activeProjects)}
            hint="Actif, attente client, recette"
            tone="violet"
          />
          <KpiCard
            label="Projets terminés"
            icon={CheckCircle2}
            value={String(clients.completedProjects)}
            hint="completedAt dans la période"
            tone="orange"
          />
          <KpiCard
            label="Devis accepté moyen"
            icon={CircleDollarSign}
            value={clients.averageAcceptedQuote ? formatMoney(clients.averageAcceptedQuote) : "—"}
            hint="Moyenne TTC des acceptations"
            premium
            tone="gold"
          />
        </div>
      </section>

      <section aria-labelledby="analytics-finance">
        <SectionTitle
          id="analytics-finance"
          title="Finance"
          hint="CA signé et encaissé = flux de la période. Restant actuel = définition Finance (stock). MRR = contrats ACTIVE déjà commencés."
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="CA signé (période)"
            icon={CircleDollarSign}
            value={formatMoney(finance.signedRevenue)}
            hint="Devis ACCEPTED, acceptedAt dans la période"
            premium
            tone="gold"
          />
          <KpiCard
            label="Encaissé (période)"
            icon={CheckCircle2}
            value={formatMoney(finance.collected)}
            hint="Paiements PAID, paidAt dans la période"
            tone="cyan"
          />
          <KpiCard
            label="Restant actuel"
            icon={Target}
            value={formatMoney(finance.remaining)}
            hint="CA signé actuel − encaissé actuel"
            tone="orange"
          />
          <KpiCard
            label="MRR"
            icon={TrendingUp}
            value={formatMoney(finance.mrr)}
            hint="Contrats ACTIVE déjà commencés"
            premium
            tone="prism"
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <InteractiveCard className="p-4 sm:p-5">
            <h3 className="text-section text-foreground">Encaissement</h3>
            <p className="mt-1 text-meta text-muted">
              Flux période vs restant actuel (Finance) vs paiements attendus (PENDING + OVERDUE).
            </p>
            <div className="mt-4">
              <BarList items={financeItems} emptyLabel="Aucun montant financier" />
            </div>
          </InteractiveCard>
          <InteractiveCard className="p-4 sm:p-5">
            <h3 className="text-section text-foreground">Funnel devis</h3>
            <p className="mt-1 text-meta text-muted">
              Envoyés et acceptés selon la date métier ; refusés selon la dernière mise à jour.
            </p>
            <div className="mt-4">
              <BarList items={quoteItems} emptyLabel="Aucun devis sur la période" />
            </div>
          </InteractiveCard>
        </div>
      </section>
    </div>
  );
}
