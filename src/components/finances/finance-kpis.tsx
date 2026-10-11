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
      hint: "Devis acceptés actifs — hors abandonnés",
      value: formatMoney(totals.signed),
      premium: true,
      tone: "gold" as const,
    },
    {
      label: "Échéances",
      icon: Clock,
      hint: "Paiements non annulés. Ce n'est pas une facture.",
      value: formatMoney(totals.scheduled),
      tone: "cyan" as const,
    },
    {
      label: "À encaisser",
      icon: AlertTriangle,
      hint: `${totals.pendingCount} en attente · ${totals.overdueCount} en retard`,
      value: formatMoney(totals.toCollect),
      tone: "orange" as const,
    },
    {
      label: "CA encaissé",
      icon: Banknote,
      hint: "Paiements confirmés uniquement",
      value: formatMoney(totals.collected),
      premium: true,
      tone: "prism" as const,
    },
    {
      label: "Signé non encaissé",
      icon: Wallet,
      hint: "Prévisionnel actif : acceptés actifs − encaissements liés",
      value: formatMoney(totals.signedUncollected),
      tone: "blue" as const,
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
