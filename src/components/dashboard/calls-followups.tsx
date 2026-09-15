import { Clock, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function CallsFollowups() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <h2 className="text-section text-foreground">Appels</h2>
        <EmptyState
          title="Aucun appel prévu"
          description="Les prospects à contacter aujourd'hui apparaîtront ici."
          aside="Restez proche de vos opportunités."
          asideIcon={Phone}
        />
      </Card>
      <Card className="p-4 sm:p-5">
        <h2 className="text-section text-foreground">Relances</h2>
        <EmptyState
          title="0 relance"
          description="Les relances échues et à venir apparaîtront ici."
          aside="Ne laissez aucune opportunité en attente."
          asideIcon={Clock}
        />
      </Card>
    </div>
  );
}
