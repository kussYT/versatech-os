import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function AgendaPanel() {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <h2 className="text-section text-foreground">Agenda</h2>
      <EmptyState
        title="Aucun événement aujourd'hui"
        description="Appels, rendez-vous et échéances du jour apparaîtront ici."
        aside="Votre journée en un coup d'œil."
        asideIcon={CalendarDays}
      />
    </Card>
  );
}
