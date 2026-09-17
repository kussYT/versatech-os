import { AlertTriangle, Banknote, Clock, Euro, Wallet } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatMoney } from "@/lib/crm/form-data";
import type { FinanceTotals } from "@/lib/finance";

type FinanceKpisProps = {
  totals: FinanceTotals;
};

export function FinanceKpis({ totals }: FinanceKpisProps) {
  const kpis = [
    {
      label: "CA signé",
      icon: Euro,
      hint: "Tous les devis actuellement acceptés",
      value: formatMoney(totals.signed),
      premium: true,
      tone: "gold" as const,
    },
    {
      label: "CA encaissé",
      icon: Banknote,
      hint: "Tous les paiements actuellement PAID",
      value: formatMoney(totals.collected),
      premium: true,
      tone: "prism" as const,
    },
    {
      label: "Restant à encaisser",
      icon: Wallet,
      hint: "CA signé − encaissé",
      value: formatMoney(totals.remaining),
      tone: "blue" as const,
    },
    {
      label: "En attente",
      icon: Clock,
      hint: `${totals.pendingCount} paiement${totals.pendingCount > 1 ? "s" : ""}`,
      value: formatMoney(totals.pending),
      tone: "cyan" as const,
    },
    {
      label: "En retard",
      icon: AlertTriangle,
      hint: `${totals.overdueCount} paiement${totals.overdueCount > 1 ? "s" : ""}`,
      value: formatMoney(totals.overdue),
      tone: "orange" as const,
    },
  ] as const;

  return (
    <section aria-labelledby="finance-kpi-heading">
      <h2 id="finance-kpi-heading" className="sr-only">
        Indicateurs financiers
      </h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            icon={kpi.icon}
            hint={kpi.hint}
            value={kpi.value}
            premium={"premium" in kpi && kpi.premium}
            tone={kpi.tone}
          />
        ))}
      </div>
    </section>
  );
}
