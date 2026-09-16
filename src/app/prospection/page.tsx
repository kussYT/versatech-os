import type { Metadata } from "next";
import { Building2, Phone, RotateCcw } from "lucide-react";
import { CompanyExplorer } from "@/components/crm/company-explorer";
import { NewProspectButton } from "@/components/crm/new-prospect-button";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  getProspectionSummary,
  listProspectCompanies,
} from "@/lib/queries/companies";

export const metadata: Metadata = {
  title: "Prospection",
};

export const dynamic = "force-dynamic";

export default async function ProspectionPage() {
  const [companies, summary] = await Promise.all([
    listProspectCompanies(),
    getProspectionSummary(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospection"
        description="Les entreprises encore en cycle commercial, hors clients."
        actions={<NewProspectButton>Nouveau prospect</NewProspectButton>}
      />

      <section aria-label="Résumé prospection">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Prospects actifs"
            icon={Building2}
            value={String(summary.active)}
            hint="Hors client, inactif et perdu"
          />
          <KpiCard
            label="À contacter"
            icon={Phone}
            value={String(summary.toContact)}
            hint="Statut Lead"
          />
          <KpiCard
            label="Relances dues"
            icon={RotateCcw}
            value={String(summary.dueFollowUps)}
            hint="Échues ou prévues aujourd'hui"
          />
        </div>
      </section>

      <CompanyExplorer companies={companies} variant="prospects" />
    </div>
  );
}
