import type { Metadata } from "next";
import { ClientExplorer } from "@/components/clients/client-explorer";
import { PageHeader } from "@/components/layout/page-header";
import { listClientCompanies } from "@/lib/queries/clients";

export const metadata: Metadata = {
  title: "Clients",
};

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClientCompanies();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Entreprises au statut client, hors cycle commercial."
      />
      <ClientExplorer clients={clients} />
    </div>
  );
}
