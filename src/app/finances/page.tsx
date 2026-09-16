import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { CreatePaymentButton } from "@/components/finances/create-payment-button";
import { FinanceKpis } from "@/components/finances/finance-kpis";
import { PaymentExplorer } from "@/components/finances/payment-explorer";
import { PageHeader } from "@/components/layout/page-header";
import {
  getFinanceSnapshot,
  listPaymentFormOptions,
  listPayments,
} from "@/lib/queries/payments";

export const metadata: Metadata = {
  title: "Finances",
};

export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const [totals, payments, options] = await Promise.all([
    getFinanceSnapshot(),
    listPayments(),
    listPaymentFormOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances"
        description="Pilotage du CA signé (devis acceptés), des encaissements et des échéances. Pas de comptabilité."
        actions={
          <CreatePaymentButton options={options}>
            <Plus className="size-4" aria-hidden="true" />
            Enregistrer un paiement
          </CreatePaymentButton>
        }
      />
      <FinanceKpis totals={totals} />
      <section className="space-y-3">
        <h2 className="text-section text-foreground">Historique des paiements</h2>
        <PaymentExplorer payments={payments} />
      </section>
    </div>
  );
}
