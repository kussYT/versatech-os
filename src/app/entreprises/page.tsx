import type { Metadata } from "next";
import { CompanyExplorer } from "@/components/crm/company-explorer";
import { NewProspectButton } from "@/components/crm/new-prospect-button";
import { PageHeader } from "@/components/layout/page-header";
import { listAllCompanies } from "@/lib/queries/companies";

export const metadata: Metadata = {
  title: "Entreprises",
};

export const dynamic = "force-dynamic";

export default async function EntreprisesPage() {
  const companies = await listAllCompanies();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entreprises"
        description="Toutes les organisations, quel que soit leur cycle de vie."
        actions={<NewProspectButton>Nouveau prospect</NewProspectButton>}
      />
      <CompanyExplorer companies={companies} variant="all" />
    </div>
  );
}
