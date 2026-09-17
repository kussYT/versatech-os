import {
  CalendarDays,
  Euro,
  Kanban,
  ListTodo,
  Phone,
  RotateCcw,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatMoney } from "@/lib/crm/form-data";

type KpiZoneProps = {
  pipelineBrut: number;
  pipelineWeighted: number;
  dueFollowUps: number;
  signedRevenue: string;
  collectedRevenue: string;
  remainingRevenue: string;
  overduePayments: number;
  openTasks: number;
  callsToday: number;
  meetingsToday: number;
};

export function KpiZone({
  pipelineBrut,
  pipelineWeighted,
  dueFollowUps,
  signedRevenue,
  collectedRevenue,
  remainingRevenue,
  overduePayments,
  openTasks,
  callsToday,
  meetingsToday,
}: KpiZoneProps) {
  const kpis = [
    {
      label: "Appels",
      icon: Phone,
      hint: "Interactions appel du jour",
      value: String(callsToday),
      tone: "cyan" as const,
    },
    {
      label: "Relances",
      icon: RotateCcw,
      hint: "Échues ou prévues aujourd'hui",
      value: String(dueFollowUps),
      tone: "violet" as const,
    },
    { label: "RDV", icon: CalendarDays, hint: "Interactions RDV du jour", value: String(meetingsToday), tone: "orange" as const },
    {
      label: "Tâches",
      icon: ListTodo,
      hint: "À faire ou en cours",
      value: String(openTasks),
      tone: "blue" as const,
    },
    {
      label: "Pipeline",
      icon: Kanban,
      hint: `Pondéré ${formatMoney(pipelineWeighted)}`,
      value: formatMoney(pipelineBrut),
      premium: true,
      tone: "prism" as const,
    },
    {
      label: "CA signé",
      icon: Euro,
      hint:
        overduePayments > 0
          ? `Encaissé ${formatMoney(collectedRevenue)} · ${overduePayments} en retard`
          : `Encaissé ${formatMoney(collectedRevenue)} · restant ${formatMoney(remainingRevenue)}`,
      value: formatMoney(signedRevenue),
      premium: true,
      tone: "gold" as const,
    },
  ] as const;

  return (
    <section aria-labelledby="kpi-heading">
      <h2 id="kpi-heading" className="sr-only">
        Indicateurs
      </h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            icon={kpi.icon}
            hint={kpi.hint}
            value={"value" in kpi ? kpi.value : "—"}
            premium={"premium" in kpi}
            tone={kpi.tone}
          />
        ))}
      </div>
    </section>
  );
}
