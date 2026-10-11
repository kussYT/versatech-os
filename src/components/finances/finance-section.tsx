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
          <dl className="mt-2 grid gap-1.5 text-meta sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">Devis signé</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatMoney(totals.signed)}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">Encaissé</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatMoney(totals.collected)}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">Signé non encaissé</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.signedUncollected)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">Échéances / à encaisser</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.scheduled)} · {formatMoney(totals.toCollect)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-meta text-faint">
            Les échéances suivent les paiements enregistrés. Ce ne sont pas des factures.
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
