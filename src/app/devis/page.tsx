import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteExplorer } from "@/components/quotes/quote-explorer";
import { listQuotes } from "@/lib/queries/quotes";

export const metadata: Metadata = {
  title: "Devis",
};

export const dynamic = "force-dynamic";

export default async function DevisPage() {
  const quotes = await listQuotes();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devis"
        description="Suivi commercial des devis, de l'envoi à l'acceptation."
      />
      <QuoteExplorer quotes={quotes} />
    </div>
  );
}
