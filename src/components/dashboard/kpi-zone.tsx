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
  dueFollowUps: number;
};

export function KpiZone({ pipelineBrut, dueFollowUps }: KpiZoneProps) {
  const kpis = [
    { label: "Appels", icon: Phone, hint: "Aucun appel prévu", tone: "cyan" as const },
    {
      label: "Relances",
      icon: RotateCcw,
      hint: "Échues ou prévues aujourd'hui",
      value: String(dueFollowUps),
      tone: "violet" as const,
    },
    { label: "RDV", icon: CalendarDays, hint: "Aucun rendez-vous", tone: "orange" as const },
    { label: "Tâches", icon: ListTodo, hint: "Aucune tâche due", tone: "blue" as const },
    {
      label: "Pipeline",
      icon: Kanban,
      hint: "Pipeline brut",
      value: formatMoney(pipelineBrut),
      premium: true,
      tone: "prism" as const,
    },
    {
      label: "CA signé",
      icon: Euro,
      hint: "Aucune donnée disponible",
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
