"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreatePaymentDialog } from "@/components/finances/create-payment-dialog";
import { PaymentList } from "@/components/finances/payment-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/crm/form-data";
import type { FinanceTotals } from "@/lib/finance";
import type { PaymentFormOptions, PaymentListItem } from "@/lib/queries/payments";

type FinanceSectionProps = {
  totals: FinanceTotals;
  payments: PaymentListItem[];
  options: PaymentFormOptions;
  defaultCompanyId?: string;
  defaultProjectId?: string;
  hideCompany?: boolean;
};

export function FinanceSection({
  totals,
  payments,
  options,
  defaultCompanyId,
  defaultProjectId,
  hideCompany = false,
}: FinanceSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-section text-foreground">Finances</h2>
          <p className="mt-1 text-meta text-muted">
            Signé {formatMoney(totals.signed)} · encaissé {formatMoney(totals.collected)} · restant{" "}
            {formatMoney(totals.remaining)}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Paiement
        </Button>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="Aucun paiement"
          description="Enregistrez un acompte ou un solde pour suivre l'encaissement."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Enregistrer un paiement
            </Button>
          }
        />
      ) : (
        <div className="mt-4">
          <PaymentList payments={payments} hideCompany={hideCompany} />
        </div>
      )}

      <CreatePaymentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        options={options}
        defaultCompanyId={defaultCompanyId}
        defaultProjectId={defaultProjectId}
      />
    </Card>
  );
}
