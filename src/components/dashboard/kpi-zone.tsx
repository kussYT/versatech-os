import {
  CalendarDays,
  Euro,
  Kanban,
  ListTodo,
  Phone,
  RotateCcw,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";

const kpis = [
  { label: "Appels", icon: Phone, hint: "Aucun appel prévu" },
  { label: "Relances", icon: RotateCcw, hint: "0 relance", value: "0" },
  { label: "RDV", icon: CalendarDays, hint: "Aucun rendez-vous" },
  { label: "Tâches", icon: ListTodo, hint: "Aucune tâche due" },
  {
    label: "Pipeline",
    icon: Kanban,
    hint: "Aucune donnée disponible",
    premium: true,
  },
  {
    label: "CA signé",
    icon: Euro,
    hint: "Aucune donnée disponible",
    premium: true,
  },
] as const;

export function KpiZone() {
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
          />
        ))}
      </div>
    </section>
  );
}
