import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/crm/form-data";
import type { RecentActivityItem } from "@/lib/queries/activity";

const ACTIVITY_LABELS: Record<string, string> = {
  "company.created": "Entreprise créée",
  "company.updated": "Entreprise mise à jour",
  "interaction.created": "Interaction enregistrée",
  "followup.created": "Relance planifiée",
  "followup.completed": "Relance terminée",
  "followup.rescheduled": "Relance reportée",
  "opportunity.created": "Opportunité créée",
  "opportunity.stage_changed": "Stage d'opportunité modifié",
  "quote.created": "Devis créé",
  "quote.status_changed": "Statut de devis modifié",
  "project.created": "Projet créé",
  "project.status_changed": "Statut de projet modifié",
  "task.created": "Tâche créée",
  "task.status_changed": "Statut de tâche modifié",
  "milestone.created": "Jalon créé",
  "milestone.status_changed": "Statut de jalon modifié",
  "calendar.created": "Événement créé",
  "calendar.updated": "Événement modifié",
  "repository.linked": "Repository GitHub associé",
  "repository.unlinked": "Repository GitHub retiré",
  "document.created": "Document ajouté",
  "document.updated": "Document modifié",
  "payment.created": "Paiement enregistré",
  "payment.marked_paid": "Paiement encaissé",
  "payment.status_changed": "Statut de paiement modifié",
  "maintenance.created": "Contrat de maintenance créé",
  "maintenance.updated": "Contrat de maintenance modifié",
  "maintenance.status_changed": "Statut de maintenance modifié",
};

type RecentActivityProps = {
  items: RecentActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <h2 className="text-section text-foreground">Activité récente</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Aucune activité"
          description="L'historique des interactions, notes et changements de statut apparaîtra ici."
          aside="Toute votre activité au même endroit."
          asideIcon={Activity}
        />
      ) : (
        <ol className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-background/90 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-body text-foreground">
                  {ACTIVITY_LABELS[item.action] ?? item.action}
                </p>
                {item.actorName ? (
                  <p className="mt-0.5 text-meta text-muted">{item.actorName}</p>
                ) : null}
              </div>
              <p className="font-mono text-meta text-faint">{formatDateTime(item.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
