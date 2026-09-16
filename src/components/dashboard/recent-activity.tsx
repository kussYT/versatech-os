import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function RecentActivity() {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <h2 className="text-section text-foreground">Activité récente</h2>
      <EmptyState
        title="Aucune activité"
        description="L'historique des interactions, notes et changements de statut apparaîtra ici."
        aside="Toute votre activité au même endroit."
        asideIcon={Activity}
      />
    </Card>
  );
}
