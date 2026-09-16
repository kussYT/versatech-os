import { SquareCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function TasksPanel() {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <h2 className="text-section text-foreground">Tâches</h2>
      <EmptyState
        title="Aucune tâche"
        description="Les tâches du jour, de la semaine et en retard apparaîtront ici."
        aside="Organisez votre productivité."
        asideIcon={SquareCheck}
      />
    </Card>
  );
}
