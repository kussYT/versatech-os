import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  FileText,
  FolderKanban,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { formatMoney } from "@/lib/crm/form-data";
import type {
  DashboardActiveProjects,
  DashboardFinance,
  DashboardUrgentFollowUps,
  DashboardWaitingQuotes,
} from "@/lib/queries/dashboard-home";
import { cn } from "@/lib/cn";

type HomeKpisProps = {
  finance: DashboardFinance;
  waitingQuotes: DashboardWaitingQuotes;
  activeProjects: DashboardActiveProjects;
  urgentFollowUps: DashboardUrgentFollowUps;
};

type Kpi = {
  label: string;
  value: string;
  hint: string;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
  iconClass: string;
};

export function HomeKpis({
  finance,
  waitingQuotes,
  activeProjects,
  urgentFollowUps,
}: HomeKpisProps) {
  const urgentHintParts = [
    urgentFollowUps.count > 0
      ? `${urgentFollowUps.count} en retard`
      : null,
    urgentFollowUps.quoteCount > 0
      ? `${urgentFollowUps.quoteCount} devis`
      : null,
    urgentFollowUps.paymentHint
      ? `${urgentFollowUps.paymentHint.overdueCount} paiement${urgentFollowUps.paymentHint.overdueCount === 1 ? "" : "s"}`
      : null,
    urgentFollowUps.todayCount > 0
      ? `${urgentFollowUps.todayCount} aujourd'hui`
      : null,
  ].filter(Boolean);

  const kpis: Kpi[] = [
    {
      label: "CA encaissé",
      value: formatMoney(finance.collected),
      hint: "Paiements confirmés uniquement",
      href: "/finances",
      linkLabel: "Voir les finances",
      icon: Banknote,
      iconClass: "bg-success/15 text-success",
    },
    {
      label: "Signé non encaissé",
      value: formatMoney(finance.signedUncollected),
      hint: `Prévisionnel actif ${formatMoney(finance.signed)} · hors abandonnés`,
      href: "/finances",
      linkLabel: "Voir le détail",
      icon: Wallet,
      iconClass: "bg-primary/12 text-primary",
    },
    {
      label: "Devis en attente",
      value: String(waitingQuotes.count),
      hint: formatMoney(waitingQuotes.totalAmount),
      href: "/devis",
      linkLabel: "Voir les devis",
      icon: FileText,
      iconClass: "bg-warning/15 text-warning",
    },
    {
      label: "Projets actifs",
      value: String(activeProjects.count),
      hint:
        activeProjects.inDevelopmentCount > 0
          ? `${activeProjects.inDevelopmentCount} avec date de début`
          : "Aucun démarré avec date",
      href: "/projets",
      linkLabel: "Voir les projets",
      icon: FolderKanban,
      iconClass: "bg-purple/15 text-purple",
    },
    {
      label: "Relances urgentes",
      value: String(urgentFollowUps.count),
      hint: urgentHintParts.length > 0 ? urgentHintParts.join(" • ") : "Aucune en retard",
      href: "/relances",
      linkLabel: "Voir les relances",
      icon: AlertTriangle,
      iconClass: "bg-danger/12 text-danger",
    },
  ];

  return (
    <section aria-labelledby="home-kpi-heading">
      <h2 id="home-kpi-heading" className="sr-only">
        Indicateurs du jour
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className="glass-card group flex min-h-[9.5rem] flex-col p-3.5 sm:p-4 transition-[transform,box-shadow,background-color] duration-hover motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_12px_36px_rgb(31_41_80/0.12)]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-meta font-medium text-muted">{kpi.label}</p>
                <span
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-xl",
                    kpi.iconClass,
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" strokeWidth={1.75} />
                </span>
              </div>
              <p className="mt-3 text-[1.45rem] font-semibold tracking-tight text-foreground tabular-nums">
                {kpi.value}
              </p>
              <p className="mt-1 text-meta text-muted">{kpi.hint}</p>
              <Link
                href={kpi.href}
                className="mt-auto pt-3 text-meta font-medium text-primary transition-colors duration-hover hover:text-primary-hover"
              >
                {kpi.linkLabel} →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
